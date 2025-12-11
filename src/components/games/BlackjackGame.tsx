import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  checkWin, 
  triggerWinConfetti, 
  formatCredits,
  createDeck,
  calculateHandValue,
  isCardRed,
  Card as CardType
} from "@/lib/gameUtils";
import { Coins, Minus, Plus, RotateCcw } from "lucide-react";

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
      className={`w-16 h-24 sm:w-20 sm:h-28 rounded-lg flex flex-col items-center justify-center font-bold text-lg sm:text-xl shadow-lg border-2 ${
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
          <span className={`text-2xl ${isCardRed(card) ? 'text-red-500' : 'text-gray-900'}`}>
            {card.suit}
          </span>
        </>
      )}
      {hidden && (
        <span className="text-3xl text-purple-300">?</span>
      )}
    </motion.div>
  );
};

export const BlackjackGame = ({ gameConfig }: BlackjackGameProps) => {
  const { currentUser, updateBalance, placeBet } = useGameStore();
  const [bet, setBet] = useState(gameConfig.minBet);
  const [deck, setDeck] = useState<CardType[]>([]);
  const [playerHand, setPlayerHand] = useState<CardType[]>([]);
  const [dealerHand, setDealerHand] = useState<CardType[]>([]);
  const [phase, setPhase] = useState<GamePhase>('betting');
  const [result, setResult] = useState<{ won: boolean; amount: number; message: string } | null>(null);
  const [shake, setShake] = useState(false);

  const startGame = useCallback(() => {
    if (!currentUser || bet > currentUser.balance) return;

    const newDeck = createDeck();
    const pHand = [newDeck.pop()!, newDeck.pop()!];
    const dHand = [newDeck.pop()!, newDeck.pop()!];

    setDeck(newDeck);
    setPlayerHand(pHand);
    setDealerHand(dHand);
    setPhase('playing');
    setResult(null);
    updateBalance(-bet);
  }, [bet, currentUser, updateBalance]);

  const hit = useCallback(() => {
    if (phase !== 'playing' || deck.length === 0) return;

    const newDeck = [...deck];
    const newCard = newDeck.pop()!;
    const newHand = [...playerHand, newCard];
    
    setDeck(newDeck);
    setPlayerHand(newHand);

    const handValue = calculateHandValue(newHand);
    if (handValue > 21) {
      // Bust!
      endGame(false, 'Bust! You went over 21.');
    }
  }, [phase, deck, playerHand]);

  const stand = useCallback(() => {
    if (phase !== 'playing') return;
    setPhase('dealer');
    
    // Dealer plays with controlled probability
    setTimeout(() => {
      const shouldWin = checkWin(gameConfig.winProbability);
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
        endGame(true, 'Dealer busts! You win!');
      } else if (finalPlayerValue > finalDealerValue) {
        endGame(true, `You win with ${finalPlayerValue}!`);
      } else if (finalPlayerValue === finalDealerValue) {
        endGame(false, `Push! It's a tie at ${finalPlayerValue}.`, true);
      } else {
        endGame(false, `Dealer wins with ${finalDealerValue}.`);
      }
    }, 1000);
  }, [phase, playerHand, dealerHand, deck, gameConfig.winProbability]);

  const endGame = (won: boolean, message: string, push: boolean = false) => {
    const payout = push ? bet : (won ? Math.floor(bet * gameConfig.payoutMultiplier) : 0);
    
    if (won) {
      triggerWinConfetti();
      updateBalance(payout);
    } else if (push) {
      updateBalance(bet); // Return bet on push
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    
    placeBet('blackjack', bet, won, payout);
    setResult({ won, amount: payout, message });
    setPhase('finished');
  };

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

  const playerValue = calculateHandValue(playerHand);
  const dealerValue = phase === 'finished' ? calculateHandValue(dealerHand) : calculateHandValue([dealerHand[0]].filter(Boolean));

  return (
    <Card glow="purple" className="w-full max-w-2xl mx-auto overflow-hidden">
      <CardHeader className="text-center bg-gradient-to-b from-accent/20 to-transparent">
        <CardTitle className="text-accent text-3xl">21 Blackjack</CardTitle>
        <p className="text-muted-foreground">Get closer to 21 than the dealer!</p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Game Table */}
        <div className={`bg-gradient-to-b from-emerald-900 to-emerald-950 rounded-xl p-6 space-y-6 border-4 border-emerald-700 ${shake ? 'animate-shake' : ''}`}>
          {/* Dealer's Hand */}
          <div className="text-center space-y-2">
            <p className="text-emerald-300 font-semibold">
              Dealer {phase !== 'betting' && `(${dealerValue}${phase !== 'finished' && dealerHand.length > 1 ? '+' : ''})`}
            </p>
            <div className="flex justify-center gap-2 min-h-[112px]">
              {dealerHand.map((card, index) => (
                <PlayingCard 
                  key={index} 
                  card={card} 
                  hidden={index === 1 && phase !== 'finished'}
                />
              ))}
              {dealerHand.length === 0 && (
                <div className="w-20 h-28 rounded-lg border-2 border-dashed border-emerald-600/50" />
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-emerald-600/50" />

          {/* Player's Hand */}
          <div className="text-center space-y-2">
            <p className="text-emerald-300 font-semibold">
              Your Hand {phase !== 'betting' && `(${playerValue})`}
            </p>
            <div className="flex justify-center gap-2 flex-wrap min-h-[112px]">
              {playerHand.map((card, index) => (
                <PlayingCard key={index} card={card} />
              ))}
              {playerHand.length === 0 && (
                <div className="w-20 h-28 rounded-lg border-2 border-dashed border-emerald-600/50" />
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
              className={`text-center p-4 rounded-lg ${
                result.won 
                  ? 'bg-secondary/20 border border-secondary text-secondary' 
                  : 'bg-destructive/20 border border-destructive text-destructive'
              }`}
            >
              <p className="text-lg font-bold">
                {result.won 
                  ? `🎉 ${result.message} +${formatCredits(result.amount)} credits!` 
                  : `😔 ${result.message}`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="space-y-4">
          {phase === 'betting' && (
            <>
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => adjustBet(-20)}
                  disabled={bet <= gameConfig.minBet}
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
                  onClick={() => adjustBet(20)}
                  disabled={bet >= gameConfig.maxBet}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <Button
                variant="royal"
                size="xl"
                className="w-full"
                onClick={startGame}
                disabled={!currentUser || bet > currentUser.balance}
              >
                <span className="text-2xl">🃏</span>
                DEAL CARDS
              </Button>
            </>
          )}

          {phase === 'playing' && (
            <div className="flex gap-4 justify-center">
              <Button
                variant="emerald"
                size="lg"
                onClick={hit}
                className="flex-1"
              >
                <Plus className="w-5 h-5" />
                HIT
              </Button>
              <Button
                variant="casino"
                size="lg"
                onClick={stand}
                className="flex-1"
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
              size="xl"
              className="w-full"
              onClick={newRound}
            >
              <RotateCcw className="w-5 h-5" />
              PLAY AGAIN
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
