const categories = new Set(['fuel', 'atm', 'pharmacy', 'hospital', 'cafe', 'restaurant', 'parking', 'charging_station']);
const actions = new Set(['NEAREST_SEARCH', 'ROUTE_TO_NEAREST', 'SEARCH_POIS', 'ZOOM_IN', 'ZOOM_OUT', 'LOCATE_USER', 'RESET_NORTH', 'CLEAR_RESULTS', 'CLEAR_ROUTE']);

export const isMapToolAction = (action) => actions.has(action?.type);
export const validMapPoint = (point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;

export async function executeMapAction(action, { map, api, getPosition }) {
  if (!isMapToolAction(action)) throw new Error('Thao tác bản đồ không được hỗ trợ.');
  if (!map) throw new Error('Bản đồ chưa sẵn sàng. Vui lòng thử lại.');
  if (action.type === 'ZOOM_IN' || action.type === 'ZOOM_OUT') {
    map.zoomBy(action.type === 'ZOOM_IN' ? 1 : -1);
    return { message: action.type === 'ZOOM_IN' ? 'Đã phóng to bản đồ.' : 'Đã thu nhỏ bản đồ.' };
  }
  if (action.type === 'RESET_NORTH') { map.resetNorth(); return { message: 'Đã quay bản đồ về hướng Bắc.' }; }
  if (action.type === 'CLEAR_RESULTS') { map.clearSearchResults(); return { message: 'Đã xóa kết quả tìm kiếm.', places: [], selectedPlace: null }; }
  if (action.type === 'CLEAR_ROUTE') { map.clearDirections(); return { message: 'Đã xóa tuyến đường.' }; }
  const locate = async () => {
    const position = await getPosition();
    if (!validMapPoint(position)) throw new Error('Cần vị trí hiện tại để tìm gần bạn. Hãy cho phép định vị rồi thử lại.');
    return position;
  };
  if (action.type === 'LOCATE_USER') { await locate(); return { message: 'Đã đưa bản đồ về vị trí hiện tại của bạn.' }; }
  const value = action.value;
  if (!value || !categories.has(value.category) || !Number.isInteger(value.radius) || value.radius < 100 || value.radius > 20000)
    throw new Error('Loại địa điểm hoặc bán kính AI yêu cầu không hợp lệ. Hãy chọn bán kính từ 100 m đến 20 km.');
  const mode = value.mode || 'driving';
  if (!['driving', 'bicycle', 'foot'].includes(mode)) throw new Error('Phương tiện không được hỗ trợ.');
  if (value.center != null && !validMapPoint(value.center)) throw new Error('Vị trí trung tâm không hợp lệ.');
  if (action.type === 'ROUTE_TO_NEAREST' && value.center != null) throw new Error('Hãy tìm quanh địa điểm đó trước, chọn kết quả rồi yêu cầu chỉ đường.');
  const origin = action.type === 'ROUTE_TO_NEAREST' || value.center == null ? await locate() : value.center;
  const center = value.center || origin;
  const query = { lat: center.lat, lng: center.lng, category: value.category, radius: value.radius };
  const nearest = action.type !== 'SEARCH_POIS';
  const routed = action.type === 'ROUTE_TO_NEAREST' ? await api.routeNearest({ ...query, mode }) : null;
  const search = routed ? routed.search : await api.find(query, nearest);
  if (!Array.isArray(search?.places) || search.places.some(place => !validMapPoint(place))) throw new Error('Dữ liệu vị trí trả về không hợp lệ.');
  const places = search.places;
  map.clearSearchResults();
  map.setNearbyMarkers(places.map(place => ({ ...place, displayName: place.address || '', categories: [{ name: value.category }] })));
  const warning = search.warnings?.length ? ` ${search.warnings.join(' ')}` : '';
  if (!places.length) return { message: `Chưa tìm thấy ${search.categoryName || 'địa điểm phù hợp'} trong bán kính ${value.radius / 1000} km.${warning}`, places: [], selectedPlace: null };
  const selected = nearest ? places[0] : null;
  if (selected) map.flyTo({ center: [selected.lng, selected.lat], zoom: 17, essential: true, showMarker: false });
  if (routed?.route && routed.destination) map.setDirections(origin, routed.destination, mode, routed.route);
  const distance = selected ? selected.distanceMeters < 1000 ? `${Math.round(selected.distanceMeters)} m` : `${(selected.distanceMeters / 1000).toFixed(1)} km` : '';
  return {
    message: `${selected ? `Trong dữ liệu tìm được, ${selected.name} gần nhất, cách ${distance} theo đường thẳng${value.center?.name ? ` từ ${value.center.name}` : ' từ vị trí của bạn'}.` : `Tìm thấy ${places.length} địa điểm trong bán kính ${value.radius / 1000} km.`}${routed?.route ? ' Đã vẽ tuyến đường; bạn có thể xem lộ trình rồi nhấn Bắt đầu.' : ''}${warning}`,
    places, selectedPlace: selected,
  };
}
