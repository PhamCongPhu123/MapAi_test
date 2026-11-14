import { mockStreetTiles } from './helpers/basemap.js';
import { test, expect } from '@playwright/test';

const user = { id: 'student', fullName: 'Sinh viên MapAI', email: 'student@example.com', role: 'User' };
const token = `header.${Buffer.from(JSON.stringify({ sub: user.id, exp: 4102444800 })).toString('base64url')}.signature`;

test.beforeEach(async ({ page }) => {
  // Isolate layout and navigation from external map credentials and database state.
  await mockStreetTiles(page);
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    let json = [];
    if (path.endsWith('/auth/login')) json = { accessToken: token, refreshToken: 'test-only-refresh' };
    if (path.endsWith('/auth/me')) json = user;
    if (path.endsWith('/location/search')) json = { id: 'dragon-bridge', title: 'Cầu Rồng', latitude: 16.0612, longitude: 108.2275, address: 'Đà Nẵng', rating: 4.8, tags: [] };
    if (path.endsWith('/reviews')) json = { items: [], myReview: null, totalCount: 0, averageRating: null, page: 1, pageSize: 10 };
    return route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
});

async function authenticate(page) {
  await page.addInitScript(accessToken => localStorage.setItem('accessToken', accessToken), token);
}

test('home fits viewport; small screens expose bottom navigation', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#root')).not.toBeEmpty();
  const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  if (testInfo.project.name === 'phone') {
    await expect(navigation).toBeVisible();
    await navigation.getByRole('link', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/login$/);
  } else await expect(navigation).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('email login calls existing API and returns to requested map', async ({ page }) => {
  await page.goto('/map?lat=16.0544&lng=108.2022');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByPlaceholder('Email', { exact: true }).fill(user.email);
  await page.getByPlaceholder('Mật khẩu', { exact: true }).fill('test-only-password');
  const login = page.waitForRequest(request => request.url().endsWith('/auth/login') && request.method() === 'POST');
  await page.locator('form').getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  expect((await login).postDataJSON()).toEqual({ email: user.email, password: 'test-only-password' });
  await expect(page).toHaveURL(/\/map\?lat=16\.0544&lng=108\.2022$/);
  await expect(page.getByPlaceholder('Tìm địa điểm, địa chỉ...')).toBeVisible();
});

test('map chat opens, closes and handles Back before navigation', async ({ page }, testInfo) => {
  await authenticate(page);
  await page.goto('/map');
  if (testInfo.project.name === 'phone') {
    await expect(page.getByRole('button', { name: 'Mở trợ lý AI' })).toBeVisible();
    await page.getByRole('button', { name: 'Mở trợ lý AI' }).click();
    await expect(page.getByPlaceholder('Hỏi trợ lý MapAI...')).toBeInViewport();
    await page.getByRole('button', { name: 'Đóng trợ lý AI' }).click();
    await expect(page.getByRole('button', { name: 'Mở trợ lý AI' })).toBeVisible();
    await page.getByRole('button', { name: 'Mở trợ lý AI' }).click();
    expect(await page.evaluate(() => window.dispatchEvent(new Event('mapai:back', { cancelable: true })))).toBe(false);
    await expect(page.getByRole('button', { name: 'Mở trợ lý AI' })).toBeVisible();
    await expect(page).toHaveURL(/\/map$/);
  } else {
    await expect(page.getByPlaceholder('Hỏi trợ lý MapAI...')).toBeVisible();
    await page.getByRole('button', { name: 'Đóng trợ lý AI' }).click();
    await expect(page.getByRole('button', { name: 'Mở trợ lý AI' })).toBeVisible();
  }
  const search = await page.getByPlaceholder('Tìm địa điểm, địa chỉ...').boundingBox();
  expect(search.x).toBeGreaterThanOrEqual(0);
  expect(search.x + search.width).toBeLessThanOrEqual(page.viewportSize().width);
});

test('directions panel fits phone width and closes on Back', async ({ page }, testInfo) => {
  await authenticate(page);
  await page.goto('/map');
  await page.getByRole('button', { name: 'Chỉ đường', exact: true }).click();
  await expect(page.getByText('Lập lộ trình', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Để tôi tự nhập' }).click();
  const panel = await page.locator('.directions-panel').boundingBox();
  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.x + panel.width).toBeLessThanOrEqual(page.viewportSize().width);
  if (testInfo.project.name === 'phone') {
    expect(await page.evaluate(() => window.dispatchEvent(new Event('mapai:back', { cancelable: true })))).toBe(false);
    await expect(page.getByText('Lập lộ trình', { exact: true })).toBeHidden();
  }
});

test('web location fallback stores the chosen position for routing', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 16.0544, longitude: 108.2022 });
  await authenticate(page);
  await page.goto('/map');
  await page.getByRole('button', { name: 'Vị trí của tôi', exact: true }).click();
  await expect(page.getByText('Đã định vị thành công!', { exact: true })).toBeVisible();
  const position = await page.evaluate(() => JSON.parse(sessionStorage.getItem('user_location')));
  expect(position.lat).toBe(16.0544);
  expect(position.lng).toBe(108.2022);
});

