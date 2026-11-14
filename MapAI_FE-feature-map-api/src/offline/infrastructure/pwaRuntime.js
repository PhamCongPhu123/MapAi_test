import { registerSW } from 'virtual:pwa-register';
import { isNative } from '../../config/platform';
// Capacitor's installed shell never relies on a Service Worker.
const embedded = isNative || import.meta.env.VITE_BUILD_TARGET === 'mobile';
const listeners = new Set();
let snapshot = { embedded, ready: embedded, update: false, error: '', supported: embedded || ('serviceWorker' in navigator && window.isSecureContext) };
const set = patch => { snapshot = { ...snapshot, ...patch }; listeners.forEach(l => l()); };
export const applyAppUpdate = embedded ? async () => {} : registerSW({
  immediate: true, onOfflineReady: () => set({ ready: true }), onNeedRefresh: () => set({ update: true }),
  onRegisterError: error => set({ error: error.message }),
});
if (!embedded && snapshot.supported) {
  const check = () => { if (navigator.serviceWorker.controller) set({ ready: true }); };
  navigator.serviceWorker.addEventListener('controllerchange', check);
  navigator.serviceWorker.getRegistration().then(registration => { if (registration?.active) check(); }).catch(error => set({ error: error.message }));
}
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const subscribePwa = subscribe;
export const getPwaSnapshot = () => snapshot;
