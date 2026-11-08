import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMobileApiUrl } from '../scripts/mobile-config.mjs';
import { nativeAuthPath } from '../src/utils/nativeNavigation.js';
import { locationErrorMessage } from '../src/services/deviceLocation.js';

test('Android development can reach emulator and LAN APIs over HTTP', () => {
  const options = { development: true };
  assert.equal(validateMobileApiUrl(' http://10.0.2.2:5028/api/v1/ ', options), 'http://10.0.2.2:5028/api/v1');
  assert.equal(validateMobileApiUrl('http://192.168.1.10:5028/api/v1', options), 'http://192.168.1.10:5028/api/v1');
});

test('native builds reject missing, relative, device-loopback and non-HTTP API URLs', () => {
  for (const value of ['', '/api/v1', 'http://localhost:5028/api/v1', 'https://127.0.0.1/api/v1', 'http://127.0.0.2/api/v1', 'http://0.0.0.0/api/v1', 'http://[::1]/api/v1', 'file:///api/v1']) {
    assert.throws(() => validateMobileApiUrl(value, { development: true }), Error, value);
  }
});

test('production and iOS reject HTTP but allow deployed HTTPS', () => {
  assert.throws(() => validateMobileApiUrl('http://10.0.2.2:5028/api/v1'), /HTTPS/);
  assert.throws(() => validateMobileApiUrl('http://192.168.1.10/api/v1', { development: true, platform: 'ios' }), /HTTPS/);
  assert.equal(validateMobileApiUrl('https://api.example.com/api/v1/'), 'https://api.example.com/api/v1');
});

test('API configuration cannot embed credentials or a query/fragment', () => {
  for (const value of ['https://user:password@example.com/api/v1', 'https://example.com/api/v1?key=secret', 'https://example.com/api/v1#fragment']) {
    assert.throws(() => validateMobileApiUrl(value), Error);
  }
});

test('native auth links preserve encoded reset and verification parameters', () => {
  assert.equal(nativeAuthPath('mapai://auth/verify-email?userId=abc&token=a%2Bb%2Fc'), '/verify-email?userId=abc&token=a%2Bb%2Fc');
  assert.equal(nativeAuthPath('mapai://auth/reset-password?token=123'), '/reset-password?token=123');
});

test('untrusted links cannot navigate to arbitrary routes', () => {
  for (const url of ['https://auth/reset-password', 'mapai://evil/reset-password', 'mapai://auth/admin/dashboard', 'javascript:alert(1)', 'invalid', 'mapai://auth/verify-email/../admin']) {
    assert.equal(nativeAuthPath(url), null, url);
  }
});

test('location denial, timeout and disabled GPS have actionable messages on both platforms', () => {
  assert.match(locationErrorMessage({ code: 1 }), /cấp quyền/);
  assert.match(locationErrorMessage({ code: 'OS-PLUG-GLOC-0003' }), /cấp quyền/);
  assert.match(locationErrorMessage({ code: 3 }), /thời gian/);
  assert.match(locationErrorMessage({ code: 'OS-PLUG-GLOC-0010' }), /thời gian/);
  assert.match(locationErrorMessage({ code: 'OS-PLUG-GLOC-0007' }), /đang tắt/);
  assert.match(locationErrorMessage(new Error('unknown')), /tự nhập/);
});
