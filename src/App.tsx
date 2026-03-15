import { useState } from 'react';
import { Lobby } from './components/Lobby';
import { Game } from './components/Game';
import { AnimatePresence, motion } from 'motion/react';

export default function App() {
  const [screen, setScreen] = useState<'lobby' | 'loading' | 'game'>('lobby');
  const [selectedChar, setSelectedChar] = useState('adam');

  const handleStart = (char: string) => {
    setSelectedChar(char);
    setScreen('loading');
    setTimeout(() => {
      setScreen('game');
    }, 2000);
  };

  return (
    <div className="h-screen w-screen bg-black overflow-hidden font-display">
      <AnimatePresence mode="wait">
        {screen === 'lobby' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Lobby onStart={handleStart} />
          </motion.div>
        )}

        {screen === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen w-screen flex flex-col items-center justify-center bg-neutral-900"
          >
            <div className="relative w-96 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 2, ease: "easeInOut" }}
                className="h-full bg-ff-orange"
              />
            </div>
            <p className="mt-4 text-ff-orange font-black italic uppercase tracking-widest animate-pulse">
              Entering Bermuda...
            </p>
            <div className="mt-12 grid grid-cols-3 gap-8 opacity-20">
              <div className="w-32 h-48 bg-white rounded-lg" />
              <div className="w-32 h-48 bg-white rounded-lg" />
              <div className="w-32 h-48 bg-white rounded-lg" />
            </div>
          </motion.div>
        )}

        {screen === 'game' && (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Game />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
