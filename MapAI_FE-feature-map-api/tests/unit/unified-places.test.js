import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { unifiedPlace, mergePlaces, osmIdentity } from '../../src/places/application/unifiedPlace.js';
import { createMapService } from '../../src/map/application/createMapService.js';
import { savedSnapshot, placeKey } from '../../src/sync/application/placeIdentity.js';
const osm = { osmType: 'node', osmId: '11363578173', name: 'Viet Han (to Hoi An)', sourceType: 'openstreetmap', lat: 15.9735166, lng: 108.2545682, osmTags: { highway: 'bus_stop' } };

test('canonical identities survive normalization, saving, and lazy reference enrichment', () => {
  const first = unifiedPlace(osm), linked = unifiedPlace({ ...first, mapaiId: 'database-uuid' });
  assert.equal(first.canonicalId, 'osm:node:11363578173');
  assert.equal(first.categoryMapping, 'bus');
  assert.equal(placeKey(linked), first.canonicalId);
  assert.equal(savedSnapshot(linked).osmId, osm.osmId);
  assert.equal(savedSnapshot(linked).mapaiId, 'database-uuid');
  assert.deepEqual(osmIdentity({ id: first.canonicalId }), { osmType: 'node', osmId: osm.osmId, canonicalId: first.canonicalId });
  assert.equal(unifiedPlace({ id: 'a', name: 'Đại học Việt Hàn', lat: 16, lng: 108 }).normalizedName, 'dai hoc viet han');
});
test('dedup needs both proximity and name similarity, preserving MapAI details and primary identity', () => {
  const base = unifiedPlace({ id: 'curated', name: osm.name, lat: osm.lat + .0001, lng: osm.lng, description: 'Rich description', rating: 4.8 });
  const merged = mergePlaces([base, osm]);
  assert.equal(merged.length, 1); assert.equal(merged[0].description, 'Rich description');
  assert.equal(merged[0].lat, osm.lat); assert.equal(merged[0].canonicalId, 'mapai:curated');
  assert.equal(unifiedPlace(merged[0]).sourceType, 'mapai_curated');
  assert.equal(unifiedPlace(merged[0]).canonicalId, 'mapai:curated');
  assert.equal(mergePlaces([base, { ...osm, lat: osm.lat + .01 }]).length, 2);
  assert.equal(mergePlaces([base, { ...osm, name: 'Một địa điểm khác' }]).length, 2);
});
test('packaged real OSM utilities and cached online results share search, details, and chat offline without imports', async () => {
  const index = JSON.parse(fs.readFileSync(new URL('../../public/offline/osm-pois.json', import.meta.url)));
  assert.ok(index.places.length > 1000); assert.ok(index.attribution.includes('OpenStreetMap'));
  let mode = 'online', remembered = [], calls = 0;
  const remote = { search: async () => { calls++; return [unifiedPlace({ ...osm, osmId: '999123456', name: 'Bến xe buýt Đã Tra Cứu' })]; } };
  const cache = { all: async () => remembered, remember: async p => { remembered = p; } };
  const service = createMapService({ remote, local: {}, cache, getMode: () => mode, getLocalData: () => ({ places: index.places }) });
  await service.search('Đã Tra Cứu'); mode = 'offline';
  assert.equal((await service.search('tram xe buyt da tra cuu'))[0].osmId, '999123456');
  const vietnamKorea = await service.search('ben xe buyt viet han');
  assert.ok(vietnamKorea.some(p => p.osmId === osm.osmId));
  assert.equal((await service.details(vietnamKorea[0])).canonicalId, vietnamKorea[0].canonicalId);
  const chat = await service.ask('Chỉ đường đến bến xe buýt Việt Hàn', []);
  assert.ok(chat.places.length); assert.equal(chat.action.type, 'LOCAL_DIRECTIONS'); assert.equal(chat.action.value.sourceType, 'openstreetmap');
  assert.equal(calls, 1);
});

test('a saved seed deep link resolves from the package online without sending an offline ID to the API', async () => {
  const seed = JSON.parse(fs.readFileSync(new URL('../../public/offline/places.json', import.meta.url)))[0];
  const normalized = unifiedPlace({ ...seed, localId: seed.id });
  const service = createMapService({ remote: { details: () => { throw new Error('Must not use the API for packaged seed IDs'); } }, local: {}, getMode: () => 'online', getLocalData: () => ({ places: [normalized] }) });
  const result = await service.details({ id: `offline:${seed.id}` });
  assert.equal(result.localId, seed.id); assert.equal(result.name, seed.name);
  await assert.rejects(service.details({ id: 'osm:node:999999999' }), /Hãy tìm lại địa điểm/);
  assert.equal(savedSnapshot({ ...osm, source: 'osm', osmType: undefined, osmId: undefined, key: 'osm:legacy-key' }).sourceType, 'openstreetmap');
});

test('offline nearest utilities use a fresh GPS port and never an old chat center', async () => {
  let gps = 0;
  const nearby = unifiedPlace({ ...osm, osmId: '101', lat: 16.06, lng: 108.22 });
  const far = unifiedPlace({ ...osm, osmId: '102', lat: 16.15, lng: 108.31 });
  const service = createMapService({ remote: { ask: () => { throw new Error('No API offline'); } }, local: { getLocation: async () => { gps++; return { lat: 16.0601, lng: 108.2201 }; } }, getMode: () => 'offline', getLocalData: () => ({ places: [far, nearby] }) });
  const result = await service.ask('Chỉ đường đến trạm xe buýt gần nhất', [], far, { origin: far });
  assert.equal(gps, 1); assert.equal(result.places.length, 1); assert.equal(result.places[0].osmId, '101');
  assert.equal(result.action.origin.lat, 16.0601); assert.equal(result.action.type, 'LOCAL_DIRECTIONS');
  assert.ok(result.places[0].distanceMeters < 100);
});
