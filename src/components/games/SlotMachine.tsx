import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  triggerWinConfetti, 
  formatCredits,
  getRandomSlotSymbol,
  SLOT_SYMBOLS,
  getWinProbability
} from "@/lib/gameUtils";
import { Coins, RotateCcw, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

interface SlotMachineProps {
  gameConfig: {
    minBet: number;
    maxBet: number;
    winProbability: number;
    payoutMultiplier: number;
  };
}

export const SlotMachine = ({ gameConfig }: SlotMachineProps) => {
  const { profile, user, updateBalance } = useAuth();
  const [bet, setBet] = useState(gameConfig.minBet);
  const [reels, setReels] = useState<string[]>(['🎰', '🎰', '🎰']);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ won: boolean; amount: number } | null>(null);
  const [shake, setShake] = useState(false);

  const spin = async () => {
    if (!user || !profile || spinning || bet > profile.balance) return;

    setSpinning(true);
    setResult(null);
    
    // Deduct bet immediately
    await updateBalance(-bet);

    // Animate reels
    const spinDuration = 2000;
    const interval = 100;
    let elapsed = 0;

    // Get win probability from settings
    const winProb = await getWinProbability();

    const spinInterval = setInterval(async () => {
      setReels([
        getRandomSlotSymbol(),
        getRandomSlotSymbol(),
        getRandomSlotSymbol(),
      ]);
      elapsed += interval;

      if (elapsed >= spinDuration) {
        clearInterval(spinInterval);
        
        // Determine win based on dynamic probability
        const won = Math.random() < winProb;
        const payout = won ? Math.floor(bet * gameConfig.payoutMultiplier) : 0;

        // Set final reels based on win
        if (won) {
          const winSymbol = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
          setReels([winSymbol, winSymbol, winSymbol]);
          triggerWinConfetti();
          await updateBalance(payout);
          toast.success(`You won NPR ${formatCredits(payout)}!`);
        } else {
          // Ensure not matching
          let finalReels = [getRandomSlotSymbol(), getRandomSlotSymbol(), getRandomSlotSymbol()];
          while (finalReels[0] === finalReels[1] && finalReels[1] === finalReels[2]) {
            finalReels = [getRandomSlotSymbol(), getRandomSlotSymbol(), getRandomSlotSymbol()];
          }
          setReels(finalReels);
          setShake(true);
          setTimeout(() => setShake(false), 500);
        }

        // Log bet to database
        await supabase.from('bet_logs').insert({
          user_id: user.id,
          game: 'slots',
          bet_amount: bet,
          won,
          payout: won ? payout : 0
        });

        setResult({ won, amount: payout });
        setSpinning(false);
      }
    }, interval);
  };

  const adjustBet = (amount: number) => {
    const newBet = Math.max(gameConfig.minBet, Math.min(gameConfig.maxBet, bet + amount));
    setBet(newBet);
  };

  const balance = profile?.balance ?? 0;

  return (
    <Card className="w-full max-w-lg mx-auto overflow-hidden border-primary/20 bg-gradient-to-b from-card to-background">
      <CardHeader className="text-center bg-gradient-to-b from-primary/10 to-transparent border-b border-primary/10 py-4 sm:py-6">
        <CardTitle className="text-gradient-gold text-2xl sm:text-3xl font-display">Lucky Spin Slots</CardTitle>
        <p className="text-muted-foreground text-sm sm:text-base">Match 3 symbols to win!</p>
      </CardHeader>
      
      <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Slot Reels */}
        <motion.div 
          className={`flex justify-center gap-2 sm:gap-4 p-4 sm:p-8 bg-gradient-to-b from-muted to-muted/50 rounded-2xl border border-border/50 ${shake ? 'animate-shake' : ''}`}
          animate={spinning ? { scale: [1, 1.02, 1] } : {}}
          transition={{ repeat: spinning ? Infinity : 0, duration: 0.3 }}
        >
          {reels.map((symbol, index) => (
            <motion.div
              key={index}
              className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 flex items-center justify-center bg-gradient-to-b from-card to-background rounded-xl border-2 border-primary/30 text-4xl sm:text-5xl md:text-6xl shadow-lg"
              animate={spinning ? { y: [0, -10, 0] } : {}}
              transition={{ 
                repeat: spinning ? Infinity : 0, 
                duration: 0.15,
                delay: index * 0.05 
              }}
            >
              {symbol}
            </motion.div>
          ))}
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
                  ? `🎉 You won NPR ${formatCredits(result.amount)}!` 
                  : '😔 Better luck next time!'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bet Controls */}
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
            
            <div className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-primary/20 to-primary/10 rounded-xl min-w-[120px] sm:min-w-[140px] justify-center border border-primary/30">
              <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="text-lg sm:text-xl font-bold text-primary">NPR {formatCredits(bet)}</span>
            </div>
            
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
            Min: NPR {gameConfig.minBet} | Max: NPR {formatCredits(gameConfig.maxBet)}
          </p>

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
      </CardContent>
    </Card>
  );
};