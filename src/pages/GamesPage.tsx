import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { Coins, Wallet } from "lucide-react";
import { formatCredits } from "@/lib/gameUtils";

const GamesPage = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="text-4xl"
        >
          🎰
        </motion.div>
      </div>
    );
  }

  if (!user) return null;

  const gamesList = [
    { 
      id: 'slots', 
      icon: '🎰', 
      name: 'Lucky Spin Slots', 
      description: 'Spin the reels and match 3 symbols to win big!',
      color: 'gold' as const,
      gradient: 'from-amber-600 to-yellow-500',
      minBet: 10,
      maxBet: 1000
    },
    { 
      id: 'roulette', 
      icon: '🎡', 
      name: 'Classic Roulette', 
      description: 'Place your bets on red, black, or your lucky number!',
      color: 'emerald' as const,
      gradient: 'from-emerald-600 to-teal-500',
      minBet: 5,
      maxBet: 500
    },
    { 
      id: 'blackjack', 
      icon: '🃏', 
      name: '21 Blackjack', 
      description: 'Get as close to 21 as you can without going bust!',
      color: 'purple' as const,
      gradient: 'from-purple-600 to-pink-500',
      minBet: 20,
      maxBet: 2000
    },
    { 
      id: 'mines', 
      icon: '💎', 
      name: 'Mines', 
      description: 'Find the diamonds and avoid the mines! Cash out anytime.',
      color: 'emerald' as const,
      gradient: 'from-emerald-500 to-cyan-500',
      minBet: 5,
      maxBet: 500
    },
    { 
      id: 'plinko', 
      icon: '⚪', 
      name: 'Plinko', 
      description: 'Drop the ball and watch it bounce to your fortune!',
      color: 'purple' as const,
      gradient: 'from-violet-600 to-fuchsia-500',
      minBet: 5,
      maxBet: 500
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-12 px-4">
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
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link to="/wallet">
                <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-card to-card/80 rounded-2xl border border-primary/30 hover:border-primary transition-colors cursor-pointer shadow-lg">
                  <Coins className="w-6 h-6 text-primary" />
                  <span className="text-lg font-semibold">
                    Balance: <span className="text-primary font-bold">NPR {formatCredits(profile?.balance ?? 0)}</span>
                  </span>
                </div>
              </Link>
              <Link to="/wallet">
                <Button variant="outline" size="lg" className="rounded-xl">
                  <Wallet className="w-5 h-5 mr-2" />
                  Deposit / Withdraw
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Games Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {gamesList.map((game, index) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  glow={game.color} 
                  className="h-full overflow-hidden card-shine group hover:scale-[1.02] transition-transform duration-300"
                >
                  <div className={`h-40 bg-gradient-to-br ${game.gradient} flex items-center justify-center relative overflow-hidden`}>
                    <motion.span 
                      className="text-7xl relative z-10"
                      whileHover={{ scale: 1.2, rotate: 10 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      {game.icon}
                    </motion.span>
                    <div className="absolute inset-0 bg-black/10" />
                  </div>
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-2xl font-display font-semibold">{game.name}</h3>
                    <p className="text-muted-foreground">{game.description}</p>
                    
                    <div className="flex justify-between text-sm text-muted-foreground border-t border-border/50 pt-4">
                      <span>Min: NPR {game.minBet}</span>
                      <span>Max: NPR {game.maxBet}</span>
                    </div>
                    
                    <Link to={`/games/${game.id}`}>
                      <Button 
                        variant={game.color === 'purple' ? 'royal' : game.color} 
                        size="lg"
                        className="w-full mt-2 text-lg font-bold"
                      >
                        Play {game.name.split(' ')[0]}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Low Balance Warning */}
          {profile && profile.balance < 10 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12 text-center p-6 bg-destructive/10 border border-destructive/30 rounded-2xl"
            >
              <p className="text-destructive font-semibold mb-2">
                ⚠️ Running low on credits!
              </p>
              <Link to="/wallet">
                <Button variant="outline" className="mt-2">
                  <Wallet className="w-4 h-4 mr-2" />
                  Request Deposit
                </Button>
              </Link>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
};

export default GamesPage;
