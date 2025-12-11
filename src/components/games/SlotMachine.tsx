import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  checkWin, 
  calculatePayout, 
  triggerWinConfetti, 
  formatCredits,
  getRandomSlotSymbol,
  SLOT_SYMBOLS 
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

    const spinInterval = setInterval(async () => {
      setReels([
        getRandomSlotSymbol(),
        getRandomSlotSymbol(),
        getRandomSlotSymbol(),
      ]);
      elapsed += interval;

      if (elapsed >= spinDuration) {
        clearInterval(spinInterval);
        
        // Determine win
        const won = checkWin(gameConfig.winProbability);
        const payout = calculatePayout(bet, won, gameConfig.payoutMultiplier);

        // Set final reels based on win
        if (won) {
          const winSymbol = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
          setReels([winSymbol, winSymbol, winSymbol]);
          triggerWinConfetti();
          await updateBalance(payout);
          toast.success(`You won $${formatCredits(payout)}!`);
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
      <CardHeader className="text-center bg-gradient-to-b from-primary/10 to-transparent border-b border-primary/10">
        <CardTitle className="text-gradient-gold text-3xl font-display">Lucky Spin Slots</CardTitle>
        <p className="text-muted-foreground">Match 3 symbols to win!</p>
      </CardHeader>
      
      <CardContent className="space-y-6 p-6">
        {/* Slot Reels */}
        <motion.div 
          className={`flex justify-center gap-4 p-8 bg-gradient-to-b from-muted to-muted/50 rounded-2xl border border-border/50 ${shake ? 'animate-shake' : ''}`}
          animate={spinning ? { scale: [1, 1.02, 1] } : {}}
          transition={{ repeat: spinning ? Infinity : 0, duration: 0.3 }}
        >
          {reels.map((symbol, index) => (
            <motion.div
              key={index}
              className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center bg-gradient-to-b from-card to-background rounded-xl border-2 border-primary/30 text-5xl sm:text-6xl shadow-lg"
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
              className={`text-center p-4 rounded-xl ${
                result.won 
                  ? 'bg-secondary/20 border border-secondary text-secondary' 
                  : 'bg-destructive/20 border border-destructive text-destructive'
              }`}
            >
              <p className="text-lg font-bold">
                {result.won 
                  ? `🎉 You won $${formatCredits(result.amount)}!` 
                  : '😔 Better luck next time!'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bet Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => adjustBet(-10)}
              disabled={bet <= gameConfig.minBet || spinning}
              className="rounded-full"
            >
              <Minus className="w-4 h-4" />
            </Button>
            
            <div className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary/20 to-primary/10 rounded-xl min-w-[140px] justify-center border border-primary/30">
              <Coins className="w-5 h-5 text-primary" />
              <span className="text-xl font-bold text-primary">${formatCredits(bet)}</span>
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => adjustBet(10)}
              disabled={bet >= gameConfig.maxBet || spinning}
              className="rounded-full"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Min: ${gameConfig.minBet} | Max: ${formatCredits(gameConfig.maxBet)}
          </p>

          <Button
            variant="gold"
            size="xl"
            className="w-full text-lg font-bold"
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
                <span className="text-2xl">🎰</span>
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
