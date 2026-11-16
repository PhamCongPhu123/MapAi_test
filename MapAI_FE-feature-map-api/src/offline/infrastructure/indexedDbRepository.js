import { liveQuery } from 'dexie';
import { db, toggleFavorite, recordVisit, rememberRoute } from './db';
import { placeCacheRepository } from '../../places/infrastructure/placeCacheRepository';
import { mergePlaces } from '../../places/application/unifiedPlace.js';

export const indexedDbRepository = {
  getPackage: () => db.packages.get('danang'),
  async isComplete(pkg) {
    const [assets, count] = await Promise.all([db.assets.bulkGet(pkg.assets.map(a => a.path)), db.places.count()]);
    return assets.every(Boolean) && count === pkg.placeCount && (!pkg.osmIndex || await db.osmPois.count() === pkg.osmIndex.count);
  },
  listPlaces: async () => {
    const [base, server] = await Promise.all([db.places.toArray(), db.serverPlaces.toArray()]);
    const bounds = (await db.packages.get('danang'))?.bounds;
    const inside = p => bounds && p.lng >= bounds[0] && p.lat >= bounds[1] && p.lng <= bounds[2] && p.lat <= bounds[3];
    return mergePlaces([...base.map(p => ({ ...p, localId: p.id })), ...server.filter(inside).map(p => ({ ...p, serverId: p.id, source: 'mapai', category: p.sourceType === 'openstreetmap' ? p.category : /cafe|cà phê/i.test(p.category) ? 'food' : /ăn|food|restaurant/i.test(p.category) ? 'food' : 'sightseeing', tags: /cafe|cà phê/i.test(p.category) ? ['ca phe'] : [] })), ...await placeCacheRepository.all()]);
  }, readAsset: path => db.assets.get(path),
  async replacePackage(pkg, places, assets, osmPlaces = []) {
    await db.transaction('rw', db.packages, db.assets, db.places, db.osmPois, async () => {
      await db.assets.clear(); await db.assets.bulkPut(assets);
      await db.places.clear(); await db.places.bulkPut(places);
      await db.osmPois.clear(); await db.osmPois.bulkPut(osmPlaces); await db.packages.put(pkg);
    });
  },
  async deletePackage() {
    await db.transaction('rw', db.packages, db.assets, db.places, db.osmPois, db.routes, async () => {
      await Promise.all([db.packages.clear(), db.assets.clear(), db.places.clear(), db.osmPois.clear(), db.routes.clear()]);
    });
  },
  toggleFavorite, recordVisit, rememberRoute,
  subscribePersonal(observer) {
    return liveQuery(async () => ({ favorites: new Set((await db.favorites.toArray()).map(f => f.placeId)),
      history: await db.history.orderBy('visitedAt').reverse().toArray() })).subscribe(observer);
  },
  async assetUrl(path) { const asset = await db.assets.get(path); return asset ? URL.createObjectURL(asset.blob) : null; },
};
