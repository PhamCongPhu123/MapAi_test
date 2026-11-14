// Download a bounded OpenFreeMap extract and its exact Liberty assets.
// No planet download is needed. Keep the existing local POI/routing graph.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { zxyToTileId, PMTiles, FileSource } from 'pmtiles';

const require = createRequire(import.meta.url);
// These decoders are direct dependencies of the already installed vt-pbf builder.
const decoder = createRequire(require.resolve('vt-pbf'));
const { VectorTile } = decoder('@mapbox/vector-tile');
const Pbf = decoder('pbf');
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'public/offline');
const cache = path.join(process.env.MAPAI_TILE_CACHE || '/tmp/mapai-openfreemap', 'download');
const bounds = [108.14, 15.97, 108.33, 16.16];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function download(url) {
  const target = path.join(cache, sha(url));
  if (fs.existsSync(target)) return fs.readFileSync(target);
  fs.mkdirSync(cache, { recursive: true });
  const result = spawnSync('curl', ['--fail', '--location', '--silent', '--show-error', '--compressed', '--retry', '2', '--max-time', '60', url], { maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0 || !result.stdout.length) throw new Error(`Download failed: ${url}\n${result.stderr}`);
  fs.writeFileSync(target, result.stdout);
  return result.stdout;
}
const style = JSON.parse(download('https://tiles.openfreemap.org/styles/liberty'));
const tilejson = JSON.parse(download('https://tiles.openfreemap.org/planet/latest'));
const template = tilejson.tiles[0];
const ranges = new Set([0, 256, 7680]);
const tiles = [];
const xy = (lng, lat, z) => [Math.floor((lng + 180) / 360 * 2 ** z), Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z)];
for (let z = 0; z <= 14; z++) {
  const [minX, minY] = xy(bounds[0], bounds[3], z), [maxX, maxY] = xy(bounds[2], bounds[1], z);
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
    let data = download(template.replace('{z}', z).replace('{x}', x).replace('{y}', y));
    if (data[0] === 31 && data[1] === 139) data = gunzipSync(data);
    const tile = new VectorTile(new Pbf(data));
    for (const layer of Object.values(tile.layers)) for (let i = 0; i < layer.length; i++) {
      for (const [key, value] of Object.entries(layer.feature(i).properties)) {
        if (z < 9 || !['name', 'name_en', 'name:latin', 'name:nonlatin'].includes(key) || typeof value !== 'string') continue;
        for (const char of value) { const code = char.codePointAt(0); if (code <= 65535) ranges.add(Math.floor(code / 256) * 256); }
      }
    }
    tiles.push({ id: zxyToTileId(z, x, y), data: gzipSync(data) });
  }
  console.log(`OpenFreeMap z${z}: ${tiles.length} tiles`);
}
const mapDir = path.join(out, 'map');
const writtenFonts = new Set();
fs.mkdirSync(mapDir, { recursive: true });
function asset(relative, bytes) {
  const target = path.join(mapDir, relative); if (relative.startsWith('fonts/')) writtenFonts.add(target); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
}
const fonts = [...new Set(style.layers.flatMap(layer => layer.layout?.['text-font'] || []).filter(name => typeof name === 'string'))];
for (const font of fonts) for (const start of [...ranges].sort((a, b) => a - b)) {
  const range = `${start}-${start + 255}`;
  asset(`fonts/${font}/${range}.pbf`, download(style.glyphs.replace('{fontstack}', encodeURIComponent(font)).replace('{range}', range)));
}
for (const suffix of ['.json', '.png', '@2x.json', '@2x.png']) asset(`sprite${suffix}`, download(`${style.sprite}${suffix}`));
for (let z = 0; z <= 6; z++) {
  const [minX, minY] = xy(bounds[0], bounds[3], z), [maxX, maxY] = xy(bounds[2], bounds[1], z);
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
    asset(`earth/${z}/${x}/${y}.png`, download(style.sources.ne2_shaded.tiles[0].replace('{z}', z).replace('{x}', x).replace('{y}', y)));
  }
}
for (const p of fs.readdirSync(path.join(mapDir, 'fonts'), { recursive: true })) {
  const target = path.join(mapDir, 'fonts', p);
  if (fs.statSync(target).isFile() && !writtenFonts.has(target)) fs.unlinkSync(target);
}
const bytes = Buffer.from(JSON.stringify(style));
asset('style.json', bytes);
fs.writeFileSync(path.join(root, 'src/map/infrastructure/openfreemap-style.json'), bytes);
const varint = n => {
  const result = []; while (n >= 128) { result.push((n % 128) | 128); n = Math.floor(n / 128); }
  return Buffer.from([...result, n]);
};
tiles.sort((a, b) => a.id - b.id);
const directory = [varint(tiles.length)];
let last = 0;
for (const tile of tiles) { directory.push(varint(tile.id - last)); last = tile.id; }
for (const _ of tiles) directory.push(varint(1));
for (const tile of tiles) directory.push(varint(tile.data.length));
tiles.forEach((_, i) => directory.push(varint(i ? 0 : 1)));
const dir = gzipSync(Buffer.concat(directory));
const metadata = gzipSync(Buffer.from(JSON.stringify({ name: 'OpenFreeMap Đà Nẵng', attribution: tilejson.attribution, vector_layers: tilejson.vector_layers })));
const data = Buffer.concat(tiles.map(t => t.data));
const header = Buffer.alloc(127); header.write('PMTiles'); header[7] = 3;
[127, dir.length, 127 + dir.length, metadata.length, 127 + dir.length + metadata.length, 0,
  127 + dir.length + metadata.length, data.length, tiles.length, tiles.length, tiles.length]
  .forEach((v, i) => header.writeBigUInt64LE(BigInt(v), 8 + 8 * i));
