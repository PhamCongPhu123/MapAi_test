import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, ArrowLeftRight, X, Search, Loader2, ArrowLeft, MoreVertical, Flag, Car, Bike, Footprints, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Power, Clock, CornerUpRight, CornerUpLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DirectionsPanel = ({ 
  onBack, 
  onRouteSelected, 
  onStartNavigation,
  onStopNavigation,
  onMoveToStep,
  isNavigating,
  initialOrigin = null, 
  initialDestination = null, 
  routeInfo = null 
}) => {
  const [originQuery, setOriginQuery] = useState(initialOrigin?.name || '');
  const [destQuery, setDestQuery] = useState(initialDestination?.name || '');
  const [origin, setOrigin] = useState(initialOrigin || null);
  const [destination, setDestination] = useState(initialDestination || null);
  const [results, setResults] = useState({ type: null, items: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [activeInput, setActiveInput] = useState(null);
  const [travelMode, setTravelMode] = useState('driving');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const steps = routeInfo?.legs?.[0]?.steps || [];

  const TRAVEL_MODES = [
    { id: 'driving', icon: <Car size={18} />, label: 'Ô tô' },
    { id: 'bicycle', icon: <Bike size={18} />, label: 'Xe đạp' },
    { id: 'foot', icon: <Footprints size={18} />, label: 'Đi bộ' },
  ];

  const getStepIcon = (modifier, type) => {
    if (type === 'arrive') return <Flag size={22} className="text-rose-500" />;
    if (type === 'depart') return <MapPin size={22} className="text-emerald-500" />;
    
    const mod = modifier?.toLowerCase() || '';
    switch (mod) {
      case 'right': 
      case 'slight right': 
      case 'sharp right': return <CornerUpRight size={24} className="text-blue-400" />;
      case 'left': 
      case 'slight left': 
      case 'sharp left': return <CornerUpLeft size={24} className="text-blue-400" />;
      case 'straight': return <ChevronUp size={24} className="text-emerald-400" />;
      case 'uturn': return <ArrowLeftRight size={24} className="text-orange-400 rotate-180" />;
      default: return <Navigation size={24} className="text-blue-400" />;
    }
  };

  const getStepAction = (step) => {
    if (!step?.maneuver) return "Tiếp tục";
    const type = step.maneuver.type;
    const modifier = step.maneuver.modifier;
    
    if (type === 'arrive') return "Đã Đến Nơi";
    if (type === 'depart') return "Bắt Đầu Đi";
    
    switch (modifier) {
      case 'right': return "Rẽ Phải";
      case 'left': return "Rẽ Trái";
      case 'slight right': return "Chếch bên Phải";
      case 'slight left': return "Chếch bên Trái";
      case 'sharp right': return "Rẽ Gắt bên Phải";
      case 'sharp left': return "Rẽ Gắt bên Trái";
      case 'straight': return "Đi Thẳng";
      case 'uturn': return "Quay Đầu";
      default: return "Tiếp Tục";
    }
  };

  const getStepTarget = (step) => {
    if (!step?.maneuver) return "theo hướng dẫn trên bản đồ";
    if (step.maneuver.type === 'arrive') return "Kết thúc hành trình tại đây";
    if (step.name && step.name !== "") return `vào đường ${step.name}`;
    if (step.maneuver.instruction && step.maneuver.instruction.includes('vào')) {
      const parts = step.maneuver.instruction.split('vào');
      return parts.length > 1 ? `vào ${parts[1]}` : "vào đường mới";
    }
    return "theo hướng dẫn trên bản đồ";
  };

  const handleNextStep = () => {
    if (steps.length === 0) return;
    const nextIndex = Math.min(currentStepIndex + 1, steps.length - 1);
    setCurrentStepIndex(nextIndex);
    onMoveToStep(nextIndex);
  };

  const handlePrevStep = () => {
    if (steps.length === 0) return;
    const prevIndex = Math.max(currentStepIndex - 1, 0);
    setCurrentStepIndex(prevIndex);
    onMoveToStep(prevIndex);
  };

  const currentStep = steps[currentStepIndex];

  const lastRequestRef = React.useRef(null);

  useEffect(() => {
    if (initialOrigin) { setOrigin(initialOrigin); setOriginQuery(initialOrigin.name); }
  }, [initialOrigin?.lng, initialOrigin?.lat, initialOrigin?.name]);

  useEffect(() => {
    if (initialDestination) { setDestination(initialDestination); setDestQuery(initialDestination.name); }
  }, [initialDestination?.lng, initialDestination?.lat, initialDestination?.name]);

  useEffect(() => {
    if (!origin || !destination) return;

    // So sánh để tránh gọi lại API khi tọa độ không thay đổi
    const requestKey = `${origin.lng},${origin.lat}|${destination.lng},${destination.lat}|${travelMode}`;
    if (lastRequestRef.current === requestKey) return;

    lastRequestRef.current = requestKey;
    onRouteSelected(origin, destination, travelMode);
  }, [origin, destination, travelMode, onRouteSelected]);

  const searchLocation = async (text, type) => {
    if (!text.trim() || text.length < 3) return;
    setIsLoading(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=5`);
      const data = await response.json();
      setResults({ type, items: data });
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeInput === 'origin') searchLocation(originQuery, 'origin');
      else if (activeInput === 'dest') searchLocation(destQuery, 'dest');
    }, 500);
    return () => clearTimeout(timer);
  }, [originQuery, destQuery, activeInput]);

  const formatDuration = (s) => {
    const m = Math.round(s / 60);
    return m < 60 ? { val: m, unit: 'Phút' } : { val: Math.floor(m/60), unit: 'Giờ', extra: m%60 };
  };

  const formatDistance = (m) => m < 1000 ? { val: Math.round(m), unit: 'm' } : { val: (m/1000).toFixed(1), unit: 'km' };

  const swapPoints = () => {
    const tempO = origin; const tempOQ = originQuery;
    setOrigin(destination); setOriginQuery(destQuery);
    setDestination(tempO); setDestQuery(tempOQ);
  };

  return (
    <>
      {/* Bảng chỉ đường CHÍNH (Chi tiết khi chưa đi, Giản đơn khi đang đi) */}
      <motion.div 
        animate={{ 
          width: isNavigating ? '420px' : '410px',
          height: isNavigating ? '110px' : 'auto',
          maxHeight: isNavigating ? '110px' : 'calc(100vh - 120px)',
          x: isNavigating ? 0 : 0
        }}
        className="absolute top-24 left-6 bg-slate-950/98 backdrop-blur-3xl border border-white/10 z-[100] flex flex-col shadow-[0_30px_60px_rgba(0,0,0,0.8)] rounded-[2rem] overflow-hidden transition-all duration-500"
      >
        {!isNavigating ? (
          /* --- PHẦN CHI TIẾT (Trạng thái chuẩn bị) --- */
          <div className="flex flex-col">
            <div className="p-5 border-b border-white/10 bg-gradient-to-br from-blue-500/10 via-transparent to-rose-500/5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-full text-white/70 transition-all border border-white/5"><ArrowLeft size={18} /></button>
                  <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">Lập lộ trình</h2>
                </div>
                <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                  {TRAVEL_MODES.map(m => (
                    <button key={m.id} onClick={() => setTravelMode(m.id)} className={`p-2 rounded-lg transition-all ${travelMode === m.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-white/30 hover:text-white'}`}>{React.cloneElement(m.icon, { size: 14 })}</button>
                  ))}
                </div>
              </div>

              <div className="relative flex items-center gap-4">
                {/* Đường kẻ minh họa điểm đi-đến */}
                <div className="absolute left-3.5 top-6 bottom-6 w-0.5 bg-gradient-to-b from-blue-500 via-blue-500/10 to-rose-500 rounded-full flex flex-col items-center justify-between py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
                </div>

                <div className="flex-1 flex flex-col gap-2.5">
                  <div className="relative group">
                    <input type="text" placeholder="Chọn điểm xuất phát..." value={originQuery} onFocus={() => setActiveInput('origin')} onChange={e => setOriginQuery(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-[12px] text-white focus:outline-none focus:border-blue-500/50 transition-all font-bold placeholder:text-white/20" />
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500/50 group-focus-within:text-blue-500 transition-colors" size={14} />
                    {originQuery && <button onClick={() => {setOriginQuery(''); setOrigin(null);}} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"><X size={12} /></button>}
                  </div>
                  <div className="relative group">
                    <input type="text" placeholder="Chọn điểm đến..." value={destQuery} onFocus={() => setActiveInput('dest')} onChange={e => setDestQuery(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-[12px] text-white focus:outline-none focus:border-rose-500/50 transition-all font-bold placeholder:text-white/20" />
                    <Flag className="absolute left-3.5 top-1/2 -translate-y-1/2 text-rose-500/50 group-focus-within:text-rose-500 transition-colors" size={14} />
                    {destQuery && <button onClick={() => {setDestQuery(''); setDestination(null);}} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"><X size={12} /></button>}
                  </div>
                </div>

                <button onClick={swapPoints} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-all border border-white/5 shadow-inner"><ArrowLeftRight size={16} className="rotate-90" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar relative min-h-[100px] bg-slate-900/30 transition-all">
              <AnimatePresence mode="wait">
                {activeInput ? (
                  <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 flex flex-col gap-2">
                    {isLoading ? (
                      <div className="py-10 flex flex-col items-center gap-3 text-white/20"><Loader2 className="animate-spin text-blue-500" size={24} /><span className="text-[10px] font-black uppercase tracking-widest">Đang tìm dữ liệu...</span></div>
                    ) : results.items.length > 0 ? (
                      results.items.map((item, idx) => (
                        <button key={idx} onClick={() => {
                          const p = { name: item.display_name, lng: parseFloat(item.lon), lat: parseFloat(item.lat) };
                          if (activeInput === 'origin') { setOrigin(p); setOriginQuery(item.display_name); } else { setDestination(p); setDestQuery(item.display_name); }
                          setResults({ type: null, items: [] }); setActiveInput(null);
                        }} className="w-full flex items-start gap-4 p-4 hover:bg-white/5 rounded-3xl text-left transition-all border border-transparent hover:border-white/5 group">
                          <div className={`mt-1 p-2 rounded-xl ${activeInput === 'origin' ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}`}><MapPin size={16} /></div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-bold text-white group-hover:text-blue-400 transition-colors truncate">{item.display_name}</p>
                            <p className="text-[10px] text-white/30 truncate mt-1 uppercase font-medium">{item.type} • {item.address?.suburb || 'Đà Nẵng'}</p>
                          </div>
                        </button>
                      ))
                    ) : <div className="py-20 text-center opacity-20 flex flex-col items-center gap-4"><Search size={32} /><p className="text-[11px] font-black uppercase tracking-[0.2em]">Nhập địa chỉ để bắt đầu</p></div>}
                  </motion.div>
                ) : origin && destination && routeInfo ? (
                  <motion.div key="route-info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-7 flex flex-col gap-6">
                    <div className="flex flex-col gap-4">
                      <div className="p-6 bg-gradient-to-br from-blue-600/20 to-indigo-600/10 rounded-[2.5rem] border border-white/10 relative overflow-hidden group shadow-2xl">
                        <div className="absolute -right-4 -top-4 p-6 opacity-10 group-hover:scale-110 transition-transform rotate-12"><Navigation size={100} /></div>
                        
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                            <Clock size={14} className="text-blue-400" />
                          </div>
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Chi tiết hành trình</span>
                        </div>

                        <div className="flex items-end gap-2 mb-6">
                          <span className="text-5xl font-black text-white tracking-tighter">{formatDuration(routeInfo.duration).val}</span>
                          <span className="text-sm font-bold text-white/50 pb-2 uppercase tracking-widest">{formatDuration(routeInfo.duration).unit}</span>
                          {formatDuration(routeInfo.duration).extra > 0 && (
                            <><span className="text-3xl font-black text-white ml-2">{formatDuration(routeInfo.duration).extra}</span><span className="text-[10px] font-bold text-white/50 pb-1.5 uppercase">m</span></>
                          )}
                          <div className="mx-4 w-1 h-8 bg-white/10 rounded-full mb-2"></div>
                          <span className="text-3xl font-bold text-white/90">{formatDistance(routeInfo.distance).val}</span>
                          <span className="text-[10px] font-bold text-white/50 pb-1.5 uppercase tracking-widest">{formatDistance(routeInfo.distance).unit}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[9px] font-black text-white/30 uppercase mb-1">Dự kiến đến</p>
                            <p className="text-sm font-bold text-white">
                              {new Date(Date.now() + routeInfo.duration * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[9px] font-black text-white/30 uppercase mb-1">Thời tiết</p>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">28°C</span>
                              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Giao thông thông thoáng trên tuyến đường này</p>
                      </div>

                      <div className="flex justify-center mt-2">
                        <button 
                          onClick={onStartNavigation} 
                          className="px-10 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-full shadow-[0_15px_30px_rgba(59,130,246,0.4)] transition-all active:scale-95 flex items-center justify-center gap-3 border border-blue-400/30 group"
                        >
                          Bắt đầu ngay 
                          <Navigation size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : <div className="h-40 flex flex-col items-center justify-center grayscale opacity-30"><Navigation className="text-white mb-4 animate-bounce" size={40} /><p className="text-[11px] font-black uppercase tracking-[0.4em]">Chọn điểm đến</p></div>}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          /* --- PHẦN GIẢN ĐƠN (Khi đang dẫn đường) --- */
          <div className="px-5 py-3 flex items-center gap-5 h-full bg-gradient-to-r from-blue-600/30 via-blue-600/5 to-transparent">
            <div className="p-3 bg-slate-900/80 rounded-2xl text-white shadow-2xl shrink-0 border border-white/10">
              {currentStep ? getStepIcon(currentStep.maneuver.modifier, currentStep.maneuver.type) : <Navigation size={24} className="animate-pulse text-blue-400" />}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-[18px] font-black text-white leading-none mb-1.5 truncate tracking-tight uppercase">
                {currentStep ? getStepAction(currentStep) : 'Đang tính toán'}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-blue-400 whitespace-nowrap">
                  {currentStep ? `${formatDistance(currentStep.distance).val} ${formatDistance(currentStep.distance).unit}` : '-- m'}
                </span>
                <div className="w-1 h-1 rounded-full bg-white/20"></div>
                <span className="text-[11px] font-medium text-white/60 italic leading-tight">
                  {currentStep ? getStepTarget(currentStep) : 'Vui lòng chờ...'}
                </span>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Bộ điều khiển 2 hướng (Giữa dưới) - Chỉ hiện mũi tên tối giản */}
      <AnimatePresence>
        {isNavigating && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-8"
          >
            {/* Nút Tiến tới bước sau */}
            <button 
              onClick={handleNextStep}
              className="text-blue-500 hover:text-blue-400 transition-all active:scale-75 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]"
              title="Bước tiếp theo"
            >
              <ChevronUp size={48} strokeWidth={3} />
            </button>

            {/* Nút Quay lại bước trước */}
            <button 
              onClick={handlePrevStep}
              className="text-white/30 hover:text-white/60 transition-all active:scale-75 drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]"
              title="Bước trước đó"
            >
              <ChevronDown size={40} strokeWidth={3} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nút Kết thúc chuyến đi (Góc trái dưới) */}
      <AnimatePresence>
        {isNavigating && (
          <motion.button
            initial={{ x: -150, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -150, opacity: 0 }}
            onClick={onStopNavigation}
            className="absolute bottom-10 left-10 z-[100] flex items-center gap-3 px-6 py-3.5 bg-rose-600/90 hover:bg-rose-500 text-white rounded-full shadow-lg font-black text-[9px] uppercase tracking-[0.15em] transition-all active:scale-95 border border-rose-400/20 group"
          >
            <div className="p-1.5 bg-white/10 rounded-lg group-hover:rotate-90 transition-transform"><Power size={14} /></div>
            Kết thúc
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};

export default DirectionsPanel;
