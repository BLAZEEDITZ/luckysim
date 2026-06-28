import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useGameSession } from "@/hooks/useGameSession";
import { supabase } from "@/integrations/supabase/client";
import {
  formatCredits,
  triggerWinConfetti,
  getEffectiveWinProbability,
  decrementForcedOutcome,
} from "@/lib/gameUtils";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { toast } from "sonner";
import { Coins, Clock, Loader2, Bird, Flame, Shield, Zap, Skull } from "lucide-react";

type Difficulty = "easy" | "medium" | "hard" | "daredevil";

interface DifficultyConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  // multiplier for lane n (1-indexed) = base^n
  base: number;
  maxLanes: number;
  // baseline survival probability per lane when admin probability is "average"
  // (used only as a visual cue / multiplier curve anchor)
  baseSurvival: number;
}

const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy:      { label: "Easy",      icon: Shield, color: "text-emerald-400", base: 1.09, maxLanes: 20, baseSurvival: 0.95 },
  medium:    { label: "Medium",    icon: Zap,    color: "text-amber-400",   base: 1.18, maxLanes: 20, baseSurvival: 0.85 },
  hard:      { label: "Hard",      icon: Flame,  color: "text-orange-500",  base: 1.35, maxLanes: 18, baseSurvival: 0.70 },
  daredevil: { label: "Daredevil", icon: Skull,  color: "text-destructive", base: 1.65, maxLanes: 15, baseSurvival: 0.55 },
};

// Build the multiplier table for a difficulty
const buildMultipliers = (d: Difficulty): number[] => {
  const cfg = DIFFICULTY_CONFIG[d];
  const arr: number[] = [];
  for (let i = 1; i <= cfg.maxLanes; i++) {
    arr.push(Number((Math.pow(cfg.base, i)).toFixed(2)));
  }
  return arr;
};

