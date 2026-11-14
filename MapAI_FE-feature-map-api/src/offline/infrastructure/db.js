import Dexie from 'dexie';

export const db = new Dexie('mapai-offline');
db.version(1).stores({
  packages: 'id', assets: 'path', places: 'id, category, district',
  favorites: 'placeId, savedAt', history: 'placeId, visitedAt', routes: 'id, createdAt',
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
