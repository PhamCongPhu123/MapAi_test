import { request } from './api';

import { unifiedPlace } from '../places/application/unifiedPlace.js';
import { placeCacheRepository } from '../places/infrastructure/placeCacheRepository';
async function read(path, options) {
  const response = await request(`/map/${path}`, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || Object.values(error.errors || {}).flat().join(' ') || 'Không thể tải dữ liệu bản đồ. Vui lòng thử lại.');
  }
  const result = await response.json();
  const search = result.search || result;
  if (search.places) { search.places = search.places.map(unifiedPlace); await placeCacheRepository.remember(search.places).catch(() => {}); }
  if (result.destination) result.destination = unifiedPlace(result.destination);
  return result;
}

export const mapTools = {
  find: ({ lat, lng, category, radius }, nearest) => read(`${nearest ? 'nearest' : 'places'}?${new URLSearchParams({ lat, lng, category, radius })}`),
  routeNearest: (data) => read('nearest/direction', { method: 'POST', body: JSON.stringify(data) }),
};
