import { useState, useRef, useCallback } from "react";
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
const PEG_SPACING = 32;
const GRAVITY = 0.4;
const FRICTION = 0.98;
const BOUNCE = 0.7;

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
  const ballIdRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const boardWidth = 400;
  const boardHeight = 500;

  const getPegPositions = useCallback(() => {
    const pegs: { x: number; y: number }[] = [];
    for (let row = 0; row < ROWS; row++) {
      const pegCount = row + 3;
      const rowWidth = (pegCount - 1) * PEG_SPACING;
      const startX = (boardWidth - rowWidth) / 2;
      const y = 50 + row * ((boardHeight - 120) / ROWS);
      
      for (let col = 0; col < pegCount; col++) {
        pegs.push({
          x: startX + col * PEG_SPACING,
          y: y
        });
      }
    }
    return pegs;
  }, []);

  const simulateBall = useCallback(async () => {
    const pegs = getPegPositions();
    const ballId = ++ballIdRef.current;
    
    // Add slight randomness to starting position
    const startX = boardWidth / 2 + (Math.random() - 0.5) * 10;
    
    let ball: Ball = {
      id: ballId,
      x: startX,
      y: 20,
      vx: (Math.random() - 0.5) * 2,
      vy: 0
    };

    setBalls(prev => [...prev, ball]);

    return new Promise<number>((resolve) => {
      const animate = () => {
        // Apply gravity
        ball.vy += GRAVITY;
        
        // Apply friction
        ball.vx *= FRICTION;
        
        // Update position
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Check collision with pegs
        for (const peg of pegs) {
          const dx = ball.x - peg.x;
          const dy = ball.y - peg.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDist = 12; // ball radius + peg radius

          if (distance < minDist) {
            // Normalize collision vector
            const nx = dx / distance;
            const ny = dy / distance;
            
            // Separate ball from peg
            ball.x = peg.x + nx * minDist;
            ball.y = peg.y + ny * minDist;
            
            // Reflect velocity
            const dotProduct = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 2 * dotProduct * nx) * BOUNCE;
            ball.vy = (ball.vy - 2 * dotProduct * ny) * BOUNCE;
            
            // Add randomness for natural feel
            ball.vx += (Math.random() - 0.5) * 1.5;
          }
        }

        // Bounce off walls
        if (ball.x < 20) {
          ball.x = 20;
          ball.vx = Math.abs(ball.vx) * BOUNCE;
        }
        if (ball.x > boardWidth - 20) {
          ball.x = boardWidth - 20;
          ball.vx = -Math.abs(ball.vx) * BOUNCE;
        }

        // Update ball state
        setBalls(prev => prev.map(b => 
          b.id === ballId ? { ...ball } : b
        ));

        // Check if ball reached bottom
        if (ball.y >= boardHeight - 60) {
          // Calculate bucket
          const bucketWidth = (boardWidth - 40) / MULTIPLIERS.length;
          const bucketIndex = Math.floor((ball.x - 20) / bucketWidth);
          const clampedIndex = Math.max(0, Math.min(MULTIPLIERS.length - 1, bucketIndex));
          
          // Remove ball after short delay
          setTimeout(() => {
            setBalls(prev => prev.filter(b => b.id !== ballId));
          }, 500);
          
          resolve(clampedIndex);
          return;
        }

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    });
  }, [getPegPositions]);

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

    // Get win probability from settings
    const winProb = await getWinProbability();
    
    // Simulate ball physics
    const bucketIndex = await simulateBall();
    
    // Apply house edge - sometimes redirect to lower multiplier
    let finalIndex = bucketIndex;
    if (Math.random() > winProb) {
      // Bias towards center (lower multipliers)
      const centerBias = Math.floor(MULTIPLIERS.length / 2);
      finalIndex = Math.floor(centerBias + (Math.random() - 0.5) * 4);
      finalIndex = Math.max(4, Math.min(8, finalIndex));
    }
    
    const multiplier = MULTIPLIERS[finalIndex];
    const payout = betAmount * multiplier;
    const won = multiplier >= 1;

    setLastMultiplier(multiplier);

    const partialReturn = payout;
    
    if (won) {
      await updateBalance(payout);
      if (multiplier >= 3) {
        triggerWinConfetti();
      }
      toast.success(`${multiplier}x - Won NPR ${payout.toFixed(2)}!`);
    } else {
      if (partialReturn > 0) {
        await updateBalance(partialReturn);
      }
      toast.error(`${multiplier}x - Lost NPR ${(betAmount - partialReturn).toFixed(2)}`);
    }

    // Log bet
    await supabase.from('bet_logs').insert({
      user_id: profile?.id,
      game: 'plinko',
      bet_amount: betAmount,
      won,
      payout: won ? payout : partialReturn
    });

    await refreshProfile();
    setDropping(false);
  };

  // Calculate peg positions for rendering
  const pegs = getPegPositions();

  return (
    <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
      {/* Game Board */}
      <Card className="lg:col-span-2 overflow-hidden">
        <CardHeader className="py-3 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-gradient-gold font-display text-lg sm:text-xl">
            <Circle className="w-5 h-5 sm:w-6 sm:h-6" />
            Plinko
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-4">
          <div 
            className="relative mx-auto bg-gradient-to-b from-muted/30 to-muted/60 rounded-xl overflow-hidden"
            style={{ 
              width: '100%', 
              maxWidth: `${boardWidth}px`,
              height: `${boardHeight}px`
            }}
          >
            {/* Pegs */}
            {pegs.map((peg, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 sm:w-3 sm:h-3 bg-primary/70 rounded-full shadow-lg"
                style={{ 
                  left: `${(peg.x / boardWidth) * 100}%`, 
                  top: `${(peg.y / boardHeight) * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              />
            ))}

            {/* Balls */}
            <AnimatePresence>
              {balls.map((ball) => (
                <motion.div
                  key={ball.id}
                  className="absolute w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-br from-primary to-amber-400 rounded-full shadow-lg"
                  style={{ 
                    left: `${(ball.x / boardWidth) * 100}%`,
                    top: `${(ball.y / boardHeight) * 100}%`,
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
            <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-0.5 sm:gap-1 px-2 sm:px-5 pb-2">
              {MULTIPLIERS.map((mult, i) => (
                <motion.div
                  key={i}
                  className={`
                    flex-1 py-1.5 sm:py-2 text-center text-[10px] sm:text-xs font-bold rounded-t-lg border-t-2
                    ${mult >= 3 ? 'bg-secondary/90 text-secondary-foreground border-secondary' : ''}
                    ${mult >= 1 && mult < 3 ? 'bg-primary/80 text-primary-foreground border-primary' : ''}
                    ${mult < 1 ? 'bg-destructive/80 text-destructive-foreground border-destructive' : ''}
                  `}
                  animate={lastMultiplier === mult ? { scale: [1, 1.15, 1] } : {}}
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
                {lastMultiplier >= 1 ? 'WIN' : 'LOSS'}: NPR {(betAmount * lastMultiplier).toFixed(2)}
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
              <li>Win based on the bucket it lands in</li>
              <li>Edge buckets have higher multipliers!</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};