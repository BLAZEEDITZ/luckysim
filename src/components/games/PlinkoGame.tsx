import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCredits, triggerWinConfetti } from "@/lib/gameUtils";
import { toast } from "sonner";
import { Circle, Coins } from "lucide-react";

const ROWS = 12;
const MULTIPLIERS = [10, 3, 1.5, 1.2, 1, 0.5, 0.3, 0.5, 1, 1.2, 1.5, 3, 10];

interface Ball {
  id: number;
  x: number;
  y: number;
  path: number[];
}

export const PlinkoGame = () => {
  const { profile, updateBalance, refreshProfile } = useAuth();
  const [betAmount, setBetAmount] = useState(1);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [dropping, setDropping] = useState(false);
  const [lastMultiplier, setLastMultiplier] = useState<number | null>(null);
  const ballIdRef = useRef(0);

  const dropBall = async () => {
    if (!profile || betAmount > profile.balance) {
      toast.error("Insufficient balance!");
      return;
    }

    if (betAmount < 1) {
      toast.error("Minimum bet is $1");
      return;
    }

    // Deduct bet
    await updateBalance(-betAmount);
    setDropping(true);

    // Generate path
    const path: number[] = [];
    let position = 6; // Start in middle
    
    for (let i = 0; i < ROWS; i++) {
      const goRight = Math.random() > 0.5;
      position = Math.max(0, Math.min(12, position + (goRight ? 1 : -1)));
      path.push(position);
    }

    const finalPosition = path[path.length - 1];
    const multiplier = MULTIPLIERS[finalPosition];
    const payout = betAmount * multiplier;
    const won = multiplier >= 1;

    // Create ball
    const newBall: Ball = {
      id: ++ballIdRef.current,
      x: 50,
      y: 0,
      path
    };

    setBalls(prev => [...prev, newBall]);

    // Animate and settle
    setTimeout(async () => {
      setLastMultiplier(multiplier);
      
      if (won) {
        await updateBalance(payout);
        if (multiplier >= 3) {
          triggerWinConfetti();
        }
        toast.success(`${multiplier}x - Won $${payout.toFixed(2)}!`);
      } else {
        toast.error(`${multiplier}x - Lost $${(betAmount - payout).toFixed(2)}`);
        await updateBalance(payout); // Return partial
      }

      // Log bet
      await supabase.from('bet_logs').insert({
        user_id: profile?.id,
        game: 'plinko',
        bet_amount: betAmount,
        won,
        payout: won ? payout : 0
      });

      await refreshProfile();
      setDropping(false);
      
      // Remove ball after animation
      setTimeout(() => {
        setBalls(prev => prev.filter(b => b.id !== newBall.id));
      }, 2000);
    }, ROWS * 150);
  };

  // Calculate peg positions
  const pegs = [];
  for (let row = 0; row < ROWS; row++) {
    const pegCount = row + 3;
    for (let col = 0; col < pegCount; col++) {
      const x = 50 + (col - (pegCount - 1) / 2) * (80 / ROWS);
      const y = 8 + (row * (84 / ROWS));
      pegs.push({ x, y, row, col });
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Game Board */}
      <Card className="lg:col-span-2" glow="royal">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gradient-gold font-display">
            <Circle className="w-6 h-6" />
            Plinko
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full aspect-[4/5] bg-gradient-to-b from-muted/30 to-muted/60 rounded-xl overflow-hidden">
            {/* Pegs */}
            {pegs.map((peg, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-primary/60 rounded-full transform -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${peg.x}%`, top: `${peg.y}%` }}
              />
            ))}

            {/* Balls */}
            <AnimatePresence>
              {balls.map((ball) => (
                <motion.div
                  key={ball.id}
                  className="absolute w-4 h-4 bg-primary rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2"
                  initial={{ left: '50%', top: '2%' }}
                  animate={{
                    left: ball.path.map((p, i) => `${15 + p * (70 / 12)}%`),
                    top: ball.path.map((_, i) => `${8 + i * (84 / ROWS)}%`),
                  }}
                  transition={{
                    duration: ROWS * 0.15,
                    times: ball.path.map((_, i) => i / (ROWS - 1)),
                    ease: "linear"
                  }}
                  style={{ zIndex: 10 }}
                />
              ))}
            </AnimatePresence>

            {/* Multiplier Buckets */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1 px-4 pb-2">
              {MULTIPLIERS.map((mult, i) => (
                <motion.div
                  key={i}
                  className={`
                    flex-1 py-2 text-center text-xs font-bold rounded-t-lg
                  ${mult >= 3 ? 'bg-secondary text-secondary-foreground' : ''}
                    ${mult >= 1 && mult < 3 ? 'bg-primary/80 text-primary-foreground' : ''}
                    ${mult < 1 ? 'bg-destructive/80 text-destructive-foreground' : ''}`}
                    ${mult >= 1 && mult < 3 ? 'bg-primary/80 text-primary-foreground' : ''}
                    ${mult < 1 ? 'bg-destructive/80 text-destructive-foreground' : ''}
                  `}
                  animate={lastMultiplier === mult ? { scale: [1, 1.2, 1] } : {}}
                >
                  {mult}x
                </motion.div>
              ))}
            </div>
          </div>

          {lastMultiplier !== null && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-center"
            >
              <div className={`text-4xl font-display font-bold ${
                lastMultiplier >= 3 ? 'text-secondary' : 
                lastMultiplier >= 1 ? 'text-primary' : 'text-destructive'
              }`}>
                {lastMultiplier}x
              </div>
              <div className="text-muted-foreground">
                {lastMultiplier >= 1 ? 'WIN' : 'LOSS'}: ${(betAmount * lastMultiplier).toFixed(2)}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <Card glow="gold">
        <CardHeader>
          <CardTitle className="font-display">Game Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Balance</Label>
              <span className="text-primary font-semibold">
                ${formatCredits(profile?.balance ?? 0)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bet Amount ($)</Label>
            <Input
              type="number"
              min={1}
              max={profile?.balance ?? 0}
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              disabled={dropping}
            />
            <div className="flex gap-2">
              {[1, 5, 10, 25].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setBetAmount(amount)}
                  disabled={dropping}
                  className="flex-1"
                >
                  ${amount}
                </Button>
              ))}
            </div>
          </div>

          <Button 
            variant="gold" 
            size="lg" 
            className="w-full" 
            onClick={dropBall}
            disabled={dropping || !profile || betAmount > profile.balance}
          >
            <Coins className="w-5 h-5 mr-2" />
            {dropping ? 'Dropping...' : 'Drop Ball'}
          </Button>

          <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <p className="font-semibold mb-2">Multipliers:</p>
            <div className="grid grid-cols-4 gap-1 text-center text-xs">
              {[...new Set(MULTIPLIERS)].sort((a, b) => b - a).map(m => (
                <span key={m} className={`px-2 py-1 rounded ${
                  m >= 3 ? 'bg-secondary/30' : 
                  m >= 1 ? 'bg-primary/30' : 'bg-destructive/30'
                }`}>
                  {m}x
                </span>
              ))}
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <p className="font-semibold mb-2">How to Play:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Drop a ball from the top</li>
              <li>Watch it bounce through pegs</li>
              <li>Win based on the bucket it lands in</li>
              <li>Edge buckets have higher multipliers!</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
