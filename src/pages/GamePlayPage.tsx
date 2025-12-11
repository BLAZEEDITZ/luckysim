import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { Header } from "@/components/layout/Header";
import { Disclaimer } from "@/components/layout/Disclaimer";
import { SlotMachine } from "@/components/games/SlotMachine";
import { RouletteGame } from "@/components/games/RouletteGame";
import { BlackjackGame } from "@/components/games/BlackjackGame";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock } from "lucide-react";

const GamePlayPage = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { currentUser, games } = useGameStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/auth');
    }
  }, [currentUser, navigate]);

  if (!currentUser) return null;

  const gameConfig = games.find(g => g.id === gameId);
  
  if (!gameConfig) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Game not found</h1>
          <Link to="/games">
            <Button variant="gold">Back to Games</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!gameConfig.enabled) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-20 px-4 flex items-center justify-center min-h-[80vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <Lock className="w-16 h-16 text-muted-foreground mx-auto" />
            <h1 className="text-2xl font-display font-bold">Game Disabled</h1>
            <p className="text-muted-foreground">This game has been temporarily disabled by the administrator.</p>
            <Link to="/games">
              <Button variant="gold">
                <ArrowLeft className="w-4 h-4" />
                Back to Games
              </Button>
            </Link>
          </motion.div>
        </main>
        <Disclaimer />
      </div>
    );
  }

  const renderGame = () => {
    switch (gameId) {
      case 'slots':
        return <SlotMachine gameConfig={gameConfig} />;
      case 'roulette':
        return <RouletteGame gameConfig={gameConfig} />;
      case 'blackjack':
        return <BlackjackGame gameConfig={gameConfig} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-20 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-8"
          >
            <Link to="/games">
              <Button variant="ghost">
                <ArrowLeft className="w-4 h-4" />
                All Games
              </Button>
            </Link>
          </motion.div>

          {/* Game */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {renderGame()}
          </motion.div>
        </div>
      </main>

      <Disclaimer />
    </div>
  );
};

export default GamePlayPage;
