import { LocateFixed, MapPin, Navigation, Footprints } from 'lucide-react';
import { LANDMARKS } from '../../offline/application/constants';
import { formatDistance } from '../../offline/application/searchEngine';

export default function OfflineRoutePanel({ destination, origin, mode, onMode, onOrigin, onGps, onMapPick, onCalculate, route, busy, gpsBusy, error, onCancel }) {
  return <div className="offline-route-panel">
    <div className="offline-section-heading"><div><span className="offline-eyebrow">HÀNH TRÌNH CỦA BẠN</span><h2>Đến {destination.name}</h2></div><button className="offline-text-button" onClick={onCancel}>Đóng</button></div>
    <label htmlFor="offline-origin">Điểm xuất phát</label>
    <div id="offline-origin" className="offline-origin-display"><MapPin size={17} />{origin?.name || 'Chọn mốc hoặc dùng vị trí GPS'}</div>
    <div className="offline-origin-choices">{LANDMARKS.map(p => <button className={`offline-chip ${origin?.id === p.id ? 'is-active' : ''}`} onClick={() => onOrigin(p)} key={p.id}>{p.name}</button>)}</div>
    <div className="offline-route-actions"><button className="offline-button secondary" onClick={onGps} disabled={gpsBusy}><LocateFixed size={16} />{gpsBusy ? 'Đang tìm GPS…' : 'Dùng GPS'}</button>
      <button className="offline-button secondary" onClick={onMapPick}><MapPin size={16} />Chọn trên bản đồ</button></div>
    <div className="offline-travel-modes" aria-label="Phương tiện">
      <button className={`offline-chip ${mode === 'foot' ? 'is-active' : ''}`} aria-pressed={mode === 'foot'} onClick={() => onMode('foot')}><Footprints size={15} />Đi bộ</button>
      <button className={`offline-chip ${mode === 'motorbike' ? 'is-active' : ''}`} aria-pressed={mode === 'motorbike'} onClick={() => onMode('motorbike')}><Navigation size={15} />Xe máy (ước tính)</button>
    </div>
    <button className="offline-button accent" disabled={!origin || busy || gpsBusy} onClick={onCalculate}><Navigation size={17} />{busy ? 'Đang tính cục bộ…' : 'Tính đường offline'}</button>
    {error && <p role="alert" className="offline-inline-warning">{error}</p>}
    {route && <section className="offline-route-summary" aria-label="Kết quả chỉ đường">
      <span className="offline-category">Tính toán Offline · A*</span>
      <div className="offline-route-metrics"><strong>{formatDistance(route.distance)}</strong><strong>≈ {route.minutes} phút <small>{route.mode === 'foot' ? 'đi bộ' : 'xe máy'}</small></strong></div>
      <p className="offline-note">Đoạn nét đứt là khoảng nối tới đường ({Math.round(route.accessDistance)} m), chưa có dữ liệu lối đi; kiểm tra thực địa trước khi đi.</p>
      <ol className="offline-turn-list">
        {route.steps.map((step, i) => <li key={i}><span>{step.instruction}</span><small>{formatDistance(step.distance)}</small></li>)}
        <li><span>Đến gần {destination.name}</span></li>
      </ol>
      <p className="offline-note">Tuyến tham khảo theo OSM đã tải; chưa xét giao thông, hạn chế rẽ và thay đổi thực tế. Luôn tuân thủ biển báo.</p>
    </section>}
  </div>;
}
