export const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const basemapProviders = () => [{ id: 'openfreemap', name: 'OpenFreeMap', vector: true }];
export const basemapStyle = () => OPENFREEMAP_STYLE;

// Watch the single provider. A retry never changes to another map design/source.
export function monitorBasemap(map, _key, { onReady, onChanging, onWarning, onProviderChange, onReload, timeoutMs = 15000 }) {
  let disposed = false, timer;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (!disposed) onWarning('Chưa tải được bản đồ OpenFreeMap. Kiểm tra kết nối hoặc gói Đà Nẵng đã lưu rồi thử lại.'); }, timeoutMs);
    timer?.unref?.();
  };
  const ready = () => { if (!disposed) onReady({ vector: true, provider: 'openfreemap' }); };
  const data = event => {
    if (disposed || event.tile?.state !== 'loaded' || !['openmaptiles', 'ne2_shaded'].includes(event.sourceId)) return;
    clearTimeout(timer); onWarning(null);
  };
  const failed = event => {
    if (disposed || ['mapai-places', 'route', 'route-access'].includes(event.sourceId)) return;
    const status = Number(event.error?.status);
    onWarning(`Không tải được tài nguyên OpenFreeMap${status ? ` (HTTP ${status})` : ''}. Bạn có thể thử tải lại.`);
  };
  const reload = () => { if (disposed) return; onWarning(null); onChanging(); onReload?.(); arm(); };
  map.on('style.load', ready); map.on('sourcedata', data); map.on('error', failed);
  onProviderChange?.({ id: 'openfreemap', name: 'OpenFreeMap' }); arm();
  return { reload, select: reload, restart: arm, dispose() {
    disposed = true; clearTimeout(timer);
    map.off('style.load', ready); map.off('sourcedata', data); map.off('error', failed);
  } };
}
