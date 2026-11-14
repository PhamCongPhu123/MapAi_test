import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
const listeners = new Set();
let simulated = false, connected = navigator.onLine;
try { simulated = localStorage.getItem('mapai-offline-simulator') === 'true'; } catch { /* In-memory fallback. */ }
let snapshot;
const update = () => {
  snapshot = { online: connected, simulated, offline: simulated || !connected };
  listeners.forEach(l => l());
};
window.addEventListener('online', () => { connected = true; update(); });
window.addEventListener('offline', () => { connected = false; update(); });
if (Capacitor.isNativePlatform()) {
  Network.getStatus().then(status => { connected = status.connected; update(); }).catch(() => {});
  Network.addListener('networkStatusChange', status => { connected = status.connected; update(); }).catch(() => {});
}
update();
export const subscribeNetwork = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const getNetworkSnapshot = () => snapshot;
export const isOffline = () => snapshot.offline;
export function setOfflineSimulation(value) {
  simulated = Boolean(value);
  try { localStorage.setItem('mapai-offline-simulator', String(simulated)); } catch { /* In-memory fallback. */ }
  update();
}
