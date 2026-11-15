const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim() || 'https://localhost:7028/api/v1').replace(/\/+$/, '');
const getTokens = () => ({ accessToken: localStorage.getItem('accessToken'), refreshToken: localStorage.getItem('refreshToken'), userId: localStorage.getItem('userId') });
export const saveTokens = (accessToken, refreshToken, userId) => {
  if (accessToken) localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  if (userId) localStorage.setItem('userId', userId);
};
export const clearTokens = () => {
  ['accessToken', 'refreshToken', 'userId', 'mapai_user', 'mapai-verified-session'].forEach(key => localStorage.removeItem(key));
  window.dispatchEvent(new Event('mapai:session-cleared'));
};
export const decodeToken = token => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(Array.from(atob(base64), c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')));
  } catch { return null; }
};
let refreshFlight;
async function refreshSession(tokens) {
  if (refreshFlight?.token === tokens.accessToken) return refreshFlight.promise;
  const flight = { token: tokens.accessToken };
  flight.promise = (async () => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken, userId: tokens.userId }) });
    // A response from a previous account must never overwrite a newer login.
    if (localStorage.getItem('accessToken') !== tokens.accessToken) return false;
    if (response.ok) {
      const next = await response.json();
      if (localStorage.getItem('accessToken') !== tokens.accessToken) return false;
      saveTokens(next.accessToken, next.refreshToken, tokens.userId);
      try {
        const cached = JSON.parse(localStorage.getItem('mapai-verified-session') || 'null'), decoded = decodeToken(next.accessToken);
        if (cached?.profile.id === tokens.userId && Number.isFinite(decoded?.exp)) {
          cached.verifiedAt = Date.now(); cached.expiresAt = Math.min(Date.now() + 7 * 86400000, decoded.exp * 1000);
          localStorage.setItem('mapai-verified-session', JSON.stringify(cached));
        }
      } catch { /* Profile cache can be restored by the next successful /auth/me. */ }
      return true;
    }
    if ([400, 401, 403].includes(response.status)) { clearTokens(); return false; }
    const error = new Error('Chưa làm mới được phiên đăng nhập. Thông tin trên thiết bị vẫn được giữ.');
    error.status = response.status; throw error;
  })().finally(() => { if (refreshFlight === flight) refreshFlight = null; });
  refreshFlight = flight; return flight.promise;
}
export const request = async (endpoint, options = {}) => {
  const { noAuthRedirect: _noAuthRedirect, expectedUserId, ...fetchOptions } = options;
  const tokens = getTokens();
  const tokenUser = decodeToken(tokens.accessToken || '');
  if (expectedUserId && (tokenUser?.id || tokenUser?.sub) !== expectedUserId) throw new Error('Tài khoản đã thay đổi. Chưa gửi dữ liệu của tài khoản trước.');
  const headers = { 'Content-Type': 'application/json', ...fetchOptions.headers };
  if (headers['Content-Type'] === undefined) delete headers['Content-Type'];
  if (tokens.accessToken) headers.Authorization = `Bearer ${tokens.accessToken}`;
  let response = await fetch(`${API_BASE_URL}${endpoint}`, { ...fetchOptions, headers });
  if (response.status === 401 && tokens.refreshToken && tokens.userId && !fetchOptions.signal?.aborted) {
    if (await refreshSession(tokens)) {
      headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
      response = await fetch(`${API_BASE_URL}${endpoint}`, { ...fetchOptions, headers });
    }
    // AuthProvider receives session-cleared; public/offline screens retain their drafts.
    // Transient refresh failures propagate without clearing tokens or forcing a page reload.
  }
  return response;
};
export default API_BASE_URL;
