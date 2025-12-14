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
  const [maxSafeReveals, setMaxSafeReveals] = useState<number | null>(null);
  const [clickOrder, setClickOrder] = useState<number[]>([]);

  const gridConfig = GRID_CONFIG[gridSize];
  const totalTiles = gridConfig.size;
  const gridCols = gridConfig.cols;
  const maxMines = gridConfig.maxMines;

  // Adjust mine count when grid size changes
  const effectiveMineCount = Math.min(mineCount, maxMines);

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
    const safeSpots = totalTiles - effectiveMineCount;
    
    // MATHEMATICAL PROBABILITY SYSTEM:
    // Win probability determines maximum tiles player can safely reveal
    // E.g., 10% win prob on 25 tiles with 5 mines (20 safe) = max 2 safe reveals before guaranteed mine
    // Sometimes (based on probability), player hits mine on first click
    
    // Calculate max safe reveals based on win probability
    // Lower probability = fewer safe reveals allowed
    const calculatedMaxSafe = Math.floor(safeSpots * winProb);
    
    // Add randomness: sometimes allow 0 safe reveals (first click is mine)
    // This happens more often with lower win probability
    const firstClickMineChance = 1 - winProb; // e.g., 90% chance for 10% win prob
    const hitFirstClick = Math.random() < (firstClickMineChance * 0.3); // 30% of loss games hit first
    
    const finalMaxSafe = hitFirstClick ? 0 : Math.max(0, calculatedMaxSafe);
    
    console.log(`Mines: Win prob ${(winProb * 100).toFixed(1)}%, Safe spots: ${safeSpots}, Max safe reveals: ${finalMaxSafe}, First click mine: ${hitFirstClick}`);

    await updateBalance(-betAmount);
    
    // Store max safe reveals - mines will be placed dynamically
    setMaxSafeReveals(finalMaxSafe);
    setClickOrder([]);

    // Initially place mines randomly - they'll be repositioned dynamically when needed
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
  };

  const revealTile = async (index: number) => {
    if (!gameActive || grid[index].revealed || gameOver) return;

    const currentReveals = revealedCount;
    const safeSpots = totalTiles - effectiveMineCount;
    
    let newGrid = [...grid];
    let tileIsMine = false;
    
    // MATHEMATICAL PROBABILITY ENFORCEMENT:
    // maxSafeReveals determines exactly how many tiles player can safely reveal
    // If currentReveals < maxSafeReveals: player is GUARANTEED safe (relocate mine if needed)
    // If currentReveals >= maxSafeReveals: player MUST hit a mine
    
    if (maxSafeReveals !== null) {
      if (currentReveals >= maxSafeReveals) {
        // Player exceeded allowed safe reveals - FORCE this tile to be a mine
        console.log(`Forcing mine at position ${index} - exceeded max safe reveals (${currentReveals} >= ${maxSafeReveals})`);
        tileIsMine = true;
        newGrid[index] = { ...newGrid[index], isMine: true, revealed: true };
      } else {
        // Player is within safe reveal limit - GUARANTEE this tile is safe
        // If the tile was originally a mine, relocate it
        if (newGrid[index].isMine) {
          console.log(`Relocating mine from position ${index} - player within safe limit (${currentReveals} < ${maxSafeReveals})`);
          // Find an unrevealed non-mine tile to move the mine to
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
      // No probability control - use original mine placement
      tileIsMine = newGrid[index].isMine;
      newGrid[index] = { ...newGrid[index], revealed: true };
    }
    
    setGrid(newGrid);
    setClickOrder([...clickOrder, index]);

    if (tileIsMine) {
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
      const newRevealed = currentReveals + 1;
      setRevealedCount(newRevealed);
      const newMultiplier = calculateMultiplier(newRevealed, effectiveMineCount, totalTiles);
      setCurrentMultiplier(newMultiplier);
      
      // Auto cash out when all safe tiles revealed
      if (newRevealed >= safeSpots) {
        const payout = betAmount * newMultiplier;
        
        // Log bet FIRST before updating balance
        await supabase.from('bet_logs').insert({
          user_id: profile?.id,
          game: 'mines',
          bet_amount: betAmount,
          won: true,
          payout: payout
        });
        
        await updateBalance(payout);
        triggerWinConfetti();
        toast.success(`🎉 All diamonds found! Won NPR ${payout.toFixed(2)}!`);
        
        setGrid(newGrid.map(t => ({ ...t, revealed: true })));
        setGameActive(false);
        setGameOver(true);
        await refreshProfile();
      }
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
    setMaxSafeReveals(null);
    setClickOrder([]);
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
