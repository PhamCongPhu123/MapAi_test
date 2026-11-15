import { decodeToken } from '../../services/api';
const key = 'mapai-verified-session';
const maxAge = 7 * 24 * 60 * 60 * 1000;
export const sessionStore = {
  read() {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      const token = decodeToken(localStorage.getItem('accessToken') || '');
      const id = token?.id || token?.sub;
      if (!cached?.profile?.id || cached.profile.id !== id || cached.expiresAt <= Date.now()) return null;
      return cached;
    } catch { return null; }
  },
  save(user) {
    const token = decodeToken(localStorage.getItem('accessToken') || '');
    const id = token?.id || token?.sub;
    if (!id || user.id !== id) return null;
    const profile = { id: user.id, fullName: user.fullName || user.name || '', avatarUrl: user.avatarUrl || user.avatar || null, role: user.role, email: user.email || '' };
    const now = Date.now();
    const cached = { profile, verifiedAt: now, expiresAt: Math.min(now + maxAge, Number.isFinite(token.exp) ? token.exp * 1000 : now + maxAge) };
    localStorage.setItem(key, JSON.stringify(cached)); return cached;
  },
  clear() { localStorage.removeItem(key); },
  owner() { return sessionStore.read()?.profile.id || 'guest'; },
};
