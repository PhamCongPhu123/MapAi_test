import { test, expect } from '@playwright/test';
import { setupMap, readyMap } from './helpers/unified.js';

test('one OpenFreeMap canvas, toolbar and chat survive a full connectivity round trip', async ({ page, context }, testInfo) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await setupMap(page); await readyMap(page);
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  const search = await page.getByRole('textbox', { name: 'Tìm địa điểm, địa chỉ', exact: true }).elementHandle();
  const toolbar = await page.locator('.map-search').boundingBox();
  const chatColor = await page.locator('#map-chat').evaluate(n => getComputedStyle(n).backgroundColor);
  await context.setOffline(true);
  await expect(page.getByTestId('map-status')).toContainText('Offline');
  await expect(page).toHaveURL(/\/map$/);
  expect(await canvas.evaluate(n => n === document.querySelector('.maplibregl-canvas'))).toBe(true);
  expect(await search.evaluate(n => n === document.querySelector('[aria-label="Tìm địa điểm, địa chỉ"]'))).toBe(true);
  expect(await page.locator('.map-search').boundingBox()).toEqual(toolbar);
  expect(await page.locator('#map-chat').evaluate(n => getComputedStyle(n).backgroundColor)).toBe(chatColor);
  await expect(page.getByRole('button', { name: '+ Thêm địa điểm', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Nguồn bản đồ', { exact: true })).toHaveValue('openfreemap');
  await context.setOffline(false);
  await expect(page.getByTestId('map-status')).toContainText('Online');
  expect(await canvas.evaluate(n => n === document.querySelector('.maplibregl-canvas'))).toBe(true);
  await expect(page.getByRole('button', { name: '+ Thêm địa điểm', exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
  if (testInfo.project.name === 'mobile') expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('search uses the API online, local POIs offline, and rejects delayed online results', async ({ page, context }) => {
  const calls = await setupMap(page); await readyMap(page);
  const input = page.getByRole('textbox', { name: 'Tìm địa điểm, địa chỉ', exact: true });
  await input.fill('cau rong');
  await expect(page.getByRole('button', { name: /Cầu Rồng/ }).first()).toBeVisible();
  expect(calls.some(path => path.endsWith('/map/search'))).toBe(true);
  await context.setOffline(true); await expect(page.getByTestId('map-status')).toContainText('Offline');
  const before = calls.length;
  await input.fill('mi quang');
  await page.getByRole('button', { name: /Mì Quảng Bà Mua/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Mì Quảng Bà Mua', exact: true })).toBeVisible();
  expect(calls.length).toBe(before);
  await context.setOffline(false); await expect(page.getByTestId('map-status')).toContainText('Online');
  await page.getByRole('button', { name: 'Đóng chi tiết địa điểm' }).click();
  await page.route('**/api/v1/map/search?**', async route => {
    await new Promise(resolve => setTimeout(resolve, 1200));
    await route.fulfill({ json: [{ display_name: 'Kết quả cũ không được hiển thị', lat: '16.06', lon: '108.22' }] }).catch(() => {});
  });
  await input.fill('delayed');
  await page.waitForRequest('**/api/v1/map/search?**');
  await context.setOffline(true);
  await input.fill('mi quang');
  await expect(page.getByRole('button', { name: /Mì Quảng Bà Mua/ }).first()).toBeVisible();
  await expect(page.getByText('Kết quả cũ không được hiển thị')).toHaveCount(0);
});

test('legacy URLs are aliases of the same automatic map feature', async ({ page }) => {
  await setupMap(page);
  for (const path of ['/offline?lat=16.06&lng=108.22', '/map/online?lat=16.06&lng=108.22']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/map\?lat=16\.06&lng=108\.22$/);
    await expect(page.getByRole('textbox', { name: 'Tìm địa điểm, địa chỉ', exact: true })).toBeVisible();
  }
});
