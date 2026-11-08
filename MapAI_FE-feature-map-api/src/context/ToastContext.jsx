import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';
import { ToastContext } from './toastContext';

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration !== Infinity) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.2 } }}
              className="pointer-events-auto"
            >
              <ToastItem toast={toast} onRemove={removeToast} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem = ({ toast, onRemove }) => {
  const { id, message, type } = toast;

  const icons = {
    success: <CheckCircle className="text-emerald-400" size={18} />,
    error: <AlertCircle className="text-rose-400" size={18} />,
    info: <Info className="text-blue-400" size={18} />,
    loading: <Loader2 className="text-blue-400 animate-spin" size={18} />
  };

  const bgColors = {
    success: 'bg-emerald-500/10 border-emerald-500/20',
    error: 'bg-rose-500/10 border-rose-500/20',
    info: 'bg-blue-500/10 border-blue-500/20',
    loading: 'bg-slate-900/80 border-white/10'
  };

  return (
    <div className={`flex items-center gap-4 px-5 py-4 rounded-2xl border backdrop-blur-2xl shadow-2xl min-w-[300px] max-w-[450px] ${bgColors[type]}`}>
      <div className="shrink-0">{icons[type]}</div>
      <div className="flex-1">
        <p className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-1">{type}</p>
        <p className="text-[13px] font-bold text-white leading-tight">{message}</p>
      </div>
      <button 
        onClick={() => onRemove(id)}
        className="p-1 hover:bg-white/10 rounded-lg text-white/30 hover:text-white transition-all"
      >
        <X size={14} />
      </button>
    </div>
  );
};
