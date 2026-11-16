import { test, expect } from '@playwright/test';
import { attachServer, serverFixture, ready } from './helpers/sync.js';
const external = { canonicalId: 'osm:node:900100', osmType: 'node', osmId: '900100', sourceType: 'openstreetmap', name: 'Bến xe buýt Tra Cứu Online', lat: 16.0612, lng: 108.2265, categoryMapping: 'bus', address: 'Hải Châu, Đà Nẵng' };
const curated = { canonicalId: 'mapai:cafe-1', mapaiId: 'cafe-1', id: 'cafe-1', sourceType: 'mapai_curated', name: 'Cà phê MapAI', lat: 16.06, lng: 108.22, rating: 4.8, categoryMapping: 'cafe' };
const input = page => page.getByRole('textbox', { name: 'Tìm địa điểm, địa chỉ', exact: true });
async function setup(page, account) {
  const server = serverFixture(); await attachServer(page, server, account);
  const searches = [];
  await page.route('**/api/v1/map/unified-search?**', route => { searches.push(new URL(route.request().url()).searchParams.get('q')); return route.fulfill({ json: { places: [external, curated], warnings: [], sourceStatus: { mapai: 'ok', osm: 'ok' } } }); });
  await ready(page); return { server, searches };
}
async function closeDetail(page) { await page.getByRole('button', { name: 'Đóng chi tiết địa điểm', exact: true }).click(); }
async function openChat(page) { const button = page.getByRole('button', { name: 'Mở trợ lý AI' }); if (await button.count() && await button.isVisible()) await button.click(); }

test('one search shows source filters and OSM details without public imports', async ({ page }) => {
  const { server } = await setup(page, 'alice');
  await input(page).fill('xe buyt');
  await expect(page.getByRole('button', { name: /Bến xe buýt Tra Cứu Online/ })).toBeVisible();
  await page.getByRole('button', { name: 'Bản đồ mở OSM', exact: true }).click();
  await expect(page.getByRole('button', { name: /Cà phê MapAI/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Gợi ý MapAI', exact: true }).click();
  await expect(page.getByRole('button', { name: /Bến xe buýt Tra Cứu Online/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
  await page.getByRole('button', { name: /Bến xe buýt Tra Cứu Online/ }).click();
  await expect(page.getByRole('heading', { name: external.name, exact: true })).toBeVisible();
  await expect(page.getByText('© OpenStreetMap contributors · ODbL 1.0', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bổ sung nhận xét', exact: true })).toBeVisible();
  expect(server.pushes).toHaveLength(0);
  expect(server.calls.some(c => c.path.includes('osm:'))).toBe(false);
});

test('packaged OSM and previously searched OSM survive offline reload on the same map', async ({ page, context }) => {
  const { server } = await setup(page);
  await input(page).fill('Tra Cứu Online');
  await page.getByRole('button', { name: /Bến xe buýt Tra Cứu Online/ }).click(); await closeDetail(page);
  await context.setOffline(true); await page.reload();
  await expect(page.getByTestId('map-status')).toContainText('Offline');
  const before = server.calls.length;
  await input(page).fill('tram xe buyt tra cuu online');
  await page.getByRole('button', { name: /Bến xe buýt Tra Cứu Online/ }).click();
  await expect(page.getByRole('heading', { name: external.name, exact: true })).toBeVisible();
  await closeDetail(page); await input(page).fill('ben xe buyt viet han');
  await page.getByRole('button', { name: /Viet Han \(to Hoi An\)/ }).click();
  await expect(page.getByRole('heading', { name: 'Viet Han (to Hoi An)', exact: true })).toBeVisible();
  await expect(page.getByLabel('Nguồn bản đồ', { exact: true })).toHaveValue('openfreemap');
  expect(server.calls.length).toBe(before);
});

test('offline ChatAI finds packaged transit and opens shared directions without external APIs', async ({ page, context }) => {
  const { server } = await setup(page);
  await context.setOffline(true); const before = server.calls.length;
  await openChat(page);
  await page.getByPlaceholder('Hỏi trợ lý MapAI...').fill('Chỉ đường đến bến xe buýt Việt Hàn');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(page.getByText('Viet Han (to Hoi An)', { exact: true })).toBeVisible();
  await expect(page.locator('.directions-panel input').last()).toHaveValue(/Viet\s+Han|Việt\s+Hàn/);
  expect(server.calls.length).toBe(before);
});

test('favorite triggers lazy reference sync and acknowledges the stable canonical ID', async ({ page }) => {
  const { server } = await setup(page, 'alice');
  await page.route('**/api/v1/sync/operations', async route => {
    const op = route.request().postDataJSON(); server.pushes.push(op);
    if (op.kind === 'favorite') {
      if (!server.accounts.has('alice')) server.accounts.set('alice', new Map());
      server.accounts.get('alice').set(op.payload.place.key, { ...op.payload, place: { ...op.payload.place, mapaiId: 'linked-uuid' } });
    }
    return route.fulfill({ json: { id: op.id, kind: op.kind, resourceId: op.payload.place?.key, mapaiLocationId: 'linked-uuid' } });
  });
  await input(page).fill('Tra Cứu Online');
  await page.getByRole('button', { name: /Bến xe buýt Tra Cứu Online/ }).click();
  expect(server.pushes).toHaveLength(0);
  await page.getByRole('button', { name: 'Lưu yêu thích', exact: true }).click();
  await expect.poll(() => server.pushes.length).toBe(1);
  expect(server.pushes[0].payload.place.key).toBe(external.canonicalId);
  expect(server.pushes[0].payload.place.osmId).toBe(external.osmId);
  await expect(page.locator('.place-detail-card .source-badge')).toHaveText('OSM · Đã đồng bộ');
});


test('an OSM review is queued offline with its original identity and sent after reconnect', async ({ page, context }) => {
  const { server } = await setup(page, 'alice');
  await input(page).fill('Tra Cứu Online');
  await page.getByRole('button', { name: /Bến xe buýt Tra Cứu Online/ }).click();
  const reviews = page.getByRole('region', { name: 'Đánh giá cộng đồng MapAI', exact: true });
  await page.getByRole('button', { name: 'Bổ sung nhận xét', exact: true }).click();
  await reviews.getByRole('button', { name: '5 sao', exact: true }).click();
  await reviews.getByRole('textbox', { name: 'Chia sẻ trải nghiệm', exact: true }).fill('Đánh giá điểm OSM từ điện thoại offline');
  await context.setOffline(true);
  await reviews.getByRole('button', { name: 'Gửi đánh giá', exact: true }).click();
  await expect(reviews.getByRole('status')).toContainText('Sẽ tự gửi khi có mạng');
  expect(server.pushes).toHaveLength(0);
  await context.setOffline(false);
  await expect.poll(() => server.pushes.filter(p => p.kind === 'review').length).toBe(1);
  const job = server.pushes.find(p => p.kind === 'review');
  expect(job.locationId).toBe(external.canonicalId); expect(job.place.osmId).toBe(external.osmId);
  expect(job.payload.rating).toBe(5);
});
