import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCredits, triggerWinConfetti, getWinProbability } from "@/lib/gameUtils";
import { toast } from "sonner";
import { Circle } from "lucide-react";

const ROWS = 12;
const MULTIPLIERS = [10, 3, 1.5, 1.2, 1, 0.5, 0.3, 0.5, 1, 1.2, 1.5, 3, 10];

// Physics constants - tuned for realistic bouncing
const GRAVITY = 0.25;
const FRICTION = 0.99;
const BOUNCE_DAMPING = 0.65;
const PEG_RADIUS = 6;
const BALL_RADIUS = 8;

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export const PlinkoGame = () => {
  const { profile, updateBalance, refreshProfile } = useAuth();
  const [betAmount, setBetAmount] = useState(10);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [dropping, setDropping] = useState(false);
  const [lastMultiplier, setLastMultiplier] = useState<number | null>(null);
  const [lastBucketIndex, setLastBucketIndex] = useState<number | null>(null);
  const ballIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 360, height: 450 });

  // Responsive sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = Math.min(containerRef.current.offsetWidth - 16, 400);
        setDimensions({ width, height: width * 1.2 });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const { width: boardWidth, height: boardHeight } = dimensions;

  // Calculate peg positions based on board dimensions
  const getPegPositions = useCallback(() => {
    const pegs: { x: number; y: number }[] = [];
    const pegSpacing = boardWidth / 16;
    const startY = 40;
    const endY = boardHeight - 80;
    const rowHeight = (endY - startY) / ROWS;

    for (let row = 0; row < ROWS; row++) {
      const pegCount = row + 3;
      const rowWidth = (pegCount - 1) * pegSpacing;
      const startX = (boardWidth - rowWidth) / 2;
      const y = startY + row * rowHeight;
      
      for (let col = 0; col < pegCount; col++) {
        pegs.push({
          x: startX + col * pegSpacing,
          y: y
        });
      }
    }
    return pegs;
  }, [boardWidth, boardHeight]);

  // Get bucket boundaries for accurate landing detection
  const getBucketBoundaries = useCallback(() => {
    const bucketWidth = (boardWidth - 20) / MULTIPLIERS.length;
    return MULTIPLIERS.map((_, i) => ({
      left: 10 + i * bucketWidth,
      right: 10 + (i + 1) * bucketWidth,
      center: 10 + (i + 0.5) * bucketWidth
    }));
  }, [boardWidth]);

  const simulateBall = useCallback(async () => {
    const pegs = getPegPositions();
    const buckets = getBucketBoundaries();
    const ballId = ++ballIdRef.current;
    
    // Start from exact center with tiny random offset
    const startX = boardWidth / 2 + (Math.random() - 0.5) * 4;
    
    let ball: Ball = {
      id: ballId,
      x: startX,
      y: 15,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 0
    };

    setBalls(prev => [...prev, ball]);

    return new Promise<number>((resolve) => {
      let frameCount = 0;
      const maxFrames = 1000; // Safety limit

      const animate = () => {
        frameCount++;
        if (frameCount > maxFrames) {
          // Fallback - force land in center
          setBalls(prev => prev.filter(b => b.id !== ballId));
          resolve(Math.floor(MULTIPLIERS.length / 2));
          return;
        }

        // Apply gravity
        ball.vy += GRAVITY;
        
        // Apply air friction
        ball.vx *= FRICTION;
        ball.vy *= FRICTION;
        
        // Update position
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Check collision with pegs
        for (const peg of pegs) {
          const dx = ball.x - peg.x;
          const dy = ball.y - peg.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDist = PEG_RADIUS + BALL_RADIUS;

          if (distance < minDist && distance > 0) {
            // Normalize collision vector
            const nx = dx / distance;
            const ny = dy / distance;
            
            // Separate ball from peg (prevent overlap)
            const overlap = minDist - distance;
            ball.x += nx * overlap;
            ball.y += ny * overlap;
            
            // Calculate reflection with proper physics
            const relativeVel = ball.vx * nx + ball.vy * ny;
            
            if (relativeVel < 0) { // Only bounce if moving towards peg
              // Reflect velocity with damping
              ball.vx -= (1 + BOUNCE_DAMPING) * relativeVel * nx;
              ball.vy -= (1 + BOUNCE_DAMPING) * relativeVel * ny;
              
              // Add slight random deflection for natural feel
              ball.vx += (Math.random() - 0.5) * 0.8;
              
              // Ensure minimum downward velocity
              if (ball.vy < 0.5) ball.vy = 0.5;
            }
          }
        }

        // Bounce off walls with padding
        const wallPadding = 15;
        if (ball.x < wallPadding) {
          ball.x = wallPadding;
          ball.vx = Math.abs(ball.vx) * BOUNCE_DAMPING;
        }
        if (ball.x > boardWidth - wallPadding) {
          ball.x = boardWidth - wallPadding;
          ball.vx = -Math.abs(ball.vx) * BOUNCE_DAMPING;
        }

        // Update ball state for rendering
        setBalls(prev => prev.map(b => 
          b.id === ballId ? { ...ball } : b
        ));

        // Check if ball reached bottom zone
        const bottomZone = boardHeight - 65;
        if (ball.y >= bottomZone) {
          // Find which bucket the ball landed in
          let bucketIndex = 0;
          for (let i = 0; i < buckets.length; i++) {
            if (ball.x >= buckets[i].left && ball.x < buckets[i].right) {
              bucketIndex = i;
              break;
            }
          }
          
          // Clamp to valid range
          bucketIndex = Math.max(0, Math.min(MULTIPLIERS.length - 1, bucketIndex));
          
          // Snap ball to bucket center for visual alignment
          const finalX = buckets[bucketIndex].center;
          setBalls(prev => prev.map(b => 
            b.id === ballId ? { ...b, x: finalX, y: bottomZone } : b
          ));
          
          // Remove ball after delay
          setTimeout(() => {
            setBalls(prev => prev.filter(b => b.id !== ballId));
          }, 800);
          
          resolve(bucketIndex);
          return;
        }

        requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    });
  }, [getPegPositions, getBucketBoundaries, boardWidth, boardHeight]);

  const dropBall = async () => {
    if (!profile || betAmount > profile.balance) {
      toast.error("Insufficient balance!");
      return;
    }

    if (betAmount < 1) {
      toast.error("Minimum bet is NPR 1");
      return;
    }

    // Deduct bet
    await updateBalance(-betAmount);
    setDropping(true);
    setLastMultiplier(null);
    setLastBucketIndex(null);

    // Get win probability from settings
    const winProb = await getWinProbability();
    
    // Simulate ball physics
    const bucketIndex = await simulateBall();
    
    // The ball lands where physics takes it (no manipulation after physics)
    const multiplier = MULTIPLIERS[bucketIndex];
    const payout = betAmount * multiplier;
    const won = multiplier >= 1;

    setLastMultiplier(multiplier);
    setLastBucketIndex(bucketIndex);

    if (won) {
      await updateBalance(payout);
      if (multiplier >= 3) {
        triggerWinConfetti();
      }
      toast.success(`${multiplier}x - Won NPR ${payout.toFixed(2)}!`);
    } else {
      if (payout > 0) {
        await updateBalance(payout);
      }
      toast.error(`${multiplier}x - Returned NPR ${payout.toFixed(2)}`);
    }

    // Log bet
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
  const buckets = getBucketBoundaries();

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
            className="relative mx-auto bg-gradient-to-b from-muted/30 to-muted/60 rounded-xl overflow-hidden border border-border/30"
            style={{ 
              width: `${boardWidth}px`,
              height: `${boardHeight}px`
            }}
          >
            {/* Pegs */}
            {pegs.map((peg, i) => (
              <div
                key={i}
                className="absolute bg-primary/80 rounded-full shadow-md"
                style={{ 
                  left: peg.x,
                  top: peg.y,
                  width: PEG_RADIUS * 2,
                  height: PEG_RADIUS * 2,
                  transform: 'translate(-50%, -50%)'
                }}
              />
            ))}

            {/* Balls */}
            <AnimatePresence>
              {balls.map((ball) => (
                <motion.div
                  key={ball.id}
                  className="absolute bg-gradient-to-br from-amber-300 to-primary rounded-full shadow-lg border-2 border-amber-200"
                  style={{ 
                    left: ball.x,
                    top: ball.y,
                    width: BALL_RADIUS * 2,
                    height: BALL_RADIUS * 2,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10
                  }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                />
              ))}
            </AnimatePresence>

            {/* Multiplier Buckets */}
            <div 
              className="absolute bottom-0 left-0 right-0 flex px-[10px] pb-2"
              style={{ height: '50px' }}
            >
              {MULTIPLIERS.map((mult, i) => (
                <motion.div
                  key={i}
                  className={`
                    flex-1 flex items-center justify-center text-[9px] sm:text-xs font-bold rounded-t-md border-t-2 mx-[1px]
                    ${mult >= 3 ? 'bg-secondary/90 text-secondary-foreground border-secondary' : ''}
                    ${mult >= 1 && mult < 3 ? 'bg-primary/80 text-primary-foreground border-primary' : ''}
                    ${mult < 1 ? 'bg-destructive/80 text-destructive-foreground border-destructive' : ''}
                  `}
                  animate={lastBucketIndex === i ? { 
                    scale: [1, 1.2, 1],
                    boxShadow: ['0 0 0px rgba(255,215,0,0)', '0 0 20px rgba(255,215,0,0.8)', '0 0 0px rgba(255,215,0,0)']
                  } : {}}
                  transition={{ duration: 0.5 }}
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
              <div className={`text-3xl sm:text-4xl font-display font-bold ${
                lastMultiplier >= 3 ? 'text-secondary' : 
                lastMultiplier >= 1 ? 'text-primary' : 'text-destructive'
              }`}>
                {lastMultiplier}x
              </div>
              <div className="text-muted-foreground text-sm sm:text-base">
                {lastMultiplier >= 1 ? 'WIN' : 'PARTIAL'}: NPR {(betAmount * lastMultiplier).toFixed(2)}
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
        <CardContent className="space-y-4 sm:space-y-6 p-3 sm:p-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm sm:text-base">
              <Label>Balance</Label>
              <span className="text-primary font-semibold">
                NPR {formatCredits(profile?.balance ?? 0)}
              </span>
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
              disabled={dropping}
              className="text-sm sm:text-base"
            />
            <div className="grid grid-cols-4 gap-1 sm:gap-2">
              {[10, 50, 100, 500].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setBetAmount(amount)}
                  disabled={dropping}
                  className="text-xs sm:text-sm px-1 sm:px-2"
                >
                  {amount}
                </Button>
              ))}
            </div>
          </div>

          <Button 
            variant="gold" 
            size="lg" 
            className="w-full text-sm sm:text-base" 
            onClick={dropBall}
            disabled={dropping || !profile || betAmount > profile.balance}
          >
            {dropping ? 'Dropping...' : 'Drop Ball'}
          </Button>

          <div className="p-3 sm:p-4 bg-muted/50 rounded-lg text-xs sm:text-sm text-muted-foreground">
            <p className="font-semibold mb-2">Multipliers:</p>
            <div className="grid grid-cols-4 gap-1 text-center text-xs">
              {[...new Set(MULTIPLIERS)].sort((a, b) => b - a).map(m => (
                <span key={m} className={`px-1 sm:px-2 py-1 rounded ${
                  m >= 3 ? 'bg-secondary/30' : 
                  m >= 1 ? 'bg-primary/30' : 'bg-destructive/30'
                }`}>
                  {m}x
                </span>
              ))}
            </div>
          </div>

          <div className="p-3 sm:p-4 bg-muted/50 rounded-lg text-xs sm:text-sm text-muted-foreground">
            <p className="font-semibold mb-2">How to Play:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Drop a ball from the top</li>
              <li>Watch it bounce through pegs</li>
              <li>Win based on where it lands</li>
              <li>Edge buckets = higher rewards!</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
