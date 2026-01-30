import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/useAuth";
import { useGameSession } from "@/hooks/useGameSession";
import { supabase } from "@/integrations/supabase/client";
import { formatCredits, triggerWinConfetti, getEffectiveWinProbability, decrementForcedOutcome, checkMaxProfitLimit } from "@/lib/gameUtils";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { toast } from "sonner";
import { Bomb, Diamond, Coins, RotateCcw, Grid3X3, Clock, Loader2 } from "lucide-react";

type GridSize = 'small' | 'medium' | 'large';
const GRID_CONFIG: Record<GridSize, { size: number; cols: number; maxMines: number }> = {
  small: { size: 9, cols: 3, maxMines: 8 },
  medium: { size: 16, cols: 4, maxMines: 15 },
  large: { size: 25, cols: 5, maxMines: 24 },
};

interface Tile {
  id: number;
  revealed: boolean;
  isMine: boolean;
}

export const MinesGame = () => {
  const { profile, user, updateBalance, refreshProfile } = useAuth();
  const { activeSession, loading: sessionLoading, saveSession, updateSession, clearSession, getTimeRemaining } = useGameSession('mines');
  const { playReveal, playExplosion, playWin, playBigWin, playCashout } = useSoundEffects();
  
  const [betAmount, setBetAmount] = useState(10);
  const [mineCount, setMineCount] = useState(3);
  const [gridSize, setGridSize] = useState<GridSize>('large');
  const [grid, setGrid] = useState<Tile[]>([]);
  const [gameActive, setGameActive] = useState(false);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [revealedCount, setRevealedCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [maxSafeReveals, setMaxSafeReveals] = useState<number | null>(null);
  const [clickOrder, setClickOrder] = useState<number[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [sessionRestored, setSessionRestored] = useState(false);

  const gridConfig = GRID_CONFIG[gridSize];
  const totalTiles = gridConfig.size;
  const gridCols = gridConfig.cols;
  const maxMines = gridConfig.maxMines;

  // Adjust mine count when grid size changes
  const effectiveMineCount = Math.min(mineCount, maxMines);

  // Restore session on mount
  useEffect(() => {
    if (sessionLoading || sessionRestored) return;
    
    if (activeSession && activeSession.game_state) {
      const state = activeSession.game_state;
      
      // Restore game state
      if (state.grid) setGrid(state.grid as Tile[]);
      if (state.gridSize) setGridSize(state.gridSize as GridSize);
      if (state.mineCount) setMineCount(state.mineCount as number);
      if (state.revealedCount !== undefined) setRevealedCount(state.revealedCount as number);
      if (state.currentMultiplier !== undefined) setCurrentMultiplier(state.currentMultiplier as number);
      if (state.maxSafeReveals !== undefined) setMaxSafeReveals(state.maxSafeReveals as number | null);
      if (state.clickOrder) setClickOrder(state.clickOrder as number[]);
      
      setBetAmount(activeSession.bet_amount);
      setGameActive(true);
      setGameOver(false);
      setSessionRestored(true);
      
      toast.info("🎮 Your previous game has been restored!");
    } else {
      setSessionRestored(true);
    }
  }, [activeSession, sessionLoading, sessionRestored]);

  // Update time remaining
  useEffect(() => {
    if (!gameActive) {
      setTimeRemaining(null);
      return;
    }

    const updateTime = () => {
      const remaining = getTimeRemaining();
      setTimeRemaining(remaining);
      
      // Check if time expired
      if (remaining === '0h 0m') {
        toast.warning("⏰ Game time limit reached! Auto cashing out...");
        if (revealedCount > 0) {
          cashOut();
        } else {
          handleTimeExpired();
        }
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [gameActive, getTimeRemaining, revealedCount]);

  // Max multiplier caps: 3x3=16x, 4x4=24x, 5x5=48x
  const getMaxMultiplierCap = useCallback((gridTotal: number, mines: number) => {
    const baseCap = gridTotal === 9 ? 16 : gridTotal === 16 ? 24 : 48;
    const mineRatio = mines / (gridTotal - 1);
    return Math.max(2, baseCap * (0.3 + mineRatio * 0.7));
  }, []);

  const calculateMultiplier = useCallback((revealed: number, mines: number, total: number) => {
    if (revealed === 0) return 1;
    
    const safeSpots = total - mines;
    const maxCap = getMaxMultiplierCap(total, mines);
    
    if (safeSpots <= 0) return 1;
    
    let multiplier = 1;
    const mineBonus = 1 + (mines / total) * 0.5;
    
    for (let i = 0; i < revealed; i++) {
      const remainingSafe = safeSpots - i;
      const remainingTotal = total - i;
      if (remainingSafe <= 0 || remainingTotal <= 0) break;
      const riskFactor = remainingTotal / remainingSafe;
      multiplier *= riskFactor * mineBonus;
    }
    
    if (mines >= total * 0.6) {
      multiplier *= 1 + (revealed / safeSpots) * 0.3;
    }
    
    multiplier *= 0.97;
    
    return Math.min(Math.max(multiplier, 1), maxCap);
  }, [getMaxMultiplierCap]);

  const maxPossibleMultiplier = useMemo(() => {
    const safeSpots = totalTiles - effectiveMineCount;
    return calculateMultiplier(safeSpots, effectiveMineCount, totalTiles);
  }, [effectiveMineCount, totalTiles, calculateMultiplier]);

  const handleTimeExpired = async () => {
    setGameActive(false);
    setGameOver(true);
    await clearSession();
    toast.error("Game expired without any reveals. Bet lost.");
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

    // Get effective win probability
    const { probability: winProb, forceLoss } = user?.id 
      ? await getEffectiveWinProbability('mines', user.id, betAmount)
      : { probability: 0.15, forceLoss: false };
    
    let effectiveWinProb = winProb;
    if (!forceLoss && user?.id) {
      const safeSpots = totalTiles - effectiveMineCount;
      const maxPayout = betAmount * calculateMultiplier(safeSpots, effectiveMineCount, totalTiles);
      const wouldExceedLimit = await checkMaxProfitLimit(user.id, maxPayout, profile.balance);
      if (wouldExceedLimit) {
        effectiveWinProb = 0.05;
      }
    }
    
    const safeSpots = totalTiles - effectiveMineCount;
    const calculatedMaxSafe = Math.floor(safeSpots * effectiveWinProb);
    const firstClickMineChance = 1 - effectiveWinProb;
    const hitFirstClick = Math.random() < (firstClickMineChance * 0.3);
    const finalMaxSafe = hitFirstClick ? 0 : Math.max(0, calculatedMaxSafe);

    await updateBalance(-betAmount);
    
    setMaxSafeReveals(finalMaxSafe);
    setClickOrder([]);

    const minePositions = new Set<number>();
    while (minePositions.size < effectiveMineCount) {
      minePositions.add(Math.floor(Math.random() * totalTiles));
    }

    const newGrid = Array.from({ length: totalTiles }, (_, i) => ({
      id: i,
      revealed: false,
      isMine: minePositions.has(i)
    }));

    setGrid(newGrid);
    setGameActive(true);
    setGameOver(false);
    setRevealedCount(0);
    setCurrentMultiplier(1);

    // Save session to database
    await saveSession(betAmount, {
      grid: newGrid,
      gridSize,
      mineCount: effectiveMineCount,
      revealedCount: 0,
      currentMultiplier: 1,
      maxSafeReveals: finalMaxSafe,
      clickOrder: []
    });
  };

  const revealTile = async (index: number) => {
    if (!gameActive || grid[index].revealed || gameOver) return;

    const currentReveals = revealedCount;
    const safeSpots = totalTiles - effectiveMineCount;
    
    let newGrid = [...grid];
    let tileIsMine = false;
    
    if (maxSafeReveals !== null) {
      if (currentReveals >= maxSafeReveals) {
        if (!newGrid[index].isMine) {
          const unrevealedMines = newGrid
            .map((t, i) => ({ ...t, originalIndex: i }))
            .filter(t => !t.revealed && t.isMine && t.originalIndex !== index);
          
          if (unrevealedMines.length > 0) {
            const mineToMove = unrevealedMines[Math.floor(Math.random() * unrevealedMines.length)];
            newGrid[mineToMove.originalIndex] = { ...newGrid[mineToMove.originalIndex], isMine: false };
            newGrid[index] = { ...newGrid[index], isMine: true, revealed: true };
          } else {
            newGrid[index] = { ...newGrid[index], isMine: true, revealed: true };
          }
        } else {
          newGrid[index] = { ...newGrid[index], revealed: true };
        }
        tileIsMine = true;
      } else {
        if (newGrid[index].isMine) {
          const unrevealedSafeTiles = newGrid
            .map((t, i) => ({ ...t, originalIndex: i }))
            .filter(t => !t.revealed && !t.isMine && t.originalIndex !== index);
          
          if (unrevealedSafeTiles.length > 0) {
            const randomTarget = unrevealedSafeTiles[Math.floor(Math.random() * unrevealedSafeTiles.length)];
            newGrid[randomTarget.originalIndex] = { ...newGrid[randomTarget.originalIndex], isMine: true };
          }
          newGrid[index] = { ...newGrid[index], isMine: false, revealed: true };
          tileIsMine = false;
        } else {
          newGrid[index] = { ...newGrid[index], revealed: true };
          tileIsMine = false;
        }
      }
    } else {
      tileIsMine = newGrid[index].isMine;
      newGrid[index] = { ...newGrid[index], revealed: true };
    }
    
    setGrid(newGrid);
    const newClickOrder = [...clickOrder, index];
    setClickOrder(newClickOrder);

    if (tileIsMine) {
      playExplosion();
      setGameOver(true);
      setGameActive(false);
      
      const revealedGrid = newGrid.map(t => ({
        ...t,
        revealed: t.isMine ? true : t.revealed
      }));
      setGrid(revealedGrid);

      await supabase.from('bet_logs').insert({
        user_id: profile?.id,
        game: 'mines',
        bet_amount: betAmount,
        won: false,
        payout: 0
      });

      if (user?.id) {
        await decrementForcedOutcome(user.id, false);
      }

      await clearSession();
      toast.error("💥 BOOM! You hit a mine!");
    } else {
      playReveal();
      const newRevealed = currentReveals + 1;
      setRevealedCount(newRevealed);
      const newMultiplier = calculateMultiplier(newRevealed, effectiveMineCount, totalTiles);
      setCurrentMultiplier(newMultiplier);
      
      // Update session with new state
      await updateSession({
        grid: newGrid,
        gridSize,
        mineCount: effectiveMineCount,
        revealedCount: newRevealed,
        currentMultiplier: newMultiplier,
        maxSafeReveals,
        clickOrder: newClickOrder
      });
      
      if (newRevealed >= safeSpots) {
        const payout = betAmount * newMultiplier;
        
        await supabase.from('bet_logs').insert({
          user_id: profile?.id,
          game: 'mines',
          bet_amount: betAmount,
          won: true,
          payout: payout
        });
        
        if (user?.id) {
          await decrementForcedOutcome(user.id, true);
        }
        
        await updateBalance(payout);
        triggerWinConfetti();
        playBigWin();
        toast.success(`🎉 All diamonds found! Won NPR ${payout.toFixed(2)}!`);
        
        setGrid(newGrid.map(t => ({ ...t, revealed: true })));
        setGameActive(false);
        setGameOver(true);
        await clearSession();
        await refreshProfile();
      }
    }
  };

  const cashOut = async () => {
    if (!gameActive || revealedCount === 0) return;

    playCashout();
    const payout = betAmount * currentMultiplier;
    await updateBalance(payout);
    
    await supabase.from('bet_logs').insert({
      user_id: profile?.id,
      game: 'mines',
      bet_amount: betAmount,
      won: true,
      payout: payout
    });

    if (user?.id) {
      await decrementForcedOutcome(user.id, true);
    }

    triggerWinConfetti();
    playWin();
    toast.success(`Cashed out NPR ${payout.toFixed(2)}!`);

    setGrid(grid.map(t => ({ ...t, revealed: true })));
    setGameActive(false);
    setGameOver(true);
    await clearSession();
    await refreshProfile();
  };

  const resetGame = async () => {
    setGrid([]);
    setGameActive(false);
    setGameOver(false);
    setRevealedCount(0);
    setCurrentMultiplier(1);
    setMaxSafeReveals(null);
    setClickOrder([]);
    setTimeRemaining(null);
    await clearSession();
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          <Loader2 className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-3 sm:gap-6">
      {/* Game Board */}
      <Card className="lg:col-span-2" glow="emerald">
        <CardHeader className="py-3 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-gradient-gold font-display text-lg sm:text-xl">
            <Bomb className="w-5 h-5 sm:w-6 sm:h-6" />
            Mines
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-6">
          <div 
            className="max-w-xs sm:max-w-md mx-auto"
            style={{ 
              display: 'grid',
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              gap: gridCols === 3 ? '8px' : gridCols === 4 ? '6px' : '4px'
            }}
          >
            {(gameActive || gameOver) ? (
              grid.map((tile, index) => (
                <motion.button
                  key={tile.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => revealTile(index)}
                  disabled={!gameActive || tile.revealed}
                  className={`
                    aspect-square rounded-md sm:rounded-lg flex items-center justify-center text-lg sm:text-2xl
                    transition-all duration-200
                    ${tile.revealed 
                      ? tile.isMine 
                        ? 'bg-destructive/80' 
                        : 'bg-secondary/80'
                      : 'bg-muted hover:bg-muted/80 cursor-pointer'
                    }
                    ${!tile.revealed && gameActive ? 'hover:scale-105' : ''}
                  `}
                >
                  <AnimatePresence>
                    {tile.revealed && (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                      >
                        {tile.isMine ? (
                          <Bomb className="w-5 h-5 sm:w-8 sm:h-8 text-destructive-foreground" />
                        ) : (
                          <Diamond className="w-5 h-5 sm:w-8 sm:h-8 text-secondary-foreground" />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              ))
            ) : (
              Array.from({ length: totalTiles }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-md sm:rounded-lg bg-muted/50 flex items-center justify-center"
                >
                  <span className="text-muted-foreground text-base sm:text-xl">?</span>
                </div>
              ))
            )}
          </div>

          {gameActive && (
            <div className="mt-4 sm:mt-6 text-center">
              <div className="text-2xl sm:text-3xl font-display font-bold text-secondary mb-2 sm:mb-4">
                {currentMultiplier.toFixed(2)}x
              </div>
              <div className="text-muted-foreground text-sm sm:text-base mb-3 sm:mb-4">
                Potential win: NPR {(betAmount * currentMultiplier).toFixed(2)}
              </div>
              <Button 
                variant="emerald" 
                size="lg" 
                onClick={cashOut}
                disabled={revealedCount === 0}
                className="text-sm sm:text-base"
              >
                <Coins className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Cash Out NPR {(betAmount * currentMultiplier).toFixed(2)}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <Card glow="gold">
        <CardHeader className="py-3 sm:py-4">
          <CardTitle className="font-display text-lg sm:text-xl">Game Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 p-3 sm:p-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm sm:text-base">
              <Label>Balance</Label>
              <span className="text-primary font-semibold">
                NPR {formatCredits(profile?.balance ?? 0)}
              </span>
            </div>
          </div>

          {/* Grid Size */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm sm:text-base">
              <Grid3X3 className="w-4 h-4" />
              Grid Size
            </Label>
            <div className="grid grid-cols-3 gap-1">
              {(['small', 'medium', 'large'] as GridSize[]).map((size) => (
                <Button
                  key={size}
                  variant={gridSize === size ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setGridSize(size);
                    setMineCount(Math.min(mineCount, GRID_CONFIG[size].maxMines));
                  }}
                  disabled={gameActive}
                  className="text-[10px] sm:text-xs px-1 py-1 h-auto whitespace-nowrap"
                >
                  {GRID_CONFIG[size].cols}x{GRID_CONFIG[size].cols}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Bet Amount (NPR)</Label>
            <Input
              type="number"
              min={1}
              max={profile?.balance ?? 0}
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              disabled={gameActive}
              className="text-sm sm:text-base"
            />
            <div className="grid grid-cols-4 gap-1 sm:gap-2">
              {[10, 50, 100, 500].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setBetAmount(amount)}
                  disabled={gameActive}
                  className="text-xs sm:text-sm px-1"
                >
                  {amount}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm sm:text-base">
              <Label>Mines: {effectiveMineCount}</Label>
              <span className="text-muted-foreground text-xs sm:text-sm">
                Max: {maxPossibleMultiplier.toFixed(1)}x
              </span>
            </div>
            <Slider
              value={[effectiveMineCount]}
              onValueChange={(v) => setMineCount(v[0])}
              min={1}
              max={maxMines}
              step={1}
              disabled={gameActive}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 mine (Low risk)</span>
              <span>{maxMines} mines (High risk)</span>
            </div>
          </div>

          {/* Time remaining indicator */}
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

          {!gameActive && !gameOver ? (
            <Button 
              variant="gold" 
              size="lg" 
              className="w-full text-sm sm:text-base" 
              onClick={startGame}
              disabled={!profile || betAmount > profile.balance}
            >
              Start Game
            </Button>
          ) : gameActive ? (
            <Button 
              variant="emerald" 
              size="lg" 
              className="w-full text-sm sm:text-base" 
              onClick={cashOut}
              disabled={revealedCount === 0}
            >
              <Coins className="w-4 h-4 mr-2" />
              Cash Out NPR {(betAmount * currentMultiplier).toFixed(2)}
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full text-sm sm:text-base" 
              onClick={resetGame}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              New Game
            </Button>
          )}

          <div className="p-3 sm:p-4 bg-muted/50 rounded-lg text-xs sm:text-sm text-muted-foreground">
            <p className="font-semibold mb-2 text-center">How to Play</p>
            <ul className="space-y-1 text-left pl-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Click tiles to reveal diamonds</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>Avoid the mines!</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-secondary">•</span>
                <span>Cash out anytime to secure winnings</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>More mines = Higher multiplier!</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
