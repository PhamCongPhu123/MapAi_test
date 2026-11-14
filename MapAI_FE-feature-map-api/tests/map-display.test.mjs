import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { basemapStyle, basemapProviders, monitorBasemap, OPENFREEMAP_STYLE } from '../src/services/mapBasemap.js';
import { toLngLat, placesGeoJSON } from '../src/utils/mapCoordinates.js';
import { requestCurrentLocation } from '../src/services/locationProvider.js';
import { locationErrorMessage } from '../src/services/deviceLocation.js';

test('all configurations use only OpenFreeMap, including a legacy MapTiler key', () => {
  for (const key of [undefined, '', 'old-key']) {
    assert.equal(basemapStyle(key), OPENFREEMAP_STYLE);
    assert.deepEqual(basemapProviders(key).map(p => p.id), ['openfreemap']);
  }
});
class TestMap extends EventEmitter {}
test('OpenFreeMap failures are actionable and never switch to a different provider', () => {
  const map = new TestMap(), warnings = [], ready = [];
  let retries = 0;
  const control = monitorBasemap(map, null, { onReady: value => ready.push(value), onChanging() {}, onWarning: value => warnings.push(value), onReload: () => retries++ });
  map.emit('error', { error: { status: 503, url: 'https://tiles.openfreemap.org/private-error-details' } });
  assert.match(warnings.at(-1), /OpenFreeMap.*HTTP 503/);
  assert.doesNotMatch(warnings.at(-1), /private-error-details/);
  map.emit('style.load');
  assert.deepEqual(ready, [{ vector: true, provider: 'openfreemap' }]);
  map.emit('sourcedata', { sourceId: 'openmaptiles', tile: { state: 'loaded' } });
  assert.equal(warnings.at(-1), null);
  control.reload(); assert.equal(retries, 1);
  control.dispose(); assert.equal(map.listenerCount('error'), 0);
});
test('a stalled OpenFreeMap reports a deadline and a real map tile cancels it', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const map = new TestMap(), warnings = [];
  const control = monitorBasemap(map, null, { onReady() {}, onChanging() {}, onWarning: value => warnings.push(value), timeoutMs: 100 });
  t.mock.timers.tick(100); assert.match(warnings.at(-1), /Chưa tải được.*OpenFreeMap/);
  control.reload();
  map.emit('sourcedata', { sourceId: 'mapai-places', tile: { state: 'loaded' } });
  t.mock.timers.tick(100); assert.match(warnings.at(-1), /Chưa tải được/);
  control.reload();
  map.emit('sourcedata', { sourceId: 'openmaptiles', tile: { state: 'loaded' } });
  t.mock.timers.tick(1000); assert.equal(warnings.at(-1), null);
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
