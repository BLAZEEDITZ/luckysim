import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/hooks/useAuth";
import { Coins, Gamepad2, Shield, Gift, Wallet, Zap, Trophy } from "lucide-react";
import { formatCredits } from "@/lib/gameUtils";

const Index = () => {
  const { user, profile } = useAuth();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  const games = [
    { 
      id: 'slots', 
      icon: '🎰', 
      name: 'Lucky Slots', 
      description: 'Match 3 symbols for massive wins!',
      color: 'gold' as const
    },
    { 
      id: 'roulette', 
      icon: '🎡', 
      name: 'Roulette', 
      description: 'Bet on red, black, or your lucky number!',
      color: 'emerald' as const
    },
    { 
      id: 'blackjack', 
      icon: '🃏', 
      name: 'Blackjack', 
      description: 'Beat the dealer to 21!',
      color: 'purple' as const
    },
    { 
      id: 'mines', 
      icon: '💎', 
      name: 'Mines', 
      description: 'Find diamonds, avoid mines!',
      color: 'emerald' as const
    },
    { 
      id: 'plinko', 
      icon: '⚪', 
      name: 'Plinko', 
      description: 'Drop the ball, win big!',
      color: 'purple' as const
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-20">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-24 lg:py-32">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
          
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="container mx-auto px-4 relative z-10"
          >
            <motion.div variants={itemVariants} className="text-center mb-8">
              <motion.div
                className="w-28 h-28 mx-auto bg-gradient-to-br from-primary via-primary/80 to-amber-600 rounded-3xl flex items-center justify-center shadow-2xl mb-6 border-2 border-primary/30"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 3 }}
              >
                <span className="text-5xl font-bold text-primary-foreground font-display">L</span>
              </motion.div>
            </motion.div>
            
            <motion.h1 
              variants={itemVariants}
              className="text-5xl md:text-7xl font-display font-bold text-center mb-6"
            >
              Welcome to{" "}
              <span className="text-gradient-gold">LuckySim</span>
            </motion.h1>
            
            <motion.p 
              variants={itemVariants}
              className="text-xl md:text-2xl text-muted-foreground text-center max-w-2xl mx-auto mb-10"
            >
              Experience the thrill of casino games with virtual credits. 
              No real money, just pure entertainment!
            </motion.p>
            
            <motion.div 
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              {user ? (
                <>
                  <Link to="/games">
                    <Button variant="gold" size="xl" className="w-full sm:w-auto text-lg font-bold">
                      <Gamepad2 className="w-6 h-6" />
                      Play Now
                    </Button>
                  </Link>
                  <Link to="/wallet">
                    <Button variant="outline" size="xl" className="w-full sm:w-auto text-lg">
                      <Wallet className="w-6 h-6" />
                      Wallet
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/auth">
                    <Button variant="gold" size="xl" className="w-full sm:w-auto text-lg font-bold">
                      <Gift className="w-6 h-6" />
                      Get $10 Free
                    </Button>
                  </Link>
                  <Link to="/auth?mode=login">
                    <Button variant="outline" size="xl" className="w-full sm:w-auto text-lg">
                      Sign In
                    </Button>
                  </Link>
                </>
              )}
            </motion.div>

            {user && profile && (
              <motion.div 
                variants={itemVariants}
                className="mt-8 text-center"
              >
                <Link to="/wallet">
                  <div className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-card to-card/80 rounded-2xl border border-primary/30 hover:border-primary transition-colors cursor-pointer shadow-lg">
                    <Coins className="w-7 h-7 text-primary" />
                    <span className="text-xl font-semibold">
                      Your Balance: <span className="text-primary font-bold">${formatCredits(profile.balance)}</span>
                    </span>
                  </div>
                </Link>
              </motion.div>
            )}
          </motion.div>
        </section>

        {/* Games Preview */}
        <section className="py-20 bg-gradient-to-b from-card/50 to-background">
          <div className="container mx-auto px-4">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-display font-bold text-center mb-4"
            >
              Featured <span className="text-gradient-gold">Games</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-muted-foreground text-center mb-12 max-w-xl mx-auto"
            >
              Choose from our collection of exciting casino games
            </motion.p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
              {games.map((game, index) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card 
                    glow={game.color} 
                    className="h-full card-shine group hover:scale-105 transition-transform duration-300"
                  >
                    <CardContent className="p-6 text-center space-y-4">
                      <motion.span 
                        className="text-5xl inline-block"
                        whileHover={{ scale: 1.2, rotate: 10 }}
                      >
                        {game.icon}
                      </motion.span>
                      <h3 className="text-lg font-display font-semibold">{game.name}</h3>
                      <p className="text-muted-foreground text-sm">{game.description}</p>
                      <Link to={user ? `/games/${game.id}` : '/auth'}>
                        <Button 
                          variant={game.color === 'purple' ? 'royal' : game.color} 
                          className="w-full mt-2"
                          size="sm"
                        >
                          Play Now
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-display font-bold text-center mb-12"
            >
              Why Choose <span className="text-gradient-gold">LuckySim</span>
            </motion.h2>
            <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
              {[
                { icon: Gift, title: '$10 Free Signup', description: 'Start playing instantly with free credits', color: 'text-primary' },
                { icon: Shield, title: '100% Safe', description: 'No real money involved - just fun!', color: 'text-secondary' },
                { icon: Zap, title: 'Instant Play', description: 'No downloads required', color: 'text-amber-400' },
                { icon: Trophy, title: 'Fair Games', description: '33% win rate on all games', color: 'text-purple-400' },
              ].map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center space-y-4 p-6 bg-card/50 rounded-2xl border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className={`w-16 h-16 mx-auto bg-gradient-to-br from-muted to-muted/50 rounded-2xl flex items-center justify-center ${feature.color}`}>
                    <feature.icon className="w-8 h-8" />
                  </div>
                  <h3 className="font-display font-semibold text-lg">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="py-8 border-t border-border/50">
          <div className="container mx-auto px-4">
            <p className="text-center text-sm text-muted-foreground max-w-2xl mx-auto">
              ⚠️ <strong>Simulated game for educational use only</strong> – no real money involved. 
              This platform is for entertainment purposes and does not offer real gambling services.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
