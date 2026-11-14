import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createOfflineService } from '../../src/offline/application/createOfflineService.js';

function fixture({ embedded = false, offline = true, corrupt = false } = {}) {
  const contents = { 'places.json': JSON.stringify([{ id: 'bridge' }]), 'roads.json': JSON.stringify({ nodes: [[108, 16]], edges: [[0, 0]] }), 'danang.pmtiles': 'map', 'geography.json': '{}' };
  const manifest = { id: 'danang', mapProvider: 'openfreemap', assets: Object.entries(contents).map(([path, content]) => ({ path, bytes: Buffer.byteLength(content), sha256: createHash('sha256').update(content).digest('hex') })) };
  manifest.bytes = manifest.assets.reduce((n, a) => n + a.bytes, 0);
  let commits = 0, pkg = { version: 'old' };
  const repository = { async replacePackage(next) { commits++; pkg = next; }, getPackage: async () => pkg, isComplete: async () => true };
  const service = createOfflineService({ repository, source: { embedded, toBlob: b => new Blob([b]),
    read: async p => new Response(p === 'manifest.json' ? JSON.stringify(manifest) : corrupt && p === 'roads.json' ? '{}' : contents[p]) },
    checksum: async b => createHash('sha256').update(Buffer.from(b)).digest('hex'), connectivity: { isOffline: () => offline } });
  return { service, commits: () => commits, pkg: () => pkg };
}
test('embedded APK data initializes during airplane mode without a network permission exception', async () => {
  const f = fixture({ embedded: true });
  const installed = await f.service.installPackage();
  assert.equal(installed.placeCount, 1); assert.equal(f.commits(), 1);
});
test('web installation refuses disconnected downloads without mutating the existing package', async () => {
  const f = fixture();
  await assert.rejects(f.service.installPackage(), /kết nối mạng/);
  assert.equal(f.commits(), 0); assert.equal(f.pkg().version, 'old');
});
test('corrupt embedded assets never partially overwrite an installed package', async () => {
  const f = fixture({ embedded: true, corrupt: true });
  await assert.rejects(f.service.installPackage(), /không toàn vẹn/);
  assert.equal(f.commits(), 0); assert.equal(f.pkg().version, 'old');
});
