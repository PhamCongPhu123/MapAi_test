import { mockStreetTiles } from './helpers/basemap.js';
import { test, expect } from '@playwright/test';

const assistant = page => page.getByRole('complementary', { name: 'Trợ lý khám phá MapAI' })
  .or(page.getByRole('dialog', { name: 'Trợ lý khám phá MapAI' }));

test('Online and offline use the same desktop map/chat split and dark assistant surface', async ({ page }) => {
  test.skip(page.viewportSize().width < 1024, 'The split layout is for desktop; mobile uses a full-width map.');
  // Isolate visual comparison from online credentials and third-party basemap availability.
  await page.addInitScript(() => {
    const payload = btoa(JSON.stringify({ id: 'visual-reference', role: 'User' }));
    localStorage.setItem('accessToken', `reference.${payload}.reference`);
  });
  await page.route('**/auth/me', route => route.fulfill({ json: { id: 'visual-reference', role: 'User' } }));
  await page.route('**/style.json*', route => route.fulfill({ json: {
    version: 8, sources: {}, layers: [{ id: 'base', type: 'background', paint: { 'background-color': '#E1E9E5' } }],
  } }));
  await page.route('**/map/search?*', route => route.fulfill({ json: [
    { display_name: 'Cầu Rồng, Đà Nẵng', lat: '16.0611', lon: '108.2266', type: 'bridge' },
  ] }));
  await mockStreetTiles(page);
  await page.route('**/api/v1/location', route => route.fulfill({ json: [] }));
  await page.goto('/map/online');
  const onlinePanel = page.locator('header').filter({ hasText: 'MapAI Assistant' }).locator('..');
  await expect(onlinePanel).toBeVisible();
  await expect.poll(async () => (await onlinePanel.boundingBox()).width / page.viewportSize().width).toBeCloseTo(0.3, 2);
  const referenceColor = await onlinePanel.evaluate(node => getComputedStyle(node).backgroundColor);
  // Choosing an online search result must stay in the online flow.
  await page.getByPlaceholder('Tìm địa điểm, địa chỉ...').fill('cau rong');
  await page.getByRole('button', { name: /Cầu Rồng, Đà Nẵng/ }).click();
  await expect(page).toHaveURL(/\/map\?lat=16\.0611&lng=108\.2266/);
  await page.goto('/offline');
  await expect(page.getByRole('heading', { name: '28 địa điểm đang chờ bạn' })).toBeVisible();
  const offlinePanel = page.getByRole('complementary', { name: 'Trợ lý khám phá MapAI' });
  await expect(offlinePanel).toBeVisible();
  await expect(offlinePanel).toHaveCSS('background-color', referenceColor);
  await expect.poll(async () => (await offlinePanel.boundingBox()).width / page.viewportSize().width).toBeCloseTo(0.3, 2);
  await page.getByRole('button', { name: 'Ẩn trợ lý AI', exact: true }).click();
  await expect(offlinePanel).toHaveCount(0);
  await expect.poll(async () => (await page.locator('.offline-map-workspace').boundingBox()).width / page.viewportSize().width).toBeCloseTo(1, 2);
  // The rendered map must grow along with its container, not leave a blank strip.
  await expect.poll(() => page.locator('canvas').evaluate(node => node.clientWidth)).toBe(page.viewportSize().width);
});

test('The dark assistant retains its conversation after closing and reopening offline', async ({ page, context }) => {
  await page.goto('/offline');
  await expect(page.getByRole('heading', { name: '28 địa điểm đang chờ bạn' })).toBeVisible();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Mở trợ lý AI', exact: true }).click();
  const panel = assistant(page);
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Tìm quán ăn tối ngon', exact: true }).click();
  await expect(panel.getByText('Bạn muốn tìm ở khu vực nào?', { exact: false })).toBeVisible();
  if (page.viewportSize().width < 1024) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Mở trợ lý AI', exact: true })).toBeFocused();
  } else await panel.getByRole('button', { name: 'Đóng trợ lý', exact: true }).click();
  await expect(panel).toHaveCount(0);
  await page.getByRole('button', { name: 'Hiện trợ lý AI', exact: true }).click();
  await expect(panel.locator('.offline-chat-message.is-user').getByText('Tìm quán ăn tối ngon', { exact: true })).toHaveCount(1);
  await panel.getByRole('button', { name: 'Quanh Cầu Rồng', exact: true }).click();
  await expect(panel.locator('.offline-ai-place')).toHaveCount(3);
});
