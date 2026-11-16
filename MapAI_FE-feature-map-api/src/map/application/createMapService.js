import { mergePlaces, unifiedPlace, placeSearchIntent, utilityCategory, UTILITY_CATEGORIES, validPlace } from '../../places/application/unifiedPlace.js';
import { createSearchEngine, normalize, distanceMeters } from '../../offline/application/searchEngine.js';
import { askLocalAssistant } from '../../offline/application/localAiAgent.js';
import { categoryLabel } from '../../offline/application/constants.js';

export const localPlace = place => unifiedPlace(place.canonicalId || place.osmType || place.serverId
  ? { ...place, id: place.serverId || place.id }
  : { ...place, localId: place.localId || place.id, id: `offline:${place.id}`, source: 'offline', type: categoryLabel(place.category), photos: [], thumbnail: null,
      categories: [{ name: place.tags?.includes('ca phe') ? 'cafe' : place.category === 'food' ? 'restaurant' : place.category === 'sightseeing' ? 'attraction' : 'entertainment' }] });

// Both transports return the same place and route contracts to presentation.
export function localRoute(result) {
  return {
    source: 'offline', geometry: { type: 'LineString', coordinates: result.coordinates },
    distance: result.distance, duration: result.minutes * 60, access: result.access,
    legs: [{ steps: result.steps.map((step, index) => ({
      ...step, duration: step.distance / (result.mode === 'foot' ? 4500 : 25000) * 3600,
      maneuver: { type: index ? 'turn' : 'depart', instruction: step.instruction,
        modifier: /trái/i.test(step.instruction) ? 'left' : /phải/i.test(step.instruction) ? 'right' : 'straight',
        location: step.location || result.coordinates[0] },
    })) }],
    notice: 'Tuyến tham khảo từ gói Đà Nẵng; thời gian ước tính. Đoạn nét đứt chưa có dữ liệu lối đi. Chưa xét giao thông hoặc hạn chế rẽ.',
  };
}

