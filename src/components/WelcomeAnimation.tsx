
import { motion } from "framer-motion";

const WelcomeAnimation = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: 0.8,
          delay: 0.2,
          ease: [0, 0.71, 0.2, 1.01]
        }}
      >
        <h1 className="text-6xl font-bold">
          <motion.span
            className="inline-block text-black"
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{
              type: "spring",
              damping: 10,
              stiffness: 100,
              delay: 0.4
            }}
          >
            IC
          </motion.span>
          <motion.span
            className="inline-block text-[#33C3F0]"
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{
              type: "spring",
              damping: 10,
              stiffness: 100,
              delay: 0.6
            }}
          >
            HI
          </motion.span>
        </h1>
      </motion.div>
    </div>
  );
};

export default WelcomeAnimation;
