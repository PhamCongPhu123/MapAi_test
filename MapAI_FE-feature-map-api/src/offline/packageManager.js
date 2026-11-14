import { db } from './db';
import { DATA_ROOT, PACKAGE_ID } from './constants';
import { isOffline } from './network';

let installing;
const digest = async buffer => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)))
  .map(b => b.toString(16).padStart(2, '0')).join('');

async function download(path) {
  if (isOffline()) throw new Error('Hãy kết nối mạng và tắt giả lập để tải hoặc đồng bộ gói dữ liệu.');
  const response = await fetch(`${DATA_ROOT}${path}`, { cache: 'no-cache', signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Không tải được ${path} (${response.status}). Gói cũ vẫn được giữ lại.`);
  return response;
}

export async function getInstalledPackage() {
  const pkg = await db.packages.get(PACKAGE_ID);
  if (!pkg) return null;
  // Do not advertise readiness if IndexedDB was partially removed/evicted.
  const [assets, count] = await Promise.all([db.assets.bulkGet(pkg.assets.map(a => a.path)), db.places.count()]);
  return assets.every(Boolean) && count === pkg.placeCount ? pkg : null;
}

export function installPackage(onProgress = () => {}) {
  if (installing) return installing;
  installing = (async () => {
    const manifest = await (await download('manifest.json')).json();
    if (manifest.id !== PACKAGE_ID || !Array.isArray(manifest.assets) || !manifest.assets.length ||
        !manifest.assets.every(a => /^[\w ./-]+$/.test(a.path) && !a.path.includes('..') && Number.isFinite(a.bytes))) {
      throw new Error('Gói dữ liệu không hợp lệ.');
    }
    const assets = [];
    let completed = 0;
    for (const entry of manifest.assets) {
      const response = await download(entry.path);
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength !== entry.bytes || await digest(buffer) !== entry.sha256) {
        throw new Error(`Dữ liệu ${entry.path} không toàn vẹn. Hãy thử tải lại; gói cũ vẫn an toàn.`);
      }
      assets.push({ path: entry.path, blob: new Blob([buffer], { type: response.headers.get('content-type') || '' }) });
      completed += entry.bytes;
      onProgress(Math.round(completed / manifest.bytes * 100));
    }
    const places = JSON.parse(await assets.find(a => a.path === 'places.json').blob.text());
    const graph = JSON.parse(await assets.find(a => a.path === 'roads.json').blob.text());
    if (!places.length || !graph.nodes?.length || !graph.edges?.length || !assets.some(a => a.path === 'danang.pmtiles')) {
      throw new Error('Gói thiếu bản đồ, địa điểm hoặc mạng lưới đường.');
    }
    const pkg = { ...manifest, installedAt: Date.now(), placeCount: places.length };
    // One atomic commit: interruption, quota errors or bad downloads cannot destroy a working package.
    await db.transaction('rw', db.packages, db.assets, db.places, async () => {
      await db.assets.clear();
      await db.assets.bulkPut(assets);
      await db.places.clear();
      await db.places.bulkPut(places);
      await db.packages.put(pkg);
    });
    return pkg;
  })().finally(() => { installing = undefined; });
  return installing;
}

export async function loadPackage() {
  const pkg = await getInstalledPackage();
  if (!pkg) return null;
  const [places, roadAsset, mapAsset, geographyAsset] = await Promise.all([
    db.places.toArray(), db.assets.get('roads.json'), db.assets.get('danang.pmtiles'), db.assets.get('geography.json'),
  ]);
  return { pkg, places, graph: JSON.parse(await roadAsset.blob.text()), mapBlob: mapAsset.blob,
    geography: JSON.parse(await geographyAsset.blob.text()) };
}

export async function deletePackage() {
  await db.transaction('rw', db.packages, db.assets, db.places, db.routes, async () => {
    await Promise.all([db.packages.clear(), db.assets.clear(), db.places.clear(), db.routes.clear()]);
  });
  // Keep personal favorites and history. Also remove the package's precache copies.
  for (const key of await caches.keys()) {
    const cache = await caches.open(key);
    for (const request of await cache.keys()) {
      if (new URL(request.url).pathname.startsWith(DATA_ROOT)) await cache.delete(request);
    }
  }
}

export async function localAssetUrl(path) {
  const asset = await db.assets.get(path);
  return asset ? URL.createObjectURL(asset.blob) : null;
}
