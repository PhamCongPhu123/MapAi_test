import React from 'react';
import { AnimatePresence } from 'framer-motion';

const MapStatusOverlays = ({ isLoaded, mapError, isDetailLoading }) => {
  return (
    <>
      <AnimatePresence>
        {isDetailLoading && (
          <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm z-[110] flex items-center justify-center">
            <div className="bg-slate-900/80 p-8 rounded-3xl border border-white/10 flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-white uppercase tracking-widest">Đang tải chi tiết...</p>
            </div>
          </div>
        )}
      </AnimatePresence>

      {!isLoaded && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-50">
          <div className="w-10 h-10 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white z-50 p-10 text-center">
          <h2 className="text-xl font-black mb-2">Lỗi Bản Đồ</h2>
          <p className="text-slate-400 mb-8">{mapError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-8 py-3 bg-blue-600 rounded-xl uppercase font-bold"
          >
            Thử lại
          </button>
        </div>
      )}
    </>
  );
};

export default MapStatusOverlays;
