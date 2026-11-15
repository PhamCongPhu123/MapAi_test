import { useNavigate } from 'react-router-dom';
import { CloudCheck, CloudOff, RefreshCw, Smartphone, X } from 'lucide-react';
import { useNetworkStatus } from '../../offline/network';
import { syncService } from '../compositionRoot';
import { useSyncStatus } from './useSyncStatus';

export default function FavoritesSyncBar() {
  const state = useSyncStatus(), network = useNetworkStatus(), navigate = useNavigate();
  const guest = state.owner === 'guest';
  const error = state.error || state.jobs.find(j => j.error)?.error;
  const complete = !state.syncing && !error && !state.pendingCount && Boolean(state.lastSynced);
  return <div className="sync-status-stack">
    <div role="status" className={`sync-bar ${guest ? 'is-guest' : complete ? 'is-complete' : 'is-pending'}`}>
      {guest ? <Smartphone size={20} /> : network.offline ? <CloudOff size={20} /> : state.syncing ? <RefreshCw size={20} className="sync-spin" /> : <CloudCheck size={20} />}
      <span>{guest ? 'Đang lưu trên máy (Chế độ Khách)' : network.offline ? `Đang ngoại tuyến • ${state.favorites.size} địa điểm được lưu trên máy, sẽ tự đồng bộ khi có mạng`
        : state.syncing ? `Đang đồng bộ ${state.pendingCount} thay đổi với tài khoản…`
        : error ? `Chưa đồng bộ được • ${error}`
        : state.pendingCount ? `${state.pendingCount} thay đổi đang chờ đồng bộ`
        : complete ? `Đã đồng bộ đa thiết bị • Cập nhật lúc ${new Date(state.lastSynced).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Sẵn sàng đồng bộ với tài khoản'}
      </span>
      {guest ? <button onClick={() => navigate('/login', { state: { from: { pathname: '/map', search: '', hash: '' } } })}>Đăng nhập để sao lưu</button>
        : !network.offline && <button disabled={state.syncing} onClick={() => syncService.sync({ retry: true })}>{error ? 'Thử đồng bộ lại' : 'Đồng bộ ngay'}</button>}
    </div>
    {state.mergedCount > 0 && complete && <div className="sync-merge" role="status"><div><strong>Đã gộp dữ liệu ngoại tuyến</strong><p>{state.mergedCount} địa điểm bạn lưu khi chưa đăng nhập đã được đồng bộ vào tài khoản.</p></div><button aria-label="Đóng thông báo gộp dữ liệu" onClick={() => syncService.dismissMerge()}><X size={18} /></button></div>}
  </div>;
}
