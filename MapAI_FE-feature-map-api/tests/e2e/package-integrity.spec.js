import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
test('A corrupt update is rejected atomically, keeping the previous offline package usable', async ({ page }) => {
  await page.goto('/map');
  await expect(page.getByRole('heading', { name: '28 địa điểm đang chờ bạn' })).toBeVisible();
  await page.route('**/offline/roads.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.getByRole('button', { name: 'Quản lý dữ liệu offline', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Dữ liệu offline Đà Nẵng' });
  await dialog.getByRole('button', { name: 'Đồng bộ lại khi có mạng', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('không toàn vẹn');
  await expect(dialog.getByText('28 địa điểm', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('textbox', { name: 'Tìm địa điểm Đà Nẵng' }).fill('mi quang');
  await expect(page.getByRole('heading', { name: '2 địa điểm đang chờ bạn' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '28 địa điểm đang chờ bạn' })).toBeVisible();
});
