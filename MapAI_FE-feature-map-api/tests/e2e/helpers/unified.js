import { expect } from '@playwright/test';
import { mockStreetTiles } from './basemap.js';

export async function setupMap(page) {
  const calls = [];
  const bridge = { id: 'bridge-server', title: 'Cầu Rồng', latitude: 16.0611, longitude: 108.2266, address: 'Đà Nẵng', category: 'Tourist attraction', images: [], tags: [] };
  await mockStreetTiles(page);
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url());
    calls.push(url.pathname);
    let json = [];
    if (url.pathname.endsWith('/location')) json = [bridge];
    if (url.pathname.endsWith('/location/bridge-server')) json = bridge;
    if (url.pathname.endsWith('/reviews')) json = { items: [], myReview: null, totalCount: 0, averageRating: null };
    if (url.pathname.endsWith('/ai/ask')) json = { message: 'Phản hồi từ dịch vụ online.' };
    if (url.pathname.endsWith('/map/direction')) json = {
      geometry: { type: 'LineString', coordinates: [[108.2266, 16.0611], [108.224, 16.067]] },
      distance: 800, duration: 300, legs: [{ steps: [] }],
    };
    return route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
  return calls;
}
export async function readyMap(page) {
  await page.goto('/map');
  await expect(page.getByTestId('map-status')).toContainText('Đà Nẵng sẵn sàng', { timeout: 45000 });
  await expect(page.getByRole('region', { name: 'Bản đồ OpenFreeMap', exact: true })).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
}
export async function chooseLocalPlace(page) {
  await page.getByRole('textbox', { name: 'Tìm địa điểm, địa chỉ', exact: true }).fill('mi quang');
  await page.getByRole('button', { name: /Mì Quảng Bà Mua/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Mì Quảng Bà Mua', exact: true })).toBeVisible();
}
export async function routeLocally(page) {
  await page.getByRole('button', { name: 'Dẫn đường', exact: true }).click();
  await page.getByRole('button', { name: 'Cầu Rồng', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Kết quả chỉ đường' })).toBeVisible();
  await expect(page.getByText('Tuyến tham khảo từ gói Đà Nẵng', { exact: false })).toBeVisible();
}
