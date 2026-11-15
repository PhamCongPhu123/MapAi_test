import { isNative } from '../config/platform';
import { checksum } from '../offline/infrastructure/packageSource';
import { getNetworkSnapshot, subscribeNetwork } from '../offline/infrastructure/networkRuntime';
import { createSyncService } from './application/createSyncService';
import { syncRepository } from './infrastructure/syncRepository';
import { syncRemote } from './infrastructure/syncRemote';
import { sessionStore } from './infrastructure/sessionStore';
const enabled = () => !(isNative || import.meta.env.VITE_BUILD_TARGET === 'mobile') || Boolean(import.meta.env.VITE_API_BASE_URL?.trim());
export const syncService = createSyncService({ repository: syncRepository, remote: syncRemote,
  clock: { now: () => Date.now(), id: () => crypto.randomUUID() }, identity: { owner: () => sessionStore.owner() },
  connectivity: { enabled, offline: () => getNetworkSnapshot().offline,
    wifi: () => getNetworkSnapshot().connectionType === 'wifi' || navigator.connection?.type === 'wifi' },
  checksum: text => checksum(new TextEncoder().encode(text)) });

let started = false;
export function startSyncRuntime() {
  if (started) return;
  started = true;
  syncRepository.watch(() => void syncService.refresh().catch(() => {}));
  subscribeNetwork(() => void syncService.sync());
  const resume = () => { if (document.visibilityState === 'visible') void syncService.sync(); };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('storage', event => { if (['mapai-verified-session', 'accessToken'].includes(event.key)) void syncService.activate(sessionStore.owner()).then(() => syncService.sync()); });
  setInterval(() => {
    void syncService.activate(sessionStore.owner()).then(() => syncService.tick()).catch(() => {});
  }, 1000);
  setInterval(() => { if (document.visibilityState === 'visible') void syncService.sync(); }, 30000);
  void syncService.refresh().then(() => syncService.sync()).catch(() => {});
}
export { sessionStore };
