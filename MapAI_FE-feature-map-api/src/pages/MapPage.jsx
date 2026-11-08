import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, User, Sparkles, Search, ChevronRight, ChevronLeft, MessageSquare, Navigation, MapPin, Globe, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import MapLibreView from '../components/MapLibreView';
import SearchBar from '../components/SearchBar';
import SearchSuggestions from '../components/SearchSuggestions';
import { askMapAI } from '../services/aiService';
import { searchNearbyPlaces, searchCityWidePlaces } from '../services/mapServices';
import { useToast } from '../hooks/useToast';

const MapPage = () => {
  const navigate = useNavigate();
  const { addToast, removeToast } = useToast();
  const [input, setInput] = useState('');
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isDirectionsMode, setIsDirectionsMode] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const [hasNearbyResults, setHasNearbyResults] = useState(false);
  const [pendingNearbySearch, setPendingNearbySearch] = useState(null);
  const chatEndRef = useRef(null);
  const mapRef = useRef(null);

  // Hàm thực hiện tìm kiếm Nearby thực tế
  const executeNearbySearch = useCallback(async (query, lat, lng) => {
    if (!mapRef.current) return;
    
    setIsSearchingNearby(true);
    const loadingToastId = addToast(`Đang tìm ${query} gần bạn...`, "loading", Infinity);

    try {
      const places = await searchNearbyPlaces(lat, lng, query, 2000);
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
  }, [addToast, removeToast]);

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
      const places = await searchCityWidePlaces(suggestion.query);
      
      removeToast(loadingToastId);
      
      if (places && places.length > 0) {
        mapRef.current.setNearbyMarkers(places);
        setHasNearbyResults(true);
        addToast(`Tìm thấy ${places.length} ${suggestion.label} tại Đà Nẵng!`, "success");
      } else {
        addToast(`Không tìm thấy ${suggestion.label} nào.`, "info");
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
      suggestions: ['Những quán cafe view biển đẹp?', 'Đường đi tới Bán đảo Sơn Trà?', 'Món ngon đặc sản Đà Nẵng?']
    }
  ]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiLoading]);

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
        window.showPlaceDetails(loc.name, loc.lng, loc.lat);
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
    setIsAiLoading(true);

    try {
      // Gọi Gemini AI
      const response = await askMapAI(messageText, messages.slice(-5));
      console.log("Raw AI Response received in MapPage:", response);
      
      const aiMsg = {
        id: crypto.randomUUID(),
        type: 'ai',
        text: response.message,
        location: response.location,
        suggestions: response.suggestions,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages(prev => [...prev, aiMsg]);

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
            searchCityWidePlaces(locName).then(places => {
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
          if (typeof destination === 'object' && destination !== null && destination.lat && destination.lng) {
            console.log("Action: Setting direction to provided coordinates:", destination);
            setIsDirectionsMode(true);
            const destObj = {
              lat: parseFloat(destination.lat),
              lng: parseFloat(destination.lng),
              name: destination.name || "Đích đến"
            };
            
            // Set vào DirectionsPanel
            if (mapRef.current && mapRef.current.setDestination) {
              mapRef.current.setDestination(destObj);
            }
            // Bay đến đích để người dùng thấy
            handleFlyTo(destObj);
          } else {
            const destName = target_location || (typeof destination === 'string' ? destination : (destination?.name || value));
            console.log("Action: Searching and setting direction to name:", destName);
            setIsDirectionsMode(true);
            
            searchCityWidePlaces(destName).then(places => {
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
          searchCityWidePlaces(query).then(places => {
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
      setIsAiLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] text-gray-100 overflow-hidden font-sans relative">
      
      {/* --- PHẦN BẢN ĐỒ --- */}
      <motion.div 
        animate={{ width: isNavigating ? 'calc(100% - 80px)' : (isChatCollapsed ? '100%' : '70%') }}
        className="relative h-full bg-[#121212] overflow-hidden"
      >
        {!isNavigating && (
          <div className="absolute top-6 left-6 z-10 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <motion.button onClick={() => navigate('/')} className="p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/10 hover:bg-white/20 transition-all shadow-xl group">
                <ArrowLeft className="w-6 h-6 text-white group-hover:-translate-x-1 transition-transform" />
              </motion.button>
              <SearchBar />
              {!isDirectionsMode && (
                <motion.button onClick={() => setIsDirectionsMode(true)} className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-950 rounded-full shadow-xl font-black text-[9px] uppercase tracking-[0.15em] transition-all border border-white/20">
                  <Navigation size={14} className="text-blue-600" /> Chỉ đường
                </motion.button>
              )}
            </div>
            
            {/* Suggestions Row */}
            <SearchSuggestions 
              onSearch={handleNearbySearch} 
              onClear={handleClearNearby} 
              hasResults={hasNearbyResults} 
            />
          </div>
        )}

        <MapLibreView 
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
      {!isNavigating && (
        <button
          onClick={() => setIsChatCollapsed(!isChatCollapsed)}
          className="absolute z-50 top-1/2 -translate-y-1/2 transition-all duration-300 flex items-center justify-center w-8 h-12 bg-slate-900 border border-white/10 text-white rounded-l-xl hover:bg-blue-600 shadow-2xl"
          style={{ right: isChatCollapsed ? '0' : '30%' }}
        >
          {isChatCollapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      )}

      {/* --- PHẦN CHAT UI --- */}
      <motion.div 
        animate={{ 
          width: isNavigating ? '80px' : (isChatCollapsed ? '0%' : '30%'),
          opacity: (isChatCollapsed && !isNavigating) ? 0 : 1,
          x: (isChatCollapsed && !isNavigating) ? 100 : 0
        }}
        className="h-full flex flex-col bg-[#0f0f12] relative border-l border-white/5 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
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
                <div>
                  <h1 className="text-lg font-black text-white tracking-tight uppercase italic">MapAI Assistant</h1>
                  <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>
                    AI Online & Ready
                  </p>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
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
              <div ref={chatEndRef} />
            </div>

            <div className="p-6 shrink-0 bg-gradient-to-t from-[#0f0f12] to-transparent">
              <form onSubmit={handleSend} className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text" value={input} onChange={(e) => setInput(e.target.value)} disabled={isAiLoading}
                  placeholder="Hỏi trợ lý MapAI..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-14 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-[13px] text-white placeholder:text-gray-600"
                />
                <button type="submit" disabled={!input.trim() || isAiLoading} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:grayscale text-white rounded-xl transition-all shadow-lg shadow-blue-500/30">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default MapPage;
