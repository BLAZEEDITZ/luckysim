import { motion } from "framer-motion";

export const Disclaimer = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-destructive/90 backdrop-blur-sm py-2 px-4 text-center z-40"
    >
      <p className="text-sm font-medium text-destructive-foreground">
        ⚠️ SIMULATION ONLY - This is an educational demo. No real money is involved or can be won.
      </p>
    </motion.div>
  );
};
