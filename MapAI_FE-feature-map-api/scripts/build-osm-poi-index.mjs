// One bounded Overpass extract, ODbL. Runtime search never downloads a planet or imports it into MapAI.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { unifiedPlace, categoryName } from '../src/places/application/unifiedPlace.js';
const root = fileURLToPath(new URL('../public/offline/', import.meta.url));
const bounds = [108.14, 15.97, 108.33, 16.16], bbox = `${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]}`;
const filters = ['["highway"="bus_stop"]', '["public_transport"="platform"]', '["amenity"~"^(bus_station|university|college|school|kindergarten|hospital|clinic|doctors|pharmacy|fuel|atm|bank)$"]'];
const query = `[out:json][timeout:90];(${filters.map(f => `nwr${f}(${bbox});`).join('')});out body center;`;
function downloadOsmMap() {
  const cache = path.join(os.tmpdir(), 'mapai-osm-map-export'); fs.mkdirSync(cache, { recursive: true });
  const elements = new Map(), sourceTimes = [];
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
    const box = [bounds[0] + .19 * x / 4, bounds[1] + .19 * y / 4, bounds[0] + .19 * (x + 1) / 4, bounds[1] + .19 * (y + 1) / 4].map(n => n.toFixed(7)).join(',');
    const target = path.join(cache, `${box}.json`);
    if (!fs.existsSync(target) || process.env.MAPAI_OSM_REFRESH === '1') {
      const result = spawnSync('curl', ['--fail', '--silent', '--show-error', '--compressed', '--max-time', '90', '--retry', '1', '-A', 'MapAI/1.0 (+https://github.com/PhamCongPhu123/MapAi_test)', `https://api.openstreetmap.org/api/0.6/map.json?bbox=${box}`], { maxBuffer: 32 * 1024 * 1024 });
      if (result.status) throw new Error(`OSM map export failed: ${result.stderr}`);
      JSON.parse(result.stdout); fs.writeFileSync(target, result.stdout);
    }
    sourceTimes.push(fs.statSync(target).mtimeMs);
    for (const element of JSON.parse(fs.readFileSync(target)).elements) elements.set(`${element.type}:${element.id}`, element);
  }
  const utility = e => ['bus_station', 'university', 'college', 'school', 'kindergarten', 'hospital', 'clinic', 'doctors', 'pharmacy', 'fuel', 'atm', 'bank'].includes(e.tags?.amenity) || e.tags?.highway === 'bus_stop' || e.tags?.public_transport === 'platform';
  const points = e => e?.type === 'node' ? [e] : e?.type === 'way' ? (e.nodes || []).map(id => elements.get(`node:${id}`)).filter(Boolean) : [];
  const places = [];
  for (const element of elements.values()) {
    if (!utility(element)) continue;
    if (element.type === 'node') { places.push(element); continue; }
    const geometry = element.type === 'way' ? points(element) : (element.members || []).flatMap(m => points(elements.get(`${m.type}:${m.ref}`)));
    if (!geometry.length) continue;
    places.push({ ...element, center: { lat: (Math.min(...geometry.map(p => p.lat)) + Math.max(...geometry.map(p => p.lat))) / 2, lon: (Math.min(...geometry.map(p => p.lon)) + Math.max(...geometry.map(p => p.lon))) / 2 } });
  }
  return { generator: 'MapAI bounded OSM API export', extractedAt: new Date(Math.min(...sourceTimes)).toISOString(), elements: places };
}
const source = process.env.MAPAI_OSM_POI_SOURCE;
let raw;
if (source) raw = JSON.parse(fs.readFileSync(source));
else {
  const response = spawnSync('curl', ['--fail', '--silent', '--show-error', '--compressed', '--max-time', '120', '--retry', '1', '--get', '--data-urlencode', `data=${query}`, 'https://overpass-api.de/api/interpreter'], { maxBuffer: 32 * 1024 * 1024 });
  if (response.status) { console.warn('Overpass unavailable; downloading a bounded OSM API extract.'); raw = downloadOsmMap(); }
  else raw = JSON.parse(response.stdout);
  fs.writeFileSync(path.join(os.tmpdir(), 'mapai-osm-poi-source.json'), JSON.stringify(raw));
}
if (!raw.elements?.length || raw.remark) throw new Error('Incomplete OSM extract; existing assets were not changed.');
const places = raw.elements.filter(e => e.tags && !(e.tags.railway === 'platform' && e.tags.bus !== 'yes') && (e.lat !== undefined || e.center)).map(e => {
  const osmTags = e.tags, point = e.center || e;
  const base = { osmType: e.type, osmId: String(e.id), sourceType: 'openstreetmap', lat: point.lat, lng: point.lon, osmTags,
    name: osmTags['name:vi'] || osmTags.name || osmTags['name:en'] || osmTags.official_name || osmTags.brand || '',
    address: osmTags['addr:full'] || [osmTags['addr:housenumber'], osmTags['addr:street'], osmTags['addr:suburb'], osmTags['addr:city']].filter(Boolean).join(', '),
    district: osmTags['addr:district'] || osmTags['addr:suburb'] || '', sourceDate: raw.osm3s?.timestamp_osm_base || raw.extractedAt, attribution: '© OpenStreetMap contributors, ODbL 1.0' };
  if (!base.name) base.name = `${categoryName(base)}${osmTags.ref ? ` ${osmTags.ref}` : ' (chưa có tên)'}`;
  return unifiedPlace(base);
}).filter(p => p.lng >= bounds[0] && p.lat >= bounds[1] && p.lng <= bounds[2] && p.lat <= bounds[3]);
const unique = [...new Map(places.map(p => [p.canonicalId, p])).values()].sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
const index = { version: 1, bounds, sourceDate: raw.osm3s?.timestamp_osm_base || raw.extractedAt, attribution: '© OpenStreetMap contributors, ODbL 1.0', source: raw.generator === 'MapAI bounded OSM API export' ? 'https://api.openstreetmap.org/api/0.6/map' : 'https://overpass-api.de/api/interpreter', places: unique };
fs.writeFileSync(root + 'osm-pois.json', JSON.stringify(index));
fs.writeFileSync(root + 'OSM_POIS_LICENSE.txt', `MapAI bounded utility index\n© OpenStreetMap contributors, ODbL 1.0. https://www.openstreetmap.org/copyright\nSource: ${index.source}\nExtracted: ${index.sourceDate}\nBounds: ${bounds.join(', ')}\n${unique.length} public utility records. Geometry centers are bounding-box centers.\nRebuild: npm run offline:pois (requires Internet and curl).\n`);
const manifest = JSON.parse(fs.readFileSync(root + 'manifest.json'));
manifest.version = '2026.11.16.1'; manifest.osmIndex = { count: unique.length, bounds, sourceDate: index.sourceDate };
manifest.assets = fs.readdirSync(root, { recursive: true }).filter(p => p !== 'manifest.json' && fs.statSync(root + p).isFile()).sort().map(path => {
  const bytes = fs.readFileSync(root + path); return { path: path.replaceAll('\\', '/'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
manifest.bytes = manifest.assets.reduce((n, a) => n + a.bytes, 0);
fs.writeFileSync(root + 'manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ count: unique.length, sourceDate: index.sourceDate, categories: Object.fromEntries([...new Set(unique.map(p => p.categoryMapping))].map(c => [c, unique.filter(p => p.categoryMapping === c).length])) }));
