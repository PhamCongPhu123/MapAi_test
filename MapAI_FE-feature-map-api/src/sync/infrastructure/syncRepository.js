import { liveQuery } from 'dexie';
import { db } from '../../offline/infrastructure/db';
import { localPlace } from '../../map/application/createMapService';
const favoriteId = (owner, key) => `${owner}|${key}`;
const jobId = (owner, key) => `${owner}|favorite:${key}`;

export const syncRepository = {
  async personal(owner) {
    const [favoriteRows, jobs, history, meta, catalog] = await Promise.all([
      db.accountFavorites.where('owner').equals(owner).toArray(), db.syncOutbox.where('owner').equals(owner).toArray(),
      db.history.orderBy('visitedAt').reverse().toArray(), db.syncMeta.get(`account:${owner}`), db.syncMeta.get('catalog'),
    ]);
    return { favoriteRows, jobs, history, mergedCount: meta?.mergedCount || 0, lastSynced: meta?.lastSynced || null, catalogVersion: catalog?.version || null };
  },
  watch(fn) { return liveQuery(async () => {
    await Promise.all([db.accountFavorites.toArray(), db.syncOutbox.toArray(), db.history.toArray(), db.syncMeta.toArray()]); return true;
  }).subscribe({ next: fn, error: error => window.dispatchEvent(new CustomEvent('mapai:sync-storage-error', { detail: error.message })) }); },
  async resolvePlace(id) {
    const place = await db.places.get(String(id).replace(/^seed:|^offline:/, ''));
    if (!place) throw new Error('Chưa có thông tin địa điểm trên thiết bị.');
    return localPlace(place);
  },
  async toggleFavorite(owner, place, now, id) {
    return db.transaction('rw', db.accountFavorites, db.syncOutbox, async () => {
      const key = favoriteId(owner, place.key), current = await db.accountFavorites.get(key);
      const deleted = current ? !current.deleted : false, notBefore = now + (deleted ? 4000 : 0);
      await db.accountFavorites.put({ key, owner, place, deleted, updatedAt: now, operationId: id });
      if (owner !== 'guest') await db.syncOutbox.put({ key: jobId(owner, place.key), id, owner, kind: 'favorite', payload: { place, deleted }, createdAt: now, notBefore, attempts: 0 });
      return { id, deleted, notBefore };
    });
  },
  async undoFavorite(owner, undo, now, id) {
    await db.transaction('rw', db.accountFavorites, db.syncOutbox, async () => {
      const row = await db.accountFavorites.get(favoriteId(owner, undo.key));
      if (!row || row.operationId !== undo.id || !row.deleted) return;
      row.deleted = false; row.operationId = id; row.updatedAt = now; await db.accountFavorites.put(row);
      if (owner !== 'guest') await db.syncOutbox.put({ key: jobId(owner, undo.key), id, owner, kind: 'favorite', payload: { place: row.place, deleted: false }, createdAt: now, notBefore: now, attempts: 0 });
    });
  },
  async mergeGuest(owner, now, id) {
    await db.transaction('rw', db.accountFavorites, db.syncOutbox, db.syncMeta, async () => {
      const guests = await db.accountFavorites.where('owner').equals('guest').toArray(); let count = 0;
      for (const row of guests.filter(r => !r.deleted)) {
        const key = favoriteId(owner, row.place.key), existing = await db.accountFavorites.get(key);
        if (!existing || existing.deleted) {
          const operationId = id();
          await db.accountFavorites.put({ ...row, key, owner, operationId, updatedAt: now });
          await db.syncOutbox.put({ key: jobId(owner, row.place.key), id: operationId, owner, kind: 'favorite', payload: { place: row.place, deleted: false }, createdAt: now, notBefore: now, attempts: 0 });
          count++;
        }
      }
      await db.accountFavorites.bulkDelete(guests.map(g => g.key));
      if (count) { const key = `account:${owner}`, meta = await db.syncMeta.get(key); await db.syncMeta.put({ ...meta, key, mergedCount: (meta?.mergedCount || 0) + count }); }
    });
  },
  ready: (owner, now) => db.syncOutbox.where('owner').equals(owner).filter(j => !j.blocked && j.notBefore <= now).sortBy('createdAt'),
  async enqueue(job) { await db.syncOutbox.put(job); },
  async updateUpload(job, thumbnail) {
    const current = await db.syncOutbox.get(job.key);
    if (current?.id === job.id) await db.syncOutbox.update(job.key, { payload: { ...job.payload, thumbnail } });
  },
  async ack(job) {
    await db.transaction('rw', db.syncOutbox, db.accountFavorites, async () => {
      const current = await db.syncOutbox.get(job.key);
      if (current?.id !== job.id) return;
      await db.syncOutbox.delete(job.key);
    });
  },
  async fail(job, changes) {
    await db.transaction('rw', db.syncOutbox, async () => {
      if ((await db.syncOutbox.get(job.key))?.id === job.id) await db.syncOutbox.update(job.key, changes);
    });
  },
  async retry(owner) { await db.syncOutbox.where('owner').equals(owner).modify({ blocked: false, notBefore: 0, error: '' }); },
  async applyRemote(owner, records, now) {
    await db.transaction('rw', db.accountFavorites, db.syncOutbox, db.syncMeta, async () => {
      const jobs = await db.syncOutbox.where('owner').equals(owner).toArray();
      const pending = new Set(jobs.filter(j => j.kind === 'favorite').map(j => j.payload.place.key));
      const remoteKeys = new Set(records.map(r => r.place.key));
      const existing = await db.accountFavorites.where('owner').equals(owner).toArray();
      await db.accountFavorites.bulkDelete(existing.filter(r => !pending.has(r.place.key) && !remoteKeys.has(r.place.key)).map(r => r.key));
      for (const record of records) if (!pending.has(record.place.key)) await db.accountFavorites.put({ ...record, key: favoriteId(owner, record.place.key), owner });
      const key = `account:${owner}`, meta = await db.syncMeta.get(key);
      await db.syncMeta.put({ ...meta, key, lastSynced: now });
    });
  },
  async dismissMerge(owner) { await db.syncMeta.update(`account:${owner}`, { mergedCount: 0 }); },
  catalog: () => db.syncMeta.get('catalog'),
  touchCatalog: checkedAt => db.syncMeta.update('catalog', { checkedAt }),
  async replaceCatalog(meta, places) {
    await db.transaction('rw', db.serverPlaces, db.syncMeta, async () => {
      await db.serverPlaces.clear(); await db.serverPlaces.bulkPut(places.map(p => ({ ...p, tags: [], category: p.category || 'Khác' })));
      await db.syncMeta.put({ ...meta, key: 'catalog' });
    });
    window.dispatchEvent(new Event('mapai:catalog-changed'));
    window.dispatchEvent(new Event('mapai:places-changed'));
  },
  saveDraft: (owner, kind, id, draft) => db.syncDrafts.put({ key: `${owner}|${kind}:${id}`, owner, ...draft }),
  loadDraft: (owner, kind, id) => db.syncDrafts.get(`${owner}|${kind}:${id}`),
  clearDraft: (owner, kind, id) => db.syncDrafts.delete(`${owner}|${kind}:${id}`),
  async editJob(owner, key, payload, now, id) {
    await db.transaction('rw', db.syncOutbox, async () => {
      const job = await db.syncOutbox.get(key);
      if (job?.owner !== owner || !job.blocked || job.kind === 'favorite') throw new Error('Chỉ sửa được nội dung bị từ chối trong tài khoản hiện tại.');
      await db.syncOutbox.put({ ...job, payload, id, blocked: false, error: '', attempts: 0, notBefore: now });
    });
  },
  async discard(owner, key) { const job = await db.syncOutbox.get(key); if (job?.owner === owner && job.kind !== 'favorite') await db.syncOutbox.delete(key); },
};