export const ChickenRoadGame = () => {
  const { profile, user, updateBalance, refreshProfile } = useAuth();
  const { activeSession, loading: sessionLoading, saveSession, updateSession, clearSession, getTimeRemaining } =
    useGameSession("chicken_road");
  const { playReveal, playExplosion, playWin, playBigWin, playCashout, playDrop } = useSoundEffects();

  const [betAmount, setBetAmount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [currentLane, setCurrentLane] = useState(0); // 0 = sidewalk start
  const [crashedLane, setCrashedLane] = useState<number | null>(null);
  const [safeLanes, setSafeLanes] = useState<boolean[]>([]); // pre-rolled outcomes
  const [maxSafeReachable, setMaxSafeReachable] = useState<number>(0); // forced cap
  const [stepping, setStepping] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [sessionRestored, setSessionRestored] = useState(false);

  const multipliers = useMemo(() => buildMultipliers(difficulty), [difficulty]);
  const maxLanes = DIFFICULTY_CONFIG[difficulty].maxLanes;
  const currentMultiplier = currentLane === 0 ? 1 : multipliers[currentLane - 1];
  const nextMultiplier = currentLane < maxLanes ? multipliers[currentLane] : null;

  // Restore session on mount
  useEffect(() => {
    if (sessionLoading || sessionRestored) return;

    if (activeSession && activeSession.game_state) {
      const s = activeSession.game_state as Record<string, unknown>;
      if (s.difficulty) setDifficulty(s.difficulty as Difficulty);
      if (typeof s.currentLane === "number") setCurrentLane(s.currentLane);
      if (Array.isArray(s.safeLanes)) setSafeLanes(s.safeLanes as boolean[]);
      if (typeof s.maxSafeReachable === "number") setMaxSafeReachable(s.maxSafeReachable);
      setBetAmount(activeSession.bet_amount);
      setGameActive(true);
      setGameOver(false);
      setSessionRestored(true);
      toast.info("🐔 Your chicken is back on the road!");
    } else {
      setSessionRestored(true);
    }
  }, [activeSession, sessionLoading, sessionRestored]);

  // Time remaining
  useEffect(() => {
    if (!gameActive) {
      setTimeRemaining(null);
      return;
    }
    const update = () => {
      const remaining = getTimeRemaining();
      setTimeRemaining(remaining);
      if (remaining === "0h 0m") {
        toast.warning("⏰ Time expired — auto cashing out!");
        if (currentLane > 0) cashOut();
        else handleTimeExpired();
      }
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameActive, currentLane]);

  const handleTimeExpired = async () => {
    setGameActive(false);
    setGameOver(true);
    await clearSession();
    toast.error("Game expired. Bet lost.");
  };

  const startGame = async () => {
    if (!profile || betAmount > profile.balance) {
      toast.error("Insufficient balance!");
      return;
    }
    if (betAmount < 1) {
      toast.error("Minimum bet is NPR 1");
      return;
    }
    if (stepping) return;
    setStepping(true);

    try {
      const maxPayout = betAmount * multipliers[multipliers.length - 1];
      const { probability: winProb, forceLoss, forceWin } = user?.id
        ? await getEffectiveWinProbability("chicken_road", user.id, betAmount, profile.balance, maxPayout)
        : { probability: 0.4, forceLoss: false, forceWin: false };

      // Decide how far the chicken can safely walk for this bet.
      // The "win" cap: at least one safe step (multiplier > 1x) — proportional to winProb.
      // Higher probability => walk further. Force-loss => 0 safe lanes.
      let safeCap: number;
      if (forceLoss) {
        safeCap = 0;
      } else if (forceWin) {
        safeCap = maxLanes; // all safe; player chooses when to cash out
      } else {
        // Map probability (0..1) to safe lanes (0..maxLanes), with mild randomness so it isn't predictable
        const target = winProb * maxLanes;
        const jitter = (Math.random() - 0.5) * 2; // ±1 lane noise
        safeCap = Math.max(0, Math.min(maxLanes, Math.round(target + jitter)));

        // Tiny chance of an instant crash even at high prob, scaled by (1-winProb)
        if (Math.random() < (1 - winProb) * 0.15) {
          safeCap = 0;
        }
      }

      // Pre-roll the lane outcomes (true = safe, false = car)
      const lanes: boolean[] = [];
      for (let i = 0; i < maxLanes; i++) lanes.push(i < safeCap);

      await updateBalance(-betAmount);
      playDrop();

      setSafeLanes(lanes);
      setMaxSafeReachable(safeCap);
      setCurrentLane(0);
      setCrashedLane(null);
      setGameActive(true);
      setGameOver(false);

      await saveSession(betAmount, {
        difficulty,
        currentLane: 0,
        safeLanes: lanes,
        maxSafeReachable: safeCap,
      });
    } finally {
      setStepping(false);
    }
  };

  const step = async () => {
    if (!gameActive || gameOver || stepping) return;
    if (currentLane >= maxLanes) return;
    setStepping(true);

    try {
      const targetLane = currentLane + 1;
      const isSafe = safeLanes[targetLane - 1];

      if (!isSafe) {
        // CRASH
        playExplosion();
        setCrashedLane(targetLane);
        setGameOver(true);
        setGameActive(false);

        await supabase.from("bet_logs").insert({
          user_id: profile?.id,
          game: "chicken_road",
          bet_amount: betAmount,
          won: false,
          payout: 0,
        });
        if (user?.id) await decrementForcedOutcome(user.id, false);
        await clearSession();
        toast.error("🚗💥 SPLAT! The chicken didn't make it.");
        return;
      }

      // Safe step
      playReveal();
      const newLane = targetLane;
      setCurrentLane(newLane);
      await updateSession({
        difficulty,
        currentLane: newLane,
        safeLanes,
        maxSafeReachable,
      });

      // If reached the very last lane → auto cash out for max win
      if (newLane >= maxLanes) {
        await cashOutInternal(newLane);
      }
    } finally {
      setStepping(false);
    }
  };

  const cashOutInternal = async (atLane: number) => {
    const mult = atLane === 0 ? 1 : multipliers[atLane - 1];
    const payout = betAmount * mult;

    playCashout();
    await updateBalance(payout);
    await supabase.from("bet_logs").insert({
      user_id: profile?.id,
      game: "chicken_road",
      bet_amount: betAmount,
      won: true,
      payout,
    });
    if (user?.id) await decrementForcedOutcome(user.id, true);

    triggerWinConfetti();
    if (mult >= 5) playBigWin();
    else playWin();

    toast.success(`🎉 Cashed out NPR ${formatCredits(payout)} at ${mult}x!`);
    setGameActive(false);
    setGameOver(true);
    await clearSession();
    await refreshProfile();
  };

  const cashOut = async () => {
    if (!gameActive || currentLane === 0 || stepping) return;
    setStepping(true);
    try {
      await cashOutInternal(currentLane);
    } finally {
      setStepping(false);
    }
  };

  const resetGame = async () => {
    setGameActive(false);
    setGameOver(false);
    setCurrentLane(0);
    setCrashedLane(null);
    setSafeLanes([]);
    setMaxSafeReachable(0);
    setTimeRemaining(null);
    await clearSession();
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
          <Loader2 className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-3 sm:gap-6">
      {/* Game Board */}
      <Card className="lg:col-span-2" glow="gold">
        <CardHeader className="py-3 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-gradient-gold font-display text-lg sm:text-xl">
            <Bird className="w-5 h-5 sm:w-6 sm:h-6" />
            Chicken Road
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-4">
          {/* Road */}
          <div
            className="relative rounded-xl overflow-hidden border border-primary/30"
            style={{
              background:
                "linear-gradient(180deg, #0a0a0f 0%, #1a1a24 50%, #0a0a0f 100%)",
              minHeight: 320,
            }}
          >
            {/* Sidewalk start */}
            <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-16 bg-gradient-to-r from-primary/20 to-transparent border-r-2 border-dashed border-primary/40 z-10 flex items-center justify-center">
              <span className="text-[10px] sm:text-xs text-primary font-bold rotate-[-90deg] whitespace-nowrap">
                START
              </span>
            </div>
            {/* Sidewalk end */}
            <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-16 bg-gradient-to-l from-secondary/20 to-transparent border-l-2 border-dashed border-secondary/40 z-10 flex items-center justify-center">
              <span className="text-[10px] sm:text-xs text-secondary font-bold rotate-90 whitespace-nowrap">
                GOAL
              </span>
            </div>

            {/* Lanes scroll container */}
            <div
              className="flex items-stretch gap-1 px-14 sm:px-20 py-4 overflow-x-auto"
              style={{ scrollbarWidth: "thin" }}
            >
              {Array.from({ length: maxLanes }).map((_, idx) => {
                const laneNum = idx + 1;
                const passed = currentLane >= laneNum;
                const isCurrent = currentLane === laneNum;
                const crashed = crashedLane === laneNum;
                const mult = multipliers[idx];

                return (
                  <div
                    key={laneNum}
                    className={`relative flex-shrink-0 w-16 sm:w-20 h-48 sm:h-56 rounded-md border-2 border-dashed transition-all
                      ${crashed
                        ? "bg-destructive/40 border-destructive"
                        : passed
                          ? "bg-emerald-500/15 border-emerald-500/60"
                          : "bg-muted/30 border-muted-foreground/30"}
                    `}
                  >
                    {/* Lane number + multiplier */}
                    <div className="absolute top-1 left-0 right-0 text-center">
                      <div className="text-[10px] text-muted-foreground">Lane {laneNum}</div>
                      <div
                        className={`text-xs sm:text-sm font-bold ${
                          mult >= 10
                            ? "text-secondary"
                            : mult >= 3
                              ? "text-primary"
                              : "text-amber-400"
                        }`}
                      >
                        {mult}x
                      </div>
                    </div>

                    {/* Car (only shown on crash lane) */}
                    {crashed && (
                      <motion.div
                        initial={{ x: -100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center text-3xl sm:text-4xl"
                      >
                        🚗
                      </motion.div>
                    )}

                    {/* Chicken */}
                    {isCurrent && !crashed && (
                      <motion.div
                        key={`chicken-${currentLane}`}
                        initial={{ y: -10, scale: 0.8 }}
                        animate={{ y: [0, -6, 0], scale: 1 }}
                        transition={{ y: { repeat: Infinity, duration: 0.8 }, scale: { duration: 0.2 } }}
                        className="absolute inset-x-0 bottom-3 flex items-center justify-center text-3xl sm:text-4xl drop-shadow-[0_0_10px_rgba(255,215,0,0.7)]"
                      >
                        🐔
                      </motion.div>
                    )}

                    {/* Passed marker */}
                    {passed && !isCurrent && (
                      <div className="absolute inset-x-0 bottom-3 flex items-center justify-center text-2xl opacity-60">
                        🐾
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Chicken at start if currentLane === 0 */}
            {currentLane === 0 && gameActive && (
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="absolute left-2 sm:left-3 bottom-6 text-3xl sm:text-4xl z-20 drop-shadow-[0_0_10px_rgba(255,215,0,0.7)]"
              >
                🐔
              </motion.div>
            )}
          </div>

          {/* Status */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 text-center">
            <div className="p-2 sm:p-3 rounded-lg bg-muted/40">
              <div className="text-[10px] sm:text-xs text-muted-foreground">Current</div>
              <div className="text-lg sm:text-2xl font-display font-bold text-secondary">
                {currentMultiplier.toFixed(2)}x
              </div>
            </div>
            <div className="p-2 sm:p-3 rounded-lg bg-muted/40">
              <div className="text-[10px] sm:text-xs text-muted-foreground">Next</div>
              <div className="text-lg sm:text-2xl font-display font-bold text-primary">
                {nextMultiplier ? `${nextMultiplier.toFixed(2)}x` : "MAX"}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1 p-2 sm:p-3 rounded-lg bg-muted/40">
              <div className="text-[10px] sm:text-xs text-muted-foreground">Potential Win</div>
              <div className="text-lg sm:text-2xl font-display font-bold text-emerald-400">
                NPR {formatCredits(Math.floor(betAmount * currentMultiplier))}
              </div>
            </div>
          </div>

          {gameActive && (
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <Button
                variant="gold"
                size="lg"
                className="flex-1 text-sm sm:text-base"
                onClick={step}
                disabled={stepping || currentLane >= maxLanes}
              >
                <Bird className="w-4 h-4 mr-2" />
                Step Forward → {nextMultiplier ? `${nextMultiplier}x` : "MAX"}
              </Button>
              <Button
                variant="emerald"
                size="lg"
                className="flex-1 text-sm sm:text-base"
                onClick={cashOut}
                disabled={currentLane === 0 || stepping}
              >
                <Coins className="w-4 h-4 mr-2" />
                Cash Out NPR {formatCredits(Math.floor(betAmount * currentMultiplier))}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <Card glow="emerald">
        <CardHeader className="py-3 sm:py-4">
          <CardTitle className="font-display text-lg sm:text-xl">Game Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 p-3 sm:p-6">
          <div className="flex justify-between text-sm sm:text-base">
            <Label>Balance</Label>
            <span className="text-primary font-semibold">
              NPR {formatCredits(profile?.balance ?? 0)}
            </span>
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Difficulty</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((d) => {
                const cfg = DIFFICULTY_CONFIG[d];
                const Icon = cfg.icon;
                const active = difficulty === d;
                return (
                  <Button
                    key={d}
                    variant={active ? "gold" : "outline"}
                    size="sm"
                    onClick={() => setDifficulty(d)}
                    disabled={gameActive}
                    className={`flex flex-col items-center gap-1 h-auto py-2 ${active ? "" : cfg.color}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] sm:text-xs">{cfg.label}</span>
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Max: {multipliers[multipliers.length - 1]}x · {maxLanes} lanes
            </p>
          </div>

          {/* Bet */}
          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Bet Amount (NPR)</Label>
            <Input
              type="number"
              min={1}
              max={profile?.balance ?? 0}
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value)))}
              disabled={gameActive}
              className="text-sm sm:text-base"
            />
            <div className="grid grid-cols-4 gap-1">
              {[10, 50, 100, 500].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setBetAmount(amount)}
                  disabled={gameActive}
                  className="text-xs px-1"
                >
                  {amount}
                </Button>
              ))}
            </div>
          </div>

          {/* Time remaining */}
          {gameActive && timeRemaining && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 p-2 bg-muted/50 rounded-lg text-sm text-muted-foreground"
            >
              <Clock className="w-4 h-4" />
              <span>Time left: {timeRemaining}</span>
            </motion.div>
          )}

          {!gameActive ? (
            <Button
              variant="gold"
              size="lg"
              className="w-full text-sm sm:text-base"
              onClick={gameOver ? resetGame : startGame}
              disabled={stepping || !profile || betAmount > (profile?.balance ?? 0)}
            >
              {gameOver ? "New Game" : stepping ? "Starting..." : "Start Run"}
            </Button>
          ) : null}

          <div className="p-3 sm:p-4 bg-muted/50 rounded-lg text-xs sm:text-sm text-muted-foreground">
            <p className="font-semibold mb-2 text-center">How to Play</p>
            <ul className="space-y-1 text-left pl-2">
              <li>🐔 Help the chicken cross the road one lane at a time</li>
              <li>📈 Each safe step grows your multiplier</li>
              <li>🚗 If a car comes — you lose it all</li>
              <li>💰 Cash out any time to lock in winnings</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
