import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { PMTiles, Protocol, FileSource } from 'pmtiles';
import { db } from '../../offline/db';
import { CENTER, CATEGORIES, LANDMARKS } from '../../offline/constants';
import 'maplibre-gl/dist/maplibre-gl.css';

const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);
maplibregl.addProtocol('localglyph', async ({ url }) => {
  const path = decodeURIComponent(url.slice('localglyph://'.length));
  const asset = await db.assets.get(path);
  return { data: asset ? await asset.blob.arrayBuffer() : new ArrayBuffer(0) };
});
const empty = { type: 'FeatureCollection', features: [] };
const line = coordinates => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });

function mapStyle(data, archiveKey) {
  return {
    version: 8, glyphs: 'localglyph://fonts/{fontstack}/{range}.pbf',
    sources: {
      streets: { type: 'vector', url: `pmtiles://${archiveKey}`, attribution: '© OpenStreetMap contributors · ODbL' },
      geography: { type: 'geojson', data: data.geography },
      route: { type: 'geojson', data: empty }, access: { type: 'geojson', data: empty },
      landmarks: { type: 'geojson', data: { type: 'FeatureCollection', features: LANDMARKS.map(p => ({
        type: 'Feature', properties: { name: p.name }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      })) } },
    },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': '#F1F3EE' } },
      { id: 'water', type: 'fill', source: 'geography', filter: ['==', 'kind', 'water'], paint: { 'fill-color': '#BAE0EB' } },
      { id: 'parks', type: 'fill', source: 'geography', filter: ['==', 'kind', 'park'], paint: { 'fill-color': '#CEE5CD' } },
      { id: 'road-casing', type: 'line', source: 'streets', 'source-layer': 'roads', paint: {
        'line-color': '#D8DCD5', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 5, 18, 12],
      } },
      { id: 'roads', type: 'line', source: 'streets', 'source-layer': 'roads', paint: {
        'line-color': ['match', ['get', 'class'], ['primary', 'secondary', 'trunk'], '#FFE4AD', '#FFFFFF'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 15, 3.5, 18, 10],
      } },
      { id: 'road-labels', type: 'symbol', source: 'streets', 'source-layer': 'roads', minzoom: 14,
        layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11 },
        paint: { 'text-color': '#64746D', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 } },
      { id: 'route-casing', type: 'line', source: 'route', paint: { 'line-color': '#FFFFFF', 'line-width': 9 }, layout: { 'line-join': 'round', 'line-cap': 'round' } },
      { id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#3B82F6', 'line-width': 6 }, layout: { 'line-join': 'round', 'line-cap': 'round' } },
      { id: 'access-line', type: 'line', source: 'access', paint: { 'line-color': '#2563EB', 'line-width': 3, 'line-dasharray': [2, 2] } },
      { id: 'landmark-labels', type: 'symbol', source: 'landmarks', maxzoom: 14,
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 2] },
        paint: { 'text-color': '#475569', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 } },
    ],
  };
}

