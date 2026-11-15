import { placeKey, savedSnapshot } from './placeIdentity.js';

// Business layer: persistence, HTTP, clock, identity and connectivity are ports.
export function createSyncService({ repository, remote, clock, identity, connectivity, checksum }) {
  const listeners = new Set(), activated = new Set();
  let owner = identity.owner(), generation = 0, running = false, scheduled;
  let state = { owner, favorites: new Set(), favoriteRows: [], pendingKeys: new Set(), history: [], jobs: [],
    syncing: false, pendingCount: 0, error: '', lastSynced: null, mergedCount: 0, undo: null, catalogVersion: null };
  const publish = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  async function refresh() {
    const current = owner, epoch = generation;
    const data = await repository.personal(current);
    if (epoch !== generation) return;
    publish({ ...data, favorites: new Set(data.favoriteRows.filter(f => !f.deleted).map(f => f.place.key)),
      pendingKeys: new Set(data.jobs.filter(j => j.kind === 'favorite').map(j => j.payload.place.key)),
      pendingCount: data.jobs.length, owner: current });
  }
  async function activate(next) {
    next = identity.owner() || 'guest';
    if (owner === next && activated.has(next)) return;
    if (owner !== next) {
    owner = next; generation++;
    publish({ owner, favorites: new Set(), favoriteRows: [], pendingKeys: new Set(), jobs: [], pendingCount: 0,
      error: '', lastSynced: null, mergedCount: 0, undo: null, syncing: false });
    }
    if (next !== 'guest') await repository.mergeGuest(next, clock.now(), clock.id);
    activated.add(next);
    await refresh();
  }
  async function toggleFavorite(input, expectedOwner = identity.owner()) {
    await activate(identity.owner());
    if (expectedOwner !== owner) throw new Error('Tài khoản đã thay đổi. Hãy mở lại địa điểm trước khi lưu.');
    const place = typeof input === 'string' ? await repository.resolvePlace(input) : input;
    const snapshot = savedSnapshot(place), current = owner;
    const mutation = await repository.toggleFavorite(current, snapshot, clock.now(), clock.id());
    if (owner !== current) return mutation;
    publish({ undo: mutation.deleted ? { owner: current, key: snapshot.key, id: mutation.id, until: mutation.notBefore } : null });
    await refresh();
    return mutation;
  }
  async function undoFavorite() {
    const undo = state.undo;
    if (!undo || undo.owner !== owner || undo.until <= clock.now()) return;
    await repository.undoFavorite(owner, undo, clock.now(), clock.id());
    if (undo.owner === owner) { publish({ undo: null }); await refresh(); }
  }
  async function queue(kind, payload, { locationId = null, photo = null, photoName = null, operationId = null, expectedOwner = identity.owner() } = {}) {
    await activate(identity.owner());
    if (expectedOwner !== owner) throw new Error('Tài khoản đã thay đổi. Bản nháp vẫn được giữ trong tài khoản ban đầu.');
    if (owner === 'guest') throw new Error('Hãy đăng nhập khi có mạng để gắn bản nháp vào tài khoản.');
    const job = { owner, id: operationId || clock.id(), kind, payload, locationId, photo, photoName, createdAt: clock.now(), notBefore: clock.now(), attempts: 0 };
    job.key = `${owner}|${kind === 'contribution' ? job.id : `review:${locationId}`}`;
    await repository.enqueue(job); await refresh(); return job;
  }
  async function updateCatalog(manual) {
    if (!connectivity.enabled() || connectivity.offline() || (!manual && !connectivity.wifi())) return;
    const previous = await repository.catalog();
    if (!manual && previous?.checkedAt > clock.now() - 15 * 60 * 1000) return;
    const result = await remote.catalog(previous?.version);
    if (result) {
      if (typeof result.payload !== 'string' || result.payload.length > 20 * 1024 * 1024 || await checksum(result.payload) !== result.sha256 || result.version !== result.sha256)
        throw new Error('Gói địa điểm mới không toàn vẹn. Dữ liệu cũ vẫn được giữ.');
      const places = JSON.parse(result.payload);
      if (!Array.isArray(places) || places.some(p => !p.id || p.source !== 'mapai' || p.key !== `mapai:${p.id}`)) throw new Error('Gói địa điểm không hợp lệ.');
      places.forEach(savedSnapshot);
      await repository.replaceCatalog({ version: result.version, checkedAt: clock.now() }, places);
    } else await repository.touchCatalog(clock.now());
    publish({ catalogVersion: result?.version || previous?.version || null });
  }
  async function sync({ manual = false, retry = false } = {}) {
    if (running) { if (manual || retry) scheduled = { manual: manual || scheduled?.manual, retry: retry || scheduled?.retry }; return; }
    if (connectivity.offline() || !connectivity.enabled()) return;
    // Claim the run before the first await: reconnect and auth restoration can fire together.
    running = true;
    try { await activate(identity.owner()); }
    catch (error) { running = false; publish({ error: error.message }); return; }
    const current = owner, epoch = generation;
    publish({ syncing: true, error: '' });
    try {
      if (retry) await repository.retry(current);
      if (current !== 'guest') {
        const jobs = await repository.ready(current, clock.now());
        for (const job of jobs) {
          if (generation !== epoch || connectivity.offline() || identity.owner() !== current) return;
          try {
            if (job.photo && !job.payload.thumbnail) {
              const thumbnail = await remote.upload(job.photo, job.photoName, current);
              job.payload = { ...job.payload, thumbnail };
              await repository.updateUpload(job, thumbnail);
            }
            await remote.push(job, current);
            await repository.ack(job);
          } catch (error) {
            await repository.fail(job, { error: error.message, blocked: error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status),
              attempts: (job.attempts || 0) + 1, notBefore: clock.now() + Math.min(300000, 5000 * 2 ** Math.min(job.attempts || 0, 6)) });
            throw error;
          }
        }
        if (generation !== epoch || connectivity.offline() || identity.owner() !== current) return;
        const favorites = await remote.pull(current);
        if (!Array.isArray(favorites)) throw new Error('Máy chủ chưa hỗ trợ đồng bộ yêu thích. Dữ liệu vẫn nằm trên thiết bị.');
        favorites.forEach(f => savedSnapshot(f.place));
        await repository.applyRemote(current, favorites, clock.now());
      }
      if (generation === epoch) { publish({ lastSynced: current === 'guest' ? null : clock.now() }); await refresh(); }
      await updateCatalog(manual);
    } catch (error) { if (generation === epoch) publish({ error: error.message || 'Chưa đồng bộ được. Dữ liệu vẫn được giữ trên máy.' }); }
    finally {
      running = false;
      if (generation === epoch) { publish({ syncing: false }); await refresh(); }
      const next = scheduled; scheduled = null;
      if (next || generation !== epoch) void sync(next || {});
    }
  }
  return { refresh, activate, toggleFavorite, undoFavorite, queue, sync, getSnapshot: () => state,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    async tick() {
      if (state.undo?.until <= clock.now()) publish({ undo: null });
      if (state.jobs.some(j => !j.blocked && j.notBefore <= clock.now()) && !state.error) await sync();
    },
    async dismissMerge() { await repository.dismissMerge(owner); await refresh(); },
    saveDraft: (kind, id, draft, draftOwner = identity.owner()) => repository.saveDraft(draftOwner, kind, id, draft),
    loadDraft: (kind, id, draftOwner = identity.owner()) => repository.loadDraft(draftOwner, kind, id),
    clearDraft: (kind, id, draftOwner = identity.owner()) => repository.clearDraft(draftOwner, kind, id),
    async editJob(key, payload) {
      await repository.editJob(owner, key, payload, clock.now(), clock.id()); await refresh();
    },
    async discardJob(key) { await repository.discard(owner, key); await refresh(); },
    placeKey,
  };
}
