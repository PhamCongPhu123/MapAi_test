import { test, expect } from '@playwright/test';
import { mockStreetTiles, rasterTile } from './helpers/basemap.js';

const centerPlace = { id: 'center-cafe', title: 'Cafe kiểm thử', latitude: 16.06, longitude: 108.22,
  category: 'Cafe', address: 'Test address', images: [], tags: [] };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('accessToken', `header.${btoa(JSON.stringify({ id: 'student' }))}.signature`));
  await mockStreetTiles(page);
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: path.endsWith('/reviews') ? { items: [], totalCount: 0, myReview: null, averageRating: null, page: 1, pageSize: 10 } : path.endsWith('/location/center-cafe') ? centerPlace : path.endsWith('/auth/me')
      ? { id: 'student', role: 'User' } : path.endsWith('/location')
        ? [centerPlace, { id: 'bridge', title: 'Cầu Rồng', latitude: 16.0612, longitude: 108.2275 },
          { id: 'invalid', title: 'Invalid', latitude: 108, longitude: 16 }] : [] });
  });
});

test('keyless map loads street tiles and preserves longitude/latitude when selecting the map center', async ({ page }) => {
  test.skip(Boolean(process.env.MAPAI_TEST_MAPTILER_KEY), 'Tests default keyless configuration');
  const requests = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto('/map?lat=16.0612&lng=108.2275');
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('OpenStreetMap contributors');
  await expect.poll(() => requests.some(url => url.startsWith('https://tile.openstreetmap.org/'))).toBe(true);
  expect(requests.some(url => url.includes('demotiles.maplibre.org'))).toBe(false);
  // Wait for flyTo, then the contribution form must read the exact camera center.
  await expect(page.locator('.maplibregl-marker')).toBeVisible();
  await expect.poll(async () => {
    const marker = await page.locator('.maplibregl-marker').boundingBox();
    const canvas = await page.locator('.maplibregl-canvas').boundingBox();
    return marker && canvas ? Math.hypot(marker.x + marker.width / 2 - canvas.x - canvas.width / 2,
      marker.y + marker.height / 2 - canvas.y - canvas.height / 2) : Infinity;
  }, { timeout: 6000 }).toBeLessThan(1);
  await page.getByRole('button', { name: '+ Thêm địa điểm' }).click();
  await expect(page.getByLabel('Vĩ độ', { exact: true })).toHaveValue('16.061200');
  await expect(page.getByLabel('Kinh độ', { exact: true })).toHaveValue('108.227500');
  expect(errors).toEqual([]);
});

test('desktop positioning retries after a high-accuracy timeout and refreshes the current location on the next click', async ({ page }) => {
  await page.addInitScript(() => {
    window.__gpsCalls = [];
    window.__gpsLatitude = 16.0612;
    navigator.geolocation.getCurrentPosition = (ok, fail, options) => {
      window.__gpsCalls.push(options);
      if (options.enableHighAccuracy) fail({ code: 3 });
      else ok({ coords: { latitude: window.__gpsLatitude, longitude: 108.2275, accuracy: 50 }, timestamp: Date.now() });
    };
  });
  await page.goto('/map');
  const locate = page.getByRole('button', { name: 'Vị trí của tôi', exact: true });
  await locate.click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('user_location'))?.lat)).toBe(16.0612);
  await page.evaluate(() => { window.__gpsLatitude = 16.0712; });
  await locate.click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('user_location'))?.lat)).toBe(16.0712);
  const options = await page.evaluate(() => window.__gpsCalls);
  expect(options.map(o => o.enableHighAccuracy)).toEqual([true, false, true, false]);
  expect(options.every(o => o.maximumAge === 0)).toBe(true);
  await expect(page.locator('.map-notices')).toHaveCount(0);
});

test('denied desktop location has a persistent recovery action and never retains a stale fix', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('user_location', JSON.stringify({ lat: 10, lng: 105, timestamp: 1 }));
    navigator.geolocation.getCurrentPosition = (_ok, fail) => fail({ code: 1 });
  });
  await page.goto('/map');
  await page.getByRole('button', { name: 'Vị trí của tôi', exact: true }).click();
  await expect(page.locator('.map-notices')).toContainText('cấp quyền vị trí');
  expect(await page.evaluate(() => sessionStorage.getItem('user_location'))).toBeNull();
  await page.evaluate(() => { navigator.geolocation.getCurrentPosition = ok => ok({ coords: { latitude: 16.06, longitude: 108.22, accuracy: 30 }, timestamp: Date.now() }); });
  await page.getByRole('button', { name: 'Thử định vị lại' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('user_location'))?.lng)).toBe(108.22);
  await expect(page.locator('.map-notices')).toHaveCount(0);
});

test('street tile failures are visible and the retry action restores the basemap with its places', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', async route => route.fulfill(await page.evaluate(() => window.__tilesAllowed)
    ? { body: rasterTile, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } }
    : { status: 503, body: 'unavailable', headers: { 'access-control-allow-origin': '*' } }));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/map');
  await expect(page.locator('.map-notices')).toContainText('Không tải được bản đồ đường phố');
  await page.getByRole('button', { name: 'Thử tải lại bản đồ' }).evaluate(button => button.addEventListener('click', () => { window.__tilesAllowed = true; }, { capture: true, once: true }));
  await page.getByRole('button', { name: 'Thử tải lại bản đồ' }).click();
  await expect(page.locator('.map-notices')).toHaveCount(0);
  const canvas = page.locator('.maplibregl-canvas');
  const bounds = await canvas.boundingBox();
  await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
  await expect(page.locator('.place-detail-card')).toContainText('Cafe kiểm thử');
  expect(errors).toEqual([]);
});

test('MapTiler failure switches to street tiles without losing the community overlay', async ({ page }) => {
  test.skip(!process.env.MAPAI_TEST_MAPTILER_KEY, 'Run with MAPAI_TEST_MAPTILER_KEY=test-only');
  await page.route('https://api.maptiler.com/**', route => route.fulfill({ status: 401, body: 'Invalid key', headers: { 'access-control-allow-origin': '*' } }));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/map');
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('OpenStreetMap contributors');
  await expect(page.getByRole('button', { name: 'Vị trí của tôi', exact: true })).toBeVisible();
  await expect(page.locator('.map-notices')).toHaveCount(0);
  const canvas = page.locator('.maplibregl-canvas');
  const bounds = await canvas.boundingBox();
  await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
  await expect(page.locator('.place-detail-card')).toContainText('Cafe kiểm thử');
  expect(errors).toEqual([]);
});
