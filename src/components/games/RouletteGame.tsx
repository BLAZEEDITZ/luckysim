import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  triggerWinConfetti, 
  formatCredits,
  ROULETTE_NUMBERS,
  getRouletteColor,
  getWinProbability
} from "@/lib/gameUtils";
import { Coins, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

interface RouletteGameProps {
  gameConfig: {
    minBet: number;
    maxBet: number;
    winProbability: number;
    payoutMultiplier: number;
  };
}

type BetType = 'red' | 'black' | 'number';

export const RouletteGame = ({ gameConfig }: RouletteGameProps) => {
  const { profile, user, updateBalance } = useAuth();
  const [bet, setBet] = useState(gameConfig.minBet);
  const [betType, setBetType] = useState<BetType>('red');
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ won: boolean; amount: number; number: number } | null>(null);
  const [shake, setShake] = useState(false);
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);

  const spin = async () => {
    if (!user || !profile || spinning || bet > profile.balance) return;
    if (betType === 'number' && selectedNumber === null) return;

    setSpinning(true);
    setResult(null);
    await updateBalance(-bet);

    // Get win probability from settings
    const winProb = await getWinProbability();

    // Animate wheel
    const spinDuration = 3000;
    const interval = 100;
    let elapsed = 0;

    const spinInterval = setInterval(async () => {
      setDisplayNumber(ROULETTE_NUMBERS[Math.floor(Math.random() * ROULETTE_NUMBERS.length)]);
      elapsed += interval;

      if (elapsed >= spinDuration) {
        clearInterval(spinInterval);
        
        // Determine outcome with controlled probability
        const won = Math.random() < winProb;
        const payout = won ? Math.floor(bet * gameConfig.payoutMultiplier) : 0;
        
        // Calculate the actual number
        let finalNumber: number;
        if (won) {
          if (betType === 'red') {
            const redNumbers = ROULETTE_NUMBERS.filter(n => getRouletteColor(n) === 'red');
            finalNumber = redNumbers[Math.floor(Math.random() * redNumbers.length)];
          } else if (betType === 'black') {
            const blackNumbers = ROULETTE_NUMBERS.filter(n => getRouletteColor(n) === 'black');
            finalNumber = blackNumbers[Math.floor(Math.random() * blackNumbers.length)];
          } else {
            finalNumber = selectedNumber!;
          }
          triggerWinConfetti();
          await updateBalance(payout);
          toast.success(`You won NPR ${formatCredits(payout)}!`);
        } else {
          // Ensure loss
          if (betType === 'red') {
            const nonRedNumbers = ROULETTE_NUMBERS.filter(n => getRouletteColor(n) !== 'red');
            finalNumber = nonRedNumbers[Math.floor(Math.random() * nonRedNumbers.length)];
          } else if (betType === 'black') {
            const nonBlackNumbers = ROULETTE_NUMBERS.filter(n => getRouletteColor(n) !== 'black');
            finalNumber = nonBlackNumbers[Math.floor(Math.random() * nonBlackNumbers.length)];
          } else {
            const otherNumbers = ROULETTE_NUMBERS.filter(n => n !== selectedNumber);
            finalNumber = otherNumbers[Math.floor(Math.random() * otherNumbers.length)];
          }
          setShake(true);
          setTimeout(() => setShake(false), 500);
        }

        setDisplayNumber(finalNumber);
        
        // Log bet to database
        await supabase.from('bet_logs').insert({
          user_id: user.id,
          game: 'roulette',
          bet_amount: bet,
          won,
          payout: won ? payout : 0
        });

        setResult({ won, amount: payout, number: finalNumber });
        setSpinning(false);
      }
    }, interval);
  };

  const adjustBet = (amount: number) => {
    const newBet = Math.max(gameConfig.minBet, Math.min(gameConfig.maxBet, bet + amount));
    setBet(newBet);
  };

  const getNumberColor = (num: number): string => {
    const color = getRouletteColor(num);
    if (color === 'red') return 'bg-red-600';
    if (color === 'black') return 'bg-zinc-900';
    return 'bg-emerald-600';
  };

  const balance = profile?.balance ?? 0;

  return (
    <Card className="w-full max-w-2xl mx-auto overflow-hidden border-secondary/20 bg-gradient-to-b from-card to-background">
      <CardHeader className="text-center bg-gradient-to-b from-secondary/10 to-transparent border-b border-secondary/10 py-4 sm:py-6">
        <CardTitle className="text-secondary text-2xl sm:text-3xl font-display">Classic Roulette</CardTitle>
        <p className="text-muted-foreground text-sm sm:text-base">Place your bet and spin the wheel!</p>
      </CardHeader>
      
      <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Wheel Display */}
        <motion.div 
          className={`flex flex-col items-center justify-center p-6 sm:p-8 bg-gradient-to-b from-muted to-muted/50 rounded-2xl border border-border/50 ${shake ? 'animate-shake' : ''}`}
        >
          <motion.div
            className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center text-4xl sm:text-5xl font-bold border-4 border-primary/50 shadow-xl ${
              displayNumber !== null ? getNumberColor(displayNumber) : 'bg-muted'
            }`}
            animate={spinning ? { rotate: 360 } : {}}
            transition={{ 
              repeat: spinning ? Infinity : 0, 
              duration: 0.5,
              ease: "linear"
            }}
          >
            <span className="text-foreground drop-shadow-lg">
              {displayNumber !== null ? displayNumber : '?'}
            </span>
          </motion.div>
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
                  : `😔 The ball landed on ${result.number}. Better luck next time!`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bet Type Selection */}
        <div className="space-y-3 sm:space-y-4">
          <p className="text-center text-xs sm:text-sm text-muted-foreground font-medium">Choose your bet:</p>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            <Button
              variant={betType === 'red' ? 'casino' : 'outline'}
              size="sm"
              onClick={() => { setBetType('red'); setSelectedNumber(null); }}
              disabled={spinning}
              className={`text-xs sm:text-sm ${betType === 'red' ? 'bg-red-600 hover:bg-red-700' : ''}`}
            >
              🔴 Red
            </Button>
            <Button
              variant={betType === 'black' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setBetType('black'); setSelectedNumber(null); }}
              disabled={spinning}
              className={`text-xs sm:text-sm ${betType === 'black' ? 'bg-zinc-800 hover:bg-zinc-900' : ''}`}
            >
              ⚫ Black
            </Button>
            <Button
              variant={betType === 'number' ? 'emerald' : 'outline'}
              size="sm"
              onClick={() => setBetType('number')}
              disabled={spinning}
              className="text-xs sm:text-sm"
            >
              🔢 Number
            </Button>
          </div>

          {/* Number Grid */}
          {betType === 'number' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="grid grid-cols-6 sm:grid-cols-9 gap-1 p-3 sm:p-4 bg-muted/50 rounded-xl border border-border/50"
            >
              {ROULETTE_NUMBERS.map((num) => (
                <Button
                  key={num}
                  size="sm"
                  variant={selectedNumber === num ? 'gold' : 'ghost'}
                  onClick={() => setSelectedNumber(num)}
                  disabled={spinning}
                  className={`h-8 sm:h-10 w-full text-xs sm:text-sm font-bold ${getNumberColor(num)} ${
                    selectedNumber === num ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  {num}
                </Button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Bet Controls */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => adjustBet(-5)}
              disabled={bet <= gameConfig.minBet || spinning}
              className="rounded-full w-9 h-9 sm:w-10 sm:h-10"
            >
              <Minus className="w-4 h-4" />
            </Button>
            
            <div className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-secondary/20 to-secondary/10 rounded-xl min-w-[120px] sm:min-w-[140px] justify-center border border-secondary/30">
              <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
              <span className="text-lg sm:text-xl font-bold text-secondary">NPR {formatCredits(bet)}</span>
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => adjustBet(5)}
              disabled={bet >= gameConfig.maxBet || spinning}
              className="rounded-full w-9 h-9 sm:w-10 sm:h-10"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <Button
            variant="emerald"
            size="lg"
            className="w-full text-base sm:text-lg font-bold"
            onClick={spin}
            disabled={spinning || !user || bet > balance || (betType === 'number' && selectedNumber === null)}
          >
            {spinning ? (
              <>
                <span className="animate-spin">🎡</span>
                Spinning...
              </>
            ) : (
              <>
                <span className="text-xl sm:text-2xl">🎡</span>
                SPIN WHEEL
              </>
            )}
          </Button>

          {betType === 'number' && selectedNumber === null && !spinning && (
            <p className="text-center text-amber-400 text-xs sm:text-sm">
              Select a number to bet on!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};