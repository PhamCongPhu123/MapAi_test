import React from 'react';
import { ChevronUp, RotateCcw, LocateFixed, Compass, RotateCw, ChevronDown } from 'lucide-react';

const NavigationControls = ({ map, onLocate, bearing, isUserLocating }) => {
  if (!map) return null;

  return (
    <div className="flex flex-col bg-slate-950/80 backdrop-blur-xl rounded-[2rem] border border-white/10 p-1.5 shadow-2xl w-fit">
      <button 
        onClick={() => map.easeTo({ pitch: Math.min(map.getPitch() + 15, 85) })} 
        className="p-3 text-white hover:text-blue-400 transition-colors"
      >
        <ChevronUp size={20} />
      </button>
      
      <button 
        onClick={() => map.easeTo({ bearing: map.getBearing() - 30 })} 
        className="p-3 text-white hover:text-blue-400 transition-colors"
      >
        <RotateCcw size={20} />
      </button>
      
      <button 
        onClick={onLocate} 
        className={`p-3 rounded-full transition-all ${isUserLocating ? 'text-blue-500 bg-blue-500/10' : 'text-emerald-400 hover:bg-white/5'}`}
        title={isUserLocating ? "Xóa vị trí" : "Vị trí của tôi"}
      >
        <LocateFixed size={20} />
      </button>

      <button 
        onClick={() => map.easeTo({ bearing: 0, pitch: 0 })} 
        className="p-3 text-blue-400 hover:scale-110 transition-all"
      >
        <Compass size={20} style={{ transform: `rotate(${-bearing}deg)` }} />
      </button>
      
      <button 
        onClick={() => map.easeTo({ bearing: map.getBearing() + 30 })} 
        className="p-3 text-white hover:text-blue-400 transition-colors"
      >
        <RotateCw size={20} />
      </button>
      
      <button 
        onClick={() => map.easeTo({ pitch: Math.max(map.getPitch() - 15, 0) })} 
        className="p-3 text-white hover:text-blue-400 transition-colors"
      >
        <ChevronDown size={20} />
      </button>
    </div>
  );
};

export default NavigationControls;
