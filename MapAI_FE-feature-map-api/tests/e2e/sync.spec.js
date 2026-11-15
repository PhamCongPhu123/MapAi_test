import { test, expect } from '@playwright/test';
import { attachServer, serverFixture, ready, saved, seedPlace, outsidePlace, login } from './helpers/sync.js';
import { chooseLocalPlace } from './helpers/unified.js';

test('cached identity survives offline reload; favorites stay scoped and pending', async ({ page, context }) => {
  const server = serverFixture(); await attachServer(page, server, 'alice'); await ready(page);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('mapai-verified-session') || 'null')?.profile.id)).toBe('alice');
  await context.setOffline(true); await page.reload();
  const count = server.calls.length;
  await chooseLocalPlace(page);
  await page.getByRole('button', { name: 'Lưu yêu thích', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bỏ lưu địa điểm', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Chờ đồng bộ', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đóng chi tiết địa điểm', exact: true }).click();
  const dialog = await saved(page);
  await expect(dialog).toContainText('Đang ngoại tuyến');
  await expect(dialog.getByRole('button', { name: 'Chi tiết Mì Quảng Bà Mua', exact: true })).toBeVisible();
  expect(server.calls.length).toBe(count);
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await context.setOffline(false);
  await expect.poll(() => server.accounts.get('alice')?.get(seedPlace.key)?.deleted).toBe(false);
  await saved(page); await expect(dialog).toContainText('Đã đồng bộ đa thiết bị');
});

test('guest favorites merge with existing cloud favorites and reach another device', async ({ page, browser }) => {
  const server = serverFixture(); server.accounts.set('alice', new Map([[outsidePlace.key, { place: outsidePlace, deleted: false }]]));
  await attachServer(page, server); await ready(page);
  // Simulate offline without disconnecting the app shell used by the login page.
  await page.getByRole('button', { name: 'Quản lý dữ liệu bản đồ', exact: true }).click();
  const data = page.getByRole('dialog', { name: 'Dữ liệu offline Đà Nẵng' });
  await data.getByRole('switch', { name: 'Giả lập Offline' }).click(); await data.getByRole('button', { name: 'Đóng', exact: true }).click();
  await chooseLocalPlace(page); await page.getByRole('button', { name: 'Lưu yêu thích', exact: true }).click();
  await page.getByRole('button', { name: 'Đóng chi tiết địa điểm', exact: true }).click();
  const first = await saved(page); await expect(first).toContainText('Chế độ Khách');
  await first.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Quản lý dữ liệu bản đồ', exact: true }).click();
  await data.getByRole('switch', { name: 'Giả lập Offline' }).click(); await data.getByRole('button', { name: 'Đóng', exact: true }).click();
  await login(page, 'alice'); await page.goto('/map');
  const merged = await saved(page);
  await expect(merged.getByRole('button', { name: 'Đã lưu (2)', exact: true })).toBeVisible();
  await expect(merged).toContainText('Đã gộp dữ liệu ngoại tuyến');
  await expect(merged).toContainText('Chỉ xem thông tin');
  const nextContext = await browser.newContext({ baseURL: 'http://localhost:4173' });
  try {
    const next = await nextContext.newPage(); await attachServer(next, server, 'alice'); await ready(next);
    const second = await saved(next); await expect(second.getByRole('button', { name: 'Đã lưu (2)', exact: true })).toBeVisible();
  } finally { await nextContext.close(); }
});

