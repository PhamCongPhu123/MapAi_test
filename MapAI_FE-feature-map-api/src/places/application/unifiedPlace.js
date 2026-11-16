import { normalize, distanceMeters } from '../../offline/application/searchEngine.js';

export const UTILITY_CATEGORIES = [
  ['bus', 'Trạm xe buýt', ['ben xe buyt', 'tram xe buyt', 'ben xe bus', 'tram xe bus', 'bus stop', 'bus station', 'bus'], ['highway=bus_stop', 'amenity=bus_station', 'public_transport=platform']],
  ['university', 'Trường đại học', ['truong dai hoc', 'dai hoc', 'university', 'college'], ['amenity=university', 'amenity=college']],
  ['school', 'Trường học', ['truong hoc', 'truong', 'school'], ['amenity=school', 'amenity=kindergarten']],
  ['hospital', 'Bệnh viện', ['benh vien', 'hospital'], ['amenity=hospital']],
  ['pharmacy', 'Nhà thuốc', ['nha thuoc', 'hieu thuoc', 'pharmacy'], ['amenity=pharmacy']],
  ['fuel', 'Trạm xăng', ['tram xang', 'cay xang', 'gas station', 'fuel', 'petrol'], ['amenity=fuel']],
  ['atm', 'ATM', ['atm', 'may rut tien'], ['amenity=atm']],
  ['bank_atm', 'Ngân hàng', ['ngan hang', 'bank'], ['amenity=bank']],
  ['clinic', 'Cơ sở y tế', ['tram y te', 'phong kham', 'clinic', 'hospital'], ['amenity=clinic', 'amenity=doctors']],
  ['cafe', 'Cà phê', ['ca phe', 'coffee', 'cafe'], ['amenity=cafe']],
  ['restaurant', 'Ăn uống', ['an uong', 'quan an', 'nha hang', 'restaurant', 'food'], ['amenity=restaurant', 'amenity=fast_food']],
  ['parking', 'Bãi đỗ xe', ['bai do xe', 'bai giu xe', 'parking'], ['amenity=parking']],
  ['charging_station', 'Trạm sạc', ['tram sac', 'charging station'], ['amenity=charging_station']],
];
export function utilityCategory(query) {
  const text = ` ${normalize(query)} `;
  return UTILITY_CATEGORIES.flatMap(([id, label, aliases]) => aliases.map(alias => ({ id, label, alias })))
    .sort((a, b) => b.alias.length - a.alias.length).find(c => text.includes(` ${c.alias} `)) || null;
}
export function categoryMapping(place) {
  const tags = place.osmTags || (place.tags && !Array.isArray(place.tags) ? place.tags : {});
  const named = String(place.categoryMapping || place.category || place.type || '').toLowerCase();
  const found = UTILITY_CATEGORIES.find(([id, , , filters]) => id === named || filters.some(filter => {
    const [key, value] = filter.split('='); return tags[key] === value;
  }));
  return found?.[0] || (named === 'food' && Array.isArray(place.tags) ? place.tags.some(t => /ca phe|cafe|coffee/.test(normalize(t))) ? 'cafe' : 'restaurant' : null) || utilityCategory(named)?.id || (['food', 'sightseeing', 'entertainment'].includes(named) ? named : 'place');
}
export function categoryName(place) { return UTILITY_CATEGORIES.find(c => c[0] === categoryMapping(place))?.[1] || place.type || place.category || 'Địa điểm'; }
export function osmIdentity(place) {
  const candidate = place.canonicalId || place.fsqId || place.id || place.key || '';
  const matched = /^(?:osm:)?osm:(node|way|relation):(\d+)$/.exec(candidate) || /^osm:(node|way|relation):(\d+)$/.exec(candidate);
  const type = ({ N: 'node', W: 'way', R: 'relation' })[place.osmType || place.osm_type] || place.osmType || place.osm_type || matched?.[1];
  const id = String(place.osmId || place.osm_id || matched?.[2] || '');
  return ['node', 'way', 'relation'].includes(type) && /^[1-9]\d{0,18}$/.test(id) ? { osmType: type, osmId: id, canonicalId: `osm:${type}:${id}` } : null;
}
export function unifiedPlace(raw) {
  const identity = osmIdentity(raw), localId = raw.localId || (String(raw.id || '').startsWith('offline:') ? raw.id.slice(8) : null);
  const explicitMapai = raw.sourceType?.startsWith('mapai_') || raw.canonicalId?.startsWith('mapai:');
  const external = !explicitMapai && (Boolean(identity) || ['osm', 'openstreetmap'].includes(raw.source) || raw.sourceType === 'openstreetmap');
  const mapaiId = raw.mapaiId || raw.locationId || (raw.canonicalId?.startsWith('mapai:') && !raw.canonicalId.startsWith('mapai:seed:') ? raw.canonicalId.slice(6) : null) || (!external && !localId && !String(raw.id || '').startsWith('osm:') && raw.id && raw.source !== 'osm' && raw.source !== 'openstreetmap' ? raw.id : null);
  const lat = Number(raw.lat ?? raw.latitude), lng = Number(raw.lng ?? raw.lon ?? raw.longitude);
  const name = String(raw.name || raw.title || raw.display_name?.split(',')[0] || '').trim();
  const canonicalId = (external ? identity?.canonicalId : null) || raw.canonicalId || (localId ? `mapai:seed:${localId}` : external ? raw.key || `osm:legacy:${lng.toFixed(6)},${lat.toFixed(6)}:${normalize(name).slice(0, 70)}` : `mapai:${mapaiId || raw.id}`);
  const sourceType = external ? 'openstreetmap' : raw.sourceType || (raw.isUserContribution ? 'mapai_community' : 'mapai_curated');
  const tags = Array.isArray(raw.tags) ? raw.tags : Object.values(raw.osmTags || raw.tags || {});
  return { ...raw, ...(identity ? { osmType: identity.osmType, osmId: identity.osmId } : {}), canonicalId, normalizedName: normalize(name), sourceType,
    key: localId ? raw.key || `seed:${localId}` : canonicalId, id: external ? canonicalId : localId ? `offline:${localId}` : mapaiId || raw.id,
    mapaiId, locationId: mapaiId || undefined, localId: localId || undefined, name, lat, lng,
    source: external ? 'openstreetmap' : localId ? 'offline' : 'mapai',
    categoryMapping: categoryMapping(raw), type: raw.type || categoryName(raw), address: typeof raw.address === 'string' ? raw.address : raw.display_name || '',
    tags, photos: Array.isArray(raw.photos) ? raw.photos : Array.isArray(raw.images) ? raw.images : [],
    aliases: [...new Set([canonicalId, ...(raw.aliases || [])])], referenceSynced: Boolean(mapaiId && external) };
}
export function validPlace(place) { return place.name && Number.isFinite(place.lat) && Number.isFinite(place.lng) && Math.abs(place.lat) <= 90 && Math.abs(place.lng) <= 180; }
export function nameSimilarity(a, b) {
  a = normalize(a); b = normalize(b); if (!a || !b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i]; for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); previous = current;
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}
export function mergePlaces(input) {
  const result = [];
  for (const place of input.map(unifiedPlace).filter(validPlace)) {
    const existing = result.findIndex(p => p.canonicalId === place.canonicalId || p.aliases.includes(place.canonicalId) || place.aliases.includes(p.canonicalId) ||
      ((p.sourceType === 'openstreetmap') !== (place.sourceType === 'openstreetmap') && distanceMeters(p, place) < 50 && nameSimilarity(p.name, place.name) > .8));
    if (existing < 0) { result.push(place); continue; }
    const first = result[existing];
    if (first.canonicalId === place.canonicalId) { result[existing] = unifiedPlace({ ...first, ...place, mapaiId: place.mapaiId || first.mapaiId, aliases: [...first.aliases, ...place.aliases] }); continue; }
    const curated = first.sourceType === 'openstreetmap' ? place : first, osm = first.sourceType === 'openstreetmap' ? first : place;
    result[existing] = { ...curated, lat: osm.lat, lng: osm.lng, osmCanonicalId: osm.canonicalId,
      osmType: osm.osmType, osmId: osm.osmId, aliases: [...new Set([...curated.aliases, ...osm.aliases])], coordinateSource: 'openstreetmap' };
  }
  return result;
}
export function placeSearchIntent(input) {
  const text = normalize(input), category = utilityCategory(text);
  if (!category || /\b(gioi thieu|lich su|vi sao|tai sao|ke ve)\b/.test(text)) return null;
  const direction = /\b(chi duong|dan duong|duong den)\b/.test(text);
  let query = text.replace(/^(toi muon |hay |vui long )*(tim giup toi |tim cho toi |tim |cho toi |chi duong den |chi duong toi |dan duong den |dan duong toi |duong den )/, '').trim();
  query = query.replace(/\b(gan day nhat|gan nhat|gan day|gan toi|quanh toi)\b/g, '').trim();
  if (!query) query = category.alias;
  return { query, category: category.id, direction, near: /\b(gan nhat|gan day|gan toi|quanh toi)\b/.test(text) };
}
