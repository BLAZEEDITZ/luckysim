import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Disclaimer } from "@/components/layout/Disclaimer";
import { useGameStore } from "@/store/gameStore";
import { Coins, Gamepad2, Shield, Sparkles } from "lucide-react";

const Index = () => {
  const { currentUser, games } = useGameStore();

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
              <motion.span
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="inline-block text-7xl mb-6"
              >
                🎰
              </motion.span>
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
              {currentUser ? (
                <Link to="/games">
                  <Button variant="gold" size="xl" className="w-full sm:w-auto">
                    <Gamepad2 className="w-6 h-6" />
                    Play Now
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth">
                    <Button variant="gold" size="xl" className="w-full sm:w-auto">
                      <Sparkles className="w-6 h-6" />
                      Get Started
                    </Button>
                  </Link>
                  <Link to="/auth?mode=login">
                    <Button variant="outline" size="xl" className="w-full sm:w-auto">
                      Sign In
                    </Button>
                  </Link>
                </>
              )}
            </motion.div>

            {currentUser && (
              <motion.div 
                variants={itemVariants}
                className="mt-8 text-center"
              >
                <div className="inline-flex items-center gap-3 px-6 py-3 bg-card rounded-full border border-border">
                  <Coins className="w-6 h-6 text-primary" />
                  <span className="text-lg font-semibold">
                    Your Balance: <span className="text-primary">{currentUser.balance.toLocaleString()} Credits</span>
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>
        </section>

        {/* Games Preview */}
        <section className="py-16 bg-card/50">
          <div className="container mx-auto px-4">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-display font-bold text-center mb-12"
            >
              Featured <span className="text-gradient-gold">Games</span>
            </motion.h2>
            
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { 
                  id: 'slots', 
                  icon: '🎰', 
                  name: 'Lucky Spin Slots', 
                  description: 'Match 3 symbols for massive wins!',
                  color: 'gold' as const
                },
                { 
                  id: 'roulette', 
                  icon: '🎡', 
                  name: 'Classic Roulette', 
                  description: 'Bet on red, black, or your lucky number!',
                  color: 'emerald' as const
                },
                { 
                  id: 'blackjack', 
                  icon: '🃏', 
                  name: '21 Blackjack', 
                  description: 'Beat the dealer to 21!',
                  color: 'purple' as const
                },
              ].map((game, index) => {
                const config = games.find(g => g.id === game.id);
                const isEnabled = config?.enabled ?? true;
                
                return (
                  <motion.div
                    key={game.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card 
                      glow={game.color} 
                      className={`h-full card-shine ${!isEnabled ? 'opacity-50' : ''}`}
                    >
                      <CardContent className="p-6 text-center space-y-4">
                        <motion.span 
                          className="text-6xl inline-block"
                          whileHover={{ scale: 1.2, rotate: 10 }}
                        >
                          {game.icon}
                        </motion.span>
                        <h3 className="text-xl font-display font-semibold">{game.name}</h3>
                        <p className="text-muted-foreground text-sm">{game.description}</p>
                        {isEnabled ? (
                          <Link to={currentUser ? `/games/${game.id}` : '/auth'}>
                            <Button 
                              variant={game.color === 'purple' ? 'royal' : game.color} 
                              className="w-full mt-2"
                            >
                              Play Now
                            </Button>
                          </Link>
                        ) : (
                          <Button variant="ghost" disabled className="w-full mt-2">
                            Coming Soon
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                { icon: Coins, title: '10,000 Free Credits', description: 'Start playing instantly with virtual credits' },
                { icon: Shield, title: '100% Safe', description: 'No real money involved, just fun!' },
                { icon: Gamepad2, title: '3 Games', description: 'Slots, Roulette, and Blackjack' },
              ].map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center space-y-3"
                >
                  <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                    <feature.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold text-lg">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <Disclaimer />
    </div>
  );
};

export default Index;
