import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

const listeners = new Set();
let snapshot = { ready: false, update: false, error: '', supported: 'serviceWorker' in navigator && window.isSecureContext };
const set = patch => { snapshot = { ...snapshot, ...patch }; listeners.forEach(l => l()); };
export const applyAppUpdate = registerSW({
  immediate: true,
  onOfflineReady: () => set({ ready: true }),
  onNeedRefresh: () => set({ update: true }),
  onRegisterError: error => set({ error: error.message }),
});
if (snapshot.supported) {
  const check = () => { if (navigator.serviceWorker.controller) set({ ready: true }); };
  navigator.serviceWorker.addEventListener('controllerchange', check);
  navigator.serviceWorker.getRegistration().then(registration => {
    if (registration?.active) check();
  }).catch(error => set({ error: error.message }));
}
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const usePwaStatus = () => useSyncExternalStore(subscribe, () => snapshot);
