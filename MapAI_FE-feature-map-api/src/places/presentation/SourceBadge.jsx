import { MapPin, Bus, GraduationCap, Hospital, Pill, Fuel, Landmark, Coffee, Utensils, ParkingCircle, Zap } from 'lucide-react';
import { useSyncStatus } from '../../sync/presentation/useSyncStatus';
import { categoryMapping } from '../application/unifiedPlace.js';
export function SourceBadge({ place }) {
  const { references = {} } = useSyncStatus();
  const external = place.sourceType === 'openstreetmap' || ['osm', 'openstreetmap'].includes(place.source);
  const synced = external && Boolean(place.mapaiId || references[place.canonicalId || place.key]);
  return <span className={`source-badge ${external ? synced ? 'source-synced' : 'source-osm' : 'source-mapai'}`}>{external ? synced ? 'OSM · Đã đồng bộ' : 'OSM' : place.sourceType === 'mapai_community' ? 'MapAI · Cộng đồng' : 'MapAI'}</span>;
}
export function PlaceAvatar({ place, size = 20 }) {
  const Icon = ({ bus: Bus, university: GraduationCap, school: GraduationCap, hospital: Hospital, clinic: Hospital, pharmacy: Pill, fuel: Fuel, atm: Landmark, bank_atm: Landmark, cafe: Coffee, restaurant: Utensils, parking: ParkingCircle, charging_station: Zap })[categoryMapping(place)] || MapPin;
  return <Icon size={size} aria-hidden="true" />;
}
