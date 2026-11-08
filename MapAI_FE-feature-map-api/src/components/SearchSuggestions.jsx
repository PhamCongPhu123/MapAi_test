import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Coffee, Utensils, Bus, Fuel, Hospital, 
  Ticket, ShoppingBag, X, CreditCard 
} from 'lucide-react';

export const SUGGESTIONS = [
  { id: 'coffee', label: 'Cà phê', icon: Coffee, query: 'coffee' },
  { id: 'restaurant', label: 'Ăn uống', icon: Utensils, query: 'restaurant' },
  { id: 'bus', label: 'Trạm xe bus', icon: Bus, query: 'bus station' },
  { id: 'gas', label: 'Trạm xăng', icon: Fuel, query: 'gas station' },
  { id: 'medical', label: 'Trạm y tế', icon: Hospital, query: 'hospital' },
  { id: 'atm', label: 'ATM/Ngân hàng', icon: CreditCard, query: 'atm bank' },
  { id: 'attraction', label: 'Tham quan', icon: Ticket, query: 'attraction' },
];

const SearchSuggestions = ({ onSearch, onClear, hasResults }) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide select-none max-w-full" 
         style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
      
      <AnimatePresence>
        {hasResults && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onClick={onClear}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/90 backdrop-blur-md border border-rose-400/30 rounded-full text-white hover:bg-rose-600 transition-all shadow-lg whitespace-nowrap z-10 font-bold text-[11px] uppercase tracking-tight"
          >
            <X size={14} strokeWidth={3} />
            Xóa kết quả
          </motion.button>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        {SUGGESTIONS.map((s) => (
          <motion.button
            key={s.id}
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(15, 23, 42, 0.8)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSearch(s)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-full text-white/80 hover:text-white transition-all shadow-lg whitespace-nowrap border border-white/5 hover:border-blue-500/50 group"
          >
            <s.icon size={14} className="text-blue-400 group-hover:text-blue-300 group-hover:rotate-12 transition-all" />
            <span className="text-[11px] font-semibold tracking-wide">{s.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default SearchSuggestions;
