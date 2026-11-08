import React, { useEffect, useRef, useState, useCallback, useImperativeHandle } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Import Services & Helpers
import { searchLocation } from '../services/locationService';
import { fetchRoute } from '../services/mapServices';

// Import Components
import PlaceDetailPanel from './PlaceDetailPanel';
import DirectionsPanel from './DirectionsPanel';
import NavigationControls from './MapLibre/NavigationControls';
import ViewToggle from './MapLibre/ViewToggle';
import MapStatusOverlays from './MapLibre/MapStatusOverlays';
import LocationRequestPopup from './MapLibre/LocationRequestPopup';

// Import Context
import { useToast } from '../hooks/useToast';

const CATEGORY_CONFIG = {
  'food': { color: '#FF6B6B', icon: 'Utensils' },
  'cafe': { color: '#FF9F43', icon: 'Coffee' },
  'shop': { color: '#4834d4', icon: 'ShoppingBag' },
  'bus': { color: '#45aaf2', icon: 'Bus' },
  'gas': { color: '#fed330', icon: 'Fuel' },
  'medical': { color: '#eb4d4b', icon: 'Hospital' },
  'atm': { color: '#26de81', icon: 'CreditCard' },
  'tourism': { color: '#f9ca24', icon: 'Ticket' },
  'hotel': { color: '#686de0', icon: 'Hotel' },
  'park': { color: '#6ab04c', icon: 'Leaf' },
  'default': { color: '#95afc0', icon: 'MapPin' }
};

