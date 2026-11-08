import test from 'node:test';
import assert from 'node:assert/strict';
import { executeMapAction } from '../src/utils/executeMapAction.js';

function fixture() {
  const calls = [];
  const place = { id: 'station', name: 'Station', lat: 0, lng: 0.001, distanceMeters: 111, category: 'fuel' };
  const search = { places: [place], categoryName: 'Cây xăng', warnings: [] };
  const map = Object.fromEntries(['zoomBy', 'resetNorth', 'clearSearchResults', 'clearDirections', 'setNearbyMarkers', 'flyTo', 'setDirections'].map(method => [method, (...args) => calls.push([method, ...args])]));
  const api = { find: async (...args) => { calls.push(['find', ...args]); return search; }, routeNearest: async (...args) => { calls.push(['routeNearest', ...args]); return { search, destination: place, route: { geometry: {} } }; } };
  return { calls, search, map, api, getPosition: async () => ({ lat: 0, lng: 0 }) };
}
const action = { type: 'NEAREST_SEARCH', value: { category: 'fuel', radius: 5000 } };

test('nearest uses fresh position, accepts equator/prime meridian and reports straight-line distance', async () => {
  const f = fixture();
  const result = await executeMapAction(action, f);
  assert.deepEqual(f.calls.find(call => call[0] === 'find')[1], { lat: 0, lng: 0, category: 'fuel', radius: 5000 });
  assert.match(result.message, /111 m theo đường thẳng/);
  assert.equal(result.selectedPlace.id, 'station');
});
test('GPS denial never searches from a guessed or saved coordinate', async () => {
  const f = fixture();
  f.getPosition = async () => null;
  await assert.rejects(executeMapAction(action, f), /Cần vị trí hiện tại/);
  assert.equal(f.calls.length, 0);
});
test('named center works without asking for user location', async () => {
  const f = fixture();
  f.getPosition = async () => { throw new Error('must not request GPS'); };
  await executeMapAction({ type: 'SEARCH_POIS', value: { category: 'cafe', radius: 2000, center: { lat: 16, lng: 108 } } }, f);
  assert.equal(f.calls.find(call => call[0] === 'find')[1].lat, 16);
});
test('nearest routing carries requested mode and actual route to map', async () => {
  const f = fixture();
  await executeMapAction({ type: 'ROUTE_TO_NEAREST', value: { category: 'fuel', radius: 5000, mode: 'foot' } }, f);
  assert.equal(f.calls.find(call => call[0] === 'routeNearest')[1].mode, 'foot');
  assert.equal(f.calls.find(call => call[0] === 'setDirections')[3], 'foot');
});
test('no results and partial-source warnings do not invent a destination', async () => {
  const f = fixture();
  f.search.places = [];
  f.search.warnings = ['OpenStreetMap đang không khả dụng.'];
  const result = await executeMapAction(action, f);
  assert.equal(result.selectedPlace, null);
  assert.match(result.message, /Chưa tìm thấy/);
  assert.match(result.message, /không khả dụng/);
  assert.equal(f.calls.some(call => call[0] === 'flyTo'), false);
});
test('unsupported model actions/categories/radius are rejected before any request', async () => {
  for (const invalid of [{ type: 'eval' }, { type: 'NEAREST_SEARCH', value: { category: 'javascript', radius: 5000 } }, { type: 'SEARCH_POIS', value: { category: 'fuel', radius: 20001 } }, { type: 'ROUTE_TO_NEAREST', value: { category: 'fuel', radius: 5000, center: { lat: 0, lng: 0 } } }]) {
    const f = fixture();
    await assert.rejects(executeMapAction(invalid, f));
    assert.equal(f.calls.length, 0);
  }
});

test('camera and clear commands use the intended map method without GPS or provider calls', async () => {
  for (const [type, method, value] of [['ZOOM_IN', 'zoomBy', 1], ['ZOOM_OUT', 'zoomBy', -1], ['RESET_NORTH', 'resetNorth'], ['CLEAR_RESULTS', 'clearSearchResults'], ['CLEAR_ROUTE', 'clearDirections']]) {
    const f = fixture();
    f.getPosition = async () => { throw new Error('must not request location'); };
    await executeMapAction({ type }, f);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0][0], method);
    if (value !== undefined) assert.equal(f.calls[0][1], value);
  }
});
