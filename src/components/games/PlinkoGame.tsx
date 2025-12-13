import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCredits, triggerWinConfetti } from "@/lib/gameUtils";
import { toast } from "sonner";
import { Circle, Zap, Shield, Flame } from "lucide-react";

type RiskLevel = 'low' | 'medium' | 'high';

// Multipliers for each risk level - edge buckets have highest multipliers
const MULTIPLIER_SETS: Record<RiskLevel, number[]> = {
  low: [5.6, 2.1, 1.1, 1, 0.5, 0.3, 0.5, 1, 1.1, 2.1, 5.6],
  medium: [25, 8, 3, 1.5, 0.5, 0.2, 0.5, 1.5, 3, 8, 25],
  high: [1000, 130, 26, 9, 4, 0.2, 4, 9, 26, 130, 1000]
};

const RISK_CONFIG: Record<RiskLevel, { label: string; icon: React.ElementType; color: string }> = {
  low: { label: 'Low Risk', icon: Shield, color: 'text-secondary' },
  medium: { label: 'Medium Risk', icon: Zap, color: 'text-amber-400' },
  high: { label: 'High Risk', icon: Flame, color: 'text-destructive' }
};

const ROWS = 10;

interface Ball {
  id: number;
  x: number;
  y: number;
}

interface BallPath {
  id: number;
  positions: { x: number; y: number }[];
  currentIndex: number;
}

