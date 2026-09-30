import { motion } from 'framer-motion';

const variants = {
  initial: { opacity: 0, y: 14, scale: 0.99 },
  enter:   { opacity: 1, y: 0,  scale: 1,    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -8, scale: 0.99, transition: { duration: 0.16, ease: 'easeIn' } },
};

export default function PageTransition({ children }) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="enter"
      exit="exit"
      style={{ height: '100%', width: '100%' }}
    >
      {children}
    </motion.div>
  );
}
