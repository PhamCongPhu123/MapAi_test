import { liveQuery } from 'dexie';
import { db, toggleFavorite, recordVisit, rememberRoute } from './db';

export const indexedDbRepository = {
  getPackage: () => db.packages.get('danang'),
  async isComplete(pkg) {
    const [assets, count] = await Promise.all([db.assets.bulkGet(pkg.assets.map(a => a.path)), db.places.count()]);
    return assets.every(Boolean) && count === pkg.placeCount;
  },
  listPlaces: async () => {
    const [base, server] = await Promise.all([db.places.toArray(), db.serverPlaces.toArray()]);
    const bounds = (await db.packages.get('danang'))?.bounds;
    const inside = p => bounds && p.lng >= bounds[0] && p.lat >= bounds[1] && p.lng <= bounds[2] && p.lat <= bounds[3];
    return [...base, ...server.filter(inside).map(p => ({ ...p, serverId: p.id, source: 'mapai', category: /cafe|cà phê/i.test(p.category) ? 'food' : /ăn|food|restaurant/i.test(p.category) ? 'food' : 'sightseeing', tags: /cafe|cà phê/i.test(p.category) ? ['ca phe'] : [] }))];
  }, readAsset: path => db.assets.get(path),
  async replacePackage(pkg, places, assets) {
    await db.transaction('rw', db.packages, db.assets, db.places, async () => {
      await db.assets.clear(); await db.assets.bulkPut(assets);
      await db.places.clear(); await db.places.bulkPut(places); await db.packages.put(pkg);
    });
  },
  async deletePackage() {
    await db.transaction('rw', db.packages, db.assets, db.places, db.routes, async () => {
      await Promise.all([db.packages.clear(), db.assets.clear(), db.places.clear(), db.routes.clear()]);
    });
  },
  toggleFavorite, recordVisit, rememberRoute,
  subscribePersonal(observer) {
    return liveQuery(async () => ({ favorites: new Set((await db.favorites.toArray()).map(f => f.placeId)),
      history: await db.history.orderBy('visitedAt').reverse().toArray() })).subscribe(observer);
  },
  async assetUrl(path) { const asset = await db.assets.get(path); return asset ? URL.createObjectURL(asset.blob) : null; },
};