export const PlinkoGame = () => {
  const { profile, updateBalance, refreshProfile } = useAuth();
  const [betAmount, setBetAmount] = useState(10);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('medium');
  const [ballPaths, setBallPaths] = useState<BallPath[]>([]);
  const [dropping, setDropping] = useState(false);
  const [lastMultiplier, setLastMultiplier] = useState<number | null>(null);
  const [lastBucketIndex, setLastBucketIndex] = useState<number | null>(null);
  const ballIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 360, height: 420 });

  const multipliers = MULTIPLIER_SETS[riskLevel];

  // Responsive sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = Math.min(containerRef.current.offsetWidth - 16, 380);
        setDimensions({ width, height: Math.floor(width * 1.15) });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const { width: boardWidth, height: boardHeight } = dimensions;
  const pegSpacing = boardWidth / (ROWS + 3);
  const startY = 35;
  const endY = boardHeight - 55;
  const rowHeight = (endY - startY) / ROWS;

  // Calculate peg positions
  const getPegPositions = useCallback(() => {
    const pegs: { x: number; y: number; row: number; col: number }[] = [];

    for (let row = 0; row < ROWS; row++) {
      const pegCount = row + 3;
      const rowWidth = (pegCount - 1) * pegSpacing;
      const startX = (boardWidth - rowWidth) / 2;
      const y = startY + row * rowHeight;
      
      for (let col = 0; col < pegCount; col++) {
        pegs.push({
          x: startX + col * pegSpacing,
          y: y,
          row,
          col
        });
      }
    }
    return pegs;
  }, [boardWidth, pegSpacing, rowHeight]);

  // Pre-calculate ball path using deterministic simulation
  const generateBallPath = useCallback(() => {
    const positions: { x: number; y: number }[] = [];
    let currentX = boardWidth / 2;
    
    // Start position
    positions.push({ x: currentX, y: 10 });
    
    // Simulate each row
    for (let row = 0; row < ROWS; row++) {
      const pegCount = row + 3;
      const rowWidth = (pegCount - 1) * pegSpacing;
      const startX = (boardWidth - rowWidth) / 2;
      const y = startY + row * rowHeight;
      
      // Ball goes left or right randomly
      const goRight = Math.random() > 0.5;
      const halfSpacing = pegSpacing / 2;
      
      // Add bounce effect - go to peg first
      positions.push({ x: currentX, y: y - 5 });
      
      // Then deflect
      if (goRight) {
        currentX += halfSpacing + (Math.random() * 4 - 2);
      } else {
        currentX -= halfSpacing + (Math.random() * 4 - 2);
      }
      
      // Clamp to board bounds
      currentX = Math.max(25, Math.min(boardWidth - 25, currentX));
      
      // Position after bounce
      positions.push({ x: currentX, y: y + rowHeight * 0.6 });
    }
    
    // Determine final bucket
    const bucketWidth = (boardWidth - 20) / multipliers.length;
    let bucketIndex = Math.floor((currentX - 10) / bucketWidth);
    bucketIndex = Math.max(0, Math.min(multipliers.length - 1, bucketIndex));
    
    // Final position centered in bucket
    const finalX = 10 + (bucketIndex + 0.5) * bucketWidth;
    positions.push({ x: finalX, y: endY + 15 });
    
    return { positions, bucketIndex };
  }, [boardWidth, pegSpacing, rowHeight, multipliers.length, startY, endY]);

  // Animate ball along pre-calculated path
  const animateBall = useCallback((path: { x: number; y: number }[], ballId: number): Promise<void> => {
    return new Promise((resolve) => {
      setBallPaths(prev => [...prev, { id: ballId, positions: path, currentIndex: 0 }]);
      
      let index = 0;
      const speed = 45; // ms per position
      
      const interval = setInterval(() => {
        index++;
        if (index >= path.length) {
          clearInterval(interval);
          setTimeout(() => {
            setBallPaths(prev => prev.filter(b => b.id !== ballId));
            resolve();
          }, 600);
          return;
        }
        
        setBallPaths(prev => prev.map(b => 
          b.id === ballId ? { ...b, currentIndex: index } : b
        ));
      }, speed);
    });
  }, []);

  const dropBall = async () => {
    if (!profile || betAmount > profile.balance) {
      toast.error("Insufficient balance!");
      return;
    }

    if (betAmount < 1) {
      toast.error("Minimum bet is NPR 1");
      return;
    }

    await updateBalance(-betAmount);
    setDropping(true);
    setLastMultiplier(null);
    setLastBucketIndex(null);

    const ballId = ++ballIdRef.current;
    const { positions, bucketIndex } = generateBallPath();
    
    // Animate ball
    await animateBall(positions, ballId);
    
    const multiplier = multipliers[bucketIndex];
    const payout = betAmount * multiplier;
    const won = multiplier >= 1;

    setLastMultiplier(multiplier);
    setLastBucketIndex(bucketIndex);

    if (payout > 0) {
      await updateBalance(payout);
    }

    if (multiplier >= 5) {
      triggerWinConfetti();
      toast.success(`🎉 ${multiplier}x - Won NPR ${formatCredits(payout)}!`);
    } else if (multiplier >= 1) {
      toast.success(`${multiplier}x - Won NPR ${formatCredits(payout)}!`);
    } else {
      toast.error(`${multiplier}x - Returned NPR ${formatCredits(payout)}`);
    }

    await supabase.from('bet_logs').insert({
      user_id: profile?.id,
      game: 'plinko',
      bet_amount: betAmount,
      won,
      payout
    });

    await refreshProfile();
    setDropping(false);
  };

  const pegs = getPegPositions();
  const bucketWidth = (boardWidth - 20) / multipliers.length;

  // Get current ball positions for rendering
  const currentBalls = ballPaths.map(bp => ({
    id: bp.id,
    ...bp.positions[bp.currentIndex]
  }));

  return (
    <div className="grid lg:grid-cols-3 gap-3 sm:gap-6">
      {/* Game Board */}
      <Card className="lg:col-span-2 overflow-hidden">
        <CardHeader className="py-3 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-gradient-gold font-display text-lg sm:text-xl">
            <Circle className="w-5 h-5 sm:w-6 sm:h-6" />
            Plinko
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-4" ref={containerRef}>
          <div 
            className="relative mx-auto bg-gradient-to-b from-muted/40 to-muted/70 rounded-xl overflow-hidden border border-border/40"
            style={{ width: `${boardWidth}px`, height: `${boardHeight}px` }}
          >
            {/* Pegs */}
            {pegs.map((peg, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 sm:w-2.5 sm:h-2.5 bg-primary/70 rounded-full"
                style={{ 
                  left: peg.x,
                  top: peg.y,
                  transform: 'translate(-50%, -50%)'
                }}
              />
            ))}

            {/* Balls */}
            <AnimatePresence>
              {currentBalls.map((ball) => (
                <motion.div
                  key={ball.id}
                  className="absolute w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-br from-amber-300 via-primary to-amber-500 rounded-full shadow-lg border-2 border-amber-200"
                  style={{ 
                    left: ball.x,
                    top: ball.y,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 20
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
              ))}
            </AnimatePresence>

            {/* Multiplier Buckets */}
            <div className="absolute bottom-0 left-[10px] right-[10px] flex gap-[2px] pb-1" style={{ height: '44px' }}>
              {multipliers.map((mult, i) => {
                const isHighlight = lastBucketIndex === i;
                const isHigh = mult >= 25;
                const isMed = mult >= 3 && mult < 25;
                const isLow = mult >= 1 && mult < 3;
                
                return (
                  <motion.div
                    key={i}
                    className={`
                      flex-1 flex items-center justify-center font-bold rounded-t-md border-t-2 text-[8px] sm:text-[10px]
                      ${isHigh ? 'bg-gradient-to-b from-secondary to-secondary/70 text-secondary-foreground border-secondary' : ''}
                      ${isMed ? 'bg-gradient-to-b from-primary to-primary/70 text-primary-foreground border-primary' : ''}
                      ${isLow ? 'bg-gradient-to-b from-amber-500 to-amber-600 text-white border-amber-400' : ''}
                      ${mult < 1 ? 'bg-gradient-to-b from-destructive/80 to-destructive text-destructive-foreground border-destructive' : ''}
                    `}
                    animate={isHighlight ? { 
                      scale: [1, 1.15, 1],
                      boxShadow: ['0 0 0px rgba(255,215,0,0)', '0 0 25px rgba(255,215,0,1)', '0 0 0px rgba(255,215,0,0)']
                    } : {}}
                    transition={{ duration: 0.6 }}
                  >
                    {mult >= 1000 ? '1000x' : `${mult}x`}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {lastMultiplier !== null && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-center"
            >
              <div className={`text-3xl sm:text-5xl font-display font-bold ${
                lastMultiplier >= 25 ? 'text-secondary animate-pulse' : 
                lastMultiplier >= 3 ? 'text-primary' : 
                lastMultiplier >= 1 ? 'text-amber-400' : 'text-destructive'
              }`}>
                {lastMultiplier}x
              </div>
              <div className="text-muted-foreground text-sm sm:text-base mt-1">
                {lastMultiplier >= 1 ? '🎉 WIN' : 'RETURN'}: NPR {formatCredits(betAmount * lastMultiplier)}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardHeader className="py-3 sm:py-4">
          <CardTitle className="font-display text-lg sm:text-xl">Game Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-3 sm:p-6">
          <div className="flex justify-between text-sm sm:text-base">
            <Label>Balance</Label>
            <span className="text-primary font-semibold">
              NPR {formatCredits(profile?.balance ?? 0)}
            </span>
          </div>

          {/* Risk Level Selection */}
          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Risk Level</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(RISK_CONFIG) as RiskLevel[]).map((level) => {
                const config = RISK_CONFIG[level];
                const Icon = config.icon;
                const isActive = riskLevel === level;
                
                return (
                  <Button
                    key={level}
                    variant={isActive ? (level === 'high' ? 'destructive' : level === 'low' ? 'emerald' : 'gold') : 'outline'}
                    size="sm"
                    onClick={() => setRiskLevel(level)}
                    disabled={dropping}
                    className={`flex flex-col items-center gap-1 h-auto py-2 ${isActive ? '' : config.color}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] sm:text-xs">{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {riskLevel === 'high' ? 'Max: 1000x multiplier!' : riskLevel === 'medium' ? 'Max: 25x multiplier' : 'Max: 5.6x multiplier'}
            </p>
          </div>

          {/* Bet Amount */}
          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Bet Amount (NPR)</Label>
            <Input
              type="number"
              min={1}
              max={profile?.balance ?? 0}
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              disabled={dropping}
              className="text-sm sm:text-base"
            />
            <div className="grid grid-cols-4 gap-1">
              {[10, 50, 100, 500].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setBetAmount(amount)}
                  disabled={dropping}
                  className="text-xs px-1"
                >
                  {amount}
                </Button>
              ))}
            </div>
          </div>

          <Button 
            variant="gold" 
            size="lg" 
            className="w-full text-sm sm:text-base font-bold" 
            onClick={dropBall}
            disabled={dropping || !profile || betAmount > profile.balance}
          >
            {dropping ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                ⚪
              </motion.span>
            ) : '⚪'} 
            {dropping ? ' Dropping...' : ' Drop Ball'}
          </Button>

          {/* Multipliers Display */}
          <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            <p className="font-semibold mb-2">Multipliers ({riskLevel}):</p>
            <div className="flex flex-wrap gap-1 justify-center">
              {[...new Set(multipliers)].sort((a, b) => b - a).map(m => (
                <span key={m} className={`px-2 py-0.5 rounded text-[10px] ${
                  m >= 25 ? 'bg-secondary/40 text-secondary-foreground' : 
                  m >= 3 ? 'bg-primary/40' : 
                  m >= 1 ? 'bg-amber-500/30' : 'bg-destructive/30'
                }`}>
                  {m}x
                </span>
              ))}
            </div>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            <p className="font-semibold mb-1">How to Play:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Choose risk level (higher = bigger wins)</li>
              <li>Drop ball & watch it bounce</li>
              <li>Edge buckets = highest rewards!</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
