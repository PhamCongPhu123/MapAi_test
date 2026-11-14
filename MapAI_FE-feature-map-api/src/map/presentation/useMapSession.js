import { useLayoutEffect, useState } from 'react';
import { useOfflineData } from '../../offline/presentation/useOfflineData';
import { useNetworkStatus } from '../../offline/network';
import { offlineService } from '../../offline/compositionRoot';
import { createMapService } from '../application/createMapService';
import { remoteMapRepository } from '../infrastructure/remoteMapRepository';
import { usePwaStatus } from '../../offline/pwa';
import { isNative } from '../../config/platform';

// Composition hook: a stable service and one mounted workspace across connectivity changes.
export function useMapSession() {
  const resource = useOfflineData();
  const network = useNetworkStatus();
  const pwa = usePwaStatus();
  const hasApi = !(isNative || import.meta.env.VITE_BUILD_TARGET === 'mobile') || Boolean(import.meta.env.VITE_API_BASE_URL?.trim());
  const mode = network.offline || !hasApi ? 'offline' : 'online';
  const [runtime] = useState(() => {
    let snapshot = { mode, data: resource.data };
    const service = createMapService({ remote: remoteMapRepository, local: offlineService,
      getMode: () => snapshot.mode, getLocalData: () => snapshot.data });
    return { service, update: next => { snapshot = next; } };
  });
  useLayoutEffect(() => { runtime.update({ mode, data: resource.data }); }, [runtime, mode, resource.data]);
  const service = runtime.service;
  return { service, mode, resource, network, hasApi, ready: Boolean(resource.data && pwa.ready) };
}
