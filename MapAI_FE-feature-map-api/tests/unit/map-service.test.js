import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMapService, localRoute } from '../../src/map/application/createMapService.js';
import { RoutingEngine } from '../../src/offline/application/routingEngine.js';

const places = JSON.parse(fs.readFileSync(new URL('../../public/offline/places.json', import.meta.url)));
function fixture() {
  let mode = 'online';
  const calls = [];
  const online = [{ id: 'server-id', name: 'Địa điểm từ server', lat: 16.06, lng: 108.22 }];
  const remote = Object.fromEntries(['search', 'category', 'list', 'details', 'route', 'ask'].map(name =>
    [name, async (...args) => { calls.push([name, ...args]); return online; }]));
  const local = { calculateRoute: async (origin, destination, mode) => ({
    origin, destination, mode, coordinates: [[108.22, 16.06], [108.23, 16.07]],
    steps: [{ instruction: 'Đi theo đường Trần Phú', name: 'Trần Phú', distance: 200 }],
    distance: 240, minutes: 4, access: [[[108.22, 16.06], [108.221, 16.061]]],
  }) };
  const service = createMapService({ remote, local, getMode: () => mode, getLocalData: () => ({ places }) });
  return { service, calls, online, setMode: value => { mode = value; } };
}
test('the same service switches transport without recreating its interface or calling the server offline', async () => {
  const f = fixture();
  assert.equal(await f.service.search('mi quang'), f.online);
  f.setMode('offline');
  const result = await f.service.search('mi quang');
  assert.equal(result.length, 2);
  assert.ok(result.every(p => p.source === 'offline' && p.localId && Number.isFinite(p.lng)));
  assert.equal(f.calls.length, 1);
  f.setMode('online');
  assert.equal(await f.service.search('mi quang'), f.online);
  assert.equal(f.calls.length, 2);
});
test('local routes follow the shared route contract and unsupported offline vehicles are explained', async () => {
  const f = fixture(); f.setMode('offline');
  const route = await f.service.route({ lng: 108.22, lat: 16.06 }, { lng: 108.23, lat: 16.07 }, 'foot');
  assert.equal(route.geometry.type, 'LineString'); assert.equal(route.duration, 240);
  assert.equal(route.legs[0].steps[0].maneuver.instruction, 'Đi theo đường Trần Phú');
  assert.ok(route.access.length); assert.equal(f.calls.length, 0);
  await assert.rejects(f.service.route({}, {}, 'driving'), /chọn lại phương tiện/);
});
test('offline category searches and detail selection use only downloaded places', async () => {
  const f = fixture(); f.setMode('offline');
  const cafes = await f.service.category('coffee'); assert.ok(cafes.length);
  assert.ok(cafes.every(p => p.tags.includes('ca phe')));
  assert.equal((await f.service.category('gas station')).length, 0);
  assert.equal((await f.service.details(cafes[0])).localId, cafes[0].localId);
  await assert.rejects(f.service.details({ name: 'Không có trong gói', lng: 109, lat: 17 }), /chưa có trong gói/);
  assert.equal(f.calls.length, 0);
});
test('offline chat clarifies area and supports shared map controls without an AI/API call', async () => {
  const f = fixture(); f.setMode('offline');
  const reply = await f.service.ask('Tìm quán ăn tối ngon', []);
  assert.ok(reply.suggestions.length);
  const zoom = await f.service.ask('Phóng to bản đồ', []);
  assert.equal(zoom.action.type, 'ZOOM_IN');
  const target = (await f.service.search('mi quang'))[0];
  assert.equal((await f.service.ask('Chỉ đường đến đó', [], target)).action.value, target);
  assert.equal(f.calls.length, 0);
});

test('shared navigation moves to the actual turn after several segments on one street', () => {
  const graph = {
    bounds: [108.19, 15.99, 108.23, 16.03],
    nodes: [[108.2, 16], [108.21, 16], [108.22, 16], [108.22, 16.01]],
    names: ['Đường Đông Tây', 'Đường Bắc Nam'],
    edges: [[0, 1, 0, 15], [1, 2, 0, 15], [2, 3, 1, 15]],
  };
  const result = new RoutingEngine(graph).route({ lng: 108.2, lat: 16 }, { lng: 108.22, lat: 16.01 });
  const steps = localRoute(result).legs[0].steps;
  assert.equal(steps.length, 2);
  assert.deepEqual(steps[1].maneuver.location, [108.22, 16]);
  assert.equal(steps[1].maneuver.modifier, 'left');
});
