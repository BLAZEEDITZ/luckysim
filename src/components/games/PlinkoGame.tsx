import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCredits, triggerWinConfetti, getEffectiveWinProbability, decrementForcedOutcome, checkMaxProfitLimit } from "@/lib/gameUtils";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { toast } from "sonner";
import { Circle, Zap, Shield, Flame } from "lucide-react";

type RiskLevel = 'low' | 'medium' | 'high';
type RowCount = 8 | 12 | 16;

// Fair multipliers - capped at reasonable values
const MULTIPLIER_SETS: Record<RowCount, Record<RiskLevel, number[]>> = {
  8: {
    low: [3, 1.5, 1.1, 1, 0.5, 1, 1.1, 1.5, 3],
    medium: [8, 2.5, 1.3, 0.7, 0.4, 0.7, 1.3, 2.5, 8],
    high: [18, 3, 1.4, 0.3, 0.2, 0.3, 1.4, 3, 18]
  },
  12: {
    low: [5, 2.5, 1.4, 1.1, 1, 0.5, 0.5, 1, 1.1, 1.4, 2.5, 5, 5],
    medium: [20, 8, 3, 1.5, 0.8, 0.4, 0.4, 0.8, 1.5, 3, 8, 20, 20],
    high: [50, 15, 6, 2, 0.5, 0.2, 0.2, 0.5, 2, 6, 15, 50, 50]
  },
  16: {
    low: [8, 5, 2, 1.4, 1.1, 1, 0.5, 0.3, 0.3, 0.5, 1, 1.1, 1.4, 2, 5, 8, 8],
    medium: [50, 25, 8, 4, 2, 1, 0.5, 0.3, 0.3, 0.5, 1, 2, 4, 8, 25, 50, 50],
    high: [100, 50, 18, 7, 3, 1.5, 0.3, 0.1, 0.1, 0.3, 1.5, 3, 7, 18, 50, 100, 100]
  }
};

const RISK_CONFIG: Record<RiskLevel, { label: string; icon: React.ElementType; color: string }> = {
  low: { label: 'Low', icon: Shield, color: 'text-secondary' },
  medium: { label: 'Medium', icon: Zap, color: 'text-amber-400' },
  high: { label: 'High', icon: Flame, color: 'text-destructive' }
};

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

