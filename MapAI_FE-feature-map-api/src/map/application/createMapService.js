import { createSearchEngine, normalize, distanceMeters } from '../../offline/application/searchEngine.js';
import { askLocalAssistant } from '../../offline/application/localAiAgent.js';
import { categoryLabel } from '../../offline/application/constants.js';

export const localPlace = place => ({
  ...place, id: `offline:${place.id}`, localId: place.id, source: 'offline',
  type: categoryLabel(place.category), photos: [], thumbnail: null,
  categories: [{ name: place.tags?.includes('ca phe') ? 'cafe' : place.category === 'food' ? 'restaurant' : place.category === 'sightseeing' ? 'attraction' : 'entertainment' }],
});

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

export function createMapService({ remote, local, getMode, getLocalData }) {
  async function places() {
    return (getLocalData()?.places || (await local.loadPackage())?.places || []);
  }
  async function localSearch(query, options = {}) {
    return createSearchEngine(await places())({ query, ...options }).map(localPlace);
  }
  return {
    mode: getMode,
    async search(query, { signal } = {}) {
      return getMode() === 'offline' ? localSearch(query) : remote.search(query, signal);
    },
    async category(query) {
      if (getMode() === 'online') return remote.category(query);
      const key = normalize(query);
      const terms = /coffee|cafe|ca phe/.test(key) ? 'ca phe' : /restaurant|food/.test(key) ? '' : /attraction|tourism/.test(key) ? '' : query;
      const category = /restaurant|food/.test(key) ? 'food' : /attraction|tourism/.test(key) ? 'sightseeing' : undefined;
      return localSearch(terms, { category });
    },
    async nearby(query, lat, lng, radius) {
      if (getMode() === 'online') return remote.nearby(lat, lng, query, radius);
      const result = await localSearch(query, { center: { lat, lng } });
      return result.filter(p => distanceMeters({ lat, lng }, p) <= radius);
    },
    async list(signal) {
      return getMode() === 'offline' ? (await places()).map(localPlace) : remote.list(signal);
    },
    async details(place, signal) {
      if (place.localId || String(place.id || '').startsWith('offline:')) {
        const id = place.localId || place.id.slice(8);
        const found = (await places()).find(p => p.id === id);
        if (found) return localPlace(found);
      }
      if (getMode() === 'online') return remote.details(place, signal);
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
      if (getMode() === 'online') return remote.ask(text, history, selected);
      const key = normalize(text);
      const commands = [
        [/phong to|zoom in/, 'ZOOM_IN'], [/thu nho|zoom out/, 'ZOOM_OUT'],
        [/huong bac/, 'RESET_NORTH'], [/xoa.*tuyen/, 'CLEAR_ROUTE'], [/xoa.*ket qua/, 'CLEAR_RESULTS'],
        [/vi tri cua toi|dinh vi/, 'LOCATE_USER'],
      ];
      const command = commands.find(([pattern]) => pattern.test(key));
      if (command) return { message: 'Đã nhận lệnh bản đồ.', action: { type: command[1] } };
      if (/chi duong|dan duong/.test(key) && selected) return {
        message: `Chọn điểm xuất phát để tính đường tới ${selected.name}.`, action: { type: 'LOCAL_DIRECTIONS', value: selected },
      };
      const answer = askLocalAssistant(text, await places(), { ...context, origin: selected });
      return { message: answer.message, places: answer.places?.map(localPlace), suggestions: answer.choices, context: answer.context };
    },
  };
}
