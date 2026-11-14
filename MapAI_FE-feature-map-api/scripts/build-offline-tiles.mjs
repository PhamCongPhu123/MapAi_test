// Regenerate PMTiles v3 + integrity manifest from the clipped OSM GeoJSON.
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import geojsonvt from 'geojson-vt';
import vtpbf from 'vt-pbf';
import { zxyToTileId, PMTiles, FileSource } from 'pmtiles';

const root = new URL('../', import.meta.url);
const out = new URL('public/offline/', root);
const bounds = [108.14, 15.97, 108.33, 16.16];
const roads = JSON.parse(fs.readFileSync(new URL('scripts/roads.geojson.local', root)));
const index = new geojsonvt(roads, { maxZoom: 15, tolerance: 3, extent: 4096 });
const tiles = [];
const xy = (lng, lat, z) => [Math.floor((lng + 180) / 360 * 2 ** z),
  Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z)];
for (let z = 9; z <= 15; z++) {
  const [minX, minY] = xy(bounds[0], bounds[3], z);
  const [maxX, maxY] = xy(bounds[2], bounds[1], z);
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
    const tile = index.getTile(z, x, y);
    if (tile?.features.length) tiles.push({ id: zxyToTileId(z, x, y), data: gzipSync(vtpbf.fromGeojsonVt({ roads: tile })) });
  }
}
tiles.sort((a, b) => a.id - b.id);
const varint = (n) => {
  const bytes = [];
  while (n >= 128) { bytes.push((n % 128) | 128); n = Math.floor(n / 128); }
  return Buffer.from([...bytes, n]);
};
const directory = [varint(tiles.length)];
let last = 0;
for (const tile of tiles) { directory.push(varint(tile.id - last)); last = tile.id; }
for (const _tile of tiles) directory.push(varint(1));
for (const tile of tiles) directory.push(varint(tile.data.length));
tiles.forEach((_tile, i) => directory.push(varint(i === 0 ? 1 : 0)));
const dir = gzipSync(Buffer.concat(directory));
const metadata = gzipSync(Buffer.from(JSON.stringify({ name: 'Đà Nẵng Offline',
  attribution: '© OpenStreetMap contributors · ODbL 1.0',
  vector_layers: [{ id: 'roads', fields: { name: 'String', class: 'String' }, minzoom: 9, maxzoom: 15 }] })));
const data = Buffer.concat(tiles.map(t => t.data));
const header = Buffer.alloc(127);
header.write('PMTiles'); header[7] = 3;
[127, dir.length, 127 + dir.length, metadata.length, 127 + dir.length + metadata.length, 0,
  127 + dir.length + metadata.length, data.length, tiles.length, tiles.length, tiles.length]
  .forEach((v, i) => header.writeBigUInt64LE(BigInt(v), 8 + 8 * i));
[1, 2, 2, 1, 9, 15].forEach((v, i) => { header[96 + i] = v; });
bounds.forEach((v, i) => header.writeInt32LE(Math.round(v * 1e7), 102 + 4 * i));
header[118] = 13; header.writeInt32LE(108.224 * 1e7, 119); header.writeInt32LE(16.061 * 1e7, 123);
const archive = Buffer.concat([header, dir, metadata, data]);
fs.writeFileSync(new URL('danang.pmtiles', out), archive);
// Read back through the production reader to detect invalid archive generation.
const reader = new PMTiles(new FileSource(new File([archive], 'danang.pmtiles')));
const sample = xy(108.224, 16.061, 13);
if (!(await reader.getZxy(13, ...sample))?.data.byteLength) throw new Error('PMTiles verification failed');
const assets = fs.readdirSync(out, { recursive: true }).filter(p => p !== 'manifest.json' && fs.statSync(new URL(p, out)).isFile())
  .sort().map(path => {
    const bytes = fs.readFileSync(new URL(path, out));
    return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
fs.writeFileSync(new URL('manifest.json', out), JSON.stringify({
  id: 'danang', version: '2026.11.14.1', bounds, sourceDate: '2026-05-26',
  attribution: '© OpenStreetMap contributors · ODbL 1.0',
  assets, bytes: assets.reduce((n, a) => n + a.bytes, 0),
}, null, 2));
console.log(`${tiles.length} verified tiles; archive ${(archive.length / 1048576).toFixed(2)} MB; ${assets.length} package assets`);
