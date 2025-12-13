import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCredits, triggerWinConfetti, getWinProbability } from "@/lib/gameUtils";
import { toast } from "sonner";
import { Bomb, Diamond, Coins, RotateCcw, Grid3X3 } from "lucide-react";

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
  const [betAmount, setBetAmount] = useState(10);
  const [mineCount, setMineCount] = useState(3);
  const [gridSize, setGridSize] = useState<GridSize>('large');
  const [grid, setGrid] = useState<Tile[]>([]);
  const [gameActive, setGameActive] = useState(false);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [revealedCount, setRevealedCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const gridConfig = GRID_CONFIG[gridSize];
  const totalTiles = gridConfig.size;
  const gridCols = gridConfig.cols;
  const maxMines = gridConfig.maxMines;

  // Adjust mine count when grid size changes
  const effectiveMineCount = Math.min(mineCount, maxMines);

  const calculateMultiplier = useCallback((revealed: number, mines: number, total: number) => {
    if (revealed === 0) return 1;
    
    const safeSpots = total - mines;
    
    // Prevent edge cases with too many mines
    if (mines >= total - 1) {
      return revealed > 0 ? Math.min(mines * 2, 50) : 1;
    }
    
    let multiplier = 1;
    
    for (let i = 0; i < revealed; i++) {
      const remainingSafe = safeSpots - i;
      const remainingTotal = total - i;
      if (remainingSafe <= 0 || remainingTotal <= 0) break;
      multiplier *= remainingTotal / remainingSafe;
    }
    
    // Apply house edge and cap multipliers fairly
    multiplier *= 0.97;
    
    // Fair caps based on mine count and grid size
    let maxMultiplier: number;
    if (mines === 1) {
      maxMultiplier = 24;
    } else if (mines >= total - 2) {
      // Second-last and last mines: cap at reasonable values
      maxMultiplier = Math.min(mines * 5, 100);
    } else {
      maxMultiplier = Math.min(mines * 12, 500);
    }
    
    return Math.min(Math.max(multiplier, 1), maxMultiplier);
  }, []);

  const maxPossibleMultiplier = useMemo(() => {
    const safeSpots = totalTiles - effectiveMineCount;
    return calculateMultiplier(safeSpots, effectiveMineCount, totalTiles);
  }, [effectiveMineCount, totalTiles, calculateMultiplier]);

  const startGame = async () => {
    if (!profile || betAmount > profile.balance) {
      toast.error("Insufficient balance!");
      return;
    }

    if (betAmount < 1) {
      toast.error("Minimum bet is NPR 1");
      return;
    }

    const winProb = await getWinProbability('mines', user?.id);
    const shouldWin = Math.random() < winProb;

    await updateBalance(-betAmount);

    const minePositions = new Set<number>();
    
    if (!shouldWin) {
      const earlyPositions = Array.from({ length: Math.min(15, totalTiles) }, (_, i) => i);
      const shuffled = earlyPositions.sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(effectiveMineCount, shuffled.length); i++) {
        minePositions.add(shuffled[i]);
      }
      while (minePositions.size < effectiveMineCount) {
        minePositions.add(Math.floor(Math.random() * totalTiles));
      }
    } else {
      while (minePositions.size < effectiveMineCount) {
        minePositions.add(Math.floor(Math.random() * totalTiles));
      }
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
  };

  const revealTile = async (index: number) => {
    if (!gameActive || grid[index].revealed || gameOver) return;

    const tile = grid[index];
    const newGrid = [...grid];
    newGrid[index] = { ...tile, revealed: true };
    setGrid(newGrid);

    if (tile.isMine) {
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

      toast.error("💥 BOOM! You hit a mine!");
    } else {
      const newRevealed = revealedCount + 1;
      setRevealedCount(newRevealed);
      const newMultiplier = calculateMultiplier(newRevealed, effectiveMineCount, totalTiles);
      setCurrentMultiplier(newMultiplier);
    }
  };

  const cashOut = async () => {
    if (!gameActive || revealedCount === 0) return;

    const payout = betAmount * currentMultiplier;
    await updateBalance(payout);
    
    await supabase.from('bet_logs').insert({
      user_id: profile?.id,
      game: 'mines',
      bet_amount: betAmount,
      won: true,
      payout: payout
    });

    triggerWinConfetti();
    toast.success(`Cashed out NPR ${payout.toFixed(2)}!`);

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
            className="gap-1 sm:gap-2 max-w-xs sm:max-w-md mx-auto"
            style={{ 
              display: 'grid',
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`
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
                  <span className="text-muted-foreground text-lg sm:text-2xl">?</span>
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
            <div className="grid grid-cols-3 gap-2">
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
                  className="text-xs capitalize"
                >
                  {size} ({GRID_CONFIG[size].cols}x{GRID_CONFIG[size].cols})
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
            <p className="font-semibold mb-2">How to Play:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Click tiles to reveal diamonds</li>
              <li>Avoid the mines!</li>
              <li>Cash out anytime to secure winnings</li>
              <li>More mines = higher multiplier (up to 1000x)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
