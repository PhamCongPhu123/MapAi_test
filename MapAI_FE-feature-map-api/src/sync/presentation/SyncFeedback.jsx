import { syncService } from '../compositionRoot';
import { useSyncStatus } from './useSyncStatus';
export default function SyncFeedback() {
  const state = useSyncStatus();
  return state.undo ? <div className="sync-undo" role="status"><span>Đã xóa khỏi danh sách yêu thích</span><button onClick={() => syncService.undoFavorite()}>Hoàn tác</button></div> : null;
}
