import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { formatCredits } from "@/lib/gameUtils";
import { Volume2, VolumeX, LogOut, Shield, Home, Wallet, Gamepad2 } from "lucide-react";
import { useState } from "react";
import logoImage from "@/assets/lucky-sim-logo.png";

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
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="relative"
          >
            <img 
              src={logoImage} 
              alt="LuckySim Casino" 
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-contain"
            />
          </motion.div>
          <span className="font-display text-lg sm:text-xl font-bold text-gradient-gold hidden sm:block">
            LuckySim
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {user ? (
            <>
              <Link to="/">
                <Button variant="ghost" size="sm" className="hidden md:flex px-2 sm:px-3">
                  <Home className="w-4 h-4" />
                  <span className="ml-1 hidden lg:inline">Home</span>
                </Button>
              </Link>

              <Link to="/games">
                <Button variant="ghost" size="sm" className="px-2 sm:px-3">
                  <Gamepad2 className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1">Games</span>
                </Button>
              </Link>

              <Link to="/wallet">
                <Button variant="ghost" size="sm" className="px-2 sm:px-3">
                  <Wallet className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1">Wallet</span>
                </Button>
              </Link>

              {isAdmin && (
                <Link to="/admin">
                  <Button variant="ghost" size="sm" className="text-primary px-2 sm:px-3">
                    <Shield className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">Admin</span>
                  </Button>
                </Link>
              )}

              <Link to="/wallet">
                <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-primary/20 to-primary/10 rounded-xl hover:from-primary/30 hover:to-primary/20 transition-colors cursor-pointer border border-primary/30">
                  <span className="font-bold text-primary text-sm sm:text-base">
                    NPR {formatCredits(profile?.balance ?? 0)}
                  </span>
                </div>
              </Link>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSound}
                title={soundEnabled ? "Mute sounds" : "Enable sounds"}
                className="hidden md:flex w-8 h-8 sm:w-9 sm:h-9"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </Button>

              <Button variant="ghost" size="icon" onClick={signOut} title="Logout" className="w-8 h-8 sm:w-9 sm:h-9">
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button variant="gold" size="sm" className="font-bold text-sm sm:text-base px-3 sm:px-4">Sign In</Button>
            </Link>
          )}
        </nav>
      </div>
    </motion.header>
  );
};