export const PlinkoGame = () => {
  const { profile, updateBalance, user } = useAuth();
  const { playDrop, playBounce, playWin, playBigWin, playLose } = useSoundEffects();
  const [betAmount, setBetAmount] = useState(10);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('medium');
  const [rowCount, setRowCount] = useState<RowCount>(12);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [dropping, setDropping] = useState(false);
  const [lastMultiplier, setLastMultiplier] = useState<number | null>(null);
  const [lastBucketIndex, setLastBucketIndex] = useState<number | null>(null);
  const ballIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const [dimensions, setDimensions] = useState({ width: 400, height: 500 });

  const multipliers = MULTIPLIER_SETS[rowCount][riskLevel];

  // Responsive sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = Math.min(containerRef.current.offsetWidth - 16, 450);
        const heightMultiplier = rowCount === 16 ? 1.4 : rowCount === 12 ? 1.25 : 1.1;
        setDimensions({ width, height: Math.floor(width * heightMultiplier) });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [rowCount]);

  const { width: boardWidth, height: boardHeight } = dimensions;
  const pegSpacing = boardWidth / (rowCount + 4);
  const startY = 80;
  const endY = boardHeight - 60;
  const rowHeight = (endY - startY) / rowCount;
  
  // FIXED: Much smaller ball relative to peg gaps to prevent sticking
  const pegRadius = Math.max(2, Math.min(4, boardWidth / 120));
  const ballRadius = Math.max(3, Math.min(5, boardWidth / 100)); // Much smaller ball
  const gapBetweenPegs = pegSpacing - pegRadius * 2;
  const safetyMargin = gapBetweenPegs * 0.3; // Ball should be much smaller than gap
  const effectiveBallRadius = Math.min(ballRadius, safetyMargin);
  
  const gravity = 0.35;
  const bounce = 0.5;
  const friction = 0.98;

  // Calculate peg positions with more spacing
  const getPegPositions = useCallback(() => {
    const pegs: { x: number; y: number }[] = [];
    for (let row = 0; row < rowCount; row++) {
      const pegCount = row + 3;
      const rowWidth = (pegCount - 1) * pegSpacing;
      const startX = (boardWidth - rowWidth) / 2;
      const y = startY + row * rowHeight;
      for (let col = 0; col < pegCount; col++) {
        pegs.push({ x: startX + col * pegSpacing, y });
      }
    }
    return pegs;
  }, [boardWidth, pegSpacing, rowHeight, rowCount, startY]);

  const pegs = getPegPositions();
  const bucketWidth = (boardWidth - 20) / multipliers.length;

  // Physics simulation with STRONG target bucket enforcement
  const [targetBucket, setTargetBucket] = useState<number | null>(null);
  
  const simulate = useCallback((ball: Ball): Ball => {
    let { x, y, vx, vy, active, id } = ball;
    if (!active) return ball;

    // Apply gravity
    vy += gravity;
    
    // Apply velocity with friction
    x += vx;
    y += vy;
    vx *= friction;

    // Calculate target x for the FORCED outcome
    const targetX = targetBucket !== null 
      ? 10 + (targetBucket + 0.5) * bucketWidth 
      : boardWidth / 2;
    
    // STRONG bias toward target - this ENFORCES the win rate
    const progress = Math.min(1, (y - startY) / (endY - startY));
    if (targetBucket !== null) {
      const distanceToTarget = Math.abs(targetX - x);
      // Stronger bias as ball progresses and if far from target
      const biasStrength = 0.15 * progress + (distanceToTarget > bucketWidth ? 0.1 : 0);
      const targetDirection = targetX > x ? 1 : -1;
      vx += targetDirection * biasStrength;
      
      // Near the bottom, force toward target
      if (progress > 0.8) {
        vx += targetDirection * 0.3;
      }
    }

    // Check peg collisions - simplified to prevent sticking
    for (const peg of pegs) {
      const dx = x - peg.x;
      const dy = y - peg.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = effectiveBallRadius + pegRadius + 4; // More clearance
      
      if (dist < minDist && dist > 0) {
        // Push ball away from peg immediately
        const nx = dx / dist;
        const ny = dy / dist;
        
        // Always push away, don't check if approaching
        const pushStrength = (minDist - dist) + 3;
        x += nx * pushStrength;
        y += ny * pushStrength;
        
        // Add bounce velocity biased toward target
        let bounceDir = Math.sign(dx) || (Math.random() > 0.5 ? 1 : -1);
        
        // Bias toward target bucket
        if (targetBucket !== null) {
          const shouldGoRight = targetX > x;
          bounceDir = shouldGoRight ? 1 : -1;
        }
        
        vx = bounceDir * (2 + Math.random() * 2);
        vy = Math.max(vy, 2); // Keep moving down
      }
    }

    // Wall collisions
    const wallPadding = effectiveBallRadius + 20;
    if (x < wallPadding) {
      x = wallPadding;
      vx = Math.abs(vx) * 0.5 + 1;
    }
    if (x > boardWidth - wallPadding) {
      x = boardWidth - wallPadding;
      vx = -Math.abs(vx) * 0.5 - 1;
    }

    // Check if ball reached bottom
    if (y >= endY + 10) {
      active = false;
    }

    return { id, x, y, vx, vy, active };
  }, [pegs, boardWidth, endY, targetBucket, bucketWidth, startY, effectiveBallRadius, pegRadius]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      setBalls(prev => {
        const updated = prev.map(simulate);
        return updated;
      });
      animationRef.current = requestAnimationFrame(animate);
    };
    
    if (balls.some(b => b.active)) {
      animationRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [balls.length, simulate]);

  // Handle ball landing
  useEffect(() => {
    const landedBalls = balls.filter(b => !b.active && b.y >= endY);
    if (landedBalls.length > 0 && dropping) {
      const ball = landedBalls[landedBalls.length - 1];
      const bucketIndex = Math.min(
        Math.max(0, Math.floor((ball.x - 10) / bucketWidth)),
        multipliers.length - 1
      );
      
      const multiplier = multipliers[bucketIndex];
      const payout = betAmount * multiplier;
      const won = multiplier >= 1;

      setLastMultiplier(multiplier);
      setLastBucketIndex(bucketIndex);
      
      // Update balance and log bet
      updateBalance(payout).then(async () => {
        // Decrement forced outcome
        if (user) {
          await decrementForcedOutcome(user.id, won);
        }
        
        if (multiplier >= 5) {
          triggerWinConfetti();
          playBigWin();
          toast.success(`🎉 ${multiplier}x - Won NPR ${formatCredits(payout)}!`);
        } else if (multiplier >= 1) {
          playWin();
          toast.success(`${multiplier}x - Won NPR ${formatCredits(payout)}!`);
        } else {
          playLose();
          toast.error(`${multiplier}x - Returned NPR ${formatCredits(payout)}`);
        }
      });

      // Log bet to database
      if (user) {
        supabase.from('bet_logs').insert({
          user_id: user.id,
          game: 'plinko',
          bet_amount: betAmount,
          won,
          payout
        }).then(() => {
          // Bet logged successfully
        });
      }

      setDropping(false);
      setBalls([]);
      setTargetBucket(null); // Reset target for next drop
    }
  }, [balls, dropping, betAmount, multipliers, bucketWidth, endY, updateBalance, user]);

  const dropBall = async () => {
    if (!profile || betAmount > profile.balance) {
      toast.error("Insufficient balance!");
      return;
    }
    if (betAmount < 1) {
      toast.error("Minimum bet is NPR 1");
      return;
    }

    playDrop();
    await updateBalance(-betAmount);
    setDropping(true);
    setLastMultiplier(null);
    setLastBucketIndex(null);

    // Get effective win probability (handles roaming, auto-loss on increase, forced outcomes)
    let { probability: winProb, forceLoss } = user?.id 
      ? await getEffectiveWinProbability('plinko', user.id, betAmount)
      : { probability: 0.15, forceLoss: false };
    
    // Also check max profit limit
    if (!forceLoss && user?.id) {
      const maxPayout = betAmount * Math.max(...multipliers);
      const wouldExceedLimit = await checkMaxProfitLimit(user.id, maxPayout, profile.balance);
      if (wouldExceedLimit) {
        winProb = 0.05;
      }
    }
    
    const shouldWin = Math.random() < winProb;
    
    // Determine target bucket based on win/loss decision
    let targetBucketIndex: number;
    if (shouldWin) {
      // Pick a winning bucket (multiplier >= 1)
      const winningBuckets = multipliers
        .map((m, i) => ({ m, i }))
        .filter(b => b.m >= 1);
      
      // Prefer middle-high multipliers for better UX
      const sortedWinning = winningBuckets.sort((a, b) => b.m - a.m);
      const topHalf = sortedWinning.slice(0, Math.ceil(sortedWinning.length / 2));
      targetBucketIndex = topHalf[Math.floor(Math.random() * topHalf.length)]?.i 
        ?? Math.floor(multipliers.length / 2);
    } else {
      // Pick a losing bucket (multiplier < 1)
      const losingBuckets = multipliers
        .map((m, i) => ({ m, i }))
        .filter(b => b.m < 1);
      
      if (losingBuckets.length > 0) {
        targetBucketIndex = losingBuckets[Math.floor(Math.random() * losingBuckets.length)].i;
      } else {
        // If no losing buckets, pick lowest multiplier
        const minMult = Math.min(...multipliers);
        targetBucketIndex = multipliers.findIndex(m => m === minMult);
      }
    }
    
    // Set the target for physics simulation to enforce
    setTargetBucket(targetBucketIndex);
    
    // Start ball from center with slight randomness
    const centerX = boardWidth / 2;

    const newBall: Ball = {
      id: ++ballIdRef.current,
      x: centerX + (Math.random() - 0.5) * 30,
      y: 15,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 3, // Good downward velocity
      active: true
    };

    setBalls([newBall]);
  };

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
            {/* Pegs - responsive size */}
            {pegs.map((peg, i) => (
              <div
                key={i}
                className="absolute bg-primary/80 rounded-full shadow-md"
                style={{ 
                  left: peg.x,
                  top: peg.y,
                  width: pegRadius * 2,
                  height: pegRadius * 2,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}
              />
            ))}

            {/* Balls - White Glowing */}
            <AnimatePresence>
              {balls.filter(b => b.active || b.y < endY + 20).map((ball) => (
                <motion.div
                  key={ball.id}
                  className="absolute rounded-full"
                  style={{ 
                    left: ball.x,
                    top: ball.y,
                    width: effectiveBallRadius * 2,
                    height: effectiveBallRadius * 2,
                    transform: 'translate(-50%, -50%)',
                    background: 'radial-gradient(circle at 30% 30%, #ffffff, #e0e0e0)',
                    boxShadow: '0 0 15px 5px rgba(255,255,255,0.8), 0 0 30px 10px rgba(255,255,255,0.5), 0 0 45px 15px rgba(200,200,255,0.3)',
                    zIndex: 20
                  }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                />
              ))}
            </AnimatePresence>

            {/* Multiplier Buckets */}
            <div className="absolute bottom-0 left-[10px] right-[10px] flex gap-[2px] pb-1" style={{ height: '44px' }}>
              {multipliers.map((mult, i) => {
                const isHighlight = lastBucketIndex === i;
                const isHigh = mult >= 20;
                const isMed = mult >= 3 && mult < 20;
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
                    {mult}x
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
                lastMultiplier >= 20 ? 'text-secondary animate-pulse' : 
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

          {/* Row Count Selection */}
          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Rows</Label>
            <div className="grid grid-cols-3 gap-2">
              {([8, 12, 16] as RowCount[]).map((rows) => (
                <Button
                  key={rows}
                  variant={rowCount === rows ? 'gold' : 'outline'}
                  size="sm"
                  onClick={() => setRowCount(rows)}
                  disabled={dropping}
                >
                  {rows}
                </Button>
              ))}
            </div>
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
                    <span className="text-[10px] sm:text-xs">{config.label}</span>
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Max: {Math.max(...multipliers)}x multiplier
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
              onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value)))}
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
            <div className="flex flex-wrap gap-1">
              {multipliers.slice(0, Math.ceil(multipliers.length / 2)).map((m, i) => (
                <span key={i} className={`px-1.5 py-0.5 rounded ${
                  m >= 20 ? 'bg-secondary/30 text-secondary' :
                  m >= 3 ? 'bg-primary/30 text-primary' :
                  m >= 1 ? 'bg-amber-500/30 text-amber-400' : 'bg-destructive/30 text-destructive'
                }`}>
                  {m}x
                </span>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1 p-3 border border-border/30 rounded-lg">
            <p className="font-semibold">How to Play:</p>
            <p>• Drop the ball and watch it bounce through pegs</p>
            <p>• Higher risk = higher potential multipliers</p>
            <p>• More rows = more bounces and variance</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
