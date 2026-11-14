import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, User, Sparkles, Search, ChevronRight, ChevronLeft, MessageSquare, Navigation, MapPin, Globe, X, Database, Wifi, WifiOff, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import MapLibreView from '../components/MapLibreView';
import SearchBar from '../components/SearchBar';
import SearchSuggestions from '../components/SearchSuggestions';
import { useToast } from '../hooks/useToast';
import { useMediaQuery } from '../hooks/useMediaQuery';
import ContributionList from '../components/Community/ContributionList';
import { mapTools } from '../services/mapTools';
import { executeMapAction, isMapToolAction } from '../utils/executeMapAction';
import { useMapSession } from '../map/presentation/useMapSession';
import { useAuth } from '../hooks/useAuth';
import OfflineDataModal from '../features/offline/OfflineDataModal';
import SavedPlacesDialog from '../map/presentation/SavedPlacesDialog';
import '../design-system/offline.css';

const MapPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { service, mode, resource, network, hasApi, ready } = useMapSession();
  const { user } = useAuth();
  const [dataOpen, setDataOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const closeData = useCallback(() => setDataOpen(false), []);
  const closeSaved = useCallback(() => setSavedOpen(false), []);
  const localContext = useRef({});
  const [aiPending, setAiPending] = useState(null);
  const isAiLoading = aiPending?.mode === mode;
  const { addToast, removeToast } = useToast();
  const [input, setInput] = useState('');
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const [isChatCollapsed, setIsChatCollapsed] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const [isDirectionsMode, setIsDirectionsMode] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const [hasNearbyResults, setHasNearbyResults] = useState(false);
  const [pendingNearbySearch, setPendingNearbySearch] = useState(null);
  const [showContributions, setShowContributions] = useState(false);
  const chatScrollRef = useRef(null);
  const mapRef = useRef(null);
  const lastAiPlace = useRef(null);

  useEffect(() => {
    const onBack = event => {
      if (event.defaultPrevented) return;
      if (dataOpen || savedOpen) {
        event.preventDefault(); setDataOpen(false); setSavedOpen(false);
      } else if (showContributions) {
        event.preventDefault();
        setShowContributions(false);
      } else if (isMobile && !isChatCollapsed) {
        event.preventDefault();
        setIsChatCollapsed(true);
      } else if (isNavigating || isDirectionsMode) {
        event.preventDefault();
        setIsNavigating(false);
        setIsDirectionsMode(false);
      }
    };
    window.addEventListener('mapai:back', onBack);
    return () => window.removeEventListener('mapai:back', onBack);
  }, [isMobile, isChatCollapsed, isNavigating, isDirectionsMode, showContributions, dataOpen, savedOpen]);

  // Hàm thực hiện tìm kiếm Nearby thực tế
  const executeNearbySearch = useCallback(async (query, lat, lng) => {
    if (!mapRef.current) return;
    
    setIsSearchingNearby(true);
    const loadingToastId = addToast(`Đang tìm ${query} gần bạn...`, "loading", Infinity);

    try {
      const places = await service.nearby(query, lat, lng, 2000);
      removeToast(loadingToastId);
      
      if (places && places.length > 0) {
        mapRef.current.setNearbyMarkers(places);
        setHasNearbyResults(true);
        addToast(`Đã tìm thấy ${places.length} địa điểm gần bạn!`, "success");
      } else {
        addToast(`Không tìm thấy ${query} nào ở gần đây.`, "info");
      }
    } catch (error) {
      removeToast(loadingToastId);
      console.error("Nearby search error:", error);
      addToast("Có lỗi xảy ra khi tìm kiếm địa điểm.", "error");
    } finally {
      setIsSearchingNearby(false);
      setPendingNearbySearch(null);
    }
  }, [addToast, removeToast, service]);

  // Callback khi vị trí được xác định từ MapLibreView
  const handleLocationFound = useCallback((locData) => {
    if (pendingNearbySearch) {
      executeNearbySearch(pendingNearbySearch, locData.lat, locData.lng);
    }
  }, [pendingNearbySearch, executeNearbySearch]);

  const handleNearbySearch = async (suggestion) => {
    if (!mapRef.current || isSearchingNearby) return;

    setIsSearchingNearby(true);
    const loadingToastId = addToast(`Đang tìm ${suggestion.label} toàn thành phố...`, "loading", Infinity);

    try {
      // Sử dụng API City-Wide mới cho các nút gợi ý dưới thanh tìm kiếm
      const requestMode = service.mode();
      const places = await service.category(suggestion.query);
      if (requestMode !== service.mode()) { removeToast(loadingToastId); return; }
      
      removeToast(loadingToastId);
      
      if (places && places.length > 0) {
        mapRef.current.setNearbyMarkers(places);
        setHasNearbyResults(true);
        addToast(`Tìm thấy ${places.length} ${suggestion.label} tại Đà Nẵng!`, "success");
      } else {
        addToast(mode === 'offline' ? `Chưa có ${suggestion.label} trong gói đã tải.` : `Không tìm thấy ${suggestion.label} nào.`, "info");
      }
    } catch (error) {
      removeToast(loadingToastId);
      console.error("City-wide search error:", error);
      addToast("Có lỗi xảy ra khi tìm kiếm địa điểm.", "error");
    } finally {
      setIsSearchingNearby(false);
    }
  };

  const handleClearNearby = () => {
    if (mapRef.current) {
      mapRef.current.clearNearbyMarkers();
      setHasNearbyResults(false);
      addToast("Đã xóa các địa điểm tìm kiếm.", "info");
    }
  };

  const [messages, setMessages] = useState([
    {
      id: crypto.randomUUID(),
      type: 'ai',
      text: 'Chào bạn! Tôi là trợ lý MapAI. Bạn muốn khám phá địa điểm nào tại Đà Nẵng hôm nay? ✨',
      time: '10:00 AM',
      suggestions: ['Tìm cây xăng gần nhất', 'ATM gần tôi', 'Phóng to bản đồ']
    }
  ]);

  useEffect(() => {
    const scroller = chatScrollRef.current;
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
  }, [messages, isAiLoading, isChatCollapsed]);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const handleFlyTo = (loc) => {
    if (mapRef.current && loc) {
      mapRef.current.flyTo({
        center: [loc.lng, loc.lat],
        zoom: 17,
        pitch: 60,
        essential: true,
        duration: 3000,
        title: loc.name // Thêm title để hiện Marker
      });
      // Tự động mở chi tiết nếu có
      if (window.showPlaceDetails) {
        window.showPlaceDetails(loc.name, loc.lng, loc.lat, loc.locationId);
      }
    }
  };

  const handleSend = async (e, textOverride = null) => {
    if (e) e.preventDefault();
    const messageText = textOverride || input;
    if (!messageText.trim() || isAiLoading) return;
    
    const userMsg = {
      id: crypto.randomUUID(),
      type: 'user',
      text: messageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingNearbySearch(null);
    const requestMode = service.mode();
    const requestId = crypto.randomUUID();
    setAiPending({ mode: requestMode, id: requestId });

    try {
      // Gọi Gemini AI
      const response = await service.ask(messageText, messages.slice(-5), lastAiPlace.current, localContext.current);
      if (requestMode !== service.mode()) return;
      if (response.context) localContext.current = response.context;
      console.log("Raw AI Response received in MapPage:", response);
      
      const aiMsg = {
        id: crypto.randomUUID(),
        type: 'ai',
        text: response.message,
        error: Boolean(response.error),
        errorCode: response.errorCode,
        location: response.location,
        places: response.places,
        suggestions: response.suggestions,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages(prev => [...prev, aiMsg]);

      if (isMapToolAction(response.action)) {
        const searching = ['NEAREST_SEARCH', 'ROUTE_TO_NEAREST', 'SEARCH_POIS'].includes(response.action.type);
        if (searching) lastAiPlace.current = null;
        try {
          const result = await executeMapAction(response.action, {
            map: mapRef.current, api: mapTools, getPosition: () => mapRef.current?.locateUser(true),
          });
          if (result.places) setHasNearbyResults(result.places.length > 0);
          if (result.selectedPlace !== undefined) lastAiPlace.current = result.selectedPlace;
          if (response.action.type === 'ROUTE_TO_NEAREST' && isMobile) setIsChatCollapsed(true);
          setMessages(prev => [...prev, { id: crypto.randomUUID(), type: 'ai', text: result.message, places: result.places,
            suggestions: result.selectedPlace ? ['Chỉ đường đến đó', 'Xóa kết quả tìm kiếm'] : [],
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }]);
        } catch (error) {
          setMessages(prev => [...prev, { id: crypto.randomUUID(), type: 'ai', text: error.message }]);
        }
        return;
      }

      if (response.action?.type === 'LOCAL_DIRECTIONS') {
        mapRef.current?.startDirections(response.action.value);
        if (isMobile) setIsChatCollapsed(true);
        return;
      }

      // XỬ LÝ CÁC ACTION TỪ AI
      if (response.action) {
        console.log("Processing AI Action:", response.action);
        const { type, target_location, search_query, value, destination } = response.action;

        // 1. Chuyển chế độ 2D/3D
        if (type?.toUpperCase() === '2D' || type?.toUpperCase() === '3D' || type?.toUpperCase() === 'SWITCH_VIEW') {
          const viewMode = (type?.toUpperCase() === '3D' || value?.toLowerCase() === '3d') ? '3d' : '2d';
          console.log("Action: Switching view to", viewMode);
          if (mapRef.current) {
            mapRef.current.toggleView(viewMode);
          }
        }

        // 2. Bay đến địa điểm cụ thể (Tương ứng 'Location')
        if ((type?.toUpperCase() === 'LOCATION' || type?.toUpperCase() === 'FLY_TO') && (target_location || value)) {
          // Nếu value hoặc target_location đã là object có tọa độ
          const locObj = (typeof value === 'object' && value !== null) ? value : 
                        ((typeof target_location === 'object' && target_location !== null) ? target_location : null);
          
          if (locObj && locObj.lat && locObj.lng) {
            console.log("Action: Flying to provided coordinates:", locObj);
            handleFlyTo({
              lat: parseFloat(locObj.lat),
              lng: parseFloat(locObj.lng),
              name: locObj.name || "Vị trí yêu cầu"
            });
          } else {
            const locName = target_location || (typeof value === 'string' ? value : value?.name);
            console.log("Action: Searching and flying to location name:", locName);
            service.category(locName).then(places => {
              if (places && places.length > 0) {
                const place = places[0];
                const latNum = parseFloat(place.lat || place.latitude);
                const lngNum = parseFloat(place.lon || place.lng || place.longitude);
                
                if (!isNaN(latNum) && !isNaN(lngNum)) {
                  handleFlyTo({ 
                    lat: latNum, 
                    lng: lngNum, 
                    name: place.display_name || place.name || locName
                  });
                } else {
                  addToast(`Không lấy được tọa độ cho: ${locName}`, "error");
                }
              } else {
                addToast(`Không tìm thấy địa điểm: ${locName}`, "info");
              }
            });
          }
        }

        // 3. Thiết lập chỉ đường (Tương ứng 'Direction')
        if ((type === 'Direction' || type === 'SET_DIRECTION') && (target_location || destination)) {
          // Nếu destination đã là object có tọa độ (như trong log của người dùng)
          if (typeof destination === 'object' && destination !== null && Number.isFinite(destination.lat) && Number.isFinite(destination.lng)) {
            console.log("Action: Setting direction to provided coordinates:", destination);
            const destObj = {
              lat: parseFloat(destination.lat),
              lng: parseFloat(destination.lng),
              name: destination.name || "Đích đến"
            };
            
            const origin = await mapRef.current?.locateUser(true);
            if (!origin) throw new Error('Cần cấp quyền vị trí để bắt đầu chỉ đường.');
            mapRef.current.setDirections(origin, destObj);
            if (isMobile) setIsChatCollapsed(true);
          } else {
            const destName = target_location || (typeof destination === 'string' ? destination : (destination?.name || value));
            console.log("Action: Searching and setting direction to name:", destName);
            setIsDirectionsMode(true);
            
            service.category(destName).then(places => {
              if (places && places.length > 0) {
                const place = places[0];
                const latNum = parseFloat(place.lat || place.latitude);
                const lngNum = parseFloat(place.lon || place.lng || place.longitude);
                
                if (!isNaN(latNum) && !isNaN(lngNum)) {
                  const destObj = {
                    lat: latNum,
                    lng: lngNum,
                    name: place.display_name || place.name || destName
                  };
                  
                  if (mapRef.current && mapRef.current.setDestination) {
                    mapRef.current.setDestination(destObj);
                  } else {
                    window.dispatchEvent(new CustomEvent('ai-set-destination', { 
                      detail: destObj 
                    }));
                  }
                  // Bay đến đích để người dùng thấy
                  handleFlyTo(destObj);
                }
              } else {
                addToast(`Không tìm thấy đích đến: ${destName}`, "info");
              }
            });
          }
        }

        // 4. Tìm kiếm lân cận (Tương ứng 'Nearby')
        if (type === 'Nearby' || type === 'NEARBY_SEARCH') {
          const query = search_query || value || messageText;
          const savedLoc = sessionStorage.getItem('user_location');
          console.log("Action: Nearby Search for:", query, "Location status:", savedLoc ? "Found" : "Not found");

          if (savedLoc) {
            const parsed = JSON.parse(savedLoc);
            executeNearbySearch(query, parsed.lat, parsed.lng);
          } else {
            addToast("Tính năng này yêu cầu vị trí. Vui lòng bật định vị trên trình duyệt!", "error");
            if (mapRef.current) {
              setPendingNearbySearch(query);
              mapRef.current.setShowLocationPopup(true);
            }
          }
        }

        // 5. Tìm kiếm toàn thành phố (Tương ứng 'CityWide')
        if (type === 'CityWide' || type === 'CITY_SEARCH') {
          const query = search_query || value || messageText;
          console.log("Action: CityWide Search for:", query);
          const loadingId = addToast(`Đang tìm ${query} tại Đà Nẵng...`, "loading", Infinity);
          service.category(query).then(places => {
            removeToast(loadingId);
            if (places && places.length > 0) {
              mapRef.current.setNearbyMarkers(places);
              setHasNearbyResults(true);
              addToast(`Đã tìm thấy ${places.length} kết quả tại Đà Nẵng!`, "success");
            } else {
              addToast(`Không tìm thấy kết quả cho "${query}".`, "info");
            }
          });
        }
      } else if (response.location) {
        // Fallback cho logic cũ nếu không có action nhưng có location
        setTimeout(() => handleFlyTo(response.location), 1000);
      }
    } catch (error) {
      const errorMessage = error.message === 'QUOTA_EXCEEDED' 
        ? '🤖 Trợ lý AI đang tạm nghỉ chút (hết giới hạn miễn phí). Bạn vui lòng đợi 30 giây rồi hỏi tiếp nhé! 🙏'
        : 'Rất tiếc, tôi đang gặp chút sự cố kỹ thuật. Bạn thử hỏi lại nhé! 🛠️';

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'ai',
        text: errorMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setAiPending(current => current?.id === requestId ? null : current);
    }
  };

  return (
    <div data-map-mode={mode} className="map-page flex h-dvh w-full bg-[#0a0a0a] text-gray-100 overflow-hidden relative">
      
      {/* --- PHẦN BẢN ĐỒ --- */}
      <motion.div 
        initial={false}
        animate={{ width: isMobile ? '100%' : (isNavigating ? 'calc(100% - 80px)' : (isChatCollapsed ? '100%' : '70%')) }}
        className="relative shrink-0 h-full bg-[#121212] overflow-hidden"
      >
        {!isNavigating && (
          <div className="map-search absolute top-6 left-6 z-[60] flex flex-col gap-4">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <motion.button aria-label="Về trang chủ" onClick={() => navigate('/')} className="shrink-0 p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/10 hover:bg-white/20 transition-all shadow-xl group">
                <ArrowLeft className="w-6 h-6 text-white group-hover:-translate-x-1 transition-transform" />
              </motion.button>
              <SearchBar service={service} mode={mode} onSelect={place => { lastAiPlace.current = place; mapRef.current?.showPlace(place); }} />
              {!isDirectionsMode && (
                <motion.button aria-label="Chỉ đường" onClick={() => { setIsDirectionsMode(true); if (isMobile) setIsChatCollapsed(true); }} className="shrink-0 flex items-center gap-2 px-3 md:px-4 py-3 bg-white hover:bg-slate-100 text-slate-950 rounded-full shadow-xl font-black text-[9px] uppercase tracking-[0.15em] transition-all border border-white/20">
                  <Navigation size={18} className="text-blue-600" /> <span className="hidden md:inline">Chỉ đường</span>
                </motion.button>
              )}
            </div>
            
            {/* Suggestions Row */}
            <SearchSuggestions 
              onSearch={handleNearbySearch} 
              onClear={handleClearNearby} 
              hasResults={hasNearbyResults} 
            />
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button data-testid="map-status" aria-label="Trạng thái kết nối và dữ liệu" onClick={() => setDataOpen(true)} className="community-secondary shrink-0 bg-slate-950/90 text-blue-300">
                {mode === 'offline' ? <WifiOff size={16} /> : <Wifi size={16} />}
                {network.simulated ? 'Giả lập Offline' : mode === 'offline' ? 'Offline' : 'Online'}
                <span className="hidden sm:inline">· {ready ? 'Đà Nẵng sẵn sàng' : resource.data ? 'Dữ liệu đã lưu' : resource.status === 'installing' ? `Đang tải ${resource.progress}%` : 'Chưa có gói'}</span>
              </button>
              <button className="community-secondary shrink-0 bg-slate-950/90" onClick={() => setDataOpen(true)} aria-label="Quản lý dữ liệu bản đồ"><Database size={16} />Dữ liệu</button>
              <button className="community-secondary shrink-0 bg-slate-950/90" onClick={() => setSavedOpen(true)}><Heart size={16} />Đã lưu / Gần đây</button>
              <button className="community-secondary shrink-0 bg-slate-950/90" disabled={mode === 'offline'} onClick={() => { if (!user) { navigate('/login', { state: { from: location } }); return; } setIsChatCollapsed(true); mapRef.current?.startContribution(); }}>+ Thêm địa điểm</button>
              <button className="community-secondary shrink-0 bg-slate-950/90" disabled={mode === 'offline'} onClick={() => { if (!user) { navigate('/login', { state: { from: location } }); return; } setIsChatCollapsed(true); mapRef.current?.dismissDetails(); setShowContributions(true); }}>Đóng góp của tôi</button>
              <button aria-label="Làm mới địa điểm MapAI" className="community-secondary shrink-0 bg-slate-950/90" onClick={() => window.dispatchEvent(new Event('mapai:places-changed'))}>Làm mới</button>
            </div>
          </div>
        )}

        <MapLibreView 
          mapService={service} mode={mode} localData={resource.data} personal={resource.personal}
          mapRef={mapRef}
          isDirectionsMode={isDirectionsMode} 
          setIsDirectionsMode={setIsDirectionsMode}
          isNavigating={isNavigating}
          setIsNavigating={setIsNavigating} 
          onLocationFound={handleLocationFound}
        />
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]"></div>
      </motion.div>

      {/* --- NÚT TOGGLE CHAT (Ẩn khi đang dẫn đường) --- */}
      {!isNavigating && (!isMobile || isChatCollapsed) && (
        <button
          onClick={() => setIsChatCollapsed(!isChatCollapsed)}
          aria-label={isChatCollapsed ? 'Mở trợ lý AI' : 'Đóng trợ lý AI'}
          aria-expanded={!isChatCollapsed}
          aria-controls="map-chat"
          className={isMobile
            ? 'map-chat-toggle absolute z-40 flex items-center gap-2 min-h-12 px-4 bg-blue-600 border border-white/10 text-white rounded-2xl shadow-2xl'
            : 'absolute z-50 top-1/2 -translate-y-1/2 transition-all duration-300 flex items-center justify-center w-8 h-12 bg-slate-900 border border-white/10 text-white rounded-l-xl hover:bg-blue-600 shadow-2xl'}
          style={isMobile ? undefined : { right: isChatCollapsed ? '0' : '30%' }}
        >
          {isMobile ? <><MessageSquare size={20} /> Trợ lý AI</> : (isChatCollapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />)}
        </button>
      )}

      {/* --- PHẦN CHAT UI --- */}
      <motion.div 
        initial={false}
        id="map-chat"
        role={isMobile ? 'dialog' : undefined}
        aria-label="Trợ lý MapAI"
        inert={(isChatCollapsed && !isNavigating) || (isMobile && isNavigating) ? true : undefined}
        animate={{ 
          width: isMobile ? '100%' : (isNavigating ? '80px' : (isChatCollapsed ? '0%' : '30%')),
          opacity: (isChatCollapsed && !isNavigating) || (isMobile && isNavigating) ? 0 : 1,
          x: isMobile ? 0 : ((isChatCollapsed && !isNavigating) ? 100 : 0),
          y: isMobile && (isChatCollapsed || isNavigating) ? '110%' : '0%'
        }}
        className="map-chat shrink-0 h-full flex flex-col bg-[#0f0f12] relative border-l border-white/5 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
      >
        {isNavigating ? (
          <div className="flex flex-col items-center py-8 gap-8 h-full bg-gradient-to-b from-blue-600/10 to-transparent">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/40 animate-pulse">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 flex flex-col gap-6 items-center">
              <div className="flex flex-col items-center gap-1">
                <div className="w-1 h-12 bg-gradient-to-b from-blue-600 to-transparent rounded-full"></div>
                <Navigation size={20} className="text-blue-500" />
              </div>
              <div className="writing-vertical text-[10px] font-black uppercase tracking-[0.3em] text-white/20 whitespace-nowrap rotate-180">
                MapAI Focus Mode
              </div>
            </div>
            <button onClick={() => setIsNavigating(false)} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-white/40 hover:text-rose-500 transition-all border border-white/5">
              <ArrowLeft size={20} />
            </button>
          </div>
        ) : (
          <>
            <header className="p-6 border-b border-white/5 bg-white/[0.02] backdrop-blur-xl shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
                  <Sparkles className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div className="flex-1">
                  <h1 className="text-lg font-black text-white tracking-tight uppercase italic">MapAI Assistant</h1>
                  <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>
                    {mode === 'online' ? 'Dịch vụ online sẵn sàng' : 'Trợ lý cục bộ Đà Nẵng'}
                  </p>
                </div>
                {isMobile && <button aria-label="Đóng trợ lý AI" className="p-3 rounded-xl bg-white/5" onClick={() => setIsChatCollapsed(true)}><X size={20} /></button>}
              </div>
            </header>

            <div ref={chatScrollRef} role="log" aria-live="polite" aria-label="Hội thoại với MapAI" className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className={`flex w-full ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex flex-col max-w-[90%] gap-3 ${msg.type === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`flex gap-3 items-end ${msg.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${msg.type === 'user' ? 'bg-blue-600 border-blue-400/50' : 'bg-white/5 border-white/10'}`}>
                          {msg.type === 'user' ? <User size={14} /> : <Sparkles size={14} className="text-blue-400" />}
                        </div>
                        <div className={`px-5 py-4 rounded-3xl text-sm leading-relaxed shadow-xl ${
                          msg.type === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/[0.03] border border-white/10 text-gray-200 rounded-bl-none backdrop-blur-md'
                        }`}>
                          {msg.text}
                          {msg.places?.length > 0 && <div className="mt-3 space-y-2">
                            {msg.places.map(place => <button key={place.id} className="w-full text-left p-3 rounded-xl bg-blue-500/10 border border-blue-400/20 text-xs" onClick={() => {
                              lastAiPlace.current = place;
                              mapRef.current?.dismissDetails();
                              mapRef.current?.flyTo({ center: [place.lng, place.lat], zoom: 17, showMarker: false });
                              mapRef.current?.showPlace({ ...place, id: place.localId ? place.id : place.locationId || (place.source === 'osm' ? undefined : place.id) });
                              if (isMobile) setIsChatCollapsed(true);
                            }}>
                              <span className="block font-semibold">{place.name}</span>
                              <span className="block text-slate-400">{place.distanceMeters >= 1000 ? `${(place.distanceMeters / 1000).toFixed(1)} km` : `${Math.round(place.distanceMeters)} m`} đường thẳng · {place.source === 'offline' ? 'Gói Đà Nẵng' : place.source === 'mapai' ? 'MapAI' : 'OpenStreetMap'}</span>
                            </button>)}
                          </div>}
                          {msg.location && msg.location.address && (
                            <motion.button 
                              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                              onClick={() => handleFlyTo(msg.location)}
                              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl text-blue-400 text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                              <MapPin size={12} /> Xem Trên Bản Đồ
                            </motion.button>
                          )}
                        </div>
                      </div>
                      {msg.type === 'ai' && msg.suggestions && msg.id === messages[messages.length-1].id && !isAiLoading && (
                        <div className="flex flex-wrap gap-2 mt-2 ml-11">
                          {msg.suggestions.map((s, i) => (
                            <button 
                              key={i} onClick={() => handleSend(null, s)}
                              className="px-3 py-1.5 bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/30 rounded-full text-[10px] text-gray-400 hover:text-blue-400 transition-all font-medium"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isAiLoading && (
                  <div className="flex gap-3 ml-2">
                    <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <Sparkles size={14} className="text-blue-400 animate-spin" />
                    </div>
                    <div className="px-5 py-3 bg-white/5 border border-white/10 rounded-3xl rounded-tl-none flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-6 shrink-0 bg-gradient-to-t from-[#0f0f12] to-transparent">
              <form onSubmit={handleSend} className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text" aria-label="Hỏi trợ lý MapAI" value={input} onChange={(e) => setInput(e.target.value)} disabled={isAiLoading}
                  placeholder="Hỏi trợ lý MapAI..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-14 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-[13px] text-white placeholder:text-gray-600"
                />
                <button type="submit" aria-label="Gửi câu hỏi" disabled={!input.trim() || isAiLoading} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:grayscale text-white rounded-xl transition-all shadow-lg shadow-blue-500/30">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        )}
      </motion.div>
      {dataOpen && <OfflineDataModal resource={resource} onClose={closeData} />}
      {savedOpen && <SavedPlacesDialog resource={resource} onClose={closeSaved} onSelect={place => {
        setSavedOpen(false); lastAiPlace.current = place; mapRef.current?.showPlace(place);
        mapRef.current?.flyTo({ center: [place.lng, place.lat], zoom: 16, showMarker: false });
      }} />}
      {!hasApi && <p className="sr-only">Bản demo chưa có URL backend; đang dùng dữ liệu cục bộ.</p>}
      {showContributions && mode === 'online' && <div className="community-overlay" role="dialog" aria-modal="true" aria-label="Đóng góp của tôi">
        <div className="community-dialog space-y-4"><header className="flex justify-between items-center gap-3"><h2 className="text-xl font-bold">Đóng góp của tôi</h2>
          <button className="community-secondary" aria-label="Đóng danh sách đóng góp" onClick={() => setShowContributions(false)}><X size={20} /></button></header>
          <ContributionList onView={place => {
            setShowContributions(false);
            mapRef.current?.flyTo({ center: [place.longitude, place.latitude], zoom: 17, title: place.title });
          }} />
        </div>
      </div>}
    </div>
  );
};

export default MapPage;
