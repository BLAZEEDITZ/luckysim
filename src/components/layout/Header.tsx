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
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50"
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-primary via-primary/80 to-amber-600 rounded-xl flex items-center justify-center shadow-lg border border-primary/30">
              <span className="text-xl font-bold text-primary-foreground font-display">L</span>
            </div>
          </motion.div>
          <span className="font-display text-xl font-bold text-gradient-gold">
            LuckySim
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {user ? (
            <>
              <Link to="/">
                <Button variant="ghost" size="sm" className="hidden sm:flex">
                  <Home className="w-4 h-4" />
                  <span className="ml-1">Home</span>
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
                  <Button variant="ghost" size="sm" className="text-primary">
                    <Shield className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">Admin</span>
                  </Button>
                </Link>
              )}

              <Link to="/wallet">
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/20 to-primary/10 rounded-xl hover:from-primary/30 hover:to-primary/20 transition-colors cursor-pointer border border-primary/30">
                  <Coins className="w-4 h-4 text-primary" />
                  <span className="font-bold text-primary">
                    ${formatCredits(profile?.balance ?? 0)}
                  </span>
                </div>
              </Link>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSound}
                title={soundEnabled ? "Mute sounds" : "Enable sounds"}
                className="hidden sm:flex"
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
              <Button variant="gold" className="font-bold">Sign In</Button>
            </Link>
          )}
        </nav>
      </div>
    </motion.header>
  );
};
