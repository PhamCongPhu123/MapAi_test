export const PACKAGE_ID = 'danang';
export const DATA_ROOT = `${import.meta.env?.BASE_URL || '/'}offline/`;
export const CATEGORIES = [
  { id: 'all', label: 'Tất cả' }, { id: 'food', label: 'Ăn uống', color: '#EA580C' },
  { id: 'sightseeing', label: 'Tham quan', color: '#0284C7' },
  { id: 'entertainment', label: 'Vui chơi', color: '#7C3AED' },
];
export const DISTRICTS = ['Tất cả', 'Hải Châu', 'Sơn Trà', 'Ngũ Hành Sơn', 'Cẩm Lệ', 'Thanh Khê'];
export const LANDMARKS = [
  { id: 'dragon-bridge', name: 'Cầu Rồng', lng: 108.2266, lat: 16.0611 },
  { id: 'airport', name: 'Sân bay Đà Nẵng', lng: 108.2027, lat: 16.0551 },
  { id: 'station', name: 'Ga Đà Nẵng', lng: 108.2093, lat: 16.0717 },
  { id: 'my-khe', name: 'Biển Mỹ Khê', lng: 108.2469, lat: 16.0615 },
];
export const CENTER = { lng: 108.224, lat: 16.061 };
export const SIMULATOR_KEY = 'mapai-offline-simulator';
export const categoryLabel = id => CATEGORIES.find(c => c.id === id)?.label || 'Địa điểm';