[1, 2, 2, 1, 0, 14].forEach((v, i) => { header[96 + i] = v; });
bounds.forEach((v, i) => header.writeInt32LE(Math.round(v * 1e7), 102 + 4 * i));
header[118] = 13; header.writeInt32LE(108.224 * 1e7, 119); header.writeInt32LE(16.061 * 1e7, 123);
const archive = Buffer.concat([header, dir, metadata, data]);
const reader = new PMTiles(new FileSource(new File([archive], 'danang.pmtiles')));
if (!(await reader.getZxy(13, ...xy(108.224, 16.061, 13)))?.data.byteLength) throw new Error('Invalid PMTiles archive');
fs.writeFileSync(path.join(out, 'danang.pmtiles'), archive);
const notices = [
  ['OpenFreeMap styles', 'https://raw.githubusercontent.com/hyperknot/openfreemap-styles/main/LICENSE.md'],
  ['OSM Liberty', 'https://raw.githubusercontent.com/maputnik/osm-liberty/gh-pages/LICENSE.md'],
  ['Noto Sans', 'https://raw.githubusercontent.com/notofonts/noto-fonts/main/LICENSE'],
].map(([name, url]) => `${name} — ${url}\n\n${download(url).toString('utf8')}`);
fs.writeFileSync(path.join(out, 'OPENFREEMAP_LICENSES.txt'), `OpenFreeMap bounded extract for MapAI\nData © OpenStreetMap contributors (ODbL 1.0).\nStyle Liberty, OpenMapTiles design attribution; Natural Earth public domain.\n\n${notices.join('\n\n---\n\n')}`);
const assets = fs.readdirSync(out, { recursive: true }).filter(p => p !== 'manifest.json' && fs.statSync(path.join(out, p)).isFile()).sort().map(p => {
  const content = fs.readFileSync(path.join(out, p)); return { path: p.split(path.sep).join('/'), bytes: content.length, sha256: sha(content) };
});
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({
  id: 'danang', version: '2026.11.14.2', mapProvider: 'openfreemap', mapStyle: 'Liberty', bounds,
  sourceDate: '2026-05-26', tileSource: template, tileCount: tiles.length,
  attribution: tilejson.attribution, assets, bytes: assets.reduce((n, a) => n + a.bytes, 0),
}, null, 2));
console.log(`${tiles.length} OpenFreeMap tiles; ${(archive.length / 1048576).toFixed(2)} MiB PMTiles; ${assets.length} assets; ${fonts.length} fonts / ${ranges.size} Unicode ranges`);
