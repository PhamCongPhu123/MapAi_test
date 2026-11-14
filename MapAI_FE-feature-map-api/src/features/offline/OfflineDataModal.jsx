import { useEffect, useState } from 'react';
import { Database, Download, RefreshCw, ShieldCheck, Trash2, WifiOff } from 'lucide-react';
import { useNetworkStatus, setOfflineSimulation } from '../../offline/network';
import { usePwaStatus, applyAppUpdate } from '../../offline/pwa';
import Dialog from './Dialog';
import { offlineService } from '../../offline/compositionRoot';

const mb = bytes => `${(bytes / 1048576).toFixed(2)} MB`;
export default function OfflineDataModal({ resource, onClose }) {
  const { data, status, error, progress, sync, remove } = resource;
  const network = useNetworkStatus();
  const pwa = usePwaStatus();
  const [storage, setStorage] = useState(null);
  const [persistent, setPersistent] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    offlineService.storageStatus().then(s => { setStorage(s.estimate); setPersistent(s.persistent); }).catch(() => {});
  }, [data]);
  const persist = async () => {
    const ok = await offlineService.persistData();
    setPersistent(Boolean(ok));
    setMessage(ok ? 'Trình duyệt đã ưu tiên giữ dữ liệu trên thiết bị.' : 'Trình duyệt chưa cấp lưu trữ bền vững. Dữ liệu vẫn dùng được, nhưng có thể bị dọn khi thiếu dung lượng.');
  };
  return <Dialog title="Dữ liệu offline Đà Nẵng" onClose={onClose}>
    <div className="offline-dialog-body">
      <div className="offline-package-hero"><Database size={30} /><div><strong>Khám phá, kể cả khi mất mạng</strong><p>Bản đồ, địa điểm và chỉ đường được lưu trên thiết bị này.</p></div></div>
      <dl className="offline-data-stats">
        <div><dt>Gói dữ liệu</dt><dd>{data ? `${data.pkg.placeCount} địa điểm · ${mb(data.pkg.bytes)}` : 'Chưa tải'}</dd></div>
        <div><dt>Phiên bản</dt><dd>{data?.pkg.version || '—'}</dd></div>
        <div><dt>Lần tải gần nhất</dt><dd>{data ? new Date(data.pkg.installedAt).toLocaleString('vi-VN') : '—'}</dd></div>
        <div><dt>Giao diện mở lại offline</dt><dd>{pwa.ready ? 'Đã sẵn sàng' : import.meta.env.DEV ? 'Cần chạy bản build PWA' : pwa.supported ? 'Đang lưu…' : 'Cần HTTPS và Service Worker'}</dd></div>
        {storage && <div><dt>Dung lượng toàn ứng dụng</dt><dd>{mb(storage.usage || 0)} / {mb(storage.quota || 0)}</dd></div>}
      </dl>
      <p className="offline-note">Gói trung tâm thành phố, gồm Hải Châu, Sơn Trà, Ngũ Hành Sơn, Cẩm Lệ và Thanh Khê trong khung bản đồ. Chưa bao gồm Bà Nà, toàn bán đảo Sơn Trà và Hội An.</p>
      <p className="offline-note">© OpenStreetMap contributors · ODbL 1.0 · Đường bộ ngày 26/05/2026. Ảnh là minh họa; giờ và giá tham khảo, không phải dữ liệu trực tiếp.</p>
      {status === 'installing' && <div role="status"><p>Đang tải và kiểm tra dữ liệu: {progress}%</p><progress value={progress} max="100" aria-label="Tiến độ tải gói Đà Nẵng" /></div>}
      {(error || pwa.error) && <p className="offline-error" role="alert">{error || `Chưa lưu được giao diện: ${pwa.error}`}</p>}
      <button className="offline-button primary" disabled={(network.offline && !offlineService.embedded) || status === 'installing'} onClick={sync}>
        {data ? <RefreshCw size={17} /> : <Download size={17} />}{offlineService.embedded ? 'Cài lại dữ liệu có sẵn trong app' : data ? 'Đồng bộ lại khi có mạng' : 'Tải gói Đà Nẵng'}
      </button>
      {network.offline && !offlineService.embedded && <p className="offline-note">Kết nối mạng và tắt giả lập để tải hoặc đồng bộ. Bạn có thể dùng Wi-Fi để tiết kiệm dữ liệu.</p>}
      {pwa.update && <button className="offline-button" onClick={() => applyAppUpdate(true)}>Cập nhật giao diện và tải lại</button>}
      <div className="offline-simulator"><div><strong><WifiOff size={16} /> Giả lập Offline</strong><p>Thử tìm kiếm, hỏi trợ lý và tính đường hoàn toàn cục bộ.</p></div>
        <button role="switch" aria-checked={network.simulated} aria-label="Giả lập Offline" className={`offline-switch ${network.simulated ? 'is-on' : ''}`} onClick={() => setOfflineSimulation(!network.simulated)}><span /></button>
      </div>
      <p className="offline-note">Giả lập áp dụng cho luồng khám phá này. Để kiểm tra tải lại PWA, dùng chế độ Offline của trình duyệt hoặc tắt Wi-Fi.</p>
      <button className="offline-button secondary" onClick={persist} disabled={persistent}><ShieldCheck size={17} />{persistent ? 'Đã ưu tiên giữ dữ liệu' : 'Ưu tiên giữ dữ liệu trên thiết bị'}</button>
      {message && <p role="status" className="offline-note">{message}</p>}
      {data && <button className="offline-button danger" disabled={status === 'installing'} onClick={async () => {
        if (!confirmDelete) { setConfirmDelete(true); return; }
        await remove(); setConfirmDelete(false);
      }}><Trash2 size={16} />{confirmDelete ? 'Xác nhận xóa gói bản đồ khỏi thiết bị' : 'Xóa gói bản đồ'} </button>}
      <p className="offline-note">Yêu thích và lịch sử được giữ khi xóa gói. Dữ liệu chỉ lưu ở trình duyệt này, chưa đồng bộ lên tài khoản.</p>
    </div>
  </Dialog>;
}
