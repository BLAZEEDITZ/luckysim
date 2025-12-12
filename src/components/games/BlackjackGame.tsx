import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  triggerWinConfetti, 
  formatCredits,
  createDeck,
  calculateHandValue,
  isCardRed,
  Card as CardType,
  getWinProbability
} from "@/lib/gameUtils";
import { Coins, Minus, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface BlackjackGameProps {
  gameConfig: {
    minBet: number;
    maxBet: number;
    winProbability: number;
    payoutMultiplier: number;
  };
}

type GamePhase = 'betting' | 'playing' | 'dealer' | 'finished';

const PlayingCard = ({ card, hidden = false }: { card: CardType; hidden?: boolean }) => {
  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0.8 }}
      animate={{ rotateY: hidden ? 180 : 0, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={`w-12 h-18 sm:w-16 sm:h-24 md:w-20 md:h-28 rounded-lg flex flex-col items-center justify-center font-bold text-base sm:text-lg md:text-xl shadow-lg border-2 ${
        hidden 
          ? 'bg-gradient-to-br from-purple-600 to-purple-900 border-purple-400' 
          : 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300'
      }`}
    >
      {!hidden && (
        <>
          <span className={isCardRed(card) ? 'text-red-500' : 'text-gray-900'}>
            {card.value}
          </span>
          <span className={`text-xl sm:text-2xl ${isCardRed(card) ? 'text-red-500' : 'text-gray-900'}`}>
            {card.suit}
          </span>
        </>
      )}
      {hidden && (
        <span className="text-2xl sm:text-3xl text-purple-300">?</span>
      )}
    </motion.div>
  );
};

