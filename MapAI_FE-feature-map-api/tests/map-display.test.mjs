import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { basemapStyle, basemapProviders, streetStyle, monitorBasemap, mapTilerKey, OPENFREEMAP_STYLE, HOT_SOURCE, OSM_SOURCE } from '../src/services/mapBasemap.js';
import { toLngLat, placesGeoJSON } from '../src/utils/mapCoordinates.js';
import { requestCurrentLocation } from '../src/services/locationProvider.js';
import { locationErrorMessage } from '../src/services/deviceLocation.js';

test('keyless maps use OpenFreeMap with independent raster fallbacks and required credits', () => {
  for (const key of [undefined, '', ' ', 'YOUR_MAPTILER_KEY_HERE']) {
    assert.equal(basemapStyle(key), OPENFREEMAP_STYLE);
    assert.deepEqual(basemapProviders(key).map(p => p.id), ['openfreemap', 'hot', 'osm']);
  }
  const hot = streetStyle('hot');
  assert.match(hot.sources[HOT_SOURCE].tiles[0], /tile\.openstreetmap\.fr/);
  assert.match(hot.sources[HOT_SOURCE].attribution, /OpenStreetMap France/);
  assert.match(hot.sources[HOT_SOURCE].attribution, /OpenStreetMap contributors/);
  assert.equal(streetStyle().sources[OSM_SOURCE].type, 'raster');
  assert.doesNotMatch(JSON.stringify([hot, streetStyle()]), /demotiles|cartocdn/);
  assert.equal(mapTilerKey(' key '), 'key');
  assert.match(basemapStyle(' key '), /key=key$/);
});

class TestMap extends EventEmitter {
  styles = [];
  isStyleLoaded() { return false; }
  setTerrain() { throw new Error('Must not change terrain before a style loads'); }
  setStyle(style) { this.styles.push(style); }
}
test('independent providers fail over once per cycle, report statuses and ignore stale errors', () => {
  const map = new TestMap();
  const ready = [], warnings = [];
  const control = monitorBasemap(map, 'test-only', { onReady: value => ready.push(value), onChanging() {}, onWarning: value => warnings.push(value) });
  map.emit('error', { error: { status: 401, url: 'https://api.maptiler.com/style?key=do-not-display' } });
  assert.equal(map.styles[0], OPENFREEMAP_STYLE);
  map.emit('style.load');
  assert.deepEqual(ready, [{ vector: true, provider: 'openfreemap' }]);
  map.emit('error', { error: { status: 401, url: 'https://api.maptiler.com/old-request' } });
  assert.equal(map.styles.length, 1);
  map.emit('error', { error: { status: 503, url: OPENFREEMAP_STYLE } });
  assert.deepEqual(map.styles[1], streetStyle('hot'));
  map.emit('error', { sourceId: HOT_SOURCE, error: { status: 403 } });
  assert.deepEqual(map.styles[2], streetStyle('osm'));
  map.emit('error', { sourceId: OSM_SOURCE, error: { status: 429 } });
  assert.match(warnings.at(-1), /HTTP 401/);
  assert.match(warnings.at(-1), /HTTP 503/);
  assert.match(warnings.at(-1), /HTTP 403/);
  assert.match(warnings.at(-1), /HTTP 429/);
  assert.doesNotMatch(warnings.join(' '), /do-not-display/);
  assert.equal(map.styles.length, 3); // No automatic cycling forever.
  map.emit('error', { sourceId: HOT_SOURCE, error: { status: 503 } });
  assert.equal(map.styles.length, 3);
  map.emit('sourcedata', { sourceId: 'mapai-places', tile: { state: 'loaded' } });
  assert.notEqual(warnings.at(-1), null);
  map.emit('sourcedata', { sourceId: OSM_SOURCE, tile: { state: 'loaded' } });
  assert.equal(warnings.at(-1), null);
  control.select('hot');
  assert.deepEqual(map.styles.at(-1), streetStyle('hot'));
  map.emit('sourcedata', { sourceId: OSM_SOURCE, tile: { state: 'loaded' } });
  control.dispose();
  assert.equal(map.listenerCount('error'), 0);
  assert.equal(map.listenerCount('style.load'), 0);
});
test('a stalled basemap switches after its deadline; a received tile cancels the watchdog', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const map = new TestMap();
  const control = monitorBasemap(map, null, { onReady() {}, onChanging() {}, onWarning() {}, timeoutMs: 100 });
  t.mock.timers.tick(100);
  assert.deepEqual(map.styles, [streetStyle('hot')]);
  map.emit('sourcedata', { sourceId: HOT_SOURCE, tile: { state: 'loaded' } });
  t.mock.timers.tick(1000);
  assert.equal(map.styles.length, 1);
  control.dispose();
});
test('failed terrain is disabled without replacing streets; late terrain errors do not affect another provider', () => {
  const map = new TestMap();
  let terrain = { source: 'maptiler-terrain' };
  map.getTerrain = () => terrain;
  map.setTerrain = value => { terrain = value; };
  const warnings = [];
  const control = monitorBasemap(map, 'test-only', { onReady() {}, onChanging() {}, onWarning: value => warnings.push(value) });
  map.emit('error', { sourceId: 'maptiler-terrain' });
  assert.equal(terrain, null);
  assert.equal(map.styles.length, 0);
  assert.match(warnings.at(-1), /địa hình 3D/);
  map.emit('error', { error: { status: 401 } });
  const warning = warnings.at(-1);
  map.emit('error', { sourceId: 'maptiler-terrain' });
  assert.equal(warnings.at(-1), warning);
  control.dispose();
});
test('a late tile from the previous raster source cannot cancel the new vector source deadline', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const map = new TestMap();
  const control = monitorBasemap(map, null, { onReady() {}, onChanging() {}, onWarning() {}, timeoutMs: 100 });
  control.select('hot');
  map.emit('sourcedata', { sourceId: HOT_SOURCE, tile: { state: 'loaded' } });
  control.select('openfreemap');
  map.emit('sourcedata', { sourceId: HOT_SOURCE, tile: { state: 'loaded' } });
  t.mock.timers.tick(100);
  assert.deepEqual(map.styles, [streetStyle('hot'), OPENFREEMAP_STYLE, streetStyle('hot')]);
  control.dispose();
});
test('errors from community points or a route do not replace the basemap', () => {
  const map = new TestMap();
  const control = monitorBasemap(map, 'test-only', { onReady() {}, onChanging() {}, onWarning() {} });
  map.emit('error', { sourceId: 'mapai-places' });
  map.emit('error', { sourceId: 'route' });
  assert.equal(map.styles.length, 0);
  control.dispose();
});

