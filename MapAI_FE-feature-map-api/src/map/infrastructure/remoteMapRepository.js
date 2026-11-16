import { request } from '../../services/api';
import { communityApi, toMapPlace } from '../../services/communityService';
import { unifiedPlace } from '../../places/application/unifiedPlace.js';
import { searchLocation } from '../../services/locationService';
import { searchCityWidePlaces, searchNearbyPlaces, fetchRoute } from '../../services/mapServices';
import { askMapAI } from '../../services/aiService';

export const remoteMapRepository = {
  async search(query, signal) {
    const response = await request(`/map/unified-search?q=${encodeURIComponent(query)}`, { signal });
    if (!response.ok) throw new Error('Nguồn tìm kiếm đang không khả dụng.');
    const result = await response.json();
    const places = (result.places || []).map(unifiedPlace);
    Object.defineProperty(places, 'meta', { value: { warnings: result.warnings || [], sourceStatus: result.sourceStatus }, enumerable: false });
    return places;
  },
  async category(query) {
    return (await searchCityWidePlaces(query)).map(p => ({ ...p, lng: Number(p.lng ?? p.longitude), lat: Number(p.lat ?? p.latitude) }));
  },
  list: signal => communityApi.list(signal).then(items => items.map(toMapPlace)),
  details: (place, signal) => place.sourceType === 'openstreetmap' && !place.mapaiId ? Promise.resolve(place) : (place.mapaiId || place.locationId || (place.source !== 'osm' && place.id))
    ? communityApi.get(place.mapaiId || place.locationId || place.id, signal).then(toMapPlace) : searchLocation(place.name, [place.lng, place.lat]),
  route: fetchRoute,
  nearby: searchNearbyPlaces,
  ask: askMapAI,
};
