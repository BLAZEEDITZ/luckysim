import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export const Footer = () => {
  return (
    <footer className="bg-card border-t border-border py-8 mt-16 mb-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <span className="text-2xl">🎰</span>
            <span className="font-display text-lg font-bold text-gradient-gold">
              LuckySim Casino
            </span>
          </motion.div>

          <nav className="flex items-center gap-6">
            <Link
              to="/games"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Games
            </Link>
            <Link
              to="/auth"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Account
            </Link>
          </nav>

          <p className="text-sm text-muted-foreground text-center md:text-right">
            © 2024 LuckySim. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
