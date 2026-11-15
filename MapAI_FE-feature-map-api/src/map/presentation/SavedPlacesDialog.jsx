import { useMemo, useState } from 'react';
import { Heart } from 'lucide-react';
import Dialog from '../../features/offline/Dialog';
import PlaceCard, { PlaceImage } from '../../features/offline/PlaceCard';
import { localPlace } from '../application/createMapService';
import QueuedChangeEditor from '../../sync/presentation/QueuedChangeEditor';
import FavoritesSyncBar from '../../sync/presentation/FavoritesSyncBar';
import FavoriteToggleButton from '../../sync/presentation/FavoriteToggleButton';
import { useSyncStatus } from '../../sync/presentation/useSyncStatus';
import { syncService } from '../../sync/compositionRoot';
import { offlineAvailability, placeKey } from '../../sync/application/placeIdentity';

export default function SavedPlacesDialog({ resource, onClose, onSelect, onDirections }) {
  const [tab, setTab] = useState('favorites');
  const { data } = resource, personal = useSyncStatus();
  const places = useMemo(() => {
    const list = (data?.places || []).map(localPlace);
    if (tab === 'favorites') return personal.favoriteRows.filter(f => !f.deleted).map(f => ({ ...f.place,
      ...list.find(p => placeKey(p) === f.place.key), key: f.place.key }));
    if (tab === 'history') return personal.history.flatMap(h => list.filter(p => p.localId === h.placeId || p.id === h.placeId));
    return list;
  }, [data, personal, tab]);
  return <Dialog title="Bộ sưu tập trên thiết bị" onClose={onClose}>
    <div className="offline-dialog-body">
      <FavoritesSyncBar />
      <div className="flex flex-wrap gap-2 pb-3" aria-label="Bộ sưu tập">
        {[['all', 'Địa điểm đã tải'], ['favorites', `Đã lưu (${personal.favorites.size})`], ['history', 'Gần đây'], ['queue', `Chờ gửi (${personal.jobs.filter(j => j.kind !== 'favorite').length})`]].map(([id, label]) =>
          <button className="community-secondary" aria-pressed={tab === id} key={id} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {tab === 'queue' ? <div>{personal.jobs.filter(j => j.kind !== 'favorite').map(job => <article key={job.key} className="sync-saved-card"><div className="sync-saved-copy">
        <strong>{job.kind === 'contribution' ? 'Đóng góp địa điểm' : 'Đánh giá'}: {job.payload.title || job.payload.comment || job.locationId}</strong>
        <p>{job.error || 'Đã lưu trên máy, chờ gửi khi có mạng.'}</p><button className="community-secondary" onClick={() => syncService.sync({ retry: true })}>Thử gửi lại</button>
        <button className="community-secondary ml-2" disabled={personal.syncing} onClick={() => syncService.discardJob(job.key)}>Bỏ khỏi hàng đợi</button><QueuedChangeEditor job={job} />
      </div></article>)}{!personal.jobs.some(j => j.kind !== 'favorite') && <p role="status">Không có đóng góp hoặc đánh giá đang chờ gửi.</p>}</div>
        : places.map(place => tab === 'favorites' ? <article className="sync-saved-card" key={placeKey(place)}>
          <PlaceImage place={place} /><div className="sync-saved-copy"><button aria-label={`Chi tiết ${place.name}`} onClick={() => onSelect(place)}>{place.name}</button>
            <p>{place.type || place.category} · {place.district || place.address}</p>
            <span className={`sync-availability ${offlineAvailability(place, data) ? '' : 'is-limited'}`}>{offlineAvailability(place, data) ? 'Sẵn sàng offline' : 'Chỉ xem thông tin'}</span>
            <div className="sync-saved-actions"><button onClick={() => onDirections?.(place)}>Chỉ đường</button><FavoriteToggleButton place={place} label={`Bỏ lưu ${place.name}`} /></div>
          </div></article> : <PlaceCard key={placeKey(place)} place={place} onSelect={onSelect} onFavorite />)}
      {tab !== 'queue' && !places.length && <div className="sync-empty" role="status"><Heart size={48} /><h3>{tab === 'favorites' ? 'Chưa có địa điểm yêu thích' : 'Chưa có địa điểm trong danh sách này'}</h3><p>Lưu lại các quán ăn và điểm tham quan để xem lại nhanh kể cả khi không có mạng.</p><button className="community-primary mt-4" onClick={onClose}>Khám phá bản đồ Đà Nẵng</button></div>}
    </div>
  </Dialog>;
}