test('place details fit viewport and phone layout survives landscape rotation', async ({ page }, testInfo) => {
  await authenticate(page);
  await page.goto('/map');
  await page.waitForFunction(() => Boolean(window.showPlaceDetails));
  await page.evaluate(() => window.showPlaceDetails('Cầu Rồng', 108.2275, 16.0612));
  await expect(page.locator('.place-detail-card')).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  if (testInfo.project.name === 'phone') {
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      const card = page.locator('.place-detail-card');
      await expect(card).toBeInViewport({ ratio: 0.95 });
      const bounds = await card.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    }
    await expect(page.getByRole('button', { name: 'Mở trợ lý AI' })).toBeVisible();
  }
  expect(await page.evaluate(() => window.dispatchEvent(new Event('mapai:back', { cancelable: true })))).toBe(false);
  await expect(page.locator('.place-detail-card')).toBeHidden();
});

test('explore returns to page one after typing, changing category or choosing a suggestion', async ({ page }) => {
  const locations = Array.from({ length: 16 }, (_, index) => ({
    id: `place-${index + 1}`,
    title: index < 8 ? `Cafe đẹp ${index + 1}` : `Quán ăn ${index - 7}`,
    category: index < 8 ? 'Cafe' : 'Ăn uống',
    latitude: 16.0544,
    longitude: 108.2022,
    thumbnail: '/favicon.svg',
    rating: 4.2,
    tags: [],
  }));
  await page.route('**/api/v1/location', route => route.fulfill({
    json: locations,
    headers: { 'access-control-allow-origin': '*' },
  }));
  await authenticate(page);
  await page.goto('/explore');

  const pageOne = page.getByRole('button', { name: '1', exact: true });
  const pageTwo = page.getByRole('button', { name: '2', exact: true });
  const search = page.getByPlaceholder('Bạn muốn đi đâu ở Đà Nẵng?');
  const firstCafe = page.getByRole('heading', { name: 'Cafe đẹp 1', exact: true });

  await pageTwo.click();
  await expect(pageTwo).toHaveClass(/bg-indigo-600/);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
  await expect(pageTwo).toHaveClass(/bg-indigo-600/);
  await search.fill('Cafe');
  await expect(pageOne).toHaveClass(/bg-indigo-600/);
  await expect(firstCafe).toBeVisible();
  await expect(page.getByText('8 địa điểm được tìm thấy', { exact: true })).toBeVisible();

  // Clear the search dropdown before selecting a category, then scroll back
  // from the results so the fixed header does not cover the category button.
  await search.fill('');
  await pageTwo.click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.getByRole('button', { name: 'Cafe', exact: true }).click();
  await expect(pageOne).toHaveClass(/bg-indigo-600/);
  await expect(firstCafe).toBeVisible();

  await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
  await search.fill('');
  await pageTwo.click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.getByRole('button', { name: 'Cafe đẹp', exact: true }).click();
  await expect(pageOne).toHaveClass(/bg-indigo-600/);
  await expect(firstCafe).toBeVisible();

  await pageTwo.click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.getByRole('button', { name: 'Cafe đẹp', exact: true }).click();
  await expect(pageTwo).toHaveClass(/bg-indigo-600/);
});
