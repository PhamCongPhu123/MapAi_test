import Fuse from 'fuse.js';
import { CENTER } from './constants.js';

export const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export function distanceMeters(a, b) {
  const rad = Math.PI / 180;
  const x = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
export const formatDistance = meters => meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
export const inBounds = (point, bounds) => point && Number.isFinite(point.lng) && Number.isFinite(point.lat) &&
  point.lng >= bounds[0] && point.lng <= bounds[2] && point.lat >= bounds[1] && point.lat <= bounds[3];

export function createSearchEngine(places) {
  const indexed = places.map(p => ({ ...p, searchName: normalize(p.name),
    searchTags: normalize(p.tags.join(' ')), searchArea: normalize(`${p.district} ${p.address}`) }));
  const fuse = new Fuse(indexed, { includeScore: true, threshold: 0.32, ignoreLocation: true, minMatchCharLength: 2,
    keys: [{ name: 'searchName', weight: 0.5 }, { name: 'searchTags', weight: 0.35 }, { name: 'searchArea', weight: 0.15 }] });
  return ({ query = '', category = 'all', district = 'Tất cả', center = CENTER, ids } = {}) => {
    const q = normalize(query);
    const found = q ? fuse.search(q).map(r => ({ ...r.item, score: r.score })) : indexed.map(p => ({ ...p, score: 0 }));
    return found.filter(p => (category === 'all' || p.category === category) &&
      (district === 'Tất cả' || p.district === district) && (!ids || ids.has(p.id)))
      .map(p => ({ ...p, distance: distanceMeters(center, p) }))
      .sort((a, b) => a.score - b.score || a.distance - b.distance);
  };
}
