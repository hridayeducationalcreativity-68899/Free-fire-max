import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Play, Users, Trophy, Settings, Shield } from 'lucide-react';

interface LobbyProps {
  onStart: (character: string) => void;
}

const CHARACTERS = [
  { id: 'adam', name: 'Adam', description: 'The original survivor.', image: 'https://picsum.photos/seed/adam/400/600' },
  { id: 'eve', name: 'Eve', description: 'Quick and agile.', image: 'https://picsum.photos/seed/eve/400/600' },
];

export const Lobby: React.FC<LobbyProps> = ({ onStart }) => {
  const [selectedChar, setSelectedChar] = useState(CHARACTERS[0]);

  return (
    <div className="relative h-screen w-screen bg-[url('https://picsum.photos/seed/battleground/1920/1080?blur=5')] bg-cover bg-center flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Header */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-10 mb-12 text-center"
      >
        <h1 className="text-7xl font-black italic tracking-tighter text-ff-orange uppercase drop-shadow-[0_5px_15px_rgba(255,107,0,0.5)]">
          Free Fire <span className="text-white">2018</span>
        </h1>
        <p className="text-ff-yellow font-bold tracking-widest uppercase text-sm mt-2">Legacy Edition</p>
      </motion.div>

      <div className="relative z-10 flex gap-8 items-stretch max-w-6xl w-full px-8">
        {/* Character Selection */}
        <div className="flex-1 flex flex-col gap-4">
          <h2 className="text-2xl font-bold uppercase italic border-l-4 border-ff-orange pl-4 mb-4">Select Survivor</h2>
          <div className="grid grid-cols-2 gap-4">
            {CHARACTERS.map((char) => (
              <motion.button
                key={char.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedChar(char)}
                className={`relative group overflow-hidden rounded-xl border-2 transition-all ${
                  selectedChar.id === char.id ? 'border-ff-orange ring-4 ring-ff-orange/20' : 'border-white/10 grayscale hover:grayscale-0'
                }`}
              >
                <img src={char.image} alt={char.name} className="w-full aspect-[3/4] object-cover" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 text-left">
                  <p className="text-xl font-black uppercase italic">{char.name}</p>
                  <p className="text-xs text-white/60">{char.description}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Character Preview */}
        <div className="flex-[1.5] relative flex items-center justify-center">
          <motion.div
            key={selectedChar.id}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="h-full w-full flex flex-col items-center"
          >
            <img 
              src={selectedChar.image} 
              alt="Preview" 
              className="h-[500px] object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              referrerPolicy="no-referrer"
            />
            <div className="mt-8 flex gap-4">
              <div className="bg-black/40 backdrop-blur p-4 rounded-lg border border-white/10 flex items-center gap-3">
                <Shield className="text-ff-orange" />
                <div>
                  <p className="text-[10px] uppercase text-white/40">Armor</p>
                  <p className="font-bold">Level 1</p>
                </div>
              </div>
              <div className="bg-black/40 backdrop-blur p-4 rounded-lg border border-white/10 flex items-center gap-3">
                <Users className="text-ff-yellow" />
                <div>
                  <p className="text-[10px] uppercase text-white/40">Squad</p>
                  <p className="font-bold">Solo</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Menu Actions */}
        <div className="flex-1 flex flex-col justify-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onStart(selectedChar.id)}
            className="bg-ff-orange hover:bg-ff-orange/90 text-white py-6 px-8 rounded-xl flex items-center justify-center gap-4 group transition-all shadow-[0_10px_30px_rgba(255,107,0,0.3)]"
          >
            <span className="text-3xl font-black uppercase italic">Start Game</span>
            <Play className="fill-white group-hover:translate-x-1 transition-transform" />
          </motion.button>

          <div className="grid grid-cols-2 gap-4">
            <button className="bg-white/5 hover:bg-white/10 p-4 rounded-xl border border-white/10 flex flex-col items-center gap-2 transition-colors">
              <Trophy size={20} className="text-ff-yellow" />
              <span className="text-[10px] uppercase font-bold">Rankings</span>
            </button>
            <button className="bg-white/5 hover:bg-white/10 p-4 rounded-xl border border-white/10 flex flex-col items-center gap-2 transition-colors">
              <Settings size={20} className="text-white/60" />
              <span className="text-[10px] uppercase font-bold">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
        <div className="flex gap-8">
          <div>
            <p className="text-[10px] uppercase text-white/40 mb-1">Region</p>
            <p className="font-bold text-sm">Bermuda</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-white/40 mb-1">Server Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="font-bold text-sm">Online</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-white/40 mb-1">Player ID</p>
          <p className="font-mono text-xs opacity-60">FF_2018_USR_9921</p>
        </div>
      </div>
    </div>
  );
};
