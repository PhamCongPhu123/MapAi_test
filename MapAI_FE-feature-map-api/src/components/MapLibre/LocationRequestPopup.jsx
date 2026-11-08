import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, X } from 'lucide-react';

const LocationRequestPopup = ({ isOpen, onConfirm, onCancel }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Popup Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-[400px] bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            <div className="p-8">
              <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center mb-6 border border-blue-500/20 mx-auto">
                <Navigation size={32} className="text-blue-500 animate-pulse" />
              </div>

              <h3 className="text-xl font-black text-white text-center mb-3 uppercase tracking-tight">
                Bật định vị của bạn?
              </h3>
              
              <p className="text-white/50 text-center text-sm leading-relaxed mb-8">
                MapAI cần quyền truy cập vị trí của bạn để thiết lập điểm xuất phát tự động và cung cấp chỉ đường chính xác nhất.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={onConfirm}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <MapPin size={16} />
                  Bật định vị ngay
                </button>
                
                <button
                  onClick={onCancel}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white font-bold text-xs uppercase tracking-widest rounded-2xl transition-all"
                >
                  Để tôi tự nhập
                </button>
              </div>
            </div>

            <button 
              onClick={onCancel}
              className="absolute top-6 right-6 p-2 text-white/20 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default LocationRequestPopup;
