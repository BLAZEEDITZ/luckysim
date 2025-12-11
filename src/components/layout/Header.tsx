import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { Button } from "@/components/ui/button";
import { formatCredits } from "@/lib/gameUtils";
import { Coins, Volume2, VolumeX, LogOut, Shield, Home } from "lucide-react";

export const Header = () => {
  const { currentUser, soundEnabled, toggleSound, logout } = useGameStore();

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50"
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.5 }}
            className="text-3xl"
          >
            🎰
          </motion.div>
          <span className="font-display text-xl font-bold text-gradient-gold">
            LuckySim
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          {currentUser ? (
            <>
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">Home</span>
                </Button>
              </Link>

              <Link to="/games">
                <Button variant="ghost" size="sm">
                  Games
                </Button>
              </Link>

              {currentUser.isAdmin && (
                <Link to="/admin">
                  <Button variant="ghost" size="sm">
                    <Shield className="w-4 h-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </Button>
                </Link>
              )}

              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
                <Coins className="w-4 h-4 text-primary" />
                <span className="font-semibold text-primary">
                  {formatCredits(currentUser.balance)}
                </span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSound}
                title={soundEnabled ? "Mute sounds" : "Enable sounds"}
              >
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5" />
                )}
              </Button>

              <Button variant="ghost" size="icon" onClick={logout} title="Logout">
                <LogOut className="w-5 h-5" />
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button variant="gold">Sign In</Button>
            </Link>
          )}
        </nav>
      </div>
    </motion.header>
  );
};
