import { createHash } from 'node:crypto';
import { expect } from '@playwright/test';
import { mockStreetTiles } from './basemap.js';
export const tokenFor = id => `header.${Buffer.from(JSON.stringify({ id, exp: 4102444800 })).toString('base64url')}.signature`;
export const seedPlace = { key: 'seed:mi-ba-mua', id: 'offline:mi-ba-mua', localId: 'mi-ba-mua', name: 'Mì Quảng Bà Mua', lat: 16.0621, lng: 108.2183, source: 'offline', address: 'Đà Nẵng' };
export const outsidePlace = { key: 'mapai:outside', id: 'outside', name: 'Địa điểm ngoài gói', lat: 16.4, lng: 108.5, address: 'Ngoài vùng Đà Nẵng đã tải', source: 'mapai' };
export function serverFixture() {
  return { accounts: new Map(), receipts: new Map(), calls: [], pushes: [], fail: false, lost: false, uploads: 0, publicPlaces: [], contributions: [], catalogCorrupt: false };
}
export async function attachServer(page, server, account) {
  await mockStreetTiles(page);
  if (account) await page.addInitScript(({ token }) => {
    if (!localStorage.getItem('test-seeded')) { localStorage.setItem('accessToken', token); localStorage.setItem('test-seeded', 'true'); }
  }, { token: tokenFor(account) });
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace('/api/v1', '');
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const token = request.headers().authorization?.split(' ')[1];
    let owner;
    try { owner = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).id; } catch { /* Guest. */ }
    const respond = (json, status = 200) => route.fulfill({ json, status, headers });
    server.calls.push({ owner, path, method: request.method() });
    if (path === '/auth/me' || path === '/user/infor') return respond({ id: owner, fullName: owner, email: `${owner}@example.test`, role: 'User' });
    if (path === '/auth/login') { const id = request.postDataJSON().email.split('@')[0]; return respond({ accessToken: tokenFor(id), refreshToken: `refresh-${id}` }); }
    if (path === '/auth/logout') return route.fulfill({ status: 204, headers });
    if (path === '/sync/favorites') return respond([...(server.accounts.get(owner)?.values() || [])]);
    if (path === '/sync/operations') {
      const operation = request.postDataJSON(); server.pushes.push({ owner, ...operation });
      if (server.fail) return respond({ message: 'Kết nối tạm gián đoạn' }, 503);
      const key = `${owner}|${operation.id}`;
      if (!server.receipts.has(key)) {
        if (operation.kind === 'favorite') {
          if (!server.accounts.has(owner)) server.accounts.set(owner, new Map());
          server.accounts.get(owner).set(operation.payload.place.key, { ...operation.payload, updatedAt: new Date().toISOString() });
        } else if (operation.kind === 'contribution') server.contributions.push({ owner, ...operation.payload });
        server.receipts.set(key, { id: operation.id, kind: operation.kind, resourceId: operation.payload.place?.key || 'resource' });
      }
      if (server.lost) { server.lost = false; return route.abort('connectionfailed'); }
      return respond(server.receipts.get(key));
    }
    if (path === '/sync/catalog') {
      const payload = JSON.stringify(server.publicPlaces), sha256 = createHash('sha256').update(payload).digest('hex');
      if (url.searchParams.get('version') === sha256) return route.fulfill({ status: 204, headers });
      return respond({ payload: server.catalogCorrupt ? payload + ' ' : payload, version: sha256, sha256 });
    }
    if (path === '/location/upload-thumbnail') { server.uploads++; return respond({ url: 'https://images.example.test/queued.jpg' }); }
    if (path === '/location' || path === '/map/search') return respond([]);
    if (path.endsWith('/reviews')) return respond({ items: [], myReview: null, totalCount: 0, pageSize: 10 });
    return respond([]);
  });
}
export async function ready(page) {
  await page.goto('/map');
  await expect(page.getByTestId('map-status')).toContainText('Đà Nẵng sẵn sàng', { timeout: 45000 });
}
export async function saved(page) {
  const close = page.getByRole('button', { name: 'Đóng chi tiết địa điểm', exact: true });
  if (await close.count()) {
    try { await close.click({ timeout: 2000 }); } catch { /* The closing animation can detach the button before a second click. */ }
    await expect(close).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Đã lưu / Gần đây', exact: true }).click();
  return page.getByRole('dialog', { name: 'Bộ sưu tập trên thiết bị' });
}
export async function login(page, id) {
  await page.goto('/login');
  await page.getByPlaceholder('Email', { exact: true }).fill(`${id}@example.test`);
  await page.getByPlaceholder('Mật khẩu', { exact: true }).fill('test-password');
  await page.locator('form').getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
