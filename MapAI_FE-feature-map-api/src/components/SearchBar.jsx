import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../hooks/useToast';
import { searchLocations } from '../services/mapServices';

const SearchBar = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();
  const searchRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchLocation = useCallback(async (text) => {
    if (!text.trim() || text.length < 2) { // Giảm xuống 2 ký tự để nhạy hơn
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const data = await searchLocations(text);
      setResults(data);
      setShowResults(true);
    } catch (_error) {
      console.error('Search error:', _error);
      addToast("Không thể tìm kiếm địa điểm này", "error");
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) searchLocation(query);
    }, 1000);
    return () => clearTimeout(timer);
  }, [query, searchLocation]);

  const handleSelect = (result) => {
    const lat = result.lat;
    const lon = result.lon;
    setQuery(result.display_name);
    setShowResults(false);
    
    // Đẩy lên URL dưới dạng map?lat=?&lng=?
    navigate(`/map?lat=${lat}&lng=${lon}`);
  };

  return (
    <div ref={searchRef} className="relative w-[410px] z-20">
      <div className="relative flex items-center group">
        <div className="absolute left-4 p-1 text-white/40 group-focus-within:text-blue-400 transition-colors z-10">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 3 && setShowResults(true)}
          placeholder="Tìm địa điểm, địa chỉ..."
          className="w-full bg-slate-950/40 backdrop-blur-2xl border border-white/10 rounded-xl py-3 pl-11 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all text-[13px] text-white placeholder:text-white/30 shadow-lg hover:bg-slate-950/60"
        />
        {query && (
          <button 
            onClick={() => { setQuery(''); setResults([]); }}
            className="absolute right-4 text-white/40 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showResults && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="absolute top-full mt-2 w-full bg-slate-950/90 backdrop-blur-3xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50"
          >
            <div className="max-h-[300px] overflow-y-auto no-scrollbar py-1">
              {results.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(result)}
                  className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-blue-500/10 transition-all text-left group/item"
                >
                  <div className="mt-0.5 p-1.5 bg-blue-500/10 rounded-lg text-blue-400 shrink-0 group-hover/item:scale-105 transition-transform">
                    <MapPin size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-white truncate group-hover/item:text-blue-400 transition-colors">{result.display_name}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5 truncate uppercase tracking-tight font-medium">
                      {(result.type || 'place').replace('_', ' ')} • {result.address?.suburb || result.address?.city || 'Đà Nẵng'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchBar;
