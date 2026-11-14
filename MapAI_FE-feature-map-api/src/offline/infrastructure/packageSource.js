import { isNative } from '../../config/platform';
const root = `${import.meta.env.BASE_URL}offline/`;
export const packageSource = {
  // Capacitor serves these files from the installed APK/IPA, including in airplane mode.
  embedded: isNative || import.meta.env.VITE_BUILD_TARGET === 'mobile',
  async read(path) {
    const response = await fetch(`${root}${path}`, { cache: 'no-cache', signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Không đọc được ${path} (${response.status}). Gói cũ vẫn được giữ lại.`);
    return response;
  },
  toBlob: (buffer, type) => new Blob([buffer], { type: type || '' }),
  async removeCachedAssets() {
    if (!('caches' in globalThis)) return;
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      for (const request of await cache.keys()) if (new URL(request.url).pathname.startsWith(root)) await cache.delete(request);
    }
  },
};
export const checksum = async buffer => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))).map(b => b.toString(16).padStart(2, '0')).join('');
export const browserStorage = {
  async status() { return { estimate: await navigator.storage?.estimate?.(), persistent: await navigator.storage?.persisted?.() || false }; },
  persist: () => navigator.storage?.persist?.(),
};
