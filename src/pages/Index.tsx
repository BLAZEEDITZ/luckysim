import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/hooks/useAuth";
import { Gamepad2, Shield, Gift, Wallet, Zap, Trophy } from "lucide-react";
import { formatCredits } from "@/lib/gameUtils";
import logoImage from "@/assets/lucky-sim-logo.png";

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
      
      <main className="pt-16 sm:pt-20">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-16 sm:py-24 lg:py-32">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-56 sm:w-80 h-56 sm:h-80 bg-secondary/10 rounded-full blur-3xl" />
          
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="container mx-auto px-4 relative z-10"
          >
            <motion.div variants={itemVariants} className="text-center mb-6 sm:mb-8">
              <motion.img
                src={logoImage}
                alt="LuckySim Casino"
                className="w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-3xl shadow-2xl mb-4 sm:mb-6"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 3 }}
              />
            </motion.div>
            
            <motion.h1 
              variants={itemVariants}
              className="text-4xl sm:text-5xl md:text-7xl font-display font-bold text-center mb-4 sm:mb-6"
            >
              Welcome to{" "}
              <span className="text-gradient-gold">LuckySim</span>
            </motion.h1>
            
            <motion.p 
              variants={itemVariants}
              className="text-lg sm:text-xl md:text-2xl text-muted-foreground text-center max-w-2xl mx-auto mb-8 sm:mb-10 px-4"
            >
              Experience the thrill of casino games with exciting rewards and endless entertainment!
            </motion.p>
            
            <motion.div 
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4"
            >
              {user ? (
                <>
                  <Link to="/games">
                    <Button variant="gold" size="lg" className="w-full sm:w-auto text-base sm:text-lg font-bold">
                      <Gamepad2 className="w-5 h-5 sm:w-6 sm:h-6" />
                      Play Now
                    </Button>
                  </Link>
                  <Link to="/wallet">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto text-base sm:text-lg">
                      <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />
                      Wallet
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/auth">
                    <Button variant="gold" size="lg" className="w-full sm:w-auto text-base sm:text-lg font-bold">
                      <Gift className="w-5 h-5 sm:w-6 sm:h-6" />
                      Get NPR 10 Free
                    </Button>
                  </Link>
                  <Link to="/auth?mode=login">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto text-base sm:text-lg">
                      Sign In
                    </Button>
                  </Link>
                </>
              )}
            </motion.div>

            {user && profile && (
              <motion.div 
                variants={itemVariants}
                className="mt-6 sm:mt-8 text-center px-4"
              >
                <Link to="/wallet">
                  <div className="inline-flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-card to-card/80 rounded-2xl border border-primary/30 hover:border-primary transition-colors cursor-pointer shadow-lg">
                    <span className="text-lg sm:text-xl font-semibold">
                      Your Balance: <span className="text-primary font-bold">NPR {formatCredits(profile.balance)}</span>
                    </span>
                  </div>
                </Link>
              </motion.div>
            )}
          </motion.div>
        </section>

        {/* Games Preview */}
        <section className="py-12 sm:py-20 bg-gradient-to-b from-card/50 to-background">
          <div className="container mx-auto px-4">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-center mb-3 sm:mb-4"
            >
              Featured <span className="text-gradient-gold">Games</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-muted-foreground text-center mb-8 sm:mb-12 max-w-xl mx-auto text-sm sm:text-base"
            >
              Choose from our collection of exciting casino games
            </motion.p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 max-w-6xl mx-auto">
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
                    <CardContent className="p-4 sm:p-6 text-center space-y-2 sm:space-y-4">
                      <motion.span 
                        className="text-3xl sm:text-5xl inline-block"
                        whileHover={{ scale: 1.2, rotate: 10 }}
                      >
                        {game.icon}
                      </motion.span>
                      <h3 className="text-sm sm:text-lg font-display font-semibold">{game.name}</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">{game.description}</p>
                      <Link to={user ? `/games/${game.id}` : '/auth'}>
                        <Button 
                          variant={game.color === 'purple' ? 'royal' : game.color} 
                          className="w-full mt-2"
                          size="sm"
                        >
                          Play
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
        <section className="py-12 sm:py-20">
          <div className="container mx-auto px-4">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-center mb-8 sm:mb-12"
            >
              Why Choose <span className="text-gradient-gold">LuckySim</span>
            </motion.h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 max-w-5xl mx-auto">
              {[
                { icon: Gift, title: 'NPR 10 Free Signup', description: 'Start playing instantly with free credits', color: 'text-primary' },
                { icon: Shield, title: '100% Secure', description: 'Safe and trusted platform', color: 'text-secondary' },
                { icon: Zap, title: 'Instant Play', description: 'No downloads required', color: 'text-amber-400' },
                { icon: Trophy, title: 'Fair Games', description: 'Provably fair gaming', color: 'text-purple-400' },
              ].map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center space-y-2 sm:space-y-4 p-4 sm:p-6 bg-card/50 rounded-2xl border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-gradient-to-br from-muted to-muted/50 rounded-2xl flex items-center justify-center ${feature.color}`}>
                    <feature.icon className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                  <h3 className="font-display font-semibold text-sm sm:text-lg">{feature.title}</h3>
                  <p className="text-muted-foreground text-xs sm:text-sm">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer spacing */}
        <div className="py-4" />
      </main>
    </div>
  );
};

export default Index;