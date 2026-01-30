import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  triggerWinConfetti, 
  formatCredits,
  createDeck,
  calculateHandValue,
  isCardRed,
  Card as CardType,
  getEffectiveWinProbability,
  decrementForcedOutcome,
  checkMaxProfitLimit
} from "@/lib/gameUtils";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { Coins, Minus, Plus, RotateCcw, Spade, Heart } from "lucide-react";
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

const PlayingCard = ({ card, hidden = false, isNew = false }: { card: CardType; hidden?: boolean; isNew?: boolean }) => {
  return (
    <motion.div
      initial={isNew ? { rotateY: 180, scale: 0.5, x: 100 } : { rotateY: hidden ? 180 : 0, scale: 1 }}
      animate={{ rotateY: hidden ? 180 : 0, scale: 1, x: 0 }}
      transition={{ duration: 0.5, type: "spring" }}
      className={`w-14 h-20 sm:w-16 sm:h-24 md:w-20 md:h-28 rounded-lg flex flex-col items-center justify-center font-bold text-base sm:text-lg md:text-xl shadow-lg border-2 relative overflow-hidden ${
        hidden 
          ? 'bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900 border-purple-400' 
          : 'bg-gradient-to-br from-white to-gray-100 border-gray-300'
      }`}
    >
      {hidden && (
        <>
          <div className="absolute inset-2 border border-purple-400/30 rounded" />
          <span className="text-3xl sm:text-4xl text-purple-300">?</span>
        </>
      )}
      {!hidden && (
        <>
          <span className={`absolute top-1 left-1.5 text-xs sm:text-sm ${isCardRed(card) ? 'text-red-500' : 'text-gray-900'}`}>
            {card.value}
          </span>
          <span className={`text-2xl sm:text-3xl ${isCardRed(card) ? 'text-red-500' : 'text-gray-900'}`}>
            {card.suit}
          </span>
          <span className={`absolute bottom-1 right-1.5 text-xs sm:text-sm rotate-180 ${isCardRed(card) ? 'text-red-500' : 'text-gray-900'}`}>
            {card.value}
          </span>
        </>
      )}
    </motion.div>
  );
};