export function createMapService({ remote, local, getMode, getLocalData, cache }) {
  async function places() {
    return mergePlaces([...(getLocalData()?.places || (await local.loadPackage())?.places || []).map(p => p.canonicalId || p.osmType || p.serverId ? p : localPlace(p)), ...await cache?.all() || []]);
  }
  async function localSearch(query, options = {}) {
    let data = (await places()).map(localPlace), text = query;
    const utility = utilityCategory(query);
    if (utility) {
      data = data.filter(p => p.categoryMapping === utility.id || (utility.id === 'atm' && p.categoryMapping === 'bank_atm'));
      text = normalize(query).replace(utility.alias, '').trim();
    }
    data = data.map(p => ({ ...p, tags: [...(p.tags || []), ...(UTILITY_CATEGORIES.find(c => c[0] === p.categoryMapping)?.[2] || [])] }));
    return createSearchEngine(data)({ query: text, ...options }).map(localPlace);
  }
  async function remember(items) {
    const places = mergePlaces(items);
    await cache?.remember(places).catch(() => {});
    if (items.meta) Object.defineProperty(places, 'meta', { value: items.meta });
    return places;
  }
  return {
    mode: getMode,
    async search(query, { signal } = {}) {
      return getMode() === 'offline' ? localSearch(query) : remember(await remote.search(query, signal));
    },
    async category(query) {
      if (getMode() === 'online') return remember(await remote.category(query));
      const key = normalize(query);
      const terms = /coffee|cafe|ca phe/.test(key) ? 'ca phe' : /restaurant|food/.test(key) ? '' : /attraction|tourism/.test(key) ? '' : query;
      const category = /restaurant|food/.test(key) ? 'food' : /attraction|tourism/.test(key) ? 'sightseeing' : undefined;
      return localSearch(terms, { category });
    },
    async nearby(query, lat, lng, radius) {
      if (getMode() === 'online') return remember(await remote.nearby(lat, lng, query, radius));
      const result = await localSearch(query, { center: { lat, lng } });
      return result.filter(p => distanceMeters({ lat, lng }, p) <= radius);
    },
    async list(signal) {
      return getMode() === 'offline' ? (await places()).map(localPlace) : remote.list(signal);
    },
    async details(place, signal) {
      const hasSnapshot = Boolean(place.key || place.canonicalId || place.osmType);
      if (!place.name && place.id) {
        const cached = (await places()).find(p => [p.canonicalId, p.id, p.mapaiId].includes(place.id));
        if (cached) place = cached;
      }
      place = unifiedPlace(place);
      if (place.sourceType === 'openstreetmap') {
        if (!validPlace(place)) throw new Error('Thông tin OSM chưa có trên thiết bị. Hãy tìm lại địa điểm để lấy dữ liệu.');
        await cache?.remember([place]).catch(() => {});
        if (getMode() === 'online' && place.mapaiId) return unifiedPlace({ ...place, ...await remote.details(place, signal), canonicalId: place.canonicalId, sourceType: 'openstreetmap', osmType: place.osmType, osmId: place.osmId });
        return { ...place, cachedOnly: getMode() === 'offline' };
      }
      if (place.localId || String(place.id || '').startsWith('offline:')) {
        const id = place.localId || place.id.slice(8);
        const found = (await places()).find(p => p.id === id || p.localId === id || p.id === `offline:${id}`);
        if (found) return localPlace(found);
      }
      if ((getMode() === 'offline' || place.localId) && hasSnapshot && place.key && place.name) return { ...place, cachedOnly: true, photos: [] };
      if (getMode() === 'online') return remote.details(place, signal);
      const stored = place.id && (await places()).find(p => p.id === place.id || p.serverId === place.id);
      if (stored) return localPlace(stored);
      const candidates = await localSearch(place.name || '');
      const found = candidates.find(p => normalize(p.name) === normalize(place.name || '') ||
        (Number.isFinite(place.lat) && Number.isFinite(place.lng) && distanceMeters(place, p) < 80));
      if (found) return found;
      throw new Error('Chi tiết địa điểm này chưa có trong gói Đà Nẵng. Hãy chọn địa điểm đã tải.');
    },
    async route(origin, destination, mode) {
      if (getMode() === 'online') return remote.route(origin, destination, mode);
      if (!['foot', 'motorbike'].includes(mode)) throw new Error('Gói cục bộ hỗ trợ đi bộ và xe máy (ước tính). Hãy chọn lại phương tiện.');
      return localRoute(await local.calculateRoute(origin, destination, mode));
    },
    async ask(text, history, selected, context) {
      if (getMode() === 'online') { const response = await remote.ask(text, history, selected);
        if (response.places) response.places = await remember(response.places);
        return response;
      }
      const key = normalize(text);
      const commands = [
        [/phong to|zoom in/, 'ZOOM_IN'], [/thu nho|zoom out/, 'ZOOM_OUT'],
        [/huong bac/, 'RESET_NORTH'], [/xoa.*tuyen/, 'CLEAR_ROUTE'], [/xoa.*ket qua/, 'CLEAR_RESULTS'],
        [/vi tri cua toi|dinh vi/, 'LOCATE_USER'],
      ];
      const command = commands.find(([pattern]) => pattern.test(key));
      if (command) return { message: 'Đã nhận lệnh bản đồ.', action: { type: command[1] } };
      if (/^(chi duong|dan duong)( den| toi)?( do| day)?$/.test(key) && selected) return {
        message: `Chọn điểm xuất phát để tính đường tới ${selected.name}.`, action: { type: 'LOCAL_DIRECTIONS', value: selected },
      };
      const intent = placeSearchIntent(text);
      const namedDirection = key.match(/^(?:chi duong|dan duong|duong) (?:den|toi) (.+)$/);
      if (namedDirection || (intent && !['cafe', 'restaurant'].includes(intent.category))) {
        let origin;
        if (intent?.near) {
          try {
            origin = await local.getLocation();
            if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) throw new Error('Vị trí không hợp lệ.');
          } catch { return { message: 'Chưa lấy được vị trí hiện tại. Hãy bật quyền định vị rồi thử tìm tiện ích gần bạn lại.' }; }
        }
        const results = await localSearch(intent?.query || namedDirection[1], origin ? { center: origin } : {});
        const found = (origin ? results.filter(p => p.distance <= 5000).map(p => ({ ...p, distanceMeters: p.distance })) : results).slice(0, intent?.near && key.includes('gan nhat') ? 1 : 12);
        return { message: found.length ? 'Đã tìm thấy địa điểm từ dữ liệu lưu trên thiết bị (MapAI và OpenStreetMap).' : 'Chưa tìm thấy trong gói dữ liệu Offline Đà Nẵng. Kết nối mạng để mở rộng tìm kiếm trên OpenStreetMap.', places: found,
          action: (namedDirection || intent?.direction) && found[0] ? { type: 'LOCAL_DIRECTIONS', value: found[0], ...(origin ? { origin: { ...origin, name: 'Vị trí của tôi' }, mode: /xe may/.test(key) ? 'motorbike' : 'foot' } : {}) } : null };
      }
      const answer = askLocalAssistant(text, await places(), { ...context, origin: selected });
      return { message: answer.message, places: answer.places?.map(localPlace), suggestions: answer.choices, context: answer.context };
    },
  };
}
