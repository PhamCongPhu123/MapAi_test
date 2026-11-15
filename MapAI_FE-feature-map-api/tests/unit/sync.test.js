import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSyncService } from '../../src/sync/application/createSyncService.js';
import { savedSnapshot, placeKey, offlineAvailability } from '../../src/sync/application/placeIdentity.js';
const place = { id: 'offline:mi-ba-mua', localId: 'mi-ba-mua', name: 'Mì Quảng Bà Mua', lat: 16.06, lng: 108.22 };
function fixture() {
  let owner = 'alice', offline = true, wifi = true, now = 100000, counter = 0, catalog;
  const jobs = [], events = [], rows = [];
  const repository = {
    personal: async current => ({ favoriteRows: rows.filter(r => r.owner === current), jobs: jobs.filter(j => j.owner === current), history: [] }),
    mergeGuest: async () => {},
    ready: async (current, time) => jobs.filter(j => j.owner === current && !j.blocked && j.notBefore <= time),
    enqueue: async job => { jobs.push(job); events.push(['persist', job.id]); },
    ack: async job => { jobs.splice(jobs.indexOf(job), 1); events.push(['ack', job.id]); },
    fail: async (job, data) => Object.assign(job, data), retry: async () => {},
    applyRemote: async (current, records) => events.push(['pull', current, records]),
    catalog: async () => catalog,
    replaceCatalog: async (meta, records) => { catalog = meta; events.push(['catalog', records]); },
    touchCatalog: async time => { catalog.checkedAt = time; },
  };
  const remote = { push: async job => { events.push(['push', job.id]); return {}; }, pull: async () => [], catalog: async () => null };
  const checksum = text => createHash('sha256').update(text).digest('hex');
  const service = createSyncService({ repository, remote, clock: { now: () => now, id: () => `operation-${++counter}` },
    identity: { owner: () => owner }, connectivity: { enabled: () => true, offline: () => offline, wifi: () => wifi }, checksum });
  return { service, repository, remote, jobs, rows, events, checksum, setOwner: value => { owner = value; }, connect: () => { offline = false; }, cellular: () => { wifi = false; }, advance: ms => { now += ms; } };
}
test('offline submissions are persisted before any network request and replay after reconnect', async () => {
  const f = fixture(); await f.service.queue('review', { rating: 5, comment: 'Ngon' }, { locationId: 'server-id' });
  await f.service.sync(); assert.equal(f.events.length, 1); assert.equal(f.jobs.length, 1);
  f.connect(); await f.service.sync();
  assert.deepEqual(f.events.slice(0, 3).map(e => e[0]), ['persist', 'push', 'ack']); assert.equal(f.jobs.length, 0);
});
test('a lost acknowledgement keeps the same operation ID for retry', async () => {
  const f = fixture(); f.connect(); await f.service.queue('contribution', { title: 'Cafe' });
  const id = f.jobs[0].id; let attempts = 0;
  f.remote.push = async job => { assert.equal(job.id, id); if (++attempts === 1) throw new TypeError('Network lost'); };
  await f.service.sync(); assert.equal(f.jobs.length, 1); assert.match(f.service.getSnapshot().error, /Network/);
  f.advance(6000); await f.service.sync(); assert.equal(attempts, 2); assert.equal(f.jobs.length, 0);
});
test('permanent errors stay queued and do not repeatedly send until explicit retry', async () => {
  const f = fixture(); f.connect(); await f.service.queue('review', { rating: 9 }, { locationId: 'id' });
  f.remote.push = async () => { const error = new Error('Invalid rating'); error.status = 400; throw error; };
  await f.service.sync(); assert.equal(f.jobs[0].blocked, true); assert.equal(f.jobs.length, 1);
  f.advance(999999); await f.service.sync(); assert.equal(f.jobs[0].attempts, 1);
});
test('changing accounts while a send is in flight never pulls private data into the new account', async () => {
  const f = fixture(); f.connect(); await f.service.queue('review', { rating: 5 }, { locationId: 'id' });
  let release; const pending = new Promise(resolve => { release = resolve; });
  f.remote.push = async () => pending;
  const sending = f.service.sync();
  await new Promise(resolve => setImmediate(resolve));
  f.setOwner('bob'); await f.service.activate('bob'); release(); await sending;
  assert.equal(f.service.getSnapshot().owner, 'bob');
  assert.ok(!f.events.some(e => e[0] === 'pull' && e[1] === 'alice'));
});
test('guest contributions are refused while favorites still have stable identities', async () => {
  const f = fixture(); f.setOwner('guest');
  await assert.rejects(f.service.queue('contribution', { title: 'Cafe' }), /đăng nhập/);
  assert.equal(f.jobs.length, 0);
  assert.equal(placeKey(place), 'seed:mi-ba-mua'); assert.equal(savedSnapshot(place).key, 'seed:mi-ba-mua');
  assert.equal(placeKey({ id: 'abc', source: 'mapai' }), 'mapai:abc');
  assert.equal(offlineAvailability(place, { places: [{ id: 'mi-ba-mua' }] }), true);
  assert.equal(offlineAvailability(place, null), false);
});
test('public catalogue update verifies checksum before replacing existing data and respects Wi-Fi', async () => {
  const f = fixture(); f.connect(); f.cellular();
  const payload = JSON.stringify([{ key: 'mapai:approved', id: 'approved', source: 'mapai', name: 'Cafe', lat: 16.06, lng: 108.22 }]);
  f.remote.catalog = async () => ({ payload, version: f.checksum(payload), sha256: f.checksum(payload) });
  await f.service.sync(); assert.ok(!f.events.some(e => e[0] === 'catalog'));
  await f.service.sync({ manual: true }); assert.equal(f.events.filter(e => e[0] === 'catalog').length, 1);
  f.remote.catalog = async () => ({ payload: payload + ' ', version: f.checksum(payload), sha256: f.checksum(payload) });
  await f.service.sync({ manual: true }); assert.equal(f.events.filter(e => e[0] === 'catalog').length, 1);
  assert.match(f.service.getSnapshot().error, /không toàn vẹn/);
});

