import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, MapPin, Phone, Globe, Clock, Image as ImageIcon, ExternalLink, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';

const PlaceDetailPanel = ({ place, onClose, onStartDirections }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  
  const photos = place.photos && place.photos.length > 0 ? place.photos : [place.thumbnail || 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&q=80&w=800'];

  useEffect(() => {
    if (photos.length <= 1) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {  
          setCurrentImageIndex((idx) => (idx + 1) % photos.length);
          return 0;
        }
        return prev + 1;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [photos.length, currentImageIndex]);

  const nextImage = (e) => {
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % photos.length);
    setProgress(0);
  };

  const prevImage = (e) => {
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setProgress(0);
  };

  if (!place) return null;

  return (
    <div className="absolute top-0 bottom-0 right-40 w-[450px] pointer-events-none flex items-start justify-center pt-12 z-[100] perspective-[2000px]">
      <motion.div
        initial={{ opacity: 0, x: 100, rotateY: -20, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, rotateY: -10, scale: 1 }}
        exit={{ opacity: 0, x: 100, rotateY: -20, scale: 0.9 }}
        whileHover={{ rotateY: -5, x: -15, transition: { duration: 0.4 } }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className="pointer-events-auto w-[360px] h-[75vh] bg-slate-950/60 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(255,255,255,0.05)] overflow-hidden flex flex-col relative"
      >
        {/* Glow Effects */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/20 blur-[80px] pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-indigo-500/20 blur-[80px] pointer-events-none"></div>

        {/* 3D Header Slider */}
        <div className="relative h-60 shrink-0 overflow-hidden group">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentImageIndex}
              initial={{ opacity: 0, scale: 1.2 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.8, ease: "circOut" }}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${photos[currentImageIndex]})` }}
            />
          </AnimatePresence>
          
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent"></div>
          
          {/* Progress Indicators */}
          <div className="absolute top-4 left-8 right-8 flex gap-1.5 z-30">
            {photos.map((_, idx) => (
              <div key={idx} className="h-0.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                {idx === currentImageIndex && (
                  <motion.div 
                    className="h-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.05 }}
                  />
                )}
                {idx < currentImageIndex && <div className="h-full w-full bg-white/40" />}
              </div>
            ))}
          </div>

          {/* Navigation Buttons */}
          {photos.length > 1 && (
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 z-20 pointer-events-none">
              <button 
                onClick={prevImage}
                className="p-2 bg-black/20 hover:bg-blue-500/40 backdrop-blur-md rounded-xl border border-white/5 text-white opacity-0 group-hover:opacity-100 transition-all pointer-events-auto active:scale-90"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={nextImage}
                className="p-2 bg-black/20 hover:bg-blue-500/40 backdrop-blur-md rounded-xl border border-white/5 text-white opacity-0 group-hover:opacity-100 transition-all pointer-events-auto active:scale-90"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          <button 
            onClick={onClose}
            className="absolute top-10 right-6 p-2 bg-slate-900/40 hover:bg-red-500/40 backdrop-blur-md rounded-xl border border-white/10 text-white transition-all z-30 group/close"
          >
            <X size={18} className="group-hover/close:rotate-90 transition-transform" />
          </button>

          <div className="absolute bottom-6 left-8 right-8 z-20">
            <span className="px-3 py-1 rounded-md bg-blue-500/20 border border-blue-500/30 text-[8px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2 inline-block">
              {place.type || 'Địa điểm'}
            </span>
            <h2 className="text-xl font-black text-white leading-tight tracking-tight uppercase drop-shadow-lg">
              {place.name}
            </h2>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 custom-scrollbar transition-all">
          <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-0.5 h-full bg-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              {place.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-blue-500/20 transition-colors">
              <Star size={16} className="text-amber-400 mb-2" fill="currentColor" />
              <span className="text-sm font-black text-white">{place.rating}</span>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Rating</span>
            </div>
            <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-blue-500/20 transition-colors">
              <ImageIcon size={16} className="text-blue-400 mb-2" />
              <span className="text-sm font-black text-white">{photos.length}</span>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Photos</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.04] transition-all cursor-pointer group">
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:scale-110 transition-transform"><MapPin size={18} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Địa chỉ</p>
                <p className="text-[10px] font-bold text-white truncate">{place.address}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.04] transition-all cursor-pointer group">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 group-hover:scale-110 transition-transform"><Clock size={18} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Giờ mở cửa</p>
                <p className="text-[10px] font-bold text-white">Đang mở cửa • Đến 22:00</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 pt-4 bg-slate-950/80 border-t border-white/10">
          <div className="flex gap-3">
            <motion.button 
              onClick={() => onStartDirections && onStartDirections(place)}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="flex-[2] py-4 bg-blue-600 text-white font-black rounded-2xl shadow-[0_10px_20px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest transition-all hover:bg-blue-500"
            >
              <span>Dẫn đường</span>
              <ExternalLink size={14} />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 py-4 bg-white/5 border border-white/10 text-white rounded-xl flex items-center justify-center hover:bg-white/10 transition-all"
            >
              <Phone size={16} />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PlaceDetailPanel;