test('Da Nang landmark coordinates stay [longitude,latitude] in GeoJSON and preserve zero', () => {
  const bridge = { id: 'dragon-bridge', title: 'Cầu Rồng', latitude: 16.0612, longitude: 108.2275 };
  assert.deepEqual(placesGeoJSON([bridge]).features[0].geometry.coordinates, [108.2275, 16.0612]);
  assert.deepEqual(toLngLat({ lat: '16.0612', lon: '108.2275' }), [108.2275, 16.0612]);
  assert.deepEqual(toLngLat({ lat: 0, lng: 0 }), [0, 0]);
  for (const value of [{ latitude: 108, longitude: 16 }, { lat: null, lng: null }, { lat: '', lng: '' }, { lat: '16oops', lng: 108 }, { lat: NaN, lng: 108 }]) {
    assert.equal(toLngLat(value), null);
    assert.equal(placesGeoJSON([value]).features.length, 0);
  }
});

const position = { coords: { latitude: 16.0612, longitude: 108.2275, accuracy: 40 }, timestamp: Date.now() };
test('desktop high-accuracy timeout retries a fresh network fix without cached/guessed coordinates', async () => {
  const options = [];
  const browser = { geolocation: { getCurrentPosition(ok, fail, value) {
    options.push(value);
    if (value.enableHighAccuracy) fail({ code: 3 }); else ok(position);
  } } };
  assert.equal(await requestCurrentLocation({ browser, secureContext: true }), position);
  assert.deepEqual(options.map(o => [o.enableHighAccuracy, o.maximumAge]), [[true, 0], [false, 0]]);
});
test('permission denial and disabled native GPS do not retry or pretend a fix succeeded', async () => {
  let attempts = 0;
  await assert.rejects(requestCurrentLocation({ secureContext: true, browser: { geolocation: {
    getCurrentPosition(_ok, fail) { attempts++; fail({ code: 1 }); },
  } } }), error => error.code === 1);
  assert.equal(attempts, 1);
  await assert.rejects(requestCurrentLocation({ native: true, plugin: {
    checkPermissions: async () => { throw { code: 'OS-PLUG-GLOC-0007' }; },
  } }), error => error.code === 'OS-PLUG-GLOC-0007');
});
test('insecure browser origins are explained and invalid provider coordinates are rejected', async () => {
  await assert.rejects(requestCurrentLocation({ secureContext: false }), error => error.code === 'INSECURE_CONTEXT');
  assert.match(locationErrorMessage({ code: 'INSECURE_CONTEXT' }), /HTTPS hoặc localhost/);
  assert.match(locationErrorMessage({ code: 2 }), /Windows/);
  await assert.rejects(requestCurrentLocation({ secureContext: true, browser: { geolocation: {
    getCurrentPosition(ok) { ok({ coords: { latitude: 108, longitude: 16 } }); },
  } } }), error => error.code === 'INVALID_POSITION');
});
test('Android approximate permission requests a balanced fix and never re-prompts for precise access', async () => {
  let prompts = 0;
  const options = [];
  const result = await requestCurrentLocation({ native: true, plugin: {
    checkPermissions: async () => ({ location: 'denied', coarseLocation: 'granted' }),
    requestPermissions: async () => { prompts++; },
    getCurrentPosition: async value => { options.push(value); return position; },
  } });
  assert.equal(result, position);
  assert.equal(prompts, 0);
  assert.equal(options[0].enableHighAccuracy, false);
  assert.equal(options[0].maximumAge, 0);
});
