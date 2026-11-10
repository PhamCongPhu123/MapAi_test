export const OSM_SOURCE = 'osm-streets';
export const HOT_SOURCE = 'osm-france-streets';
export const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const credit = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';
const rasters = {
  osm: { source: OSM_SOURCE, tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attribution: credit },
  hot: { source: HOT_SOURCE, tiles: ['https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'],
    attribution: `${credit} | Tiles: <a href="https://www.hotosm.org/" target="_blank" rel="noopener noreferrer">HOT</a> / <a href="https://www.openstreetmap.fr/" target="_blank" rel="noopener noreferrer">OpenStreetMap France</a>` },
};

export function streetStyle(provider = 'osm') {
  const entry = rasters[provider];
  if (!entry) throw new Error('Nguồn bản đồ không hợp lệ.');
  return { version: 8, sources: { [entry.source]: { type: 'raster', tiles: [...entry.tiles], tileSize: 256,
    maxzoom: 19, attribution: entry.attribution } },
  layers: [{ id: entry.source, type: 'raster', source: entry.source }] };
}

export function mapTilerKey(value) {
  const key = value?.trim();
  return key && !/^(YOUR_|REPLACE_|PASTE_)/i.test(key) ? key : null;
}

export function basemapProviders(key) {
  return [
    ...(mapTilerKey(key) ? [{ id: 'maptiler', name: 'MapTiler', vector: true }] : []),
    { id: 'openfreemap', name: 'OpenFreeMap', vector: true },
    { id: 'hot', name: 'OpenStreetMap France', vector: false, source: HOT_SOURCE },
    { id: 'osm', name: 'OpenStreetMap', vector: false, source: OSM_SOURCE },
  ];
}

export function basemapStyle(key, provider = basemapProviders(key)[0].id) {
  if (provider === 'maptiler' && mapTilerKey(key)) return `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(key.trim())}`;
  if (provider === 'openfreemap') return OPENFREEMAP_STYLE;
  return streetStyle(provider);
}

function failureReason(error) {
  const status = Number(error?.status);
  // Never show raw provider errors/URLs, which may contain a public API key.
  return status >= 400 && status <= 599 ? `HTTP ${status}` : error?.timeout ? 'hết thời gian chờ' : 'lỗi tải bản đồ';
}

function errorProvider(event) {
  try {
    const host = new URL(event.error?.url || event.source?.url).hostname;
    if (host === 'api.maptiler.com') return 'maptiler';
    if (host === 'tiles.openfreemap.org' || host === 'assets.openfreemap.com') return 'openfreemap';
    if (host === 'tile.openstreetmap.org') return 'osm';
    if (host.endsWith('.tile.openstreetmap.fr')) return 'hot';
  } catch { /* Errors without a URL are identified by their source ID below. */ }
  return null;
}

// Fail over across independent public services, not just reload a blocked host.
// Switching style preserves the camera/DOM markers; callers rebuild data overlays
// on style.load. Each service is attempted at most once per manual retry cycle.
export function monitorBasemap(map, key, { onReady, onChanging, onWarning, onProviderChange, timeoutMs = 12000 }) {
  const providers = basemapProviders(key);
  let index = 0;
  let disposed = false;
  let timer;
  let visited = new Set([providers[0].id]);
  const failures = new Map();
  const active = () => providers[index];
  const stopTimer = () => { clearTimeout(timer); timer = undefined; };
  const notify = () => onProviderChange?.({ id: active().id, name: active().name });
  const startTimer = () => {
    stopTimer();
    const id = active().id;
    timer = setTimeout(() => {
      if (!disposed && active().id === id) failed({ sourceId: active().source, error: { timeout: true } });
    }, timeoutMs);
    timer?.unref?.();
  };
  const change = target => {
    if (disposed) return;
    stopTimer();
    index = target;
    visited.add(active().id);
    notify();
    onChanging();
    if (map.isStyleLoaded()) map.setTerrain(null);
    map.setStyle(basemapStyle(key, active().id), { diff: false });
    startTimer();
  };
  const failed = event => {
    if (disposed || ['mapai-places', 'route'].includes(event.sourceId)) return;
    if (event.sourceId === 'maptiler-terrain') {
      if (active().id !== 'maptiler') return;
      // Terrain can fail while other tiles are loading; style metadata is
      // already loaded if terrain exists, even when isStyleLoaded() is false.
      if (map.getTerrain?.()) map.setTerrain(null);
      onWarning('Không tải được địa hình 3D. Bạn vẫn có thể xem bản đồ đường phố.');
      return;
    }
    // Ignore late tile errors from a source removed by a previous switch.
    if (active().vector && [OSM_SOURCE, HOT_SOURCE].includes(event.sourceId)) return;
    const owner = errorProvider(event);
    if (owner && owner !== active().id) return;
    if (!active().vector && event.sourceId && event.sourceId !== active().source) return;
    stopTimer();
    const previous = active();
    failures.set(previous.id, `${previous.name}: ${failureReason(event.error)}`);
    let next = -1;
    for (let offset = 1; offset < providers.length; offset++) {
      const candidate = (index + offset) % providers.length;
      if (!visited.has(providers[candidate].id)) { next = candidate; break; }
    }
    if (next >= 0) {
      onWarning(`Không tải được ${previous.name} (${failureReason(event.error)}). Đang chuyển sang ${providers[next].name}…`);
      change(next);
    } else {
      onWarning(`Chưa tải được bản đồ từ các nguồn đã thử (${[...failures.values()].join('; ')}). Kết nối tới máy chủ bản đồ bị từ chối hoặc không phản hồi. Bạn có thể chọn nguồn khác rồi thử lại.`);
    }
  };
  const ready = () => { if (!disposed) onReady({ vector: active().vector, provider: active().id }); };
  const data = event => {
    if (disposed || event.tile?.state !== 'loaded' || ['mapai-places', 'route', 'maptiler-terrain'].includes(event.sourceId)) return;
    if (active().vector && [OSM_SOURCE, HOT_SOURCE].includes(event.sourceId)) return;
    const owner = errorProvider(event);
    if (owner && owner !== active().id) return;
    if (!active().vector && event.sourceId !== active().source) return;
    stopTimer();
    failures.delete(active().id);
    onWarning(null);
  };
  const select = id => {
    const target = providers.findIndex(provider => provider.id === id);
    if (disposed || target < 0) return;
    visited = new Set();
    failures.clear();
    onWarning(null);
    change(target);
  };
  map.on('style.load', ready);
  map.on('error', failed);
  map.on('sourcedata', data);
  notify();
  startTimer();
  return {
    reload: () => select(active().id),
    select,
    dispose: () => {
      disposed = true;
      stopTimer();
      map.off('style.load', ready);
      map.off('error', failed);
      map.off('sourcedata', data);
    },
  };
}