export default function OfflineMapCanvas({ data, results, selected, route, origin, pickingOrigin, onSelect, onPickOrigin, onMove, mapApiRef }) {
  const container = useRef(null);
  const map = useRef(null);
  const callbacks = useRef({ onSelect, onPickOrigin, onMove, pickingOrigin });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { callbacks.current = { onSelect, onPickOrigin, onMove, pickingOrigin }; }, [onSelect, onPickOrigin, onMove, pickingOrigin]);

  useEffect(() => {
    const key = `danang-${data.pkg.version}.pmtiles`;
    protocol.add(new PMTiles(new FileSource(new File([data.mapBlob], key))));
    let instance, resizeObserver;
    try {
      instance = new maplibregl.Map({ container: container.current, style: mapStyle(data, key),
        center: [CENTER.lng, CENTER.lat], zoom: 13, minZoom: 10, maxZoom: 18,
        maxBounds: [[data.pkg.bounds[0], data.pkg.bounds[1]], [data.pkg.bounds[2], data.pkg.bounds[3]]],
        attributionControl: false, cooperativeGestures: false,
      });
      map.current = instance;
      mapApiRef.current = instance;
      resizeObserver = new ResizeObserver(() => instance.resize());
      resizeObserver.observe(container.current);
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
      instance.on('load', () => setLoaded(true));
      instance.on('error', e => { if (e.error?.message?.includes('WebGL')) setError('Thiết bị chưa hỗ trợ WebGL. Bạn vẫn có thể tìm địa điểm và chọn mốc xuất phát bên dưới.'); });
      instance.on('click', e => {
        if (callbacks.current.pickingOrigin) callbacks.current.onPickOrigin({ lng: e.lngLat.lng, lat: e.lngLat.lat, name: 'Điểm chọn trên bản đồ' });
      });
      instance.on('moveend', () => {
        const center = instance.getCenter();
        callbacks.current.onMove({ lng: center.lng, lat: center.lat });
      });
    } catch {
      queueMicrotask(() => setError('Không khởi tạo được bản đồ WebGL. Bạn vẫn có thể tìm địa điểm và chọn mốc xuất phát bên dưới.'));
    }
    return () => {
      resizeObserver?.disconnect();
      instance?.remove(); map.current = null; mapApiRef.current = null;
      protocol.tiles.delete(key);
    };
  }, [data, mapApiRef]);

  useEffect(() => {
    if (!loaded || !map.current) return;
    const visible = new Set(results.map(p => p.id));
    const markers = data.places.map(place => {
      const el = document.createElement('button');
      const active = selected?.id === place.id;
      el.type = 'button'; el.className = `offline-map-pin ${active ? 'is-selected' : ''} ${!visible.has(place.id) ? 'is-dimmed' : ''}`;
      el.style.setProperty('--pin-color', CATEGORIES.find(c => c.id === place.category)?.color || '#2563EB');
      el.setAttribute('aria-label', `Xem ${place.name}`);
      el.title = place.name;
      const dot = document.createElement('span'); dot.className = 'offline-pin-dot';
      dot.textContent = place.category === 'food' ? '●' : place.category === 'entertainment' ? '✦' : '◆';
      el.appendChild(dot);
      if (active) { const label = document.createElement('span'); label.className = 'offline-pin-label'; label.textContent = place.name; el.appendChild(label); }
      el.addEventListener('click', event => {
        event.stopPropagation();
        if (callbacks.current.pickingOrigin) callbacks.current.onPickOrigin({ lng: place.lng, lat: place.lat, name: place.name });
        else callbacks.current.onSelect(place);
      });
      return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([place.lng, place.lat]).addTo(map.current);
    });
    return () => markers.forEach(marker => marker.remove());
  }, [loaded, data, results, selected]);

  useEffect(() => {
    if (!loaded || !map.current || !origin) return;
    const el = document.createElement('div');
    el.className = `offline-origin-pin ${origin.gps ? 'is-gps' : ''}`;
    el.textContent = origin.gps ? '●' : '⚑'; el.title = origin.name;
    el.setAttribute('aria-label', `Điểm xuất phát: ${origin.name}`);
    const marker = new maplibregl.Marker({ element: el }).setLngLat([origin.lng, origin.lat]).addTo(map.current);
    return () => marker.remove();
  }, [origin, loaded]);

  useEffect(() => {
    if (!loaded || !map.current) return;
    const instance = map.current;
    instance.getSource('route').setData(route?.coordinates.length > 1 ? line(route.coordinates) : empty);
    instance.getSource('access').setData(route ? { type: 'FeatureCollection', features: route.access.map(line) } : empty);
    if (route) {
      const coords = [[route.origin.lng, route.origin.lat], ...route.coordinates, [route.destination.lng, route.destination.lat]];
      const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
      const mobile = window.matchMedia('(max-width: 1023px)').matches;
      instance.fitBounds(bounds, { padding: mobile ? { top: 180, bottom: window.innerHeight * 0.5, left: 40, right: 40 } : { top: 190, bottom: 70, left: 430, right: 80 }, maxZoom: 16, duration: 700 });
    }
  }, [route, loaded]);

  return <>
    <div ref={container} className={`offline-map-canvas ${pickingOrigin ? 'is-picking' : ''}`} aria-label="Bản đồ Đà Nẵng ngoại tuyến" />
    {error && <div className="offline-map-error" role="status">{error}</div>}
    <div className="offline-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap · ODbL</a> · Đường OSM 26/05/2026 · Bờ nước giản lược</div>
  </>;
}