export const BlackjackGame = ({ gameConfig }: BlackjackGameProps) => {
  const { profile, user, updateBalance } = useAuth();
  const [bet, setBet] = useState(gameConfig.minBet);
  const [deck, setDeck] = useState<CardType[]>([]);
  const [playerHand, setPlayerHand] = useState<CardType[]>([]);
  const [dealerHand, setDealerHand] = useState<CardType[]>([]);
  const [phase, setPhase] = useState<GamePhase>('betting');
  const [result, setResult] = useState<{ won: boolean; amount: number; message: string } | null>(null);
  const [shake, setShake] = useState(false);

  const logBet = async (won: boolean, payout: number) => {
    if (!user) return;
    await supabase.from('bet_logs').insert({
      user_id: user.id,
      game: 'blackjack',
      bet_amount: bet,
      won,
      payout
    });
  };

  const startGame = useCallback(async () => {
    if (!user || !profile || bet > profile.balance) return;

    const newDeck = createDeck();
    const pHand = [newDeck.pop()!, newDeck.pop()!];
    const dHand = [newDeck.pop()!, newDeck.pop()!];

    setDeck(newDeck);
    setPlayerHand(pHand);
    setDealerHand(dHand);
    setPhase('playing');
    setResult(null);
    await updateBalance(-bet);
  }, [bet, user, profile, updateBalance]);

  const endGame = async (won: boolean, message: string, push: boolean = false) => {
    const payout = push ? bet : (won ? Math.floor(bet * gameConfig.payoutMultiplier) : 0);
    
    if (won) {
      triggerWinConfetti();
      await updateBalance(payout);
      toast.success(`You won NPR ${formatCredits(payout)}!`);
    } else if (push) {
      await updateBalance(bet);
      toast.info("Push! Bet returned.");
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    
    await logBet(won, payout);
    setResult({ won, amount: payout, message });
    setPhase('finished');
  };

  const hit = useCallback(async () => {
    if (phase !== 'playing' || deck.length === 0) return;

    const newDeck = [...deck];
    const newCard = newDeck.pop()!;
    const newHand = [...playerHand, newCard];
    
    setDeck(newDeck);
    setPlayerHand(newHand);

    const handValue = calculateHandValue(newHand);
    if (handValue > 21) {
      await endGame(false, 'Bust! You went over 21.');
    }
  }, [phase, deck, playerHand]);

  const stand = useCallback(async () => {
    if (phase !== 'playing') return;
    setPhase('dealer');
    
    // Get win probability from settings
    const winProb = await getWinProbability();
    
    // Dealer plays with controlled probability
    setTimeout(async () => {
      const shouldWin = Math.random() < winProb;
      const playerValue = calculateHandValue(playerHand);
      
      let newDealerHand = [...dealerHand];
      let newDeck = [...deck];
      
      if (shouldWin) {
        // Force a win for player
        while (calculateHandValue(newDealerHand) < 17 && newDeck.length > 0) {
          newDealerHand.push(newDeck.pop()!);
        }
        // If dealer hasn't busted and beats player, bust them
        const dealerValue = calculateHandValue(newDealerHand);
        if (dealerValue <= 21 && dealerValue >= playerValue && newDeck.length > 0) {
          // Force bust
          while (calculateHandValue(newDealerHand) <= 21 && newDeck.length > 0) {
            newDealerHand.push(newDeck.pop()!);
          }
        }
      } else {
        // Force a loss for player
        while (calculateHandValue(newDealerHand) < playerValue && calculateHandValue(newDealerHand) <= 21 && newDeck.length > 0) {
          newDealerHand.push(newDeck.pop()!);
        }
      }
      
      setDealerHand(newDealerHand);
      setDeck(newDeck);
      
      // Determine result
      const finalDealerValue = calculateHandValue(newDealerHand);
      const finalPlayerValue = calculateHandValue(playerHand);
      
      if (finalDealerValue > 21) {
        await endGame(true, 'Dealer busts! You win!');
      } else if (finalPlayerValue > finalDealerValue) {
        await endGame(true, `You win with ${finalPlayerValue}!`);
      } else if (finalPlayerValue === finalDealerValue) {
        await endGame(false, `Push! It's a tie at ${finalPlayerValue}.`, true);
      } else {
        await endGame(false, `Dealer wins with ${finalDealerValue}.`);
      }
    }, 1000);
  }, [phase, playerHand, dealerHand, deck, gameConfig.winProbability]);

  const newRound = () => {
    setPlayerHand([]);
    setDealerHand([]);
    setDeck([]);
    setPhase('betting');
    setResult(null);
  };

  const adjustBet = (amount: number) => {
    const newBet = Math.max(gameConfig.minBet, Math.min(gameConfig.maxBet, bet + amount));
    setBet(newBet);
  };

  const balance = profile?.balance ?? 0;
  const playerValue = calculateHandValue(playerHand);
  const dealerValue = phase === 'finished' ? calculateHandValue(dealerHand) : calculateHandValue([dealerHand[0]].filter(Boolean));

  return (
    <Card className="w-full max-w-2xl mx-auto overflow-hidden border-accent/20 bg-gradient-to-b from-card to-background">
      <CardHeader className="text-center bg-gradient-to-b from-accent/10 to-transparent border-b border-accent/10 py-4 sm:py-6">
        <CardTitle className="text-accent text-2xl sm:text-3xl font-display">21 Blackjack</CardTitle>
        <p className="text-muted-foreground text-sm sm:text-base">Get closer to 21 than the dealer!</p>
      </CardHeader>
      
      <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Game Table */}
        <div className={`bg-gradient-to-b from-emerald-900 to-emerald-950 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6 border-4 border-emerald-700 ${shake ? 'animate-shake' : ''}`}>
          {/* Dealer's Hand */}
          <div className="text-center space-y-2">
            <p className="text-emerald-300 font-semibold text-sm sm:text-base">
              Dealer {phase !== 'betting' && `(${dealerValue}${phase !== 'finished' && dealerHand.length > 1 ? '+' : ''})`}
            </p>
            <div className="flex justify-center gap-1 sm:gap-2 min-h-[72px] sm:min-h-[112px]">
              {dealerHand.map((card, index) => (
                <PlayingCard 
                  key={index} 
                  card={card} 
                  hidden={index === 1 && phase !== 'finished'}
                />
              ))}
              {dealerHand.length === 0 && (
                <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg border-2 border-dashed border-emerald-600/50" />
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-emerald-600/50" />

          {/* Player's Hand */}
          <div className="text-center space-y-2">
            <p className="text-emerald-300 font-semibold text-sm sm:text-base">
              Your Hand {phase !== 'betting' && `(${playerValue})`}
            </p>
            <div className="flex justify-center gap-1 sm:gap-2 flex-wrap min-h-[72px] sm:min-h-[112px]">
              {playerHand.map((card, index) => (
                <PlayingCard key={index} card={card} />
              ))}
              {playerHand.length === 0 && (
                <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg border-2 border-dashed border-emerald-600/50" />
              )}
            </div>
          </div>
        </div>

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
                  ? `🎉 ${result.message} +NPR ${formatCredits(result.amount)}!` 
                  : `😔 ${result.message}`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="space-y-3 sm:space-y-4">
          {phase === 'betting' && (
            <>
              <div className="flex items-center justify-center gap-2 sm:gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => adjustBet(-20)}
                  disabled={bet <= gameConfig.minBet}
                  className="rounded-full w-9 h-9 sm:w-10 sm:h-10"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                
                <div className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-accent/20 to-accent/10 rounded-xl min-w-[120px] sm:min-w-[140px] justify-center border border-accent/30">
                  <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                  <span className="text-lg sm:text-xl font-bold text-accent">NPR {formatCredits(bet)}</span>
                </div>
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => adjustBet(20)}
                  disabled={bet >= gameConfig.maxBet}
                  className="rounded-full w-9 h-9 sm:w-10 sm:h-10"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <Button
                variant="royal"
                size="lg"
                className="w-full text-base sm:text-lg font-bold"
                onClick={startGame}
                disabled={!user || bet > balance}
              >
                <span className="text-xl sm:text-2xl">🃏</span>
                DEAL CARDS
              </Button>
            </>
          )}

          {phase === 'playing' && (
            <div className="flex gap-3 sm:gap-4 justify-center">
              <Button
                variant="emerald"
                size="lg"
                onClick={hit}
                className="flex-1 text-sm sm:text-base"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                HIT
              </Button>
              <Button
                variant="casino"
                size="lg"
                onClick={stand}
                className="flex-1 text-sm sm:text-base"
              >
                ✋ STAND
              </Button>
            </div>
          )}

          {phase === 'dealer' && (
            <div className="text-center py-4">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="text-accent font-semibold"
              >
                Dealer is playing...
              </motion.div>
            </div>
          )}

          {phase === 'finished' && (
            <Button
              variant="gold"
              size="lg"
              className="w-full text-base sm:text-lg font-bold"
              onClick={newRound}
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
              PLAY AGAIN
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};