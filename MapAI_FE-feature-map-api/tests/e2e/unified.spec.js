import { test, expect } from '@playwright/test';
import { mockStreetTiles } from './helpers/basemap.js';

async function ready(page) {
  await page.goto('/offline');
  await expect(page.getByRole('heading', { name: '28 địa điểm đang chờ bạn' })).toBeVisible();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

test('a guest can open the online URL offline and returns to login when connectivity returns', async ({ page, context }) => {
  await ready(page);
  await context.setOffline(true);
  await page.goto('/map');
  await expect(page.locator('.offline-status-pill')).toContainText('Offline • Đà Nẵng sẵn sàng');
  await expect(page).toHaveURL(/\/map$/);
  await page.getByRole('textbox', { name: 'Tìm địa điểm Đà Nẵng' }).fill('mi quang');
  await expect(page.getByRole('heading', { name: '2 địa điểm đang chờ bạn' })).toBeVisible();
  await context.setOffline(false);
  await expect(page).toHaveURL(/\/login$/);
});

test('one app switches between online and offline without discarding the session', async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem('accessToken', `header.${btoa(JSON.stringify({ sub: 'student' }))}.signature`));
  await mockStreetTiles(page);
  await page.route('**/api/v1/**', route => route.fulfill({ json: route.request().url().includes('/auth/me')
    ? { id: 'student', fullName: 'Sinh viên MapAI', role: 'User' } : [] }));
  await ready(page);
  await page.getByRole('link', { name: 'Bản đồ online', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dùng bản đồ offline' })).toBeVisible();
  await page.getByRole('button', { name: 'Dùng bản đồ offline' }).click();
  await expect(page).toHaveURL(/\/offline$/);
  await context.setOffline(true);
  await page.goto('/map');
  await expect(page.locator('.offline-status-pill')).toContainText('Offline • Đà Nẵng sẵn sàng');
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: 'Dùng bản đồ offline' })).toBeVisible();
  expect(await page.evaluate(() => Boolean(localStorage.getItem('accessToken')))).toBe(true);
});
