import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../../src/services/api.js', import.meta.url), 'utf8').replace('import.meta.env.VITE_API_BASE_URL', "'https://api.example.test/api/v1'");
const api = await import(`data:text/javascript,${encodeURIComponent(source)}`);
const token = id => `header.${Buffer.from(JSON.stringify({ id, exp: 4102444800 })).toString('base64url')}.signature`;
function setup() {
  const values = new Map([['accessToken', token('alice')], ['refreshToken', 'refresh-alice'], ['userId', 'alice']]);
  const previous = { fetch: globalThis.fetch, localStorage: globalThis.localStorage, window: globalThis.window };
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const events = []; globalThis.window = { dispatchEvent: event => events.push(event.type) };
  return { values, events, restore() { Object.assign(globalThis, previous); } };
}
test('network errors and server failures during refresh preserve local credentials', async () => {
  const f = setup();
  try {
    globalThis.fetch = async url => { if (url.endsWith('/auth/refresh')) throw new TypeError('Network lost'); return new Response(null, { status: 401 }); };
    await assert.rejects(api.request('/sync/favorites'), /Network lost/);
    assert.equal(f.values.get('accessToken'), token('alice')); assert.equal(f.events.length, 0);
    globalThis.fetch = async () => new Response(null, { status: 503 });
    let calls = 0;
    globalThis.fetch = async () => new Response(null, { status: ++calls === 1 ? 401 : 503 });
    await assert.rejects(api.request('/auth/me'), /Thông tin trên thiết bị vẫn được giữ/);
    assert.equal(f.values.get('refreshToken'), 'refresh-alice'); assert.equal(f.events.length, 0);
  } finally { f.restore(); }
});
test('a delayed refresh from Alice cannot overwrite a newer Bob login', async () => {
  const f = setup();
  try {
    let release, started;
    const pending = new Promise(resolve => { release = resolve; });
    const entered = new Promise(resolve => { started = resolve; });
    globalThis.fetch = async url => {
      if (url.endsWith('/auth/refresh')) { started(); return pending; }
      return new Response(null, { status: 401 });
    };
    const request = api.request('/sync/favorites'); await entered;
    api.saveTokens(token('bob'), 'refresh-bob', 'bob');
    release(Response.json({ accessToken: token('alice'), refreshToken: 'new-alice' })); await request;
    assert.equal(f.values.get('accessToken'), token('bob')); assert.equal(f.values.get('refreshToken'), 'refresh-bob');
  } finally { f.restore(); }
});
test('only authoritative authentication rejection clears the cached session', async () => {
  const f = setup();
  try {
    globalThis.fetch = async () => new Response(null, { status: 401 });
    await api.request('/auth/me');
    assert.equal(f.values.has('accessToken'), false); assert.deepEqual(f.events, ['mapai:session-cleared']);
  } finally { f.restore(); }
});
