export const OSM_SOURCE = 'osm-streets';

export function streetStyle() {
  return {
    version: 8,
    sources: { [OSM_SOURCE]: {
      type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256, maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
    } },
    layers: [{ id: 'osm-streets', type: 'raster', source: OSM_SOURCE }],
  };
}

export function mapTilerKey(value) {
  const key = value?.trim();
  return key && !/^(YOUR_|REPLACE_|PASTE_)/i.test(key) ? key : null;
}

export function basemapStyle(key) {
  return mapTilerKey(key) ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(key.trim())}` : streetStyle();
}

// A failed paid/keyed provider must not leave only points over an empty canvas.
// style.load runs again after setStyle, letting callers rebuild their overlays.
export function monitorBasemap(map, key, { onReady, onChanging, onWarning }) {
  let raster = !mapTilerKey(key);
  let disposed = false;
  const ready = () => { if (!disposed) onReady({ vector: !raster }); };
  const change = () => {
    if (disposed) return;
    onChanging();
    if (map.isStyleLoaded()) map.setTerrain(null);
    map.setStyle(raster ? streetStyle() : basemapStyle(key), { diff: false });
  };
  const failed = event => {
    if (disposed || ['mapai-places', 'route'].includes(event.sourceId)) return;
    if (event.sourceId === 'maptiler-terrain') {
      map.setTerrain(null);
      onWarning('Không tải được địa hình 3D. Bạn vẫn có thể xem bản đồ đường phố.');
      return;
    }
    if (!raster) {
      raster = true;
      onWarning('Đã chuyển sang bản đồ đường phố dự phòng vì không tải được lớp bản đồ đã chọn.');
      change();
    } else onWarning('Không tải được bản đồ đường phố. Hãy kiểm tra kết nối mạng rồi thử tải lại.');
  };
  const data = event => {
    if (!disposed && event.sourceId === OSM_SOURCE && event.tile?.state === 'loaded') onWarning(null);
  };
  map.on('style.load', ready);
  map.on('error', failed);
  map.on('sourcedata', data);
  return {
    reload: change,
    dispose: () => {
      disposed = true;
      map.off('style.load', ready);
      map.off('error', failed);
      map.off('sourcedata', data);
    },
  };
}
