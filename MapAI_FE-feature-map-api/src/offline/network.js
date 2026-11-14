import { useSyncExternalStore } from 'react';
import { SIMULATOR_KEY } from './constants';

const listeners = new Set();
let simulated = false;
try { simulated = localStorage.getItem(SIMULATOR_KEY) === 'true'; } catch { /* Private browsing. */ }
let snapshot;
function update() {
  snapshot = { online: navigator.onLine, simulated, offline: simulated || !navigator.onLine };
  listeners.forEach(listener => listener());
}
update();
window.addEventListener('online', update);
window.addEventListener('offline', update);

export function setOfflineSimulation(value) {
  simulated = Boolean(value);
  try { localStorage.setItem(SIMULATOR_KEY, String(simulated)); } catch { /* In-memory simulation still works. */ }
  update();
}
export const isOffline = () => snapshot.offline;
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const useNetworkStatus = () => useSyncExternalStore(subscribe, () => snapshot);
