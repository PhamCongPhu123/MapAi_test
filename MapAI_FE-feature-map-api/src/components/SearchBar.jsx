import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../hooks/useToast';
import { SourceBadge, PlaceAvatar } from '../places/presentation/SourceBadge';
import { categoryName } from '../places/application/unifiedPlace.js';
const SearchBar = ({ service, mode = 'online', onSelect, onSearchStart }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [waiting, setWaiting] = useState(false);
  const [failure, setFailure] = useState('');
  const [resultData, setResultData] = useState({ mode, items: [] });
  const results = resultData.mode === mode ? resultData.items : [];
  const visible = results.filter(p => filter === 'all' || (filter === 'osm') === (p.sourceType === 'openstreetmap')).sort((a, b) => (a.sourceType === 'openstreetmap') - (b.sourceType === 'openstreetmap'));
  const warnings = resultData.mode === mode ? resultData.items.meta?.warnings || [] : [];
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();
  const searchRef = useRef(null);
  const chosenQuery = useRef('');

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchLocation = useCallback(async (text, signal) => {
    if (!text.trim() || text.length < 2) { // Giảm xuống 2 ký tự để nhạy hơn
      setResultData({ mode, items: [] });
      return;
    }

    setIsLoading(true); setFailure('');
    try {
      const items = await service.search(text, { signal });
      if (signal.aborted) return;
      setResultData({ mode, items }); setWaiting(false);
      setShowResults(true);
    } catch (_error) {
      if (!signal.aborted) { setResultData({ mode, items: [] }); setFailure('Không thể tìm kiếm lúc này. Hãy thử lại khi kết nối ổn định.'); setShowResults(true); addToast("Không thể tìm kiếm địa điểm này", "error"); }
    } finally {
      if (!signal.aborted) setIsLoading(false);
    }
  }, [addToast, mode, service]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (query && chosenQuery.current !== query) searchLocation(query, controller.signal);
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, searchLocation]);

  const handleSelect = (result) => {
    const lat = result.lat;
    const lon = result.lng;
    chosenQuery.current = result.name;
    setQuery(result.name);
    setShowResults(false);
    onSelect?.(result);
    
    // Đẩy lên URL dưới dạng map?lat=?&lng=?
    navigate(`/map?${result.id ? `placeId=${encodeURIComponent(result.id)}&` : ""}lat=${lat}&lng=${lon}`);
  };

  return (
    <div ref={searchRef} className="relative min-w-0 flex-1 md:flex-none w-full md:w-[410px] z-20">
      <div className="relative flex items-center group">
        <div className="absolute left-4 p-1 text-white/40 group-focus-within:text-blue-400 transition-colors z-10">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => { onSearchStart?.(); chosenQuery.current = ''; setQuery(e.target.value); }}
          onFocus={() => { onSearchStart?.(); if (query.length >= 2) setShowResults(true); }}
          placeholder="Tìm quán ăn, bến xe buýt, địa điểm tại Đà Nẵng..."
          aria-label="Tìm địa điểm, địa chỉ"
          className="w-full bg-slate-950/40 backdrop-blur-2xl border border-white/10 rounded-xl py-3 pl-11 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all text-[13px] text-white placeholder:text-white/30 shadow-lg hover:bg-slate-950/60"
        />
        {query && (
          <button 
            aria-label="Xóa từ khóa"
            onClick={() => { setQuery(''); setResultData({ mode, items: [] }); setIsLoading(false); }}
            className="absolute right-4 text-white/40 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showResults && query.length >= 2 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="absolute top-full mt-2 w-full bg-slate-950/90 backdrop-blur-3xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50"
          >
            <div role="group" aria-label="Lọc nguồn địa điểm" className="flex flex-wrap gap-1 px-3 py-2 border-b border-white/10">
              {[['all', 'Tất cả'], ['mapai', 'Gợi ý MapAI'], ['osm', 'Bản đồ mở OSM']].map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={`rounded-full px-2 py-1 text-[10px] ${filter === id ? 'bg-blue-600 text-white' : 'text-slate-300 bg-white/5'}`}>{label}</button>)}
            </div>
            <div className="max-h-[340px] overflow-y-auto no-scrollbar py-1">
              {warnings.map(w => <p key={w} role="status" className="px-4 py-2 text-xs text-amber-200">{w}</p>)}
              {results.length > 0 && results.every(p => p.sourceType === 'openstreetmap') && <p className="px-4 py-2 text-[11px] text-indigo-200">Không có trong danh sách du lịch MapAI • Đang hiển thị kết quả từ OpenStreetMap</p>}
              {!visible.length && <p role="status" className="px-4 py-4 text-sm text-slate-300">{failure || (results.length ? 'Không có kết quả từ nguồn đã chọn.' : mode === 'offline' ? 'Chưa tìm thấy trong gói dữ liệu Offline Đà Nẵng. Kết nối mạng để mở rộng tìm kiếm trên OpenStreetMap.' : 'Chưa tìm thấy địa điểm phù hợp.')}</p>}
              {!results.length && mode === 'offline' && <button className="community-secondary m-3 text-xs" onClick={() => { chosenQuery.current = ''; setWaiting(true); }}>{waiting ? 'Đang chờ có mạng để tìm lại' : 'Thử lại khi có mạng'}</button>}
              {visible.map((result, idx) => <React.Fragment key={result.canonicalId || idx}>
                {(idx === 0 || (visible[idx - 1].sourceType === 'openstreetmap') !== (result.sourceType === 'openstreetmap')) && <p className="px-4 pt-2 pb-1 text-[10px] text-slate-400">{result.sourceType === 'openstreetmap' ? 'OpenStreetMap' : 'Gợi ý MapAI'}</p>}
                <button onClick={() => handleSelect(result)} className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-blue-500/10 transition-all text-left group/item">
                  <div className="mt-0.5 p-2 bg-indigo-500/15 rounded-lg text-indigo-300 shrink-0"><PlaceAvatar place={result} size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-white truncate group-hover/item:text-blue-400">{result.name}</p>
                    <SourceBadge place={result} />
                    {Number.isFinite(result.rating) && <span className="text-[10px] text-amber-300 ml-1">★ {result.rating}</span>}
                    <p className="text-[10px] text-slate-400 mt-1 truncate">{categoryName(result)} • {result.address || result.district || 'Đà Nẵng'}</p>
                    {mode === 'offline' && <span className="text-[10px] text-slate-400">Dữ liệu lưu trên thiết bị</span>}
                  </div>
                </button>
              </React.Fragment>)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchBar;
