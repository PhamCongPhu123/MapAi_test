// The stable key is shared across devices. Never identify a place by its display name alone.
export function placeKey(place) {
  if (typeof place === 'string') return place.startsWith('seed:') || place.startsWith('mapai:') || place.startsWith('osm:') ? place : `seed:${place.replace(/^offline:/, '')}`;
  if (place.key) return place.key;
  if (place.localId || String(place.id || '').startsWith('offline:')) return `seed:${place.localId || place.id.slice(8)}`;
  if (place.locationId || (place.id && place.source !== 'osm' && place.source !== 'openstreetmap')) return `mapai:${place.locationId || place.id}`;
  return `osm:${place.fsqId || place.id || `${Number(place.lng).toFixed(6)},${Number(place.lat).toFixed(6)}:${place.name?.slice(0, 80)}`}`;
}
export function savedSnapshot(place) {
  const lat = Number(place.lat ?? place.latitude), lng = Number(place.lng ?? place.longitude);
  const name = String(place.name || place.title || '').trim();
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('Địa điểm chưa có tọa độ hợp lệ để lưu.');
  return { key: placeKey(place), id: place.id || place.locationId || null, localId: place.localId || null,
    name: name.slice(0, 255), lat, lng, address: String(place.address || '').slice(0, 500),
    description: String(place.description || '').slice(0, 2000), category: String(place.category || place.type || '').slice(0, 100),
    district: String(place.district || '').slice(0, 100), source: place.source || (place.localId ? 'offline' : 'mapai') };
}
export function offlineAvailability(place, data) {
  if (!data) return false;
  if (place.localId && data.places.some(p => p.id === place.localId)) return true;
  return data.places.some(p => placeKey(p) === placeKey(place));
}
