import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { setupMap, readyMap } from './helpers/unified.js';

test('online and offline have identical map/chat dimensions and panel colors', async ({ page, context }, info) => {
  await setupMap(page); await readyMap(page);
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Mở trợ lý AI', exact: true }).click();
  const panel = page.locator('#map-chat');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS('transform', 'none');
  const before = await panel.boundingBox();
  const color = await panel.evaluate(n => getComputedStyle(n).backgroundColor);
  if (info.project.name === 'desktop') expect(before.width / page.viewportSize().width).toBeCloseTo(.3, 2);
  if (process.env.MAPAI_SCREENSHOTS_DIR) {
    fs.mkdirSync(process.env.MAPAI_SCREENSHOTS_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.MAPAI_SCREENSHOTS_DIR, `mapai-${info.project.name}-online.png`) });
  }
  await context.setOffline(true); await expect(page.getByTestId('map-status')).toContainText('Offline');
  await expect(page.getByRole('region', { name: 'Bản đồ OpenFreeMap', exact: true })).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  expect(await panel.boundingBox()).toEqual(before);
  expect(await panel.evaluate(n => getComputedStyle(n).backgroundColor)).toBe(color);
  await expect(page.getByLabel('Nguồn bản đồ', { exact: true })).toHaveValue('openfreemap');
  if (process.env.MAPAI_SCREENSHOTS_DIR) await page.screenshot({ path: path.join(process.env.MAPAI_SCREENSHOTS_DIR, `mapai-${info.project.name}-offline.png`) });
});

test('the shared toolbar fits narrow screens and landscape in both connection modes', async ({ page, context }) => {
  await setupMap(page); await readyMap(page);
  for (const offline of [false, true]) {
    await context.setOffline(offline);
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 640 }]) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole('textbox', { name: 'Tìm địa điểm, địa chỉ', exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const box = await page.locator('.map-search').boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
  }
});
