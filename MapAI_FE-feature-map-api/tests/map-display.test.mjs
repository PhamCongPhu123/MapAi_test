import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { basemapStyle, streetStyle, monitorBasemap, mapTilerKey } from '../src/services/mapBasemap.js';
import { toLngLat, placesGeoJSON } from '../src/utils/mapCoordinates.js';
import { requestCurrentLocation } from '../src/services/locationProvider.js';
import { locationErrorMessage } from '../src/services/deviceLocation.js';

test('without a key the basemap contains real street raster tiles and attribution, never the country demo', () => {
  for (const key of [undefined, '', ' ', 'YOUR_MAPTILER_KEY_HERE']) {
    const style = basemapStyle(key);
    assert.equal(style.sources['osm-streets'].type, 'raster');
    assert.equal(style.layers[0].source, 'osm-streets');
    assert.match(style.sources['osm-streets'].tiles[0], /^https:\/\/tile\.openstreetmap\.org\//);
    assert.match(style.sources['osm-streets'].attribution, /OpenStreetMap contributors/);
    assert.doesNotMatch(JSON.stringify(style), /demotiles/);
  }
  assert.equal(mapTilerKey(' key '), 'key');
  assert.match(basemapStyle(' key '), /key=key$/);
});

class TestMap extends EventEmitter {
  styles = [];
  isStyleLoaded() { return false; }
  setTerrain() { throw new Error('Must not change terrain before a style loads'); }
  setStyle(style) { this.styles.push(style); }
}
test('failed MapTiler switches once to streets, reports tile failures, and unregisters on cleanup', () => {
  const map = new TestMap();
  const ready = [], warnings = [];
  let changing = 0;
  const control = monitorBasemap(map, 'test-only', { onReady: value => ready.push(value), onChanging: () => changing++, onWarning: value => warnings.push(value) });
  map.emit('error', { error: { status: 401 } });
  assert.deepEqual(map.styles, [streetStyle()]);
  assert.equal(changing, 1);
  map.emit('style.load');
  assert.deepEqual(ready, [{ vector: false }]);
  map.emit('error', { sourceId: 'osm-streets', error: { status: 503 } });
  assert.match(warnings.at(-1), /kiểm tra kết nối/);
  assert.equal(map.styles.length, 1);
  map.emit('sourcedata', { sourceId: 'osm-streets', tile: { state: 'loaded' } });
  assert.equal(warnings.at(-1), null);
  control.reload();
  assert.equal(map.styles.length, 2);
  control.dispose();
  assert.equal(map.listenerCount('error'), 0);
  assert.equal(map.listenerCount('style.load'), 0);
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