const MapLibreView = ({ mapRef, isDirectionsMode, setIsDirectionsMode, isNavigating, setIsNavigating, onLocationFound }) => {
  const [searchParams] = useSearchParams();
  const mapContainer = useRef(null);
  const map = useRef(null);
  
  // States
  const [is3D, setIs3D] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [mapError, setMapError] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isUserLocating, setIsUserLocating] = useState(false);
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [initialOrigin, setInitialOrigin] = useState(null);
  const [initialDestination, setInitialDestination] = useState(null);

  // Refs
  const routeMarkersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const searchMarkerRef = useRef(null);
  const nearbyMarkersRef = useRef([]);

  const { addToast, removeToast } = useToast();

  const clearNearbyMarkers = useCallback(() => {
    nearbyMarkersRef.current.forEach(m => m.remove());
    nearbyMarkersRef.current = [];
  }, []);

  const setNearbyMarkers = useCallback((places) => {
    if (!map.current) return;
    clearNearbyMarkers();

    const bounds = new maplibregl.LngLatBounds();

    places.forEach(place => {
      const el = document.createElement('div');
      el.className = 'relative flex items-center justify-center cursor-pointer group';
      
      // Determine config based on category or default
      const category = place.categories?.[0]?.name?.toLowerCase() || '';
      let config = CATEGORY_CONFIG.default;
      
      if (category.includes('coffee') || category.includes('cafe') || category.includes('tea')) {
        config = CATEGORY_CONFIG.cafe;
      } else if (category.includes('restaurant') || category.includes('food') || category.includes('dining') || category.includes('bakery')) {
        config = CATEGORY_CONFIG.food;
      } else if (category.includes('bus') || category.includes('transit') || category.includes('stop')) {
        config = CATEGORY_CONFIG.bus;
      } else if (category.includes('gas') || category.includes('fuel') || category.includes('petrol')) {
        config = CATEGORY_CONFIG.gas;
      } else if (category.includes('hospital') || category.includes('medical') || category.includes('clinic') || category.includes('health')) {
        config = CATEGORY_CONFIG.medical;
      } else if (category.includes('atm') || category.includes('bank') || category.includes('finance')) {
        config = CATEGORY_CONFIG.atm;
      } else if (category.includes('hotel') || category.includes('lodging') || category.includes('resort') || category.includes('hostel')) {
        config = CATEGORY_CONFIG.hotel;
      } else if (category.includes('shop') || category.includes('store') || category.includes('mall') || category.includes('market')) {
        config = CATEGORY_CONFIG.shop;
      } else if (category.includes('tourism') || category.includes('attraction') || category.includes('museum') || category.includes('monument')) {
        config = CATEGORY_CONFIG.tourism;
      } else if (category.includes('park') || category.includes('garden') || category.includes('nature')) {
        config = CATEGORY_CONFIG.park;
      }

      const color = config?.color || CATEGORY_CONFIG.default.color;

      el.innerHTML = `
        <div class="absolute w-12 h-12 bg-white/20 rounded-full scale-0 group-hover:scale-110 transition-transform duration-300 shadow-2xl"></div>
        <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg" class="relative drop-shadow-2xl transition-all duration-300 group-hover:scale-125">
          <path d="M17 0C7.611 0 0 7.611 0 17C0 27.5 17 42 17 42C17 42 34 27.5 34 17C34 7.611 26.389 0 17 0Z" fill="${color}"/>
          <circle cx="17" cy="17" r="13" fill="white"/>
          <circle cx="17" cy="17" r="11" fill="${color}" fill-opacity="0.1"/>
          <g transform="translate(9, 9) scale(0.65)">
            <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="${color}" stroke="white" stroke-width="1"/>
          </g>
        </svg>
      `;

      const marker = new maplibregl.Marker({ 
        element: el,
        anchor: 'bottom'
      })
        .setLngLat([place.lng, place.lat])
        .addTo(map.current);

      const popupContent = `
        <div class="relative p-4 bg-slate-900/90 backdrop-blur-xl text-white rounded-2xl border border-white/10 shadow-2xl min-w-[240px] overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-1" style="background-color: ${color}"></div>
          <h3 class="text-sm font-bold mb-1 mt-1 pr-4 truncate">${place.name}</h3>
          <p class="text-[10px] text-slate-400 mb-4 line-clamp-2">${place.displayName || place.location?.formattedAddress || ''}</p>
          <div class="grid grid-cols-2 gap-2">
            <button onclick="window.showPlaceDetails('${place.name.replace(/'/g, "\\'")}', ${place.lng}, ${place.lat})" class="py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black rounded-xl uppercase tracking-wider transition-colors shadow-lg shadow-blue-600/20">CHI TIẾT</button>
            <button onclick="window.startDirectionsFromPopup('${place.name.replace(/'/g, "\\'")}', ${place.lng}, ${place.lat})" class="py-2.5 bg-white/10 hover:bg-white/20 text-white text-[9px] font-black rounded-xl uppercase tracking-wider transition-colors border border-white/10">ĐƯỜNG ĐI</button>
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: [0, -10], closeButton: true, className: 'custom-search-popup' })
        .setHTML(popupContent);
      
      marker.setPopup(popup);
      nearbyMarkersRef.current.push(marker);
      bounds.extend([place.lng, place.lat]);
    });

    if (places.length > 0) {
      map.current.fitBounds(bounds, { 
        padding: 80, 
        duration: 1500, 
        maxZoom: 16,
        pitch: map.current.getPitch() // Giữ nguyên độ nghiêng hiện tại
      });
    }
  }, [clearNearbyMarkers]);

  // --- Map Actions ---
  const handleToggleView = useCallback((forceMode = null) => {
    if (!map.current) return;
    const nextIs3D = forceMode !== null ? forceMode.toUpperCase() === '3D' : !is3D;
    if (forceMode !== null && nextIs3D === is3D) return false;

    if (nextIs3D) {
      if (map.current.getSource('maptiler-terrain')) {
        map.current.setTerrain({ source: 'maptiler-terrain', exaggeration: 1.5 });
      }
      map.current.easeTo({ pitch: 65, zoom: Math.max(map.current.getZoom(), 15.5), duration: 1000 });
    } else {
      map.current.setTerrain(null);
      map.current.easeTo({ pitch: 0, zoom: Math.max(map.current.getZoom() - 1, 14), duration: 1000 });
    }
    setIs3D(nextIs3D);
    return true;
  }, [is3D]);

  const addSearchMarker = useCallback((lng, lat) => {
    if (!map.current) return;
    if (searchMarkerRef.current) searchMarkerRef.current.remove();

    const el = document.createElement('div');
    el.className = 'relative flex items-center justify-center';
    el.innerHTML = `
      <div class="absolute w-12 h-12 bg-rose-500/30 rounded-full animate-ping"></div>
      <div class="absolute w-8 h-8 bg-rose-500/50 rounded-full animate-pulse"></div>
      <div class="relative w-6 h-6 bg-rose-600 rounded-full border-4 border-white shadow-2xl flex items-center justify-center">
        <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
      </div>
    `;

    searchMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(map.current);
  }, []);

  const handleMoveCamera = useCallback((direction) => {
    if (!map.current) return;
    const center = map.current.getCenter();
    const bearing = map.current.getBearing();
    const zoom = map.current.getZoom();
    const step = 0.0001 * (Math.pow(2, 20 - zoom)); 
    const rad = bearing * Math.PI / 180;

    switch (direction) {
      case 'forward':
        map.current.easeTo({ center: [center.lng + step * Math.sin(rad), center.lat + step * Math.cos(rad)], duration: 200 });
        break;
      case 'backward':
        map.current.easeTo({ center: [center.lng - step * Math.sin(rad), center.lat - step * Math.cos(rad)], duration: 200 });
        break;
      case 'left':
        map.current.easeTo({ bearing: bearing - 15, duration: 200 });
        break;
      case 'right':
        map.current.easeTo({ bearing: bearing + 15, duration: 200 });
        break;
    }
  }, []);

  const handleMoveToStep = useCallback((index) => {
    if (!map.current || !routeInfo || !routeInfo.legs?.[0]?.steps?.[index]) return;
    
    const steps = routeInfo.legs[0].steps;
    const currentStep = steps[index];
    
    if (!currentStep.maneuver || !currentStep.maneuver.location || currentStep.maneuver.location.length < 2) {
      console.warn("Invalid step location at index:", index);
      return;
    }

    const nextStep = steps[index + 1];
    const lon1 = currentStep.maneuver.location[0];
    const lat1 = currentStep.maneuver.location[1];
    
    let targetBearing = map.current.getBearing();
    
    if (nextStep && nextStep.maneuver && nextStep.maneuver.location && nextStep.maneuver.location.length >= 2) {
      const lon2 = nextStep.maneuver.location[0];
      const lat2 = nextStep.maneuver.location[1];
      
      if (lon1 !== lon2 || lat1 !== lat2) {
        const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
        const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
                  Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
        targetBearing = Math.atan2(y, x) * 180 / Math.PI;
      }
    }

    map.current.flyTo({ 
      center: [lon1, lat1], 
      zoom: 18, 
      pitch: 75, 
      bearing: isFinite(targetBearing) ? targetBearing : map.current.getBearing(), 
      duration: 1500, 
      essential: true 
    });
  }, [routeInfo]);

  const handleStartNavigation = useCallback(() => {
    if (!map.current || !routeInfo || !routeInfo.geometry) return;
    const coords = routeInfo.geometry.coordinates;
    if (coords.length < 2) return;

    addToast("Bắt đầu dẫn đường 3D...", "success");

    const lon1 = coords[0][0]; const lat1 = coords[0][1];
    const lon2 = coords[1][0]; const lat2 = coords[1][1];

    const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    brng = (brng + 360) % 360;

    if (!is3D) {
      if (map.current.getSource('maptiler-terrain')) {
        map.current.setTerrain({ source: 'maptiler-terrain', exaggeration: 1.5 });
      }
      setIs3D(true);
    }

    map.current.flyTo({ center: [lon1, lat1], zoom: 19, pitch: 80, bearing: brng, duration: 4000, essential: true });
    setIsNavigating(true);
  }, [routeInfo, is3D, addToast, setIsNavigating]);

  const clearRoute = useCallback(() => {
    if (!map.current) return;
    if (map.current.getLayer('route-line')) map.current.removeLayer('route-line');
    if (map.current.getSource('route')) map.current.removeSource('route');
    routeMarkersRef.current.forEach(m => m.remove());
    routeMarkersRef.current = [];
    setRouteInfo(null);
  }, []);

  // Expose methods to parent
  useImperativeHandle(mapRef, () => ({
    flyTo: (options) => {
      if (map.current) {
        map.current.flyTo(options);
        if (options.center) addSearchMarker(options.center[0], options.center[1], options.title || "Vị trí tìm thấy");
      }
    },
    toggleView: (mode) => handleToggleView(mode),
    getIs3D: () => is3D,
    getMap: () => map.current,
    setNearbyMarkers: (places) => setNearbyMarkers(places),
    clearNearbyMarkers: () => clearNearbyMarkers(),
    setShowLocationPopup: (show) => setShowLocationPopup(show),
    locateUser: (force) => handleLocateUser(force),
    setDestination: (dest) => setInitialDestination(dest)
  }));

  // --- Effects ---
  useEffect(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    if (lat && lng && map.current) {
      const lonNum = parseFloat(lng);
      const latNum = parseFloat(lat);
      clearNearbyMarkers();
      map.current.flyTo({ center: [lonNum, latNum], zoom: 16, essential: true, duration: 3000 });
      addSearchMarker(lonNum, latNum, "Địa điểm đã chọn");
    }
  }, [searchParams, isLoaded, addSearchMarker, clearNearbyMarkers]);

  const handleLocateUser = useCallback((forceUpdateInitialOrigin = false) => {
    const isForce = forceUpdateInitialOrigin === true;
    if (userMarkerRef.current && !isForce) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
      setIsUserLocating(false);
      sessionStorage.removeItem('user_location');
      if (initialOrigin?.name === "Vị trí của tôi") setInitialOrigin(null);
      addToast("Đã ẩn vị trí của bạn.", "info");
      return;
    }

    if (!navigator.geolocation) {
      addToast("Trình duyệt không hỗ trợ định vị.", "error");
      return;
    }

    const loadingId = addToast("Đang xác định vị trí của bạn...", "loading", Infinity);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        removeToast(loadingId);
        if (!map.current) return;
        
        map.current.flyTo({ center: [longitude, latitude], zoom: 17, essential: true, duration: 2000 });
        
        const el = document.createElement('div');
        el.className = 'relative flex items-center justify-center';
        el.innerHTML = `<div class="absolute w-10 h-10 bg-blue-500/20 rounded-full animate-ping"></div><div class="relative w-5 h-5 bg-blue-600 rounded-full border-4 border-white shadow-lg"></div>`;
        
        if (userMarkerRef.current) userMarkerRef.current.remove();
        userMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map.current);
        
        const locData = { name: "Vị trí của tôi", lng: longitude, lat: latitude, timestamp: Date.now() };
        setIsUserLocating(true);
        sessionStorage.setItem('user_location', JSON.stringify(locData));
        
        if (onLocationFound) onLocationFound(locData);
        if (forceUpdateInitialOrigin) setInitialOrigin(locData);

        addToast("Đã định vị thành công!", "success");
      },
      (error) => { 
        console.error("Geolocation error:", error);
        removeToast(loadingId); 
        addToast("Không thể lấy vị trí.", "error"); 
        setIsUserLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [addToast, removeToast, initialOrigin?.name, onLocationFound]);

  const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY?.trim();
  const styleUrl = (MAPTILER_KEY && MAPTILER_KEY !== 'YOUR_MAPTILER_KEY_HERE')
    ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
    : 'https://demotiles.maplibre.org/style.json';

  useEffect(() => {
    if (map.current) return;
    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: styleUrl,
        center: [108.22, 16.06],
        zoom: 15,
        pitch: 0,
        antialias: true
      });

      map.current.on('load', () => {
        setIsLoaded(true);
        if (MAPTILER_KEY) {
          map.current.addSource('maptiler-terrain', { type: 'raster-dem', url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`, tileSize: 256 });
        }
        map.current.resize();
      });

      map.current.on('rotate', () => setBearing(map.current.getBearing()));
      map.current.on('click', (e) => {
        const poi = map.current.queryRenderedFeatures([ [e.point.x - 10, e.point.y - 10], [e.point.x + 10, e.point.y + 10] ]).find(f => f.properties?.name);
        if (!poi) return;
        const popupContent = `
          <div class="relative p-4 bg-slate-900 text-white rounded-2xl border border-white/10 shadow-2xl min-w-[220px]">
            <h3 class="text-sm font-bold mb-3">${poi.properties.name}</h3>
            <div class="grid grid-cols-2 gap-2">
              <button onclick="window.showPlaceDetails('${poi.properties.name}', ${e.lngLat.lng}, ${e.lngLat.lat})" class="py-2 bg-blue-600 text-white text-[9px] font-black rounded-lg uppercase">CHI TIẾT</button>
              <button onclick="window.startDirectionsFromPopup('${poi.properties.name}', ${e.lngLat.lng}, ${e.lngLat.lat})" class="py-2 bg-slate-800 text-white text-[9px] font-black rounded-lg uppercase">ĐƯỜNG ĐI</button>
            </div>
          </div>
        `;
        new maplibregl.Popup({ offset: [0, -10], closeButton: true }).setLngLat(e.lngLat).setHTML(popupContent).addTo(map.current);
      });
    } catch (_err) { setMapError("Không thể khởi tạo bản đồ."); }
    return () => { if (map.current) { map.current.remove(); map.current = null; } };
  }, [MAPTILER_KEY, styleUrl]);

  const handleShowDetails = useCallback(async (name, coordinates) => {
    setIsDetailLoading(true);
    try {
      const details = await searchLocation(name, coordinates);
      if (details) {
        setSelectedPlace(details);
      } else {
        addToast("Không tìm thấy thông tin chi tiết cho địa điểm này.", "info");
      }
    } catch (_error) { 
      addToast("Không thể tải thông tin từ hệ thống.", "error"); 
    } finally { 
      setIsDetailLoading(false); 
    }
  }, [addToast]);

  const handleStartDirectionsFromPanel = useCallback((place) => {
    const savedLoc = sessionStorage.getItem('user_location');
    if (savedLoc) setInitialOrigin(JSON.parse(savedLoc));
    
    setInitialDestination({
      name: place.name,
      lng: place.lng,
      lat: place.lat
    });
    
    setIsDirectionsMode(true);
    setSelectedPlace(null); // Đóng panel chi tiết
  }, [setIsDirectionsMode]);

  const handleRouteSelected = useCallback(async (origin, destination, mode = 'driving') => {
    if (!map.current) return;
    clearRoute();
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }

    const loadingToastId = addToast(`Đang tìm đường...`, "loading", Infinity);
    try {
      const route = await fetchRoute(origin, destination, mode);
      map.current.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: route.geometry } });
      map.current.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#3b82f6', 'line-width': 6 } });

      const originEl = document.createElement('div');
      originEl.className = 'flex items-center justify-center';
      originEl.innerHTML = `<div class="relative flex items-center justify-center"><div class="absolute w-8 h-8 bg-blue-500/30 rounded-full animate-ping"></div><div class="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center"><div class="w-1.5 h-1.5 bg-white rounded-full"></div></div></div>`;
      const originMarker = new maplibregl.Marker({ element: originEl }).setLngLat([origin.lng, origin.lat]).addTo(map.current);
      routeMarkersRef.current.push(originMarker);

      const destEl = document.createElement('div');
      destEl.className = 'flex items-center justify-center';
      destEl.innerHTML = `<div class="relative flex items-center justify-center"><div class="absolute w-8 h-8 bg-rose-500/30 rounded-full animate-ping"></div><div class="w-4 h-4 bg-rose-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center"><div class="w-1.5 h-1.5 bg-white rounded-full"></div></div></div>`;
      const destMarker = new maplibregl.Marker({ element: destEl }).setLngLat([destination.lng, destination.lat]).addTo(map.current);
      routeMarkersRef.current.push(destMarker);

      const bounds = route.geometry.coordinates.reduce((acc, coord) => acc.extend(coord), new maplibregl.LngLatBounds(route.geometry.coordinates[0], route.geometry.coordinates[0]));
      map.current.fitBounds(bounds, { 
        padding: 100, 
        duration: 1000,
        pitch: map.current.getPitch() // Giữ nguyên độ nghiêng hiện tại
      });
      setRouteInfo(route);
      removeToast(loadingToastId);
      addToast("Đã tìm thấy đường!", "success");
    } catch (_error) { 
      console.error("Route error:", _error);
      removeToast(loadingToastId); 
      addToast("Lỗi tìm đường", "error"); 
    }
  }, [addToast, removeToast, clearRoute]);

  useEffect(() => {
    window.showPlaceDetails = (name, lng, lat) => handleShowDetails(name, [lng, lat]);
    window.startDirectionsFromPopup = (name, lng, lat) => {
      const savedLoc = sessionStorage.getItem('user_location');
      if (savedLoc) setInitialOrigin(JSON.parse(savedLoc));
      setInitialDestination({ name, lng, lat });
      setIsDirectionsMode(true);
    };
    return () => { delete window.showPlaceDetails; delete window.startDirectionsFromPopup; };
  }, [handleShowDetails, setIsDirectionsMode]);

  useEffect(() => {
    const handleAISetDestination = (e) => {
      const destination = e.detail;
      if (destination) {
        setInitialDestination(destination);
        setIsDirectionsMode(true);
      }
    };
    window.addEventListener('ai-set-destination', handleAISetDestination);
    return () => window.removeEventListener('ai-set-destination', handleAISetDestination);
  }, [setIsDirectionsMode, setInitialDestination]);

  useEffect(() => {
    if (isDirectionsMode && !initialOrigin && !isNavigating) {
      const savedLoc = sessionStorage.getItem('user_location');
      if (savedLoc) {
        setInitialOrigin(JSON.parse(savedLoc));
      } else if (!isUserLocating) {
        setShowLocationPopup(true);
      }
    }
  }, [isDirectionsMode, initialOrigin, isNavigating, isUserLocating]);

  return (
    <div className="relative w-full h-full bg-[#0f172a] overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      <AnimatePresence>
        {isDirectionsMode && (
          <DirectionsPanel 
            initialOrigin={initialOrigin} initialDestination={initialDestination} routeInfo={routeInfo}
            isNavigating={isNavigating}
            onStartNavigation={handleStartNavigation}
            onStopNavigation={() => setIsNavigating(false)}
            onMoveCamera={handleMoveCamera}
            onMoveToStep={handleMoveToStep}
            onBack={() => { setIsDirectionsMode(false); setIsNavigating(false); clearRoute(); setInitialOrigin(null); setInitialDestination(null); }}
            onRouteSelected={handleRouteSelected}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedPlace && (
          <PlaceDetailPanel 
            place={selectedPlace} 
            onClose={() => setSelectedPlace(null)} 
            onStartDirections={handleStartDirectionsFromPanel}
          />
        )}
      </AnimatePresence>
      <MapStatusOverlays isLoaded={isLoaded} mapError={mapError} isDetailLoading={isDetailLoading} />
      <div className="absolute bottom-10 right-10 z-20 flex flex-col gap-3 items-end">
        <NavigationControls map={map.current} onLocate={handleLocateUser} bearing={bearing} isUserLocating={isUserLocating} />
        <ViewToggle is3D={is3D} onToggle={() => handleToggleView()} />
      </div>
      <LocationRequestPopup 
        isOpen={showLocationPopup}
        onConfirm={() => { setShowLocationPopup(false); handleLocateUser(true); }}
        onCancel={() => { setShowLocationPopup(false); addToast("Bạn đã từ chối chia sẻ vị trí. Vui lòng tự chọn điểm xuất phát.", "info"); }}
      />
      <style>{`
        .maplibregl-popup-content { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
        .custom-search-popup .maplibregl-popup-close-button { right: 12px !important; top: 8px !important; color: white !important; font-size: 16px !important; opacity: 0.6; transition: opacity 0.2s; }
        .custom-search-popup .maplibregl-popup-close-button:hover { opacity: 1; }
      `}</style>
    </div>
  );
};

export default MapLibreView;
