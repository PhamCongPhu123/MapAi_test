import { test, expect } from '@playwright/test';

test('Offline GPS, out-of-area fallback, sheet dragging and keyboard access work', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 16.0611, longitude: 108.2266 });
  await page.goto('/map');
  await expect(page.getByRole('heading', { name: '28 địa điểm đang chờ bạn' })).toBeVisible();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  const handle = page.getByRole('button', { name: 'Thay đổi chiều cao bảng' });
  const rect = await handle.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2, rect.y - 60, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Mở rộng bảng', exact: true })).toBeDisabled();
  await handle.focus(); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Mở rộng bảng', exact: true })).toBeEnabled();
  await page.getByRole('textbox', { name: 'Tìm địa điểm Đà Nẵng' }).fill('mi quang');
  await page.getByRole('button', { name: 'Chi tiết Mì Quảng Bà Mua', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉ đường tới đây', exact: true }).click();
  await expect(page.locator('.offline-origin-display')).toContainText('Vị trí GPS của bạn');
  await page.getByRole('button', { name: 'Tính đường offline', exact: true }).click();
  await expect(page.locator('.offline-route-metrics')).toContainText('km');
  await context.setGeolocation({ latitude: 10.78, longitude: 106.69 });
  await page.getByRole('button', { name: 'Dùng GPS', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ngoài gói Đà Nẵng');
  await expect(page.getByRole('button', { name: 'Cầu Rồng', exact: true })).toBeEnabled();
});
