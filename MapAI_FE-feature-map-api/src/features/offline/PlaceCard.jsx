import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { localAssetUrl } from '../../offline/packageManager';
import { categoryLabel } from '../../offline/application/constants';
import FavoriteToggleButton from '../../sync/presentation/FavoriteToggleButton';
import { formatDistance } from '../../offline/application/searchEngine';

export function PlaceImage({ place, large = false }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true, objectUrl;
    localAssetUrl(place.image).then(value => {
      objectUrl = value;
      if (alive) setUrl(value); else if (value) URL.revokeObjectURL(value);
    }).catch(() => {});
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [place.image]);
  return <div className={`offline-place-image ${large ? 'is-large' : ''}`}>
    {url ? <img src={url} alt={`Minh họa ${categoryLabel(place.category).toLowerCase()}`} onError={() => setUrl(null)} /> :
      <svg viewBox="0 0 72 72" aria-label="Minh họa địa điểm" role="img"><rect width="72" height="72" fill="#0F172A" /><path d="M36 12c-11 0-19 8-19 19 0 14 19 29 19 29s19-15 19-29c0-11-8-19-19-19z" fill="#2563EB" /><circle cx="36" cy="31" r="7" fill="white" /></svg>}
    {large && <span>Ảnh minh họa</span>}
  </div>;
}

export default function PlaceCard({ place, onSelect, onFavorite, compact = false }) {
  return <article className={`offline-place-card ${compact ? 'is-compact' : ''}`}>
    <button className="offline-place-main" onClick={() => onSelect(place)} aria-label={`Chi tiết ${place.name}`}>
      <PlaceImage place={place} />
      <span className="offline-place-copy"><span className="offline-place-name">{place.name}</span>
        <span className={`offline-category category-${place.category}`}>{categoryLabel(place.category)}</span>
        <span className="offline-place-description">{place.description}</span>
        <span className="offline-place-meta"><MapPin size={12} /> {place.district}{Number.isFinite(place.distance) && ` · ≈ ${formatDistance(place.distance)}`}</span>
      </span>
    </button>
    {onFavorite && <FavoriteToggleButton place={place} label={undefined} />}
  </article>;
}