test('simultaneous reconnect and authentication callbacks run a single upload/send', async () => {
  const f = fixture(); f.connect();
  await f.service.queue('contribution', { title: 'Cafe' }, { photo: new Blob(['photo']) });
  let uploads = 0, pushes = 0;
  f.repository.updateUpload = async () => {};
  f.remote.upload = async () => { uploads++; await new Promise(resolve => setImmediate(resolve)); return 'https://images.example.test/photo.jpg'; };
  f.remote.push = async () => { pushes++; };
  await Promise.all([f.service.sync(), f.service.sync(), f.service.sync()]);
  assert.equal(uploads, 1); assert.equal(pushes, 1); assert.equal(f.jobs.length, 0);
});

test('a form opened for the previous account cannot queue data under the new login', async () => {
  const f = fixture(); f.setOwner('bob');
  await assert.rejects(f.service.queue('review', { rating: 5, comment: 'Alice draft' }, { locationId: 'id', expectedOwner: 'alice' }), /Tài khoản đã thay đổi/);
  assert.equal(f.jobs.length, 0);
  const writes = [];
  f.repository.saveDraft = async (owner, kind, id, draft) => writes.push({ owner, draft });
  await f.service.saveDraft('review', 'id', { comment: 'Alice draft' }, 'alice');
  assert.equal(writes[0].owner, 'alice');
});


test('restoring an already cached login still merges guest records left by an interrupted login', async () => {
  const f = fixture(); let merges = 0;
  f.repository.mergeGuest = async account => { assert.equal(account, 'alice'); merges++; };
  await f.service.activate('alice'); await f.service.activate('alice');
  assert.equal(merges, 1);
});
