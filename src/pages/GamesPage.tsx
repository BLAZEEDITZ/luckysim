import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Disclaimer } from "@/components/layout/Disclaimer";
import { Coins, Lock } from "lucide-react";
import { formatCredits } from "@/lib/gameUtils";

const GamesPage = () => {
  const { currentUser, games } = useGameStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/auth');
    }
  }, [currentUser, navigate]);

  if (!currentUser) return null;

  const gamesList = [
    { 
      id: 'slots', 
      icon: '🎰', 
      name: 'Lucky Spin Slots', 
      description: 'Spin the reels and match 3 symbols to win big!',
      color: 'gold' as const,
      gradient: 'from-amber-600 to-yellow-500'
    },
    { 
      id: 'roulette', 
      icon: '🎡', 
      name: 'Classic Roulette', 
      description: 'Place your bets on red, black, or your lucky number!',
      color: 'emerald' as const,
      gradient: 'from-emerald-600 to-teal-500'
    },
    { 
      id: 'blackjack', 
      icon: '🃏', 
      name: '21 Blackjack', 
      description: 'Get as close to 21 as you can without going bust!',
      color: 'purple' as const,
      gradient: 'from-purple-600 to-pink-500'
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
              Choose Your <span className="text-gradient-gold">Game</span>
            </h1>
            <p className="text-muted-foreground text-lg mb-6">
              Select a game to start playing with your virtual credits
            </p>
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-card rounded-full border border-border glow-gold">
              <Coins className="w-6 h-6 text-primary" />
              <span className="text-lg font-semibold">
                Balance: <span className="text-primary">{formatCredits(currentUser.balance)} Credits</span>
              </span>
            </div>
          </motion.div>

          {/* Games Grid */}
          <div className="grid md:grid-cols-3 gap-8">
            {gamesList.map((game, index) => {
              const config = games.find(g => g.id === game.id);
              const isEnabled = config?.enabled ?? true;

              return (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.15 }}
                >
                  <Card 
                    glow={isEnabled ? game.color : 'none'} 
                    className={`h-full overflow-hidden card-shine group ${!isEnabled ? 'opacity-60' : ''}`}
                  >
                    <div className={`h-40 bg-gradient-to-br ${game.gradient} flex items-center justify-center relative overflow-hidden`}>
                      <motion.span 
                        className="text-7xl relative z-10"
                        whileHover={{ scale: 1.2, rotate: 10 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        {game.icon}
                      </motion.span>
                      {!isEnabled && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <Lock className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-6 space-y-4">
                      <h3 className="text-2xl font-display font-semibold">{game.name}</h3>
                      <p className="text-muted-foreground">{game.description}</p>
                      
                      {config && (
                        <div className="flex justify-between text-sm text-muted-foreground border-t border-border pt-4">
                          <span>Min: {config.minBet}</span>
                          <span>Max: {formatCredits(config.maxBet)}</span>
                          <span>Win: 2.5x</span>
                        </div>
                      )}
                      
                      {isEnabled ? (
                        <Link to={`/games/${game.id}`}>
                          <Button 
                            variant={game.color === 'purple' ? 'royal' : game.color} 
                            size="lg"
                            className="w-full mt-2"
                          >
                            Play {game.name.split(' ')[0]}
                          </Button>
                        </Link>
                      ) : (
                        <Button variant="ghost" disabled className="w-full mt-2">
                          <Lock className="w-4 h-4 mr-2" />
                          Disabled by Admin
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Low Balance Warning */}
          {currentUser.balance < 100 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12 text-center p-6 bg-destructive/10 border border-destructive/30 rounded-xl"
            >
              <p className="text-destructive font-semibold mb-2">
                ⚠️ Running low on credits!
              </p>
              <p className="text-muted-foreground text-sm">
                This is a simulation - credits are for entertainment only.
              </p>
            </motion.div>
          )}
        </div>
      </main>

      <Footer />
      <Disclaimer />
    </div>
  );
};

export default GamesPage;
