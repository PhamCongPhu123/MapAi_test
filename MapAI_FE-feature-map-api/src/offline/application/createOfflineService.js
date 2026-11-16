import { osmIdentity, unifiedPlace, validPlace } from '../../places/application/unifiedPlace.js';
// Business/use-case layer. All storage, network, native and worker operations are injected ports.
export function createOfflineService({ repository, source, checksum, connectivity, storage, router, location, personal }) {
  let installing, loadedGraph;
  async function getInstalledPackage() {
    const pkg = await repository.getPackage();
    if (!pkg || pkg.mapProvider !== 'openfreemap') return null;
    return await repository.isComplete(pkg) ? pkg : null;
  }
  function installPackage(onProgress = () => {}) {
    if (installing) return installing;
    installing = (async () => {
      if (!source.embedded && connectivity.isOffline()) throw new Error('Hãy kết nối mạng và tắt giả lập để tải hoặc đồng bộ gói dữ liệu.');
      const manifest = await (await source.read('manifest.json')).json();
      if (manifest.id !== 'danang' || manifest.mapProvider !== 'openfreemap' || !Array.isArray(manifest.assets) || !manifest.assets.length ||
          !manifest.assets.every(a => /^[\w ./@-]+$/.test(a.path) && !a.path.includes('..') && Number.isFinite(a.bytes))) throw new Error('Gói dữ liệu không hợp lệ.');
      let completed = 0;
      const assets = [];
      for (const entry of manifest.assets) {
        if (!source.embedded && connectivity.isOffline()) throw new Error('Đã mất mạng. Gói cũ vẫn được giữ lại; hãy thử lại khi có kết nối.');
        const response = await source.read(entry.path), buffer = await response.arrayBuffer();
        if (buffer.byteLength !== entry.bytes || await checksum(buffer) !== entry.sha256) throw new Error(`Dữ liệu ${entry.path} không toàn vẹn. Hãy thử tải lại; gói cũ vẫn an toàn.`);
        assets.push({ path: entry.path, blob: source.toBlob(buffer, response.headers.get('content-type')) });
        completed += entry.bytes; onProgress(Math.round(completed / manifest.bytes * 100));
      }
      const places = JSON.parse(await assets.find(a => a.path === 'places.json').blob.text());
      const graph = JSON.parse(await assets.find(a => a.path === 'roads.json').blob.text());
      if (!places.length || !graph.nodes?.length || !graph.edges?.length || !assets.some(a => a.path === 'danang.pmtiles')) throw new Error('Gói thiếu bản đồ, địa điểm hoặc mạng lưới đường.');
      const pkg = { ...manifest, installedAt: Date.now(), placeCount: places.length };
      const osmIndex = assets.find(a => a.path === 'osm-pois.json');
      const osmPlaces = osmIndex ? JSON.parse(await osmIndex.blob.text()).places : [];
      if (manifest.osmIndex && (!Array.isArray(osmPlaces) || osmPlaces.length !== manifest.osmIndex.count || osmPlaces.some(p => !osmIdentity(p) || !validPlace(p) || p.lng < manifest.bounds[0] || p.lng > manifest.bounds[2] || p.lat < manifest.bounds[1] || p.lat > manifest.bounds[3]))) throw new Error('Chỉ mục tiện ích OSM không hợp lệ.');
      await repository.replacePackage(pkg, places, assets, osmPlaces.map(unifiedPlace));
      loadedGraph = graph;
      return pkg;
    })().finally(() => { installing = undefined; });
    return installing;
  }
  async function loadPackage() {
    const pkg = await getInstalledPackage();
    if (!pkg || pkg.mapProvider !== 'openfreemap') return null;
    const [places, roads, map, geography] = await Promise.all([repository.listPlaces(), repository.readAsset('roads.json'), repository.readAsset('danang.pmtiles'), repository.readAsset('geography.json')]);
    loadedGraph = JSON.parse(await roads.blob.text());
    return { pkg, places, mapBlob: map.blob, geography: JSON.parse(await geography.blob.text()) };
  }
  return {
    embedded: source.embedded, installPackage, loadPackage, getInstalledPackage,
    async deletePackage() { await repository.deletePackage(); await source.removeCachedAssets(); loadedGraph = undefined; },
    toggleFavorite: place => personal ? personal.toggleFavorite(place) : repository.toggleFavorite(place), recordVisit: id => repository.recordVisit(id),
    subscribePersonal: observer => {
      if (!personal) return repository.subscribePersonal(observer);
      observer.next(personal.getSnapshot());
      const unsubscribe = personal.subscribe(() => observer.next(personal.getSnapshot()));
      return { unsubscribe };
    },
    readAsset: path => repository.readAsset(path), localAssetUrl: path => repository.assetUrl(path),
    async calculateRoute(origin, destination, mode) {
      if (!loadedGraph) await loadPackage();
      if (!loadedGraph) throw new Error('Chưa có dữ liệu đường bộ.');
      const result = await router.route(loadedGraph, origin, destination, mode);
      // A full cache must not prevent an otherwise valid route from being shown.
      await repository.rememberRoute(result).catch(() => {});
      return result;
    },
    getLocation: () => location(), storageStatus: () => storage.status(), persistData: () => storage.persist(),
  };
}
