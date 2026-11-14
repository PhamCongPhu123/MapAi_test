import { useMemo, useState } from 'react';
import Dialog from '../../features/offline/Dialog';
import PlaceCard from '../../features/offline/PlaceCard';
import { offlineService } from '../../offline/compositionRoot';
import { localPlace } from '../application/createMapService';
import { useToast } from '../../hooks/useToast';

export default function SavedPlacesDialog({ resource, onClose, onSelect }) {
  const { addToast } = useToast();
  const [tab, setTab] = useState('all');
  const { data, personal } = resource;
  const places = useMemo(() => {
    const list = data?.places || [];
    if (tab === 'favorites') return list.filter(p => personal.favorites.has(p.id));
    if (tab === 'history') return personal.history.flatMap(h => list.filter(p => p.id === h.placeId));
    return list;
  }, [data, personal, tab]);
  return <Dialog title="Bộ sưu tập trên thiết bị" onClose={onClose}>
    <div className="offline-dialog-body">
      <div className="flex flex-wrap gap-2 pb-3" aria-label="Bộ sưu tập">
        {[['all', 'Địa điểm đã tải'], ['favorites', `Đã lưu (${personal.favorites.size})`], ['history', 'Gần đây']].map(([id, label]) =>
          <button className="community-secondary" aria-pressed={tab === id} key={id} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      <p className="text-xs text-slate-400 mb-3">Dữ liệu lưu trên thiết bị, dùng được ở cả hai chế độ.</p>
      {places.map(place => <PlaceCard key={place.id} place={place} favorite={personal.favorites.has(place.id)}
        onSelect={p => onSelect(localPlace(p))} onFavorite={id => offlineService.toggleFavorite(id).catch(error => addToast(error.message, 'error'))} />)}
      {!places.length && <p role="status" className="py-8 text-center text-sm text-slate-300">Chưa có địa điểm trong danh sách này.</p>}
    </div>
  </Dialog>;
}
