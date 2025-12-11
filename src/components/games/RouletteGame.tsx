import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  checkWin, 
  calculatePayout, 
  triggerWinConfetti, 
  formatCredits,
  ROULETTE_NUMBERS,
  getRouletteColor 
} from "@/lib/gameUtils";
import { Coins, Minus, Plus } from "lucide-react";

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
  const { currentUser, updateBalance, placeBet } = useGameStore();
  const [bet, setBet] = useState(gameConfig.minBet);
  const [betType, setBetType] = useState<BetType>('red');
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ won: boolean; amount: number; number: number } | null>(null);
  const [shake, setShake] = useState(false);
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);

  const spin = async () => {
    if (!currentUser || spinning || bet > currentUser.balance) return;
    if (betType === 'number' && selectedNumber === null) return;

    setSpinning(true);
    setResult(null);
    updateBalance(-bet);

    // Animate wheel
    const spinDuration = 3000;
    const interval = 100;
    let elapsed = 0;

    const spinInterval = setInterval(() => {
      setDisplayNumber(ROULETTE_NUMBERS[Math.floor(Math.random() * ROULETTE_NUMBERS.length)]);
      elapsed += interval;

      if (elapsed >= spinDuration) {
        clearInterval(spinInterval);
        
        // Determine outcome with controlled probability
        const won = checkWin(gameConfig.winProbability);
        const payout = calculatePayout(bet, won, gameConfig.payoutMultiplier);
        
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
          updateBalance(payout);
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
        placeBet('roulette', bet, won, payout);
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

  return (
    <Card glow="emerald" className="w-full max-w-2xl mx-auto overflow-hidden">
      <CardHeader className="text-center bg-gradient-to-b from-secondary/20 to-transparent">
        <CardTitle className="text-secondary text-3xl">Classic Roulette</CardTitle>
        <p className="text-muted-foreground">Place your bet and spin the wheel!</p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Wheel Display */}
        <motion.div 
          className={`flex flex-col items-center justify-center p-8 bg-muted rounded-xl ${shake ? 'animate-shake' : ''}`}
        >
          <motion.div
            className={`w-32 h-32 rounded-full flex items-center justify-center text-5xl font-bold border-4 border-primary/50 shadow-lg ${
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
              className={`text-center p-4 rounded-lg ${
                result.won 
                  ? 'bg-secondary/20 border border-secondary text-secondary' 
                  : 'bg-destructive/20 border border-destructive text-destructive'
              }`}
            >
              <p className="text-lg font-bold">
                {result.won 
                  ? `🎉 You won ${formatCredits(result.amount)} credits!` 
                  : `😔 The ball landed on ${result.number}. Better luck next time!`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bet Type Selection */}
        <div className="space-y-4">
          <p className="text-center text-sm text-muted-foreground font-medium">Choose your bet:</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              variant={betType === 'red' ? 'casino' : 'outline'}
              onClick={() => { setBetType('red'); setSelectedNumber(null); }}
              disabled={spinning}
              className={betType === 'red' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              🔴 Red
            </Button>
            <Button
              variant={betType === 'black' ? 'default' : 'outline'}
              onClick={() => { setBetType('black'); setSelectedNumber(null); }}
              disabled={spinning}
              className={betType === 'black' ? 'bg-zinc-800 hover:bg-zinc-900' : ''}
            >
              ⚫ Black
            </Button>
            <Button
              variant={betType === 'number' ? 'emerald' : 'outline'}
              onClick={() => setBetType('number')}
              disabled={spinning}
            >
              🔢 Number
            </Button>
          </div>

          {/* Number Grid */}
          {betType === 'number' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="grid grid-cols-6 sm:grid-cols-9 gap-1 p-4 bg-muted rounded-lg"
            >
              {ROULETTE_NUMBERS.map((num) => (
                <Button
                  key={num}
                  size="sm"
                  variant={selectedNumber === num ? 'gold' : 'ghost'}
                  onClick={() => setSelectedNumber(num)}
                  disabled={spinning}
                  className={`h-10 w-full text-sm font-bold ${getNumberColor(num)} ${
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
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => adjustBet(-5)}
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
              onClick={() => adjustBet(5)}
              disabled={bet >= gameConfig.maxBet || spinning}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <Button
            variant="emerald"
            size="xl"
            className="w-full"
            onClick={spin}
            disabled={spinning || !currentUser || bet > currentUser.balance || (betType === 'number' && selectedNumber === null)}
          >
            {spinning ? (
              <>
                <span className="animate-spin">🎡</span>
                Spinning...
              </>
            ) : (
              <>
                <span className="text-2xl">🎡</span>
                SPIN WHEEL
              </>
            )}
          </Button>

          {betType === 'number' && selectedNumber === null && !spinning && (
            <p className="text-center text-amber-400 text-sm">
              Select a number to bet on!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
