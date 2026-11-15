import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { syncService } from '../compositionRoot';
import { placeKey } from '../application/placeIdentity';
import { useSyncStatus } from './useSyncStatus';

export default function FavoriteToggleButton({ place, label }) {
  const state = useSyncStatus(), key = placeKey(place);
  const { addToast } = useToast();
  const [optimistic, setOptimistic] = useState(null);
  const saved = optimistic ?? state.favorites.has(key);
  const pending = state.owner !== 'guest' && state.pendingKeys.has(key);
  async function toggle() {
    if (optimistic !== null) return;
    setOptimistic(!saved);
    try { await syncService.toggleFavorite(place, state.owner); }
    catch (error) { addToast(error.message, 'error'); }
    finally { setOptimistic(null); }
  }
  return <button type="button" className={`sync-favorite ${saved ? 'is-saved' : ''}`} aria-label={label || (saved ? 'Bỏ lưu địa điểm' : 'Lưu yêu thích')}
    aria-pressed={saved} onClick={toggle} title={state.owner === 'guest' ? 'Đã lưu trên thiết bị này' : pending ? 'Đang chờ đồng bộ' : 'Lưu vào tài khoản'}>
    <Heart size={20} strokeWidth={1.75} fill={saved ? 'currentColor' : 'none'} />
    {pending && <span className="sync-pending-dot" aria-label="Chờ đồng bộ" />}
  </button>;
}
