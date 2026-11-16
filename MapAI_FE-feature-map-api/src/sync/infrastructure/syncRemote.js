import { request } from '../../services/api';
import { sessionStore } from './sessionStore';
async function call(path, options = {}, owner) {
  if (owner && sessionStore.owner() !== owner) throw new Error('Tài khoản đã thay đổi. Dữ liệu vẫn được giữ riêng.');
  const response = await request(`/sync/${path}`, { ...options, noAuthRedirect: true, expectedUserId: owner, signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.message || data.detail || (response.status === 401 ? 'Phiên online đã hết hạn. Đăng nhập lại để tiếp tục đồng bộ.' : 'Chưa kết nối được dịch vụ đồng bộ. Dữ liệu vẫn được giữ trên máy.'));
    error.status = response.status; throw error;
  }
  return response.status === 204 ? null : response.json();
}
export const syncRemote = {
  async push(job, owner) {
    const receipt = await call('operations', { method: 'POST', body: JSON.stringify({ id: job.id, kind: job.kind, locationId: job.locationId, payload: job.payload, ...(job.place ? { place: job.place } : {}) }) }, owner);
    if (receipt?.id !== job.id || receipt.kind !== job.kind) throw new Error('Máy chủ chưa xác nhận thao tác. Dữ liệu vẫn chờ đồng bộ.');
    return receipt;
  },
  pull: owner => call('favorites', {}, owner),
  catalog: version => call(`catalog${version ? `?version=${encodeURIComponent(version)}` : ''}`),
  async upload(photo, name, owner) {
    if (sessionStore.owner() !== owner) throw new Error('Tài khoản đã thay đổi.');
    const form = new FormData(); form.append('file', photo, name || 'place.jpg');
    const response = await request('/location/upload-thumbnail', { method: 'POST', body: form, headers: { 'Content-Type': undefined }, noAuthRedirect: true, expectedUserId: owner, signal: AbortSignal.timeout(60000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) { const error = new Error(data.message || 'Chưa tải được ảnh đóng góp. Bản nháp vẫn được giữ.'); error.status = response.status; throw error; }
    return data.url;
  },
};
