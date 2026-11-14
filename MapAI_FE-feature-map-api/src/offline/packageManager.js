// Public use-case facade; UI never sees the concrete storage adapter.
import { offlineService } from './compositionRoot';
export const { loadPackage, installPackage, deletePackage, getInstalledPackage, localAssetUrl } = offlineService;
