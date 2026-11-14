import { test, expect } from '@playwright/test';
import { setupMap, readyMap, chooseLocalPlace, routeLocally } from './helpers/unified.js';

test('reload, new tab, local details, favorites and recent places work without any API request', async ({ page, context }) => {
  const calls = await setupMap(page); await readyMap(page);
  await context.setOffline(true); await page.reload();
  await expect(page.getByTestId('map-status')).toContainText('Offline');
  const before = calls.length;
  await chooseLocalPlace(page);
  await page.getByRole('button', { name: 'Lưu yêu thích', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bỏ lưu địa điểm' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Đóng chi tiết địa điểm' }).click();
  await page.getByRole('button', { name: 'Đã lưu / Gần đây' }).click();
  const dialog = page.getByRole('dialog', { name: 'Bộ sưu tập trên thiết bị' });
  await dialog.getByRole('button', { name: 'Đã lưu (1)', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Chi tiết Mì Quảng Bà Mua', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Gần đây', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Chi tiết Mì Quảng Bà Mua', exact: true })).toBeVisible();
  const next = await context.newPage(); await next.goto('/map');
  await expect(next.getByTestId('map-status')).toContainText('Offline');
  await next.getByRole('button', { name: 'Đã lưu / Gần đây' }).click();
  await expect(next.getByRole('button', { name: 'Đã lưu (1)', exact: true })).toBeVisible();
  expect(calls.length).toBe(before);
});

test('the shared directions panel computes walking and motorbike routes from local roads', async ({ page, context }) => {
  const calls = await setupMap(page); await readyMap(page);
  await context.setOffline(true); const before = calls.length;
  await chooseLocalPlace(page); await routeLocally(page);
  await page.getByRole('button', { name: 'Phương tiện: Xe máy (ước tính)', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Kết quả chỉ đường' })).toBeVisible();
  expect(calls.length).toBe(before);
  await page.getByRole('button', { name: 'Đóng bảng chỉ đường', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Kết quả chỉ đường' })).toHaveCount(0);
});

test('the same assistant clarifies an area, opens a local recommendation and preserves its conversation', async ({ page, context }, info) => {
  const calls = await setupMap(page); await readyMap(page);
  await context.setOffline(true); const before = calls.length;
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Mở trợ lý AI', exact: true }).click();
  await page.getByRole('textbox', { name: 'Hỏi trợ lý MapAI', exact: true }).fill('Tìm quán ăn tối ngon');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(page.getByText('Bạn muốn tìm ở khu vực nào?', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Quanh Cầu Rồng', exact: true }).click();
  const suggestion = page.locator('#map-chat button').filter({ hasText: 'Gói Đà Nẵng' }).first();
  await expect(suggestion).toBeVisible(); await suggestion.click();
  await expect(page.getByRole('button', { name: 'Dẫn đường', exact: true })).toBeVisible();
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Đóng chi tiết địa điểm', exact: true }).click();
    await page.getByRole('button', { name: 'Mở trợ lý AI', exact: true }).click();
  }
  await expect(page.getByText('Tìm quán ăn tối ngon', { exact: true })).toBeVisible();
  expect(calls.length).toBe(before);
});

test('empty local search and unsupported categories disclose the bounded package', async ({ page, context }) => {
  await setupMap(page); await readyMap(page); await context.setOffline(true);
  await page.getByRole('textbox', { name: 'Tìm địa điểm, địa chỉ', exact: true }).fill('not-an-existing-place-1234');
  await expect(page.getByRole('status').filter({ hasText: 'Chưa có kết quả trong gói Đà Nẵng' })).toBeVisible();
  await page.getByRole('button', { name: 'Xóa từ khóa', exact: true }).click();
  await page.getByRole('button', { name: 'Trạm xăng', exact: true }).click();
  await expect(page.getByText('Chưa có Trạm xăng trong gói đã tải.', { exact: true })).toBeVisible();
});

test('simulation keeps the same map and deleting/reinstalling the package preserves saved places', async ({ page, context }) => {
  const calls = await setupMap(page); await readyMap(page);
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  await page.getByRole('button', { name: 'Quản lý dữ liệu bản đồ', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Dữ liệu offline Đà Nẵng' });
  await dialog.getByRole('switch', { name: 'Giả lập Offline' }).click();
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(page.getByTestId('map-status')).toContainText('Giả lập Offline');
  expect(await canvas.evaluate(n => n === document.querySelector('.maplibregl-canvas'))).toBe(true);
  const before = calls.length;
  await chooseLocalPlace(page);
  await page.getByRole('button', { name: 'Lưu yêu thích', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bỏ lưu địa điểm', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Đóng chi tiết địa điểm', exact: true }).click();
  await page.getByRole('button', { name: 'Quản lý dữ liệu bản đồ', exact: true }).click();
  await dialog.getByRole('button', { name: 'Xóa gói bản đồ', exact: true }).click();
  await dialog.getByRole('button', { name: 'Xác nhận xóa gói bản đồ khỏi thiết bị', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Tải gói Đà Nẵng', exact: true })).toBeDisabled();
  await context.setOffline(true); await context.setOffline(false);
  await expect(page.getByTestId('map-status')).toContainText('Giả lập Offline');
  expect(calls.length).toBe(before);
  await dialog.getByRole('switch', { name: 'Giả lập Offline' }).click();
  await dialog.getByRole('button', { name: 'Tải gói Đà Nẵng', exact: true }).click();
  await expect(dialog.getByText('28 địa điểm', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Đã lưu / Gần đây', exact: true }).click();
  const saved = page.getByRole('dialog', { name: 'Bộ sưu tập trên thiết bị' });
  await saved.getByRole('button', { name: 'Đã lưu (1)', exact: true }).click();
  await expect(saved.getByRole('button', { name: 'Chi tiết Mì Quảng Bà Mua', exact: true })).toBeVisible();
});
