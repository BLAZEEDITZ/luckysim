import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

type BetType = 'red' | 'black' | 'green' | 'odd' | 'even' | 'high' | 'low' | 'number' | 'dozen' | 'column';

interface ActiveBet {
  type: BetType;
  value?: number | string;
  amount: number;
}

export const RouletteGame = ({ gameConfig }: RouletteGameProps) => {
  const { profile, user, updateBalance } = useAuth();
  const [bet, setBet] = useState(gameConfig.minBet);
  const [betType, setBetType] = useState<BetType>('red');
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [selectedDozen, setSelectedDozen] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ won: boolean; amount: number; number: number } | null>(null);
  const [shake, setShake] = useState(false);
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [editingBet, setEditingBet] = useState(false);

  const spin = async () => {
    if (!user || !profile || spinning || bet > profile.balance) return;
    if (betType === 'number' && selectedNumber === null) return;
    if (betType === 'dozen' && selectedDozen === null) return;

    setSpinning(true);
    setResult(null);
    await updateBalance(-bet);

    const winProb = await getWinProbability('roulette', user?.id);

    // Animate wheel spin
    const spinDuration = 4000;
    const startRotation = wheelRotation;
    const totalRotation = 360 * 5 + Math.random() * 360; // 5 full spins + random
    
    const startTime = Date.now();
    
    const animateWheel = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setWheelRotation(startRotation + totalRotation * eased);
      setDisplayNumber(ROULETTE_NUMBERS[Math.floor(Math.random() * ROULETTE_NUMBERS.length)]);
      
      if (progress < 1) {
        requestAnimationFrame(animateWheel);
      } else {
        // Determine outcome
        finishSpin();
      }
    };

    const finishSpin = async () => {
      const won = Math.random() < winProb;
      let payout = 0;
      let finalNumber: number;

      // Calculate payout multiplier based on bet type
      const getMultiplier = () => {
        switch (betType) {
          case 'number': return 35;
          case 'red':
          case 'black': return 2;
          case 'green': return 35;
          case 'odd':
          case 'even':
          case 'high':
          case 'low': return 2;
          case 'dozen':
          case 'column': return 3;
          default: return 2;
        }
      };

      const multiplier = getMultiplier();
      payout = won ? Math.floor(bet * multiplier) : 0;

      // Determine final number based on outcome
      if (won) {
        switch (betType) {
          case 'red':
            const redNumbers = ROULETTE_NUMBERS.filter(n => getRouletteColor(n) === 'red');
            finalNumber = redNumbers[Math.floor(Math.random() * redNumbers.length)];
            break;
          case 'black':
            const blackNumbers = ROULETTE_NUMBERS.filter(n => getRouletteColor(n) === 'black');
            finalNumber = blackNumbers[Math.floor(Math.random() * blackNumbers.length)];
            break;
          case 'green':
            finalNumber = 0;
            break;
          case 'number':
            finalNumber = selectedNumber!;
            break;
          case 'odd':
            const oddNumbers = ROULETTE_NUMBERS.filter(n => n !== 0 && n % 2 === 1);
            finalNumber = oddNumbers[Math.floor(Math.random() * oddNumbers.length)];
            break;
          case 'even':
            const evenNumbers = ROULETTE_NUMBERS.filter(n => n !== 0 && n % 2 === 0);
            finalNumber = evenNumbers[Math.floor(Math.random() * evenNumbers.length)];
            break;
          case 'high':
            const highNumbers = ROULETTE_NUMBERS.filter(n => n >= 19 && n <= 36);
            finalNumber = highNumbers[Math.floor(Math.random() * highNumbers.length)];
            break;
          case 'low':
            const lowNumbers = ROULETTE_NUMBERS.filter(n => n >= 1 && n <= 18);
            finalNumber = lowNumbers[Math.floor(Math.random() * lowNumbers.length)];
            break;
          case 'dozen':
            const dozenStart = (selectedDozen! - 1) * 12 + 1;
            const dozenNumbers = ROULETTE_NUMBERS.filter(n => n >= dozenStart && n < dozenStart + 12);
            finalNumber = dozenNumbers[Math.floor(Math.random() * dozenNumbers.length)];
            break;
          default:
            finalNumber = ROULETTE_NUMBERS[Math.floor(Math.random() * ROULETTE_NUMBERS.length)];
        }
        triggerWinConfetti();
        await updateBalance(payout);
        toast.success(`You won NPR ${formatCredits(payout)}!`);
      } else {
        // Ensure loss
        const losingNumbers = ROULETTE_NUMBERS.filter(n => {
          if (betType === 'red') return getRouletteColor(n) !== 'red';
          if (betType === 'black') return getRouletteColor(n) !== 'black';
          if (betType === 'green') return n !== 0;
          if (betType === 'number') return n !== selectedNumber;
          if (betType === 'odd') return n === 0 || n % 2 === 0;
          if (betType === 'even') return n === 0 || n % 2 === 1;
          if (betType === 'high') return n < 19;
          if (betType === 'low') return n > 18 || n === 0;
          return true;
        });
        finalNumber = losingNumbers[Math.floor(Math.random() * losingNumbers.length)] ?? 0;
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }

      setDisplayNumber(finalNumber);

      await supabase.from('bet_logs').insert({
        user_id: user.id,
        game: 'roulette',
        bet_amount: bet,
        won,
        payout: won ? payout : 0
      });

      setResult({ won, amount: payout, number: finalNumber });
      setSpinning(false);
    };

    requestAnimationFrame(animateWheel);
  };

  const adjustBet = (amount: number) => {
    const newBet = Math.max(gameConfig.minBet, Math.min(gameConfig.maxBet, bet + amount));
    setBet(newBet);
  };

  const handleBetChange = (value: string) => {
    const num = parseInt(value) || gameConfig.minBet;
    setBet(Math.max(gameConfig.minBet, Math.min(gameConfig.maxBet, num)));
  };

  const getNumberColor = (num: number): string => {
    const color = getRouletteColor(num);
    if (color === 'red') return 'bg-red-600';
    if (color === 'black') return 'bg-zinc-900';
    return 'bg-emerald-600';
  };

  const balance = profile?.balance ?? 0;

  return (
    <Card className="w-full max-w-3xl mx-auto overflow-hidden border-secondary/20 bg-gradient-to-b from-card to-background">
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
            className={`w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center text-4xl sm:text-5xl font-bold border-4 border-primary/50 shadow-xl relative overflow-hidden ${
              displayNumber !== null ? getNumberColor(displayNumber) : 'bg-muted'
            }`}
            style={{ rotate: wheelRotation }}
            transition={{ duration: 0.1 }}
          >
            {/* Wheel segments visual */}
            <div className="absolute inset-2 rounded-full border-2 border-white/20" />
            <div className="absolute inset-4 rounded-full border border-white/10" />
            <motion.span 
              className="text-white drop-shadow-lg relative z-10"
              style={{ rotate: -wheelRotation }}
            >
              {displayNumber !== null ? displayNumber : '?'}
            </motion.span>
          </motion.div>
          <p className="text-muted-foreground text-sm mt-4">
            {displayNumber !== null && !spinning && (
              <span className={`font-semibold ${getRouletteColor(displayNumber) === 'red' ? 'text-red-500' : getRouletteColor(displayNumber) === 'black' ? 'text-foreground' : 'text-emerald-500'}`}>
                {getRouletteColor(displayNumber).toUpperCase()} {displayNumber}
              </span>
            )}
          </p>
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
          
          {/* Main bet types */}
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant={betType === 'red' ? 'casino' : 'outline'}
              size="sm"
              onClick={() => { setBetType('red'); setSelectedNumber(null); setSelectedDozen(null); }}
              disabled={spinning}
              className={`text-xs sm:text-sm ${betType === 'red' ? 'bg-red-600 hover:bg-red-700' : ''}`}
            >
              🔴 Red (2x)
            </Button>
            <Button
              variant={betType === 'black' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setBetType('black'); setSelectedNumber(null); setSelectedDozen(null); }}
              disabled={spinning}
              className={`text-xs sm:text-sm ${betType === 'black' ? 'bg-zinc-800 hover:bg-zinc-900' : ''}`}
            >
              ⚫ Black (2x)
            </Button>
            <Button
              variant={betType === 'green' ? 'emerald' : 'outline'}
              size="sm"
              onClick={() => { setBetType('green'); setSelectedNumber(null); setSelectedDozen(null); }}
              disabled={spinning}
              className="text-xs sm:text-sm"
            >
              🟢 Zero (35x)
            </Button>
          </div>

          {/* Additional bet types */}
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant={betType === 'odd' ? 'gold' : 'outline'}
              size="sm"
              onClick={() => { setBetType('odd'); setSelectedNumber(null); setSelectedDozen(null); }}
              disabled={spinning}
              className="text-xs"
            >
              Odd (2x)
            </Button>
            <Button
              variant={betType === 'even' ? 'gold' : 'outline'}
              size="sm"
              onClick={() => { setBetType('even'); setSelectedNumber(null); setSelectedDozen(null); }}
              disabled={spinning}
              className="text-xs"
            >
              Even (2x)
            </Button>
            <Button
              variant={betType === 'low' ? 'gold' : 'outline'}
              size="sm"
              onClick={() => { setBetType('low'); setSelectedNumber(null); setSelectedDozen(null); }}
              disabled={spinning}
              className="text-xs"
            >
              1-18 (2x)
            </Button>
            <Button
              variant={betType === 'high' ? 'gold' : 'outline'}
              size="sm"
              onClick={() => { setBetType('high'); setSelectedNumber(null); setSelectedDozen(null); }}
              disabled={spinning}
              className="text-xs"
            >
              19-36 (2x)
            </Button>
          </div>

          {/* Dozen bets */}
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant={betType === 'dozen' && selectedDozen === 1 ? 'gold' : 'outline'}
              size="sm"
              onClick={() => { setBetType('dozen'); setSelectedDozen(1); setSelectedNumber(null); }}
              disabled={spinning}
              className="text-xs"
            >
              1st 12 (3x)
            </Button>
            <Button
              variant={betType === 'dozen' && selectedDozen === 2 ? 'gold' : 'outline'}
              size="sm"
              onClick={() => { setBetType('dozen'); setSelectedDozen(2); setSelectedNumber(null); }}
              disabled={spinning}
              className="text-xs"
            >
              2nd 12 (3x)
            </Button>
            <Button
              variant={betType === 'dozen' && selectedDozen === 3 ? 'gold' : 'outline'}
              size="sm"
              onClick={() => { setBetType('dozen'); setSelectedDozen(3); setSelectedNumber(null); }}
              disabled={spinning}
              className="text-xs"
            >
              3rd 12 (3x)
            </Button>
            <Button
              variant={betType === 'number' ? 'emerald' : 'outline'}
              size="sm"
              onClick={() => { setBetType('number'); setSelectedDozen(null); }}
              disabled={spinning}
              className="text-xs"
            >
              🔢 Number (35x)
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
                className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-secondary/20 to-secondary/10 rounded-xl min-w-[120px] sm:min-w-[140px] justify-center border border-secondary/30 cursor-pointer hover:border-secondary/50 transition-colors"
              >
                <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
                <span className="text-lg sm:text-xl font-bold text-secondary">NPR {formatCredits(bet)}</span>
              </div>
            )}
            
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

          <p className="text-center text-xs text-muted-foreground">
            Click amount to edit manually
          </p>

          <Button
            variant="emerald"
            size="lg"
            className="w-full text-base sm:text-lg font-bold"
            onClick={spin}
            disabled={spinning || !user || bet > balance || (betType === 'number' && selectedNumber === null) || (betType === 'dozen' && selectedDozen === null)}
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
