import React, { useEffect, useRef, useState, useCallback, useImperativeHandle } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Import Services & Helpers
import { searchLocation } from '../services/locationService';
import { fetchRoute } from '../services/mapServices';
import { getDeviceLocation, locationErrorMessage } from '../services/deviceLocation';
import { communityApi, toMapPlace } from '../services/communityService';
import ContributionDialog from './Community/ContributionDialog';
import { MapPin } from 'lucide-react';
import { createPlacePopup } from '../utils/mapPopup';
import { toLngLat, placesGeoJSON } from '../utils/mapCoordinates';
import { basemapStyle, basemapProviders, mapTilerKey, monitorBasemap } from '../services/mapBasemap';

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

function BasemapSelector({ value, providers, onSelect }) {
  return <label className="block">
    <span className="sr-only">Nguồn bản đồ</span>
    <select aria-label="Nguồn bản đồ" title="Nguồn bản đồ" value={value || providers[0].id}
      onChange={event => onSelect(event.target.value)}
      className="map-source-select w-44 max-w-full rounded-xl border border-white/20 bg-slate-950 p-2 text-xs text-white shadow-xl">
      {providers.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
    </select>
  </label>;
}

const MapLibreView = ({ mapRef, isDirectionsMode, setIsDirectionsMode, isNavigating, setIsNavigating, onLocationFound }) => {
  const [searchParams] = useSearchParams();
  const mapContainer = useRef(null);
  const map = useRef(null);
  
  // States
  const [is3D, setIs3D] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [mapError, setMapError] = useState(null);
  const [mapWarning, setMapWarning] = useState(null);
  const [mapProvider, setMapProvider] = useState(null);
  const [locationIssue, setLocationIssue] = useState(null);
  const [styleRevision, setStyleRevision] = useState(0);
  const basemap = useRef(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isUserLocating, setIsUserLocating] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const locatingRef = useRef(false);
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [initialOrigin, setInitialOrigin] = useState(null);
  const [initialDestination, setInitialDestination] = useState(null);
  const [initialTravelMode, setInitialTravelMode] = useState('driving');
  const [directionSession, setDirectionSession] = useState(0);
  const preparedRoute = useRef(null);
  const [contributionDraft, setContributionDraft] = useState(null);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const pickingRef = useRef(false);

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
    places = places.flatMap(place => {
      const coordinates = toLngLat(place);
      return coordinates ? [{ ...place, lng: coordinates[0], lat: coordinates[1] }] : [];
    });

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
      } else if (category.includes('hospital') || category.includes('pharmacy') || category.includes('medical') || category.includes('clinic') || category.includes('health')) {
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

      const popupContent = createPlacePopup(place,
        () => window.showPlaceDetails?.(place.name, place.lng, place.lat, place.locationId),
        () => window.startDirectionsFromPopup?.(place.name, place.lng, place.lat));

      const popup = new maplibregl.Popup({ offset: [0, -10], closeButton: true, className: 'custom-search-popup' })
        .setDOMContent(popupContent);
      
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
        if (options.center && !toLngLat({ lng: options.center[0], lat: options.center[1] })) {
          addToast('Tọa độ địa điểm không hợp lệ.', 'error');
          return;
        }
        const { showMarker, ...camera } = options;
        map.current.flyTo(camera);
        if (options.center && showMarker !== false) addSearchMarker(options.center[0], options.center[1], options.title || "Vị trí tìm thấy");
      }
    },
    toggleView: (mode) => handleToggleView(mode),
    getIs3D: () => is3D,
    getMap: () => map.current,
    setNearbyMarkers: (places) => setNearbyMarkers(places),
    clearNearbyMarkers: () => clearNearbyMarkers(),
    setShowLocationPopup: (show) => setShowLocationPopup(show),
    locateUser: (force) => handleLocateUser(force),
    setDestination: (dest) => setInitialDestination(dest),
    zoomBy: amount => {
      const current = map.current;
      if (current) current.zoomTo(Math.max(current.getMinZoom(), Math.min(current.getMaxZoom(), current.getZoom() + amount)));
    },
    resetNorth: () => map.current?.easeTo({ bearing: 0 }),
    clearSearchResults: () => {
      clearNearbyMarkers();
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;
      setSelectedPlace(null);
    },
    clearDirections: () => {
      clearRoute();
      preparedRoute.current = null;
      setIsNavigating(false);
      setIsDirectionsMode(false);
      setInitialOrigin(null);
      setInitialDestination(null);
    },
    setDirections: (origin, destination, mode = 'driving', route = null) => {
      preparedRoute.current = { key: `${origin.lng},${origin.lat}|${destination.lng},${destination.lat}|${mode}`, route };
      setInitialOrigin({ ...origin, name: origin.name || 'Vị trí của tôi' });
      setInitialDestination(destination);
      setInitialTravelMode(mode);
      setDirectionSession(session => session + 1);
      setSelectedPlace(null);
      setShowLocationPopup(false);
      setIsNavigating(false);
      setIsDirectionsMode(true);
    },
    dismissDetails: () => { setSelectedPlace(null); setShowLocationPopup(false); },
    startContribution: () => {
      if (pickingRef.current) return;
      const center = map.current?.getCenter() || { lat: 16.06, lng: 108.22 };
      setSelectedPlace(null);
      setContributionDraft({ title: '', coordinates: { latitude: center.lat.toFixed(6), longitude: center.lng.toFixed(6) } });
    }
  }));

  // --- Effects ---
  useEffect(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const coordinates = toLngLat({ lat, lng });
    if (coordinates && map.current) {
      const [lonNum, latNum] = coordinates;
      clearNearbyMarkers();
      map.current.flyTo({ center: [lonNum, latNum], zoom: 16, essential: true, duration: 3000 });
      addSearchMarker(lonNum, latNum, "Địa điểm đã chọn");
    }
  }, [searchParams, isLoaded, addSearchMarker, clearNearbyMarkers]);

  const handleLocateUser = useCallback(async (forceUpdateInitialOrigin = false) => {
    const isForce = forceUpdateInitialOrigin === true;
    if (locatingRef.current) return;
    locatingRef.current = true;
    setIsLocating(true);
    setLocationIssue(null);

    const loadingId = addToast("Đang xác định vị trí của bạn...", "loading", Infinity);
    try {
        const position = await getDeviceLocation();
        const { longitude, latitude } = position.coords;
        removeToast(loadingId);
        if (!map.current) return;
        
        map.current.flyTo({ center: [longitude, latitude], zoom: 17, essential: true, duration: 2000 });
        
        const el = document.createElement('div');
        el.className = 'relative flex items-center justify-center';
        el.innerHTML = `<div class="absolute w-10 h-10 bg-blue-500/20 rounded-full animate-ping"></div><div class="relative w-5 h-5 bg-blue-600 rounded-full border-4 border-white shadow-lg"></div>`;
        
        if (userMarkerRef.current) userMarkerRef.current.remove();
        userMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map.current);
        
        const locData = { name: "Vị trí của tôi", lng: longitude, lat: latitude,
          accuracy: position.coords.accuracy, timestamp: position.timestamp || Date.now() };
        setIsUserLocating(true);
        sessionStorage.setItem('user_location', JSON.stringify(locData));
        
        if (onLocationFound) onLocationFound(locData);
        if (isForce) setInitialOrigin(locData);

        addToast("Đã định vị thành công!", "success");
        return locData;
    } catch (error) {
        console.error("Geolocation error:", error);
        removeToast(loadingId); 
        const message = locationErrorMessage(error);
        addToast(message, "error");
        setLocationIssue(message);
        sessionStorage.removeItem('user_location');
        userMarkerRef.current?.remove();
        userMarkerRef.current = null;
        if (initialOrigin?.name === 'Vị trí của tôi') setInitialOrigin(null);
        setIsUserLocating(false);
    } finally {
        locatingRef.current = false;
        setIsLocating(false);
    }
  }, [addToast, removeToast, initialOrigin?.name, onLocationFound]);

  useEffect(() => {
    const observer = new ResizeObserver(() => map.current?.resize());
    if (mapContainer.current) observer.observe(mapContainer.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onBack = event => {
      if (event.defaultPrevented) return;
      if (isPickingLocation) {
        event.preventDefault();
        pickingRef.current = false;
        setIsPickingLocation(false);
      } else if (contributionDraft) {
        event.preventDefault();
        setContributionDraft(null);
      } else if (showLocationPopup) {
        event.preventDefault();
        setShowLocationPopup(false);
      } else if (selectedPlace) {
        event.preventDefault();
        setSelectedPlace(null);
      }
    };
    window.addEventListener('mapai:back', onBack, true);
    return () => window.removeEventListener('mapai:back', onBack, true);
  }, [selectedPlace, showLocationPopup, contributionDraft, isPickingLocation]);

  const MAPTILER_KEY = mapTilerKey(import.meta.env.VITE_MAPTILER_KEY);

  useEffect(() => {
    if (map.current) return;
    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: basemapStyle(MAPTILER_KEY),
        center: [108.22, 16.06],
        zoom: 15,
        pitch: 0,
        antialias: true
      });

      const currentMap = map.current;
      basemap.current = monitorBasemap(currentMap, MAPTILER_KEY, {
        onChanging: () => setIsLoaded(false),
        onWarning: setMapWarning,
        onProviderChange: setMapProvider,
        onReady: ({ provider }) => {
          if (provider === 'maptiler' && MAPTILER_KEY && !currentMap.getSource('maptiler-terrain')) {
            currentMap.addSource('maptiler-terrain', { type: 'raster-dem', url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${encodeURIComponent(MAPTILER_KEY)}`, tileSize: 256 });
          }
          setIsLoaded(true);
          setStyleRevision(revision => revision + 1);
          currentMap.resize();
        },
      });

      map.current.on('rotate', () => setBearing(map.current.getBearing()));
      map.current.on('click', (e) => {
        if (pickingRef.current) return;
        const features = map.current.queryRenderedFeatures([ [e.point.x - 10, e.point.y - 10], [e.point.x + 10, e.point.y + 10] ]);
        const poi = features.find(f => f.properties?.name && f.geometry?.type === 'Point') || features.find(f => f.properties?.name);
        if (!poi) return;
        const [lng, lat] = poi.geometry.type === 'Point' ? poi.geometry.coordinates : [e.lngLat.lng, e.lngLat.lat];
        const place = { name: poi.properties.name, lng, lat };
        const popupContent = createPlacePopup(place,
          () => window.showPlaceDetails?.(place.name, lng, lat),
          () => window.startDirectionsFromPopup?.(place.name, lng, lat));
        new maplibregl.Popup({ offset: [0, -10], closeButton: true }).setLngLat([lng, lat]).setDOMContent(popupContent).addTo(map.current);
      });
    } catch (_err) { setMapError("Không thể khởi tạo bản đồ."); }
    return () => {
      basemap.current?.dispose();
      basemap.current = null;
      if (map.current) { map.current.remove(); map.current = null; }
    };
  }, [MAPTILER_KEY]);

  const handleShowDetails = useCallback(async (name, coordinates) => {
    setIsDetailLoading(true);
    try {
      const details = await searchLocation(name, coordinates);
      if (details) {
        setSelectedPlace(details);
      } else {
        setSelectedPlace(null);
        setContributionDraft({ title: name, coordinates: { latitude: coordinates[1], longitude: coordinates[0] } });
        addToast("Địa điểm chưa có trong MapAI. Bạn có thể gửi thông tin để quản trị viên duyệt.", "info");
      }
    } catch (_error) { 
      addToast("Không thể tải thông tin từ hệ thống.", "error"); 
    } finally { 
      setIsDetailLoading(false); 
    }
  }, [addToast]);

  const openStoredPlace = useCallback(async (id, signal) => {
    try {
      const place = toMapPlace(await communityApi.get(id, signal));
      if (signal?.aborted) return;
      if (!toLngLat(place)) throw new Error('Tọa độ địa điểm không hợp lệ.');
      setSelectedPlace(place);
      map.current?.flyTo({ center: [place.lng, place.lat], zoom: 17 });
    } catch (error) { if (!signal?.aborted) addToast(error.message, 'error'); }
  }, [addToast]);

  useEffect(() => {
    if (!isLoaded || !map.current) return;
    const currentMap = map.current;
    const controller = new AbortController();
    let disposed = false;
    const sourceId = 'mapai-places';
    const layerId = 'mapai-places-points';
    currentMap.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    currentMap.addLayer({ id: layerId, type: 'circle', source: sourceId,
      paint: { 'circle-radius': 9, 'circle-color': '#8b5cf6', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' } });
    const refresh = async () => {
      try {
        const places = await communityApi.list(controller.signal);
        if (disposed) return;
        currentMap.getSource(sourceId)?.setData(placesGeoJSON(places));
      } catch (error) { if (!controller.signal.aborted) addToast(`Không thể tải địa điểm MapAI: ${error.message}`, 'error'); }
    };
    const onClick = event => {
      if (!pickingRef.current && event.features?.[0]) openStoredPlace(event.features[0].properties.id, controller.signal);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    currentMap.on('click', layerId, onClick);
    window.addEventListener('mapai:places-changed', refresh);
    document.addEventListener('visibilitychange', onVisible);
    refresh();
    return () => {
      disposed = true;
      controller.abort();
      window.removeEventListener('mapai:places-changed', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      if (map.current === currentMap) {
        currentMap.off('click', layerId, onClick);
        if (currentMap.getLayer(layerId)) currentMap.removeLayer(layerId);
        if (currentMap.getSource(sourceId)) currentMap.removeSource(sourceId);
      }
    };
  }, [isLoaded, styleRevision, addToast, openStoredPlace]);

  useEffect(() => {
    const currentMap = map.current;
    if (!isLoaded || !routeInfo?.geometry || !currentMap || currentMap.getSource('route')) return;
    currentMap.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: routeInfo.geometry } });
    currentMap.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#3b82f6', 'line-width': 6 } });
  }, [isLoaded, styleRevision, routeInfo]);

  useEffect(() => {
    const id = searchParams.get('placeId');
    if (!id || !isLoaded) return;
    const controller = new AbortController();
    openStoredPlace(id, controller.signal);
    return () => controller.abort();
  }, [searchParams, isLoaded, openStoredPlace]);

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
      const key = `${origin.lng},${origin.lat}|${destination.lng},${destination.lat}|${mode}`;
      const route = preparedRoute.current?.key === key && preparedRoute.current.route
        ? preparedRoute.current.route : await fetchRoute(origin, destination, mode);
      preparedRoute.current = null;
      if (route?.geometry?.type !== 'LineString' || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2)
        throw new Error('Tuyến đường trả về không hợp lệ.');
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
    window.showPlaceDetails = (name, lng, lat, id) => id ? openStoredPlace(id) : handleShowDetails(name, [lng, lat]);
    window.startDirectionsFromPopup = (name, lng, lat) => {
      const savedLoc = sessionStorage.getItem('user_location');
      if (savedLoc) setInitialOrigin(JSON.parse(savedLoc));
      setInitialDestination({ name, lng, lat });
      setIsDirectionsMode(true);
    };
    return () => { delete window.showPlaceDetails; delete window.startDirectionsFromPopup; };
  }, [handleShowDetails, openStoredPlace, setIsDirectionsMode]);

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
            key={directionSession}
            initialMode={initialTravelMode}
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
      {(mapWarning || locationIssue) && <div className="map-notices absolute z-[70] rounded-2xl border border-white/20 bg-slate-950/95 p-4 text-sm text-white shadow-xl">
        {mapWarning && <div role="alert" className="space-y-2"><p>{mapWarning}</p>
          <BasemapSelector value={mapProvider?.id} providers={basemapProviders(MAPTILER_KEY)} onSelect={id => basemap.current?.select(id)} />
          <button className="text-blue-300 font-bold" onClick={() => basemap.current?.reload()}>Thử tải lại bản đồ</button>
        </div>}
        {locationIssue && <div role="alert" className="space-y-2 mt-2"><p>{locationIssue}</p><button disabled={isLocating} className="text-blue-300 font-bold" onClick={() => handleLocateUser(true)}>Thử định vị lại</button></div>}
      </div>}
      <div className="map-controls absolute bottom-10 right-10 z-20 flex flex-col gap-3 items-end">
        <NavigationControls map={map.current} onLocate={handleLocateUser} bearing={bearing} isUserLocating={isUserLocating} isLocating={isLocating} />
        <ViewToggle is3D={is3D} onToggle={() => handleToggleView()} />
        {!mapWarning && <BasemapSelector value={mapProvider?.id} providers={basemapProviders(MAPTILER_KEY)} onSelect={id => basemap.current?.select(id)} />}
      </div>
      <LocationRequestPopup 
        isOpen={showLocationPopup}
        onConfirm={() => { setShowLocationPopup(false); handleLocateUser(true); }}
        onCancel={() => { setShowLocationPopup(false); addToast("Bạn đã từ chối chia sẻ vị trí. Vui lòng tự chọn điểm xuất phát.", "info"); }}
      />
      {contributionDraft && <ContributionDialog
        initialName={contributionDraft.title}
        coordinates={contributionDraft.coordinates}
        onCoordinatesChange={coordinates => setContributionDraft(draft => ({ ...draft, coordinates }))}
        picking={isPickingLocation}
        onPick={() => { pickingRef.current = true; setIsPickingLocation(true); }}
        onClose={() => setContributionDraft(null)}
        onSubmitted={() => addToast('Đóng góp của bạn đang chờ quản trị viên duyệt.', 'success')}
      />}
      {isPickingLocation && <div className="place-picker">
        <MapPin size={48} className="place-picker-pin" fill="#8b5cf6" />
        <div className="place-picker-actions space-y-3"><p>Kéo bản đồ để đặt ghim đúng vị trí địa điểm.</p>
          <div className="flex gap-3"><button className="community-primary" onClick={() => {
            const center = map.current.getCenter();
            setContributionDraft(draft => ({ ...draft, coordinates: { latitude: center.lat.toFixed(6), longitude: center.lng.toFixed(6) } }));
            pickingRef.current = false;
            setIsPickingLocation(false);
          }}>Dùng vị trí ghim này</button><button className="community-secondary" onClick={() => { pickingRef.current = false; setIsPickingLocation(false); }}>Quay lại biểu mẫu</button></div>
        </div>
      </div>}
      <style>{`
        .maplibregl-popup-content { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
        .custom-search-popup .maplibregl-popup-close-button { right: 12px !important; top: 8px !important; color: white !important; font-size: 16px !important; opacity: 0.6; transition: opacity 0.2s; }
        .custom-search-popup .maplibregl-popup-close-button:hover { opacity: 1; }
      `}</style>
    </div>
  );
};

export default MapLibreView;
