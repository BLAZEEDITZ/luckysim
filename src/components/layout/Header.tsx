import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { formatCredits } from "@/lib/gameUtils";
import { Coins, Volume2, VolumeX, LogOut, Shield, Home, Wallet, Gamepad2 } from "lucide-react";
import { useState } from "react";

export const Header = () => {
  const { user, profile, isAdmin, signOut } = useAuth();
  const [soundEnabled, setSoundEnabled] = useState(true);

  const toggleSound = () => setSoundEnabled(!soundEnabled);

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
            className="relative"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-xl font-bold text-primary-foreground">L</span>
            </div>
          </motion.div>
          <span className="font-display text-xl font-bold text-gradient-gold">
            LuckySim
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          {user ? (
            <>
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1">Home</span>
                </Button>
              </Link>

              <Link to="/games">
                <Button variant="ghost" size="sm">
                  <Gamepad2 className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1">Games</span>
                </Button>
              </Link>

              <Link to="/wallet">
                <Button variant="ghost" size="sm">
                  <Wallet className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1">Wallet</span>
                </Button>
              </Link>

              {isAdmin && (
                <Link to="/admin">
                  <Button variant="ghost" size="sm">
                    <Shield className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">Admin</span>
                  </Button>
                </Link>
              )}

              <Link to="/wallet">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors cursor-pointer">
                  <Coins className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-primary">
                    ${formatCredits(profile?.balance ?? 0)}
                  </span>
                </div>
              </Link>

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

              <Button variant="ghost" size="icon" onClick={signOut} title="Logout">
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
