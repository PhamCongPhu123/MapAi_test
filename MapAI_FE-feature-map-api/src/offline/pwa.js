// Public presentation facade for web/native shell readiness.
import { useSyncExternalStore } from 'react';
import { subscribePwa, getPwaSnapshot } from './infrastructure/pwaRuntime';
export { applyAppUpdate } from './infrastructure/pwaRuntime';
export const usePwaStatus = () => useSyncExternalStore(subscribePwa, getPwaSnapshot);
