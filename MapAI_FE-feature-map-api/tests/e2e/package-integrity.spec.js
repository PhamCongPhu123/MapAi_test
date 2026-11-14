import { test, expect } from '@playwright/test';
import { setupMap } from './helpers/unified.js';

test.use({ serviceWorkers: 'block' });
test('a corrupt OpenFreeMap package update leaves the installed data intact', async ({ page }) => {
  await setupMap(page); await page.goto('/map');
  await expect(page.getByTestId('map-status')).toContainText('Dữ liệu đã lưu', { timeout: 45000 });
  await page.route('**/offline/roads.json', route => route.fulfill({ contentType: 'application/json', body: '{}' }));
  await page.getByRole('button', { name: 'Quản lý dữ liệu bản đồ', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Dữ liệu offline Đà Nẵng' });
  await dialog.getByRole('button', { name: 'Đồng bộ lại khi có mạng', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('không toàn vẹn', { timeout: 30000 });
  await expect(dialog.getByText('28 địa điểm', { exact: false })).toBeVisible();
  await dialog.getByRole('switch', { name: 'Giả lập Offline' }).click();
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('textbox', { name: 'Tìm địa điểm, địa chỉ', exact: true }).fill('mi quang');
  await expect(page.getByRole('button', { name: /Mì Quảng Bà Mua/ }).first()).toBeVisible();
});
