import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
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

interface SlotMachineProps {
  gameConfig: {
    minBet: number;
    maxBet: number;
    winProbability: number;
    payoutMultiplier: number;
  };
}

export const SlotMachine = ({ gameConfig }: SlotMachineProps) => {
  const { currentUser, updateBalance, placeBet } = useGameStore();
  const [bet, setBet] = useState(gameConfig.minBet);
  const [reels, setReels] = useState<string[]>(['🎰', '🎰', '🎰']);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ won: boolean; amount: number } | null>(null);
  const [shake, setShake] = useState(false);

  const spin = async () => {
    if (!currentUser || spinning || bet > currentUser.balance) return;

    setSpinning(true);
    setResult(null);
    updateBalance(-bet);

    // Animate reels
    const spinDuration = 2000;
    const interval = 100;
    let elapsed = 0;

    const spinInterval = setInterval(() => {
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
          updateBalance(payout);
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

        placeBet('slots', bet, won, payout);
        setResult({ won, amount: payout });
        setSpinning(false);
      }
    }, interval);
  };

  const adjustBet = (amount: number) => {
    const newBet = Math.max(gameConfig.minBet, Math.min(gameConfig.maxBet, bet + amount));
    setBet(newBet);
  };

  return (
    <Card glow="gold" className="w-full max-w-lg mx-auto overflow-hidden">
      <CardHeader className="text-center bg-gradient-to-b from-muted/50 to-transparent">
        <CardTitle className="text-gradient-gold text-3xl">Lucky Spin Slots</CardTitle>
        <p className="text-muted-foreground">Match 3 symbols to win!</p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Slot Reels */}
        <motion.div 
          className={`flex justify-center gap-4 p-6 bg-muted rounded-xl ${shake ? 'animate-shake' : ''}`}
          animate={spinning ? { scale: [1, 1.02, 1] } : {}}
          transition={{ repeat: spinning ? Infinity : 0, duration: 0.3 }}
        >
          {reels.map((symbol, index) => (
            <motion.div
              key={index}
              className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center bg-card rounded-lg border-2 border-primary/30 text-5xl sm:text-6xl shadow-inner"
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
              className={`text-center p-4 rounded-lg ${
                result.won 
                  ? 'bg-secondary/20 border border-secondary text-secondary' 
                  : 'bg-destructive/20 border border-destructive text-destructive'
              }`}
            >
              <p className="text-lg font-bold">
                {result.won 
                  ? `🎉 You won ${formatCredits(result.amount)} credits!` 
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
            >
              <Minus className="w-4 h-4" />
            </Button>
            
            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg min-w-[120px] justify-center">
              <Coins className="w-5 h-5 text-primary" />
              <span className="text-xl font-bold text-primary">{formatCredits(bet)}</span>
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => adjustBet(10)}
              disabled={bet >= gameConfig.maxBet || spinning}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Min: {gameConfig.minBet} | Max: {formatCredits(gameConfig.maxBet)}
          </p>

          <Button
            variant="gold"
            size="xl"
            className="w-full"
            onClick={spin}
            disabled={spinning || !currentUser || bet > currentUser.balance}
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

          {currentUser && bet > currentUser.balance && (
            <p className="text-center text-destructive text-sm">
              Insufficient credits!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
