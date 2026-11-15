import { useSyncExternalStore } from 'react';
import { syncService } from '../compositionRoot';
export const useSyncStatus = () => useSyncExternalStore(syncService.subscribe, syncService.getSnapshot);
