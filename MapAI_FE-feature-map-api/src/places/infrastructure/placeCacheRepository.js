import { db } from '../../offline/infrastructure/db';
import { mergePlaces, unifiedPlace, validPlace } from '../application/unifiedPlace.js';
const TTL = 7 * 24 * 60 * 60 * 1000, MAX = 1000;
export const placeCacheRepository = {
  async all() {
    const [packaged, cached] = await Promise.all([db.osmPois.toArray(), db.osmCache.where('cachedAt').above(Date.now() - TTL).toArray()]);
    return mergePlaces([...packaged, ...cached]);
  },
  async remember(places) {
    const incoming = places.map(unifiedPlace).filter(validPlace);
    if (!incoming.length) return;
    await db.transaction('rw', db.osmCache, async () => {
      for (const place of incoming) {
        const old = await db.osmCache.get(place.canonicalId);
        await db.osmCache.put({ ...place, mapaiId: place.mapaiId || old?.mapaiId, cachedAt: Date.now() });
      }
      await db.osmCache.where('cachedAt').below(Date.now() - TTL).delete();
      const stale = await db.osmCache.orderBy('cachedAt').reverse().offset(MAX).primaryKeys();
      await db.osmCache.bulkDelete(stale);
    });
    window.dispatchEvent(new Event('mapai:places-cache-changed'));
  },
};
