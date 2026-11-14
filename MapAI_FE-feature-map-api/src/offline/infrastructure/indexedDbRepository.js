import { liveQuery } from 'dexie';
import { db, toggleFavorite, recordVisit, rememberRoute } from './db';

export const indexedDbRepository = {
  getPackage: () => db.packages.get('danang'),
  async isComplete(pkg) {
    const [assets, count] = await Promise.all([db.assets.bulkGet(pkg.assets.map(a => a.path)), db.places.count()]);
    return assets.every(Boolean) && count === pkg.placeCount;
  },
  listPlaces: () => db.places.toArray(), readAsset: path => db.assets.get(path),
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
