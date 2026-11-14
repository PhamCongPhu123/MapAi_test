// Composition root: the single place that wires business ports to concrete platform adapters.
import { createOfflineService } from './application/createOfflineService';
import { indexedDbRepository } from './infrastructure/indexedDbRepository';
import { packageSource, checksum, browserStorage } from './infrastructure/packageSource';
import { createRoutingClient } from './infrastructure/routingClient';
import { getDeviceLocation } from '../services/deviceLocation';
import { isOffline } from './infrastructure/networkRuntime';

export const offlineService = createOfflineService({ repository: indexedDbRepository, source: packageSource,
  checksum, connectivity: { isOffline }, storage: browserStorage, router: createRoutingClient(), location: getDeviceLocation });
