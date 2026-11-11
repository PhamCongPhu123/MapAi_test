import { request } from './api';

async function call(path, options = {}) {
  const response = await request(`/location${path}`, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.detail || Object.values(error.errors || {}).flat().join(' ') || 'Không thể xử lý yêu cầu. Vui lòng thử lại.');
  }
  return response.status === 204 ? null : response.json();
}

export const communityApi = {
  list: (signal) => call('', { signal }),
  search: (title, signal) => call(`?title=${encodeURIComponent(title)}`, { signal }),
  get: (id, signal) => call(`/${encodeURIComponent(id)}`, { signal }),
  submit: (data) => call('/contributions', { method: 'POST', body: JSON.stringify(data) }),
  uploadImage: async (file) => {
    const body = new FormData();
    body.append('file', file);
    const result = await call('/upload-thumbnail', { method: 'POST', headers: { 'Content-Type': undefined }, body });
    if (!result.url) throw new Error('Máy chủ chưa trả về đường dẫn ảnh. Vui lòng thử lại.');
    return result.url;
  },
  mine: (page = 1, signal) => call(`/contributions/mine?page=${page}`, { signal }),
  pending: (page = 1, signal) => call(`/contributions/pending?page=${page}`, { signal }),
  moderate: (id, status, note) => call(`/contributions/${encodeURIComponent(id)}/moderation`, { method: 'PUT', body: JSON.stringify({ status, note }) }),
  reviews: (id, page = 1, signal) => call(`/${encodeURIComponent(id)}/reviews?page=${page}`, { signal }),
  saveReview: (id, data) => call(`/${encodeURIComponent(id)}/reviews/me`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteReview: (id) => call(`/${encodeURIComponent(id)}/reviews/me`, { method: 'DELETE' }),
};

export const toMapPlace = (location) => ({
  ...location, name: location.title, lat: location.latitude, lng: location.longitude,
  type: location.category, photos: location.images, phone: location.phoneNumber,
});
