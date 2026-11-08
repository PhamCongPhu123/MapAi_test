import { request } from './api';

async function read(path, options) {
  const response = await request(`/map/${path}`, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || Object.values(error.errors || {}).flat().join(' ') || 'Không thể tải dữ liệu bản đồ. Vui lòng thử lại.');
  }
  return response.json();
}

export const mapTools = {
  find: ({ lat, lng, category, radius }, nearest) => read(`${nearest ? 'nearest' : 'places'}?${new URLSearchParams({ lat, lng, category, radius })}`),
  routeNearest: (data) => read('nearest/direction', { method: 'POST', body: JSON.stringify(data) }),
};
