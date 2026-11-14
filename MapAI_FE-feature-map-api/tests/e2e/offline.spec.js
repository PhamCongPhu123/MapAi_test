import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/map');
  await expect(page.getByRole('heading', { name: '28 địa điểm đang chờ bạn' })).toBeVisible();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await expect(page.getByRole('button', { name: 'Xem Cầu Rồng', exact: true })).toBeVisible();
  await expect(page.locator('.offline-status-pill')).toContainText('Đà Nẵng sẵn sàng');
}

test('KT01/02: reload and reopen offline, search without accents, local details, favorites and history persist', async ({ page, context }) => {
  const errors = [];
  const external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://localhost:4173')) external.push(request.url()); });
  await ready(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.offline-status-pill')).toContainText('Offline • Đà Nẵng sẵn sàng');
  await page.getByRole('button', { name: 'Hải Châu', exact: true }).click();
  await page.getByRole('textbox', { name: 'Tìm địa điểm Đà Nẵng' }).fill('mi quang');
  await expect(page.getByRole('heading', { name: '2 địa điểm đang chờ bạn' })).toBeVisible();
  await page.getByRole('button', { name: 'Chi tiết Mì Quảng Bà Mua', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mì Quảng Bà Mua', exact: true })).toBeVisible();
  const selectedPin = page.getByRole('button', { name: 'Xem Mì Quảng Bà Mua', exact: true });
  const detailsPanel = page.getByRole('region', { name: 'Chi tiết địa điểm', exact: true });
  // A marker must be positioned on the map, not offset by normal document flow or hidden by the card.
  await expect(selectedPin).toHaveCSS('position', 'absolute');
  await expect.poll(async () => {
    const pin = await selectedPin.boundingBox(), card = await detailsPanel.boundingBox();
    if (!pin || !card) return false; // Markers are recreated when the animated camera reaches its destination.
    return page.viewportSize().width >= 1024 ? pin.x >= 0 && pin.x + pin.width < card.x : pin.y >= 0 && pin.y + pin.height < card.y;
  }).toBe(true);
  await expect(page.getByText('Tham khảo: 35.000–70.000đ', { exact: true })).toBeAttached();
  await page.getByRole('button', { name: 'Lưu yêu thích offline' }).click();
  await expect(page.getByRole('button', { name: 'Bỏ lưu địa điểm' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Danh sách địa điểm', exact: true }).click();
  await page.getByRole('button', { name: 'Đã lưu (1)', exact: true }).click();
  await expect(page.getByRole('heading', { name: '1 địa điểm đã lưu' })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/offline');
  await expect(second.locator('.offline-status-pill')).toContainText('Offline • Đà Nẵng sẵn sàng');
  await second.getByRole('button', { name: 'Đã lưu (1)', exact: true }).click();
  await expect(second.getByRole('button', { name: 'Chi tiết Mì Quảng Bà Mua', exact: true })).toBeVisible();
  await second.getByRole('button', { name: 'Gần đây', exact: true }).click();
  await expect(second.getByRole('heading', { name: '1 địa điểm đã xem' })).toBeVisible();
  await expect(second.getByRole('button', { name: 'Chi tiết Mì Quảng Bà Mua', exact: true })).toBeVisible();
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test('KT03: assistant clarifies area and opens a local recommendation without any backend', async ({ page, context }) => {
  await ready(page);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Mở trợ lý AI', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Trợ lý khám phá MapAI' }).or(page.getByRole('complementary', { name: 'Trợ lý khám phá MapAI' }));
  await dialog.getByRole('button', { name: 'Tìm quán ăn tối ngon', exact: true }).click();
  await expect(dialog.getByText('Bạn muốn tìm ở khu vực nào?', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Quanh Cầu Rồng', exact: true }).click();
  await expect(dialog.locator('.offline-ai-place')).toHaveCount(3);
  await dialog.getByRole('button', { name: 'Mở trên bản đồ →', exact: true }).first().click();
  if (page.viewportSize().width >= 1024) await expect(dialog).toBeVisible();
  else await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Chỉ đường tới đây', exact: true })).toBeVisible();
});

test('KT04: no GPS, route from Cầu Rồng, switch mode, then pick origin on the map', async ({ page, context }) => {
  await ready(page);
  await context.setOffline(true);
  await page.getByRole('textbox', { name: 'Tìm địa điểm Đà Nẵng' }).fill('mi quang');
  await page.getByRole('button', { name: 'Chi tiết Mì Quảng Bà Mua', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉ đường tới đây', exact: true }).click();
  await page.getByRole('button', { name: 'Cầu Rồng', exact: true }).click();
  await expect(page.locator('.offline-toast')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tính đường offline', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Kết quả chỉ đường' })).toContainText('Tính toán Offline · A*');
  await expect(page.locator('.offline-route-metrics')).toContainText('km');
  await expect(page.locator('.offline-turn-list li')).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Xe máy (ước tính)', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Kết quả chỉ đường' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tính đường offline', exact: true }).click();
  await expect(page.locator('.offline-route-metrics')).toContainText('xe máy');
  const cached = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('mapai-offline'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const route = await new Promise(resolve => { const r = db.transaction('routes').objectStore('routes').get('latest'); r.onsuccess = () => resolve(r.result); });
    db.close(); return route;
  });
  expect(cached.coordinates.length).toBeGreaterThan(5);
  expect(cached.mode).toBe('motorbike');
  await page.getByRole('button', { name: 'Chọn trên bản đồ', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Chạm bản đồ để chọn điểm xuất phát' })).toBeVisible();
  const map = page.locator('canvas');
  const bounds = await map.boundingBox();
  await map.click({ position: { x: bounds.width * 0.6, y: bounds.height * 0.42 } });
  await expect(page.locator('.offline-origin-display')).toContainText('Điểm chọn trên bản đồ');
});

test('KT05: empty state offers working recovery actions for unsupported search', async ({ page, context }) => {
  await ready(page); await context.setOffline(true);
  await page.getByRole('textbox', { name: 'Tìm địa điểm Đà Nẵng' }).fill('Bún bò Huế');
  await expect(page.getByRole('heading', { name: 'Chưa có kết quả trong gói Đà Nẵng' })).toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc · Mở rộng toàn thành phố', exact: true }).click();
  await expect(page.getByRole('heading', { name: '28 địa điểm đang chờ bạn' })).toBeVisible();
});

test('Simulator, accessible sheet heights, package deletion and reinstall preserve personal data', async ({ page, context }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Lưu Cầu Rồng', exact: true }).click();
  await page.getByRole('button', { name: 'Mở rộng bảng', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mở rộng bảng', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Thu gọn bảng', exact: true }).click();
  await page.getByRole('button', { name: 'Quản lý dữ liệu offline', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Dữ liệu offline Đà Nẵng' });
  await dialog.getByRole('switch', { name: 'Giả lập Offline', exact: true }).click();
  await expect(dialog.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByRole('button', { name: 'Đồng bộ lại khi có mạng', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(page.locator('.offline-status-pill')).toContainText('Giả lập Offline');
  await page.reload();
  await expect(page.locator('.offline-status-pill')).toContainText('Giả lập Offline');
  await page.getByRole('button', { name: 'Quản lý dữ liệu offline', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Dữ liệu offline Đà Nẵng' });
  await dialog.getByRole('button', { name: 'Xóa gói bản đồ', exact: true }).click();
  await dialog.getByRole('button', { name: 'Xác nhận xóa gói bản đồ khỏi thiết bị', exact: true }).click();
  await expect(dialog.getByText('Chưa tải', { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.offline-status-pill')).toContainText('Chưa tải dữ liệu');
  await page.getByRole('button', { name: 'Quản lý gói dữ liệu', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Dữ liệu offline Đà Nẵng' });
  await expect(dialog.getByRole('button', { name: 'Tải gói Đà Nẵng', exact: true })).toBeDisabled();
  await context.setOffline(false);
  await dialog.getByRole('switch').click();
  await dialog.getByRole('button', { name: 'Tải gói Đà Nẵng', exact: true }).click();
  await expect(dialog.getByText('28 địa điểm', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Đã lưu (1)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Chi tiết Cầu Rồng', exact: true })).toBeVisible();
});

test('Deleting an existing package online does not immediately download it again', async ({ page }) => {
  await ready(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: '28 địa điểm đang chờ bạn' })).toBeVisible();
  const downloads = [];
  page.on('request', request => { if (request.url().includes('/offline/manifest.json')) downloads.push(request.url()); });
  await page.getByRole('button', { name: 'Quản lý dữ liệu offline', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Dữ liệu offline Đà Nẵng' });
  await dialog.getByRole('button', { name: 'Xóa gói bản đồ', exact: true }).click();
  await dialog.getByRole('button', { name: 'Xác nhận xóa gói bản đồ khỏi thiết bị', exact: true }).click();
  await expect(dialog.getByText('Chưa tải', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Quản lý gói dữ liệu', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Dữ liệu offline Đà Nẵng' });
  await expect(dialog.getByRole('button', { name: 'Tải gói Đà Nẵng', exact: true })).toBeEnabled();
  await expect(dialog.getByText('Chưa tải', { exact: true })).toBeVisible();
  expect(downloads).toEqual([]);
});
