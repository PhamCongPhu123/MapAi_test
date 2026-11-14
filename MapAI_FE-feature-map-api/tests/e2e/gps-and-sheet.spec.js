import { test, expect } from '@playwright/test';
import { setupMap, readyMap, chooseLocalPlace, routeLocally } from './helpers/unified.js';

test('denied GPS has a persistent explanation and the shared route panel supports landmarks and map origin', async ({ page, context }) => {
  await setupMap(page);
  await page.addInitScript(() => { navigator.geolocation.getCurrentPosition = (_ok, fail) => fail({ code: 1 }); });
  await readyMap(page); await context.setOffline(true);
  await page.getByRole('button', { name: 'Vị trí của tôi', exact: true }).click();
  await expect(page.locator('.map-notices')).toContainText('quyền');
  expect(await page.evaluate(() => sessionStorage.getItem('user_location'))).toBeNull();
  await chooseLocalPlace(page); await routeLocally(page);
  await page.getByRole('button', { name: 'Chọn trên bản đồ', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Chạm bản đồ để chọn điểm xuất phát' })).toBeVisible();
  const canvas = page.locator('.maplibregl-canvas'), box = await canvas.boundingBox();
  await canvas.click({ position: { x: box.width * .65, y: box.height * .45 } });
  await expect(page.getByPlaceholder('Chọn điểm xuất phát...')).toHaveValue('Điểm đã chọn trên bản đồ');
  await page.getByRole('button', { name: 'Đóng bảng chỉ đường', exact: true }).click();
  await page.getByRole('button', { name: 'Quản lý dữ liệu bản đồ', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Dữ liệu offline Đà Nẵng' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Quản lý dữ liệu bản đồ', exact: true })).toBeFocused();
});
