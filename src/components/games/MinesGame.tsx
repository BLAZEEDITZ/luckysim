import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCredits, triggerWinConfetti, checkWin } from "@/lib/gameUtils";
import { toast } from "sonner";
import { Bomb, Diamond, Coins, RotateCcw } from "lucide-react";

const GRID_SIZE = 25;

interface Tile {
  id: number;
  revealed: boolean;
  isMine: boolean;
}

export const MinesGame = () => {
  const { profile, updateBalance, refreshProfile } = useAuth();
  const [betAmount, setBetAmount] = useState(1);
  const [mineCount, setMineCount] = useState(5);
  const [grid, setGrid] = useState<Tile[]>([]);
  const [gameActive, setGameActive] = useState(false);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [revealedCount, setRevealedCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const calculateMultiplier = useCallback((revealed: number, mines: number) => {
    const safeSpots = GRID_SIZE - mines;
    let multiplier = 1;
    for (let i = 0; i < revealed; i++) {
      multiplier *= safeSpots / (safeSpots - i);
    }
    return Math.min(multiplier * 0.97, 100); // House edge + cap
  }, []);

  const startGame = async () => {
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

    // Generate mines
    const minePositions = new Set<number>();
    while (minePositions.size < mineCount) {
      minePositions.add(Math.floor(Math.random() * GRID_SIZE));
    }

    const newGrid = Array.from({ length: GRID_SIZE }, (_, i) => ({
      id: i,
      revealed: false,
      isMine: minePositions.has(i)
    }));

    setGrid(newGrid);
    setGameActive(true);
    setGameOver(false);
    setRevealedCount(0);
    setCurrentMultiplier(1);
  };

  const revealTile = async (index: number) => {
    if (!gameActive || grid[index].revealed || gameOver) return;

    const tile = grid[index];
    const newGrid = [...grid];
    newGrid[index] = { ...tile, revealed: true };
    setGrid(newGrid);

    if (tile.isMine) {
      // Hit a mine - game over
      setGameOver(true);
      setGameActive(false);
      
      // Reveal all mines
      const revealedGrid = newGrid.map(t => ({
        ...t,
        revealed: t.isMine ? true : t.revealed
      }));
      setGrid(revealedGrid);

      // Log bet
      await supabase.from('bet_logs').insert({
        user_id: profile?.id,
        game: 'mines',
        bet_amount: betAmount,
        won: false,
        payout: 0
      });

      toast.error("💥 BOOM! You hit a mine!");
    } else {
      // Safe tile
      const newRevealed = revealedCount + 1;
      setRevealedCount(newRevealed);
      const newMultiplier = calculateMultiplier(newRevealed, mineCount);
      setCurrentMultiplier(newMultiplier);
    }
  };

  const cashOut = async () => {
    if (!gameActive || revealedCount === 0) return;

    const payout = betAmount * currentMultiplier;
    await updateBalance(payout);
    
    // Log win
    await supabase.from('bet_logs').insert({
      user_id: profile?.id,
      game: 'mines',
      bet_amount: betAmount,
      won: true,
      payout: payout
    });

    triggerWinConfetti();
    toast.success(`Cashed out $${payout.toFixed(2)}!`);

    // Reveal all tiles
    setGrid(grid.map(t => ({ ...t, revealed: true })));
    setGameActive(false);
    setGameOver(true);
    await refreshProfile();
  };

  const resetGame = () => {
    setGrid([]);
    setGameActive(false);
    setGameOver(false);
    setRevealedCount(0);
    setCurrentMultiplier(1);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Game Board */}
      <Card className="lg:col-span-2" glow="emerald">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gradient-gold font-display">
            <Bomb className="w-6 h-6" />
            Mines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2 max-w-md mx-auto">
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
                    aspect-square rounded-lg flex items-center justify-center text-2xl
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
                          <Bomb className="w-8 h-8 text-destructive-foreground" />
                        ) : (
                          <Diamond className="w-8 h-8 text-secondary-foreground" />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              ))
            ) : (
              Array.from({ length: GRID_SIZE }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-lg bg-muted/50 flex items-center justify-center"
                >
                  <span className="text-muted-foreground text-2xl">?</span>
                </div>
              ))
            )}
          </div>

          {gameActive && (
            <div className="mt-6 text-center">
              <div className="text-3xl font-display font-bold text-secondary mb-4">
                {currentMultiplier.toFixed(2)}x
              </div>
              <div className="text-muted-foreground mb-4">
                Potential win: ${(betAmount * currentMultiplier).toFixed(2)}
              </div>
              <Button 
                variant="emerald" 
                size="lg" 
                onClick={cashOut}
                disabled={revealedCount === 0}
              >
                <Coins className="w-5 h-5 mr-2" />
                Cash Out ${(betAmount * currentMultiplier).toFixed(2)}
              </Button>
            </div>
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
              disabled={gameActive}
            />
            <div className="flex gap-2">
              {[1, 5, 10, 25].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setBetAmount(amount)}
                  disabled={gameActive}
                  className="flex-1"
                >
                  ${amount}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Mines: {mineCount}</Label>
              <span className="text-muted-foreground text-sm">
                Safe tiles: {GRID_SIZE - mineCount}
              </span>
            </div>
            <Slider
              value={[mineCount]}
              onValueChange={(v) => setMineCount(v[0])}
              min={1}
              max={24}
              step={1}
              disabled={gameActive}
            />
          </div>

          {!gameActive && !gameOver ? (
            <Button 
              variant="gold" 
              size="lg" 
              className="w-full" 
              onClick={startGame}
              disabled={!profile || betAmount > profile.balance}
            >
              Start Game
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full" 
              onClick={resetGame}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              New Game
            </Button>
          )}

          <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <p className="font-semibold mb-2">How to Play:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Click tiles to reveal diamonds</li>
              <li>Avoid the mines!</li>
              <li>Cash out anytime to secure your winnings</li>
              <li>More mines = higher multiplier</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
