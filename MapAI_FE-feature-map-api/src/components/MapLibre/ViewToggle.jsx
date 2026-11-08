import React from 'react';
import { Box, Layers } from 'lucide-react';

const ViewToggle = ({ is3D, onToggle }) => {
  return (
    <button 
      onClick={onToggle} 
      className={`flex items-center gap-4 px-8 py-4 rounded-[2rem] backdrop-blur-2xl border transition-all shadow-2xl font-black text-[10px] uppercase tracking-[0.2em] ${
        is3D ? 'bg-slate-900 text-white border-white/20' : 'bg-white text-slate-900 border-white/20'
      }`}
    >
      {is3D ? <Box size={18} /> : <Layers size={18} />} 
      {is3D ? 'Perspective: 3D' : 'View: 2D'}
    </button>
  );
};

export default ViewToggle;
