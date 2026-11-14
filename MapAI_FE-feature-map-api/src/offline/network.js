// Public presentation facade for the platform connectivity adapter.
import { useSyncExternalStore } from 'react';
import { subscribeNetwork, getNetworkSnapshot } from './infrastructure/networkRuntime';
export { isOffline, setOfflineSimulation } from './infrastructure/networkRuntime';
export const useNetworkStatus = () => useSyncExternalStore(subscribeNetwork, getNetworkSnapshot);
