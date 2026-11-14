import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Model Capacitor's installed-file transport, not an Android emulator. No server,
// cached website, Service Worker or previous IndexedDB installation is available.
const bundle = fileURLToPath(new URL('../../dist-native/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png' };

test('installed mobile bundle initializes, searches and routes on a first offline launch', async ({ page, context }) => {
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://localhost:4175') { external.push(url.href); return route.abort(); }
    const file = ['/', '/offline', '/map'].includes(url.pathname) ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const target = path.resolve(bundle, file);
    if (!target.startsWith(bundle)) return route.abort();
    try { await route.fulfill({ body: await readFile(target), contentType: types[path.extname(file)] || 'application/octet-stream' }); }
    catch { await route.fulfill({ status: 404 }); }
  });
  await context.setOffline(true);
  await page.goto('/offline');
  await expect(page.locator('.offline-status-pill')).toContainText('Offline • Đà Nẵng sẵn sàng');
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
  await page.getByRole('textbox', { name: 'Tìm địa điểm Đà Nẵng' }).fill('mi quang');
  await page.getByRole('button', { name: 'Chi tiết Mì Quảng Bà Mua', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉ đường tới đây', exact: true }).click();
  await page.getByRole('button', { name: 'Cầu Rồng', exact: true }).click();
  await page.getByRole('button', { name: 'Tính đường offline', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Kết quả chỉ đường' })).toContainText('Tính toán Offline · A*');
  await page.evaluate(() => window.dispatchEvent(new Event('mapai:back', { cancelable: true })));
  await expect(page.getByRole('region', { name: 'Kết quả chỉ đường' })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.offline-status-pill')).toContainText('Offline • Đà Nẵng sẵn sàng');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
