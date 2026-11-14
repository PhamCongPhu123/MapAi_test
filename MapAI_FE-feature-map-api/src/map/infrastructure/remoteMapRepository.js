import { request } from '../../services/api';
import { communityApi, toMapPlace } from '../../services/communityService';
import { searchLocation } from '../../services/locationService';
import { searchCityWidePlaces, searchNearbyPlaces, fetchRoute } from '../../services/mapServices';
import { askMapAI } from '../../services/aiService';

export const remoteMapRepository = {
  async search(query, signal) {
    const [stored, external] = await Promise.allSettled([
      communityApi.search(query, signal),
      request(`/map/search?q=${encodeURIComponent(query)}`, { signal }).then(async response => {
        if (!response.ok) throw new Error('Nguồn tìm kiếm đang không khả dụng.');
        return response.json();
      }),
    ]);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (stored.status === 'rejected' && external.status === 'rejected') throw stored.reason;
    return [
      ...(stored.status === 'fulfilled' ? stored.value.map(toMapPlace) : []),
      ...(external.status === 'fulfilled' ? external.value.map(p => ({
        name: p.display_name, lng: Number(p.lon), lat: Number(p.lat), type: p.type,
        address: p.address?.suburb || p.address?.city || 'Đà Nẵng', source: 'osm',
      })) : []),
    ];
  },
  async category(query) {
    return (await searchCityWidePlaces(query)).map(p => ({ ...p, lng: Number(p.lng ?? p.longitude), lat: Number(p.lat ?? p.latitude) }));
  },
  list: signal => communityApi.list(signal).then(items => items.map(toMapPlace)),
  details: (place, signal) => (place.locationId || (place.source !== 'osm' && place.id))
    ? communityApi.get(place.locationId || place.id, signal).then(toMapPlace) : searchLocation(place.name, [place.lng, place.lat]),
  route: fetchRoute,
  nearby: searchNearbyPlaces,
  ask: askMapAI,
};