export const BlackjackGame = ({ gameConfig }: BlackjackGameProps) => {
  const { profile, user, updateBalance } = useAuth();
  const { playCardDeal, playWin, playBigWin, playLose, playChip } = useSoundEffects();
  const [bet, setBet] = useState(gameConfig.minBet);
  const [deck, setDeck] = useState<CardType[]>([]);
  const [playerHand, setPlayerHand] = useState<CardType[]>([]);
  const [dealerHand, setDealerHand] = useState<CardType[]>([]);
  const [phase, setPhase] = useState<GamePhase>('betting');
  const [result, setResult] = useState<{ won: boolean; amount: number; message: string } | null>(null);
  const [shake, setShake] = useState(false);
  const [editingBet, setEditingBet] = useState(false);
  const [canDouble, setCanDouble] = useState(false);
  const [canSplit, setCanSplit] = useState(false);

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
    // Create a 6-deck shoe for more realism
    const multiDeck = [...newDeck, ...createDeck(), ...createDeck(), ...createDeck(), ...createDeck(), ...createDeck()];
    
    const pHand = [multiDeck.pop()!, multiDeck.pop()!];
    const dHand = [multiDeck.pop()!, multiDeck.pop()!];

    setDeck(multiDeck);
    setPlayerHand(pHand);
    setDealerHand(dHand);
    setPhase('playing');
    setResult(null);
    
    // Play card deal sounds
    playCardDeal();
    setTimeout(() => playCardDeal(), 200);
    setTimeout(() => playCardDeal(), 400);
    setTimeout(() => playCardDeal(), 600);
    
    // Check for options
    setCanDouble(pHand.length === 2 && bet * 2 <= profile.balance);
    setCanSplit(pHand.length === 2 && pHand[0].value === pHand[1].value);
    
    await updateBalance(-bet);

    // Check for blackjack
    const playerValue = calculateHandValue(pHand);
    const dealerValue = calculateHandValue(dHand);
    
    if (playerValue === 21 && dealerValue === 21) {
      setPhase('finished');
      await updateBalance(bet); // Push
      setResult({ won: false, amount: bet, message: "Both Blackjack - Push!" });
      toast.info("Both have Blackjack - Push!");
    } else if (playerValue === 21) {
      const blackjackPayout = Math.floor(bet * 2.5);
      setPhase('finished');
      await updateBalance(blackjackPayout);
      await logBet(true, blackjackPayout);
      triggerWinConfetti();
      playBigWin();
      setResult({ won: true, amount: blackjackPayout, message: "BLACKJACK!" });
      toast.success(`Blackjack! Won NPR ${formatCredits(blackjackPayout)}!`);
    }
  }, [bet, user, profile, updateBalance, playCardDeal, playBigWin]);

  const endGame = async (won: boolean, message: string, push: boolean = false) => {
    const payout = push ? bet : (won ? Math.floor(bet * gameConfig.payoutMultiplier) : 0);
    
    if (won) {
      triggerWinConfetti();
      playWin();
      await updateBalance(payout);
      if (user?.id) await decrementForcedOutcome(user.id, true);
      toast.success(`You won NPR ${formatCredits(payout)}!`);
    } else if (push) {
      await updateBalance(bet);
      toast.info("Push! Bet returned.");
    } else {
      if (user?.id) await decrementForcedOutcome(user.id, false);
      playLose();
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
    setCanDouble(false);
    setCanSplit(false);

    const handValue = calculateHandValue(newHand);
    if (handValue > 21) {
      await endGame(false, 'Bust! You went over 21.');
    } else if (handValue === 21) {
      // Auto-stand on 21
      stand();
    }
  }, [phase, deck, playerHand]);

  const stand = useCallback(async () => {
    if (phase !== 'playing') return;
    setPhase('dealer');
    setCanDouble(false);
    setCanSplit(false);
    
    // Get effective win probability (handles roaming, auto-loss on increase, forced outcomes)
    let { probability: winProb, forceLoss } = user?.id
      ? await getEffectiveWinProbability('blackjack', user.id, bet)
      : { probability: 0.15, forceLoss: false };
    
    // Also check max profit limit
    if (!forceLoss && user?.id) {
      const maxPayout = bet * 2.5;
      const wouldExceedLimit = await checkMaxProfitLimit(user.id, maxPayout, profile?.balance ?? 0);
      if (wouldExceedLimit) {
        winProb = 0.05;
      }
    }
    
    const shouldWin = Math.random() < winProb;
    const playerValue = calculateHandValue(playerHand);
    
    // Dealer draws cards
    let newDealerHand = [...dealerHand];
    let newDeck = [...deck];
    
    const drawCard = () => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          if (newDeck.length > 0) {
            newDealerHand = [...newDealerHand, newDeck.pop()!];
            setDealerHand(newDealerHand);
            setDeck(newDeck);
          }
          resolve();
        }, 600);
      });
    };

    // Dealer draws until 17 or higher
    const dealerPlay = async () => {
      while (calculateHandValue(newDealerHand) < 17 && newDeck.length > 0) {
        await drawCard();
      }
      
      // If we're controlling outcome and dealer hasn't busted yet
      if (shouldWin && calculateHandValue(newDealerHand) <= 21 && calculateHandValue(newDealerHand) >= playerValue) {
        // Try to bust dealer if they're winning
        while (calculateHandValue(newDealerHand) <= 21 && calculateHandValue(newDealerHand) >= playerValue && newDeck.length > 0) {
          await drawCard();
          if (calculateHandValue(newDealerHand) > 21) break;
        }
      }
      
      // Final result
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
    };

    // Reveal dealer's hidden card first
    setTimeout(dealerPlay, 500);
  }, [phase, playerHand, dealerHand, deck]);

  const doubleDown = async () => {
    if (phase !== 'playing' || !canDouble || !profile || bet * 2 > profile.balance) return;
    
    await updateBalance(-bet);
    
    const newDeck = [...deck];
    const newCard = newDeck.pop()!;
    const newHand = [...playerHand, newCard];
    
    setDeck(newDeck);
    setPlayerHand(newHand);
    setCanDouble(false);
    setCanSplit(false);

    const handValue = calculateHandValue(newHand);
    if (handValue > 21) {
      await endGame(false, 'Bust! You went over 21.');
    } else {
      stand();
    }
  };

  const newRound = () => {
    setPlayerHand([]);
    setDealerHand([]);
    setDeck([]);
    setPhase('betting');
    setResult(null);
    setCanDouble(false);
    setCanSplit(false);
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
  const playerValue = calculateHandValue(playerHand);
  const dealerValue = phase === 'finished' ? calculateHandValue(dealerHand) : calculateHandValue([dealerHand[0]].filter(Boolean));

  return (
    <Card className="w-full max-w-2xl mx-auto overflow-hidden border-accent/20 bg-gradient-to-b from-card to-background">
      <CardHeader className="text-center bg-gradient-to-b from-accent/10 to-transparent border-b border-accent/10 py-4 sm:py-6">
        <div className="flex items-center justify-center gap-2">
          <Spade className="w-6 h-6 text-foreground" />
          <CardTitle className="text-accent text-2xl sm:text-3xl font-display">21 Blackjack</CardTitle>
          <Heart className="w-6 h-6 text-red-500" />
        </div>
        <p className="text-muted-foreground text-sm sm:text-base">Get closer to 21 than the dealer!</p>
      </CardHeader>
      
      <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Game Table */}
        <div className={`bg-gradient-to-b from-emerald-900 to-emerald-950 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6 border-4 border-emerald-700 shadow-xl ${shake ? 'animate-shake' : ''}`}>
          {/* Dealer's Hand */}
          <div className="text-center space-y-2">
            <p className="text-emerald-300 font-semibold text-sm sm:text-base">
              Dealer {phase !== 'betting' && `(${dealerValue}${phase !== 'finished' && dealerHand.length > 1 ? '+' : ''})`}
            </p>
            <div className="flex justify-center gap-1 sm:gap-2 min-h-[80px] sm:min-h-[112px]">
              <AnimatePresence>
                {dealerHand.map((card, index) => (
                  <PlayingCard 
                    key={`dealer-${index}`}
                    card={card} 
                    hidden={index === 1 && phase !== 'finished'}
                    isNew={index > 1}
                  />
                ))}
              </AnimatePresence>
              {dealerHand.length === 0 && (
                <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg border-2 border-dashed border-emerald-600/50 flex items-center justify-center text-emerald-600/50">
                  ?
                </div>
              )}
            </div>
          </div>

          {/* Divider with text */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-emerald-600/50" />
            <span className="text-emerald-400 text-xs font-medium">VS</span>
            <div className="flex-1 border-t border-emerald-600/50" />
          </div>

          {/* Player's Hand */}
          <div className="text-center space-y-2">
            <p className="text-emerald-300 font-semibold text-sm sm:text-base">
              Your Hand {phase !== 'betting' && (
                <span className={playerValue > 21 ? 'text-red-400' : playerValue === 21 ? 'text-secondary' : ''}>
                  ({playerValue})
                </span>
              )}
            </p>
            <div className="flex justify-center gap-1 sm:gap-2 flex-wrap min-h-[80px] sm:min-h-[112px]">
              <AnimatePresence>
                {playerHand.map((card, index) => (
                  <PlayingCard key={`player-${index}`} card={card} isNew={index > 1} />
                ))}
              </AnimatePresence>
              {playerHand.length === 0 && (
                <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg border-2 border-dashed border-emerald-600/50 flex items-center justify-center text-emerald-600/50">
                  ?
                </div>
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
                  : result.amount > 0 
                    ? 'bg-amber-500/20 border border-amber-500 text-amber-400'
                    : 'bg-destructive/20 border border-destructive text-destructive'
              }`}
            >
              <p className="text-base sm:text-lg font-bold">
                {result.won 
                  ? `🎉 ${result.message} +NPR ${formatCredits(result.amount)}!` 
                  : result.amount > 0 
                    ? `${result.message} Bet returned.`
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
                    onClick={() => setEditingBet(true)}
                    className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-accent/20 to-accent/10 rounded-xl min-w-[120px] sm:min-w-[140px] justify-center border border-accent/30 cursor-pointer hover:border-accent/50 transition-colors"
                  >
                    <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                    <span className="text-lg sm:text-xl font-bold text-accent">NPR {formatCredits(bet)}</span>
                  </div>
                )}
                
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

              <p className="text-center text-xs text-muted-foreground">
                Click amount to edit manually
              </p>

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
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Button
                variant="emerald"
                size="lg"
                onClick={hit}
                className="text-sm sm:text-base"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                HIT
              </Button>
              <Button
                variant="casino"
                size="lg"
                onClick={stand}
                className="text-sm sm:text-base"
              >
                ✋ STAND
              </Button>
              {canDouble && (
                <Button
                  variant="gold"
                  size="lg"
                  onClick={doubleDown}
                  className="col-span-2 text-sm sm:text-base"
                  disabled={bet * 2 > balance}
                >
                  💰 DOUBLE DOWN
                </Button>
              )}
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

        {/* Rules hint */}
        <div className="text-xs text-muted-foreground text-center p-2 bg-muted/30 rounded-lg">
          <p>Blackjack pays 3:2 • Dealer stands on 17 • Double down on first 2 cards</p>
        </div>
      </CardContent>
    </Card>
  );
};
