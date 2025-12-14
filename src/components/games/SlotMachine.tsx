import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  triggerWinConfetti, 
  formatCredits,
  getRandomSlotSymbol,
  SLOT_SYMBOLS,
  getWinProbability,
  getUserBettingControl,
  decrementForcedOutcome,
  checkMaxProfitLimit
} from "@/lib/gameUtils";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { Coins, RotateCcw, Minus, Plus, Star, Sparkles } from "lucide-react";

// Extended symbols with more variety
const EXTENDED_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🍉', '💎', '7️⃣', '⭐', '🎰', '👑', '💰', '🔔'];

interface SlotMachineProps {
  gameConfig: {
    minBet: number;
    maxBet: number;
    winProbability: number;
    payoutMultiplier: number;
  };
}

import { toast } from "sonner";

export const SlotMachine = ({ gameConfig }: SlotMachineProps) => {
  const { profile, user, updateBalance } = useAuth();
  const { playSpin, playReelStop, playWin, playBigWin, playLose, playChip } = useSoundEffects();
  const [bet, setBet] = useState(gameConfig.minBet);
  const [reels, setReels] = useState<string[][]>([
    ['🎰', '🍒', '💎'],
    ['🎰', '🍋', '7️⃣'],
    ['🎰', '🍊', '⭐'],
    ['🎰', '🍇', '👑'],
    ['🎰', '🍉', '💰']
  ]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ won: boolean; amount: number; message: string } | null>(null);
  const [shake, setShake] = useState(false);
  const [editingBet, setEditingBet] = useState(false);
  const [paylines, setPaylines] = useState<number[]>([]);

  const getRandomSymbol = () => EXTENDED_SYMBOLS[Math.floor(Math.random() * EXTENDED_SYMBOLS.length)];

  const spin = async () => {
    if (!user || !profile || spinning || bet > profile.balance) return;

    setSpinning(true);
    setResult(null);
    setPaylines([]);
    playSpin();
    
    await updateBalance(-bet);

    const spinDuration = 2500;
    const interval = 80;
    let elapsed = 0;

    // Check for forced outcomes first
    const bettingControl = await getUserBettingControl(user.id);
    let forcedOutcome: boolean | null = bettingControl?.forcedWin ?? null;
    
    // Check max profit limit
    if (bettingControl?.maxProfitLimit !== null) {
      const maxPayout = bet * 25; // Max slot multiplier
      const wouldExceedLimit = await checkMaxProfitLimit(user.id, maxPayout, profile.balance);
      if (wouldExceedLimit && forcedOutcome !== false) {
        forcedOutcome = false;
      }
    }

    let winProb = await getWinProbability('slots', user?.id);
    
    // Override win probability based on forced outcome
    if (forcedOutcome === true) {
      winProb = 0.95;
    } else if (forcedOutcome === false) {
      winProb = 0.05;
    }

    const spinInterval = setInterval(async () => {
      // Animate all reels
      setReels(prev => prev.map(() => [
        getRandomSymbol(),
        getRandomSymbol(),
        getRandomSymbol()
      ]));
      elapsed += interval;

      if (elapsed >= spinDuration) {
        clearInterval(spinInterval);
        
        const won = Math.random() < winProb;
        
        // Generate final reels
        let finalReels: string[][];
        let winPaylines: number[] = [];
        let multiplier = 1;
        let message = '';

        if (won) {
          // Determine win type
          const winType = Math.random();
          if (winType < 0.1) {
            // Jackpot - all 5 match on middle row
            const jackpotSymbol = ['💎', '7️⃣', '👑', '💰'][Math.floor(Math.random() * 4)];
            finalReels = Array(5).fill(null).map(() => [
              getRandomSymbol(),
              jackpotSymbol,
              getRandomSymbol()
            ]);
            winPaylines = [1];
            multiplier = 25;
            message = '🎰 JACKPOT! 5 in a row!';
          } else if (winType < 0.3) {
            // 4 of a kind
            const winSymbol = EXTENDED_SYMBOLS[Math.floor(Math.random() * EXTENDED_SYMBOLS.length)];
            const randomPos = Math.floor(Math.random() * 5);
            finalReels = Array(5).fill(null).map((_, i) => {
              if (i === randomPos) {
                return [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
              }
              return [getRandomSymbol(), winSymbol, getRandomSymbol()];
            });
            winPaylines = [1];
            multiplier = 8;
            message = '🎉 4 of a kind!';
          } else if (winType < 0.6) {
            // 3 of a kind
            const winSymbol = EXTENDED_SYMBOLS[Math.floor(Math.random() * EXTENDED_SYMBOLS.length)];
            const winPositions = [0, 1, 2];
            finalReels = Array(5).fill(null).map((_, i) => {
              if (winPositions.includes(i)) {
                return [getRandomSymbol(), winSymbol, getRandomSymbol()];
              }
              return [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
            });
            winPaylines = [1];
            multiplier = 3;
            message = '🎊 3 of a kind!';
          } else {
            // 2 pairs or diagonal
            const winSymbol = EXTENDED_SYMBOLS[Math.floor(Math.random() * EXTENDED_SYMBOLS.length)];
            finalReels = Array(5).fill(null).map((_, i) => {
              if (i < 2) {
                return [getRandomSymbol(), winSymbol, getRandomSymbol()];
              }
              return [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
            });
            winPaylines = [1];
            multiplier = 1.5;
            message = '✨ Small win!';
          }
          
          triggerWinConfetti();
          if (multiplier >= 8) {
            playBigWin();
          } else {
            playWin();
          }
        } else {
          // Ensure no winning combination
          finalReels = Array(5).fill(null).map(() => {
            const symbols = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
            return symbols;
          });
          // Make sure middle row doesn't have 3+ matching
          const middleRow = finalReels.map(r => r[1]);
          const counts: Record<string, number> = {};
          middleRow.forEach(s => counts[s] = (counts[s] || 0) + 1);
          if (Object.values(counts).some(c => c >= 3)) {
            // Randomize to break patterns
            finalReels[2][1] = EXTENDED_SYMBOLS.find(s => s !== middleRow[0] && s !== middleRow[1]) || '🍊';
          }
          playLose();
          setShake(true);
          setTimeout(() => setShake(false), 500);
        }

        playReelStop();

        setReels(finalReels);
        setPaylines(winPaylines);

        const payout = won ? Math.floor(bet * multiplier) : 0;
        
        if (won) {
          await updateBalance(payout);
          await decrementForcedOutcome(user.id, true);
          toast.success(`${message} Won NPR ${formatCredits(payout)}!`);
        } else {
          await decrementForcedOutcome(user.id, false);
        }

        await supabase.from('bet_logs').insert({
          user_id: user.id,
          game: 'slots',
          bet_amount: bet,
          won,
          payout: won ? payout : 0
        });

        setResult({ won, amount: payout, message: message || (won ? 'You won!' : 'Better luck next time!') });
        setSpinning(false);
      }
    }, interval);
  };

  const adjustBet = (amount: number) => {
    const newBet = Math.max(gameConfig.minBet, Math.min(gameConfig.maxBet, bet + amount));
    setBet(newBet);
  };

  const handleBetChange = (value: string) => {
    const num = parseInt(value) || gameConfig.minBet;
    setBet(Math.max(gameConfig.minBet, Math.min(gameConfig.maxBet, num)));
  };

  const balance = profile?.balance ?? 0;

  return (
    <Card className="w-full max-w-2xl mx-auto overflow-hidden border-primary/20 bg-gradient-to-b from-card to-background">
      <CardHeader className="text-center bg-gradient-to-b from-primary/10 to-transparent border-b border-primary/10 py-4 sm:py-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          <CardTitle className="text-gradient-gold text-2xl sm:text-3xl font-display">Lucky Spin Slots</CardTitle>
          <Sparkles className="w-6 h-6 text-primary animate-pulse" />
        </div>
        <p className="text-muted-foreground text-sm sm:text-base">Match symbols to win big!</p>
      </CardHeader>
      
      <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* 5-Reel Slot Machine */}
        <motion.div 
          className={`p-4 sm:p-6 bg-gradient-to-b from-muted to-muted/50 rounded-2xl border-4 border-primary/30 shadow-xl ${shake ? 'animate-shake' : ''}`}
          animate={spinning ? { scale: [1, 1.01, 1] } : {}}
          transition={{ repeat: spinning ? Infinity : 0, duration: 0.2 }}
        >
          {/* Payline indicator */}
          <div className="absolute left-0 right-0 top-1/2 pointer-events-none z-10">
            {paylines.includes(1) && (
              <motion.div 
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                className="h-1 bg-secondary/50 mx-4 rounded-full"
              />
            )}
          </div>

          <div className="flex justify-center gap-1 sm:gap-2 relative">
            {reels.map((reel, reelIndex) => (
              <div key={reelIndex} className="relative">
                <motion.div
                  className="flex flex-col gap-1 overflow-hidden rounded-xl border-2 border-primary/20 bg-gradient-to-b from-background to-card p-1 sm:p-2"
                  animate={spinning ? { y: [0, -5, 0] } : {}}
                  transition={{ 
                    repeat: spinning ? Infinity : 0, 
                    duration: 0.1,
                    delay: reelIndex * 0.05 
                  }}
                >
                  {reel.map((symbol, symbolIndex) => (
                    <motion.div
                      key={symbolIndex}
                      className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center text-2xl sm:text-3xl md:text-4xl rounded-lg ${
                        symbolIndex === 1 && paylines.includes(1) ? 'bg-secondary/20 ring-2 ring-secondary' : 'bg-muted/50'
                      }`}
                    >
                      {symbol}
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Result Display */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`text-center p-3 sm:p-4 rounded-xl ${
                result.won 
                  ? 'bg-secondary/20 border border-secondary text-secondary' 
                  : 'bg-destructive/20 border border-destructive text-destructive'
              }`}
            >
              <p className="text-base sm:text-lg font-bold">
                {result.won 
                  ? `${result.message} +NPR ${formatCredits(result.amount)}!` 
                  : '😔 Better luck next time!'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bet Controls with manual input */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => adjustBet(-10)}
              disabled={bet <= gameConfig.minBet || spinning}
              className="rounded-full w-9 h-9 sm:w-10 sm:h-10"
            >
              <Minus className="w-4 h-4" />
            </Button>
            
            {editingBet ? (
              <Input
                type="number"
                value={bet}
                onChange={(e) => handleBetChange(e.target.value)}
                onBlur={() => setEditingBet(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingBet(false)}
                autoFocus
                className="w-32 text-center text-lg font-bold"
                min={gameConfig.minBet}
                max={gameConfig.maxBet}
              />
            ) : (
              <div 
                onClick={() => !spinning && setEditingBet(true)}
                className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-primary/20 to-primary/10 rounded-xl min-w-[120px] sm:min-w-[140px] justify-center border border-primary/30 cursor-pointer hover:border-primary/50 transition-colors"
              >
                <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <span className="text-lg sm:text-xl font-bold text-primary">NPR {formatCredits(bet)}</span>
              </div>
            )}
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => adjustBet(10)}
              disabled={bet >= gameConfig.maxBet || spinning}
              className="rounded-full w-9 h-9 sm:w-10 sm:h-10"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-center text-xs sm:text-sm text-muted-foreground">
            Min: NPR {gameConfig.minBet} | Max: NPR {formatCredits(gameConfig.maxBet)} | Click amount to edit
          </p>

          {/* Quick bet buttons */}
          <div className="flex justify-center gap-2">
            {[10, 50, 100, 500].map((amount) => (
              <Button
                key={amount}
                variant="outline"
                size="sm"
                onClick={() => setBet(amount)}
                disabled={spinning || amount > balance}
                className="text-xs"
              >
                {amount}
              </Button>
            ))}
          </div>

          <Button
            variant="gold"
            size="lg"
            className="w-full text-base sm:text-lg font-bold"
            onClick={spin}
            disabled={spinning || !user || bet > balance}
          >
            {spinning ? (
              <>
                <RotateCcw className="w-5 h-5 animate-spin" />
                Spinning...
              </>
            ) : (
              <>
                <span className="text-xl sm:text-2xl">🎰</span>
                SPIN
              </>
            )}
          </Button>

          {user && bet > balance && (
            <p className="text-center text-destructive text-sm">
              Insufficient balance!
            </p>
          )}
        </div>

        {/* Paytable */}
        <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
          <p className="font-semibold mb-2 flex items-center gap-1"><Star className="w-3 h-3" /> Paytable:</p>
          <div className="grid grid-cols-2 gap-1">
            <span>5 matching = 25x</span>
            <span>4 matching = 8x</span>
            <span>3 matching = 3x</span>
            <span>2 matching = 1.5x</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