test('undo cancels a delayed removal and deletion tombstones propagate to another session', async ({ page, context }) => {
  const server = serverFixture(); server.accounts.set('alice', new Map([[seedPlace.key, { place: seedPlace, deleted: false }]]));
  await attachServer(page, server, 'alice'); await ready(page);
  const dialog = await saved(page); await expect(dialog.getByRole('button', { name: 'Đã lưu (1)', exact: true })).toBeVisible();
  await context.setOffline(true);
  await dialog.getByRole('button', { name: 'Bỏ lưu Mì Quảng Bà Mua', exact: true }).click();
  await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Đã lưu (1)', exact: true })).toBeVisible();
  await context.setOffline(false); await dialog.getByRole('button', { name: 'Đồng bộ ngay', exact: true }).click();
  await expect(dialog).toContainText('Đã đồng bộ đa thiết bị');
  expect(server.pushes.some(p => p.kind === 'favorite' && p.payload.deleted)).toBe(false);
  await context.setOffline(true); await dialog.getByRole('button', { name: 'Bỏ lưu Mì Quảng Bà Mua', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hoàn tác', exact: true })).toBeVisible();
  await page.reload(); await context.setOffline(false); const after = await saved(page);
  await expect.poll(() => server.accounts.get('alice').get(seedPlace.key).deleted, { timeout: 15000 }).toBe(true);
  await expect(after.getByRole('button', { name: 'Đã lưu (0)', exact: true })).toBeVisible();
});

test('a failed sync keeps changes across reload and retries the same operation ID', async ({ page, context }) => {
  const server = serverFixture(); await attachServer(page, server, 'alice'); await ready(page);
  await context.setOffline(true); await chooseLocalPlace(page);
  await page.getByRole('button', { name: 'Lưu yêu thích', exact: true }).click();
  await page.getByRole('button', { name: 'Đóng chi tiết địa điểm', exact: true }).click();
  server.fail = true; await context.setOffline(false); const dialog = await saved(page);
  await expect(dialog).toContainText('Kết nối tạm gián đoạn');
  const id = server.pushes[0].id;
  await context.setOffline(true); await page.reload(); const local = await saved(page);
  await expect(local.getByRole('button', { name: 'Đã lưu (1)', exact: true })).toBeVisible();
  server.fail = false; server.lost = true; await context.setOffline(false);
  await expect.poll(() => server.lost, { timeout: 15000 }).toBe(false);
  await expect(local).toContainText('Chưa đồng bộ');
  await local.getByRole('button', { name: 'Thử đồng bộ lại', exact: true }).click();
  await expect(local).toContainText('Đã đồng bộ đa thiết bị');
  expect(server.pushes.every(p => p.id === id)).toBe(true); expect(server.receipts.size).toBe(1);
});

test('offline contribution and photo survive restart then submit once after reconnect', async ({ page, context }) => {
  const server = serverFixture(); await attachServer(page, server, 'alice'); await ready(page); await context.setOffline(true);
  await page.getByRole('button', { name: '+ Thêm địa điểm', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Thêm địa điểm còn thiếu' });
  await form.getByLabel('Tên địa điểm', { exact: true }).fill('Cafe khi mất mạng');
  await form.getByLabel('Địa chỉ', { exact: true }).fill('Đà Nẵng');
  await form.locator('input[type=file]').setInputFiles({ name: 'cafe.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1cAAAAASUVORK5CYII=', 'base64') });
  await form.getByRole('button', { name: 'Gửi địa điểm chờ duyệt', exact: true }).click();
  await expect(form).toContainText('Đã lưu đóng góp trên máy');
  await page.reload(); const pending = await saved(page); await pending.getByRole('button', { name: 'Chờ gửi (1)', exact: true }).click();
  await expect(pending).toContainText('Cafe khi mất mạng');
  server.lost = true; await context.setOffline(false);
  await expect(pending).toContainText('Chưa đồng bộ');
  await pending.getByRole('button', { name: 'Thử đồng bộ lại', exact: true }).click();
  await expect(pending.getByRole('button', { name: 'Chờ gửi (0)', exact: true })).toBeVisible();
  expect(server.contributions.length).toBe(1); expect(server.uploads).toBe(1);
});

test('verified public catalogue updates offline search; corrupt update preserves the previous data', async ({ page, context }) => {
  const server = serverFixture(); server.publicPlaces = [{ key: 'mapai:new-cafe', id: 'new-cafe', name: 'Cafe vừa được duyệt', source: 'mapai', category: 'Cafe', lat: 16.06, lng: 108.22, address: 'Đà Nẵng' }];
  await attachServer(page, server); await ready(page);
  await page.getByRole('button', { name: 'Quản lý dữ liệu bản đồ', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Dữ liệu offline Đà Nẵng' });
  await dialog.getByRole('button', { name: 'Cập nhật địa điểm cộng đồng', exact: true }).click();
  await expect(dialog).toContainText('Phiên bản địa điểm:');
  server.catalogCorrupt = true; server.publicPlaces.push({ ...server.publicPlaces[0], id: 'bad', key: 'mapai:bad' });
  await dialog.getByRole('button', { name: 'Cập nhật địa điểm cộng đồng', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('không toàn vẹn');
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await context.setOffline(true); await page.reload();
  await page.getByRole('textbox', { name: 'Tìm địa điểm, địa chỉ', exact: true }).fill('Cafe vừa được duyệt');
  await expect(page.getByRole('button', { name: /Cafe vừa được duyệt/ })).toHaveCount(1);
});

test('logging out offline isolates account data and an expired cache falls back to guest', async ({ page, context }) => {
  const server = serverFixture(); await attachServer(page, server, 'alice'); await ready(page); await context.setOffline(true);
  await chooseLocalPlace(page); await page.getByRole('button', { name: 'Lưu yêu thích', exact: true }).click();
  await expect(page.getByLabel('Chờ đồng bộ', { exact: true })).toBeVisible();
  await page.goto('/profile'); await expect(page.getByText('Phiên ngoại tuyến • Đã xác thực trước đó', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click(); await context.setOffline(false);
  await login(page, 'bob'); await page.goto('/map');
  const bob = await saved(page); await expect(bob.getByRole('button', { name: 'Đã lưu (0)', exact: true })).toBeVisible();
  expect(server.pushes.some(p => p.owner === 'bob')).toBe(false);
  await bob.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.goto('/profile'); await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await login(page, 'alice'); await page.goto('/map');
  const alice = await saved(page); await expect(alice.getByRole('button', { name: 'Đã lưu (1)', exact: true })).toBeVisible();
  await expect.poll(() => server.accounts.get('alice')?.get(seedPlace.key)?.deleted).toBe(false);
  await context.setOffline(true);
  await page.evaluate(() => { const cached = JSON.parse(localStorage.getItem('mapai-verified-session')); cached.expiresAt = Date.now() - 1; localStorage.setItem('mapai-verified-session', JSON.stringify(cached)); });
  await page.reload(); const guest = await saved(page);
  await expect(guest).toContainText('Chế độ Khách'); await expect(guest.getByRole('button', { name: 'Đã lưu (0)', exact: true })).toBeVisible();
});

test('offline reviews are kept across reload and sent for the original account only', async ({ page, context }) => {
  const server = serverFixture(); const inside = { ...outsidePlace, id: 'review-place', key: 'mapai:review-place', name: 'Quán có đánh giá', lat: 16.06, lng: 108.22 };
  server.accounts.set('alice', new Map([[inside.key, { place: inside, deleted: false }]]));
  await attachServer(page, server, 'alice'); await ready(page); await context.setOffline(true);
  const dialog = await saved(page); await dialog.getByRole('button', { name: 'Chi tiết Quán có đánh giá', exact: true }).click();
  const reviews = page.getByRole('region', { name: 'Đánh giá cộng đồng MapAI', exact: true });
  await reviews.getByRole('button', { name: '5 sao', exact: true }).click();
  await reviews.getByLabel('Chia sẻ trải nghiệm', { exact: true }).fill('Đánh giá soạn khi mất mạng');
  await reviews.getByRole('button', { name: 'Gửi đánh giá', exact: true }).click();
  await expect(reviews).toContainText('Đã lưu đánh giá trên máy');
  await page.reload(); const pending = await saved(page); await pending.getByRole('button', { name: 'Chờ gửi (1)', exact: true }).click();
  await expect(pending).toContainText('Đánh giá soạn khi mất mạng');
  await context.setOffline(false);
  await expect(pending.getByRole('button', { name: 'Chờ gửi (0)', exact: true })).toBeVisible();
  const sent = server.pushes.find(p => p.kind === 'review'); expect(sent.owner).toBe('alice'); expect(sent.locationId).toBe('review-place');
});

test('upgrading the old device-only database preserves favorites in the guest partition', async ({ page }) => {
  const server = serverFixture(); await attachServer(page, server);
  await page.route('**/prepare-sync-upgrade', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Preparing old storage</body></html>' }));
  await page.goto('/prepare-sync-upgrade');
  await page.addScriptTag({ path: 'node_modules/dexie/dist/dexie.js' });
  await page.evaluate(async () => {
    const old = new window.Dexie('mapai-offline');
    old.version(1).stores({ packages: 'id', assets: 'path', places: 'id, category, district', favorites: 'placeId, savedAt', history: 'placeId, visitedAt', routes: 'id, createdAt' });
    await old.places.put({ id: 'mi-ba-mua', name: 'Mì Quảng Bà Mua', lat: 16.06, lng: 108.22, address: 'Đà Nẵng', category: 'food', district: 'Hải Châu', tags: [] });
    await old.favorites.put({ placeId: 'mi-ba-mua', savedAt: Date.now() });
    old.close();
  });
  await ready(page); const dialog = await saved(page);
  await expect(dialog).toContainText('Chế độ Khách');
  await expect(dialog.getByRole('button', { name: 'Đã lưu (1)', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Chi tiết Mì Quảng Bà Mua', exact: true })).toBeVisible();
});
