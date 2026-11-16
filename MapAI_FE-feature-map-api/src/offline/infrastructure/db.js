import Dexie from 'dexie';

export const db = new Dexie('mapai-offline');
db.version(1).stores({
  packages: 'id', assets: 'path', places: 'id, category, district',
  favorites: 'placeId, savedAt', history: 'placeId, visitedAt', routes: 'id, createdAt',
});

// Account data and public catalogue overlays survive deleting the base map package.
db.version(2).stores({
  accountFavorites: 'key, owner', syncOutbox: 'key, owner, notBefore', syncMeta: 'key',
  syncDrafts: 'key, owner', serverPlaces: 'id',
}).upgrade(async transaction => {
  for (const favorite of await transaction.table('favorites').toArray()) {
    const base = await transaction.table('places').get(favorite.placeId);
    if (!base) continue;
    const place = { key: `seed:${base.id}`, id: `offline:${base.id}`, localId: base.id, name: base.name,
      lat: base.lat, lng: base.lng, address: base.address || '', description: base.description || '',
      category: base.category, district: base.district || '', source: 'offline' };
    await transaction.table('accountFavorites').put({ key: `guest|${place.key}`, owner: 'guest', place, deleted: false, updatedAt: favorite.savedAt });
  }
});

db.version(3).stores({
  osmPois: 'canonicalId, normalizedName, categoryMapping',
  osmCache: 'canonicalId, normalizedName, categoryMapping, cachedAt',
});

// Favorites/history belong to this browser, independently of online accounts.
export async function toggleFavorite(placeId) {
  await db.transaction('rw', db.favorites, async () => {
    if (await db.favorites.get(placeId)) await db.favorites.delete(placeId);
    else await db.favorites.put({ placeId, savedAt: Date.now() });
  });
}

export async function recordVisit(placeId) {
  await db.transaction('rw', db.history, async () => {
    await db.history.put({ placeId, visitedAt: Date.now() });
    const stale = await db.history.orderBy('visitedAt').reverse().offset(50).primaryKeys();
    await db.history.bulkDelete(stale);
  });
}

export async function rememberRoute(route) {
  await db.transaction('rw', db.routes, async () => {
    await db.routes.put({ ...route, id: 'latest', createdAt: Date.now() });
  });
}
