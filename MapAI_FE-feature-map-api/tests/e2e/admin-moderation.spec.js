import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Asia/Bangkok' });

const photoUrl = 'https://images.example.test/moderation-photo.png';
const pendingPlace = (id, overrides = {}) => ({
  id, title: 'Cà phê Bên Sông', category: 'Cafe', address: '12 Trần Hưng Đạo, Đà Nẵng',
  submittedByName: 'Nguyễn An', latitude: 16.061, longitude: 108.227,
  description: 'Quán có không gian ngoài trời, nằm bên bờ sông Hàn.\nMở cửa từ 7 giờ đến 22 giờ.',
  thumbnail: photoUrl, status: 1, createdAt: '2026-11-12T02:00:00Z', ...overrides,
});

async function setup(page, items = []) {
  const state = { items, failLoad: false, failReview: false, reviews: [], loads: 0 };
  await page.addInitScript(() => localStorage.setItem('accessToken', `header.${btoa(JSON.stringify({ sub: 'admin-fixture' }))}.signature`));
  await page.route(photoUrl, route => route.fulfill({ path: new URL('../../src/assets/hero.png', import.meta.url).pathname, contentType: 'image/png' }));
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url());
    const respond = (json, status = 200) => route.fulfill({ json, status });
    if (url.pathname.endsWith('/auth/me')) return respond({ id: 'admin-fixture', role: 'Admin', fullName: 'Quản trị viên', email: 'admin@example.test' });
    if (url.pathname.endsWith('/location/contributions/pending')) {
      state.loads++;
      if (state.failLoad) return respond({ message: 'Chưa thể tải đóng góp. Vui lòng thử lại.' }, 503);
      const pageNumber = Number(url.searchParams.get('page') || 1);
      const pending = state.items.filter(place => place.status === 1);
      return respond({ items: pending.slice((pageNumber - 1) * 10, pageNumber * 10), totalCount: pending.length, page: pageNumber, pageSize: 10 });
    }
    if (url.pathname.endsWith('/moderation')) {
      const body = route.request().postDataJSON();
      state.reviews.push(body);
      if (state.failReview) return respond({ message: 'Chưa lưu được kết quả duyệt. Vui lòng thử lại.' }, 503);
      const place = state.items.find(item => url.pathname.endsWith(`/${item.id}/moderation`));
      place.status = body.status;
      place.moderationNote = body.note;
      return route.fulfill({ status: 204 });
    }
    return respond([]);
  });
  return state;
}

test('empty moderation queue has the admin layout and can refresh without overflowing', async ({ page }, testInfo) => {
  const state = await setup(page);
  await page.goto('/admin/contributions');
  await expect(page.getByRole('heading', { name: 'Không có địa điểm đang chờ duyệt.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Danh sách chờ duyệt' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mở bản đồ', exact: true })).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('button', { name: 'Tải lại danh sách' })).toBeEnabled();
  const before = state.loads;
  await page.getByRole('button', { name: 'Tải lại danh sách' }).click();
  await expect.poll(() => state.loads).toBeGreaterThan(before);
  await expect(page.getByRole('heading', { name: 'Không có địa điểm đang chờ duyệt.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('moderation-empty.png'), animations: 'disabled' });
});

test('moderation filters and detail form retain drafts, show location and handle keyboard dismissal', async ({ page }, testInfo) => {
  await setup(page, [pendingPlace('cafe'), pendingPlace('fuel', { title: 'Trạm xăng Sông Hàn', category: 'Cây xăng', thumbnail: null, submittedByName: 'Trần Bình' })]);
  await page.goto('/admin/contributions');
  const cafe = page.getByRole('button', { name: 'Xem và duyệt Cà phê Bên Sông', exact: true });
  const fuel = page.getByRole('button', { name: 'Xem và duyệt Trạm xăng Sông Hàn', exact: true });
  await expect(cafe).toBeVisible();
  await expect(fuel).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('moderation-list.png'), animations: 'disabled' });
  await page.getByRole('searchbox', { name: 'Tìm đóng góp trong trang' }).fill('tram xang');
  await expect(fuel).toBeVisible();
  await expect(cafe).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Tìm đóng góp trong trang' }).fill('không có kết quả');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy đóng góp phù hợp' })).toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await page.getByRole('combobox', { name: 'Lọc danh mục trong trang' }).selectOption('Cafe');
  await expect(cafe).toBeVisible();
  await expect(fuel).toHaveCount(0);
  await cafe.click();
  const dialog = page.getByRole('dialog', { name: 'Duyệt địa điểm', exact: true });
  await expect(dialog.getByRole('heading', { name: 'Cà phê Bên Sông', exact: true })).toBeVisible();
  await expect(dialog.getByAltText('Ảnh Cà phê Bên Sông')).toBeVisible();
  const location = new URL(await dialog.getByRole('link', { name: 'Xem vị trí' }).getAttribute('href'), 'https://example.test');
  expect(location.searchParams.get('lat')).toBe('16.061');
  expect(location.searchParams.get('lng')).toBe('108.227');
  await expect(dialog.getByRole('link', { name: 'Xem vị trí' })).toHaveAttribute('target', '_blank');
  await dialog.getByLabel('Ghi chú cho Cà phê Bên Sông').fill('Cần kiểm tra lại địa chỉ trước khi duyệt.');
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
  await page.screenshot({ path: testInfo.outputPath('moderation-review.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(cafe).toBeFocused();
  await cafe.click();
  await expect(dialog.getByLabel('Ghi chú cho Cà phê Bên Sông')).toHaveValue('Cần kiểm tra lại địa chỉ trước khi duyệt.');
});

test('failed moderation preserves the note and retries without removing the pending place', async ({ page }) => {
  const state = await setup(page, [pendingPlace('cafe')]);
  state.failReview = true;
  await page.goto('/admin/contributions');
  await page.getByRole('button', { name: 'Xem và duyệt Cà phê Bên Sông', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Duyệt địa điểm', exact: true });
  const note = dialog.getByLabel('Ghi chú cho Cà phê Bên Sông');
  await note.fill('Tọa độ chưa đúng với địa chỉ.');
  await dialog.getByRole('button', { name: 'Từ chối', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Chưa lưu được kết quả duyệt');
  await expect(dialog.getByRole('alert')).toBeInViewport();
  await expect(note).toHaveValue('Tọa độ chưa đúng với địa chỉ.');
  expect(state.items[0].status).toBe(1);
  state.failReview = false;
  await dialog.getByRole('button', { name: 'Từ chối', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Không có địa điểm đang chờ duyệt.' })).toBeVisible();
  expect(state.items[0].moderationNote).toBe('Tọa độ chưa đúng với địa chỉ.');
  expect(state.reviews).toHaveLength(2);
});

test('approving the last item on a page returns to the remaining pending queue', async ({ page }) => {
  await setup(page, Array.from({ length: 11 }, (_, index) => pendingPlace(`item-${index + 1}`, { title: `Địa điểm ${index + 1}`, thumbnail: null })));
  await page.goto('/admin/contributions');
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect(page.getByText('Trang 2/2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xem và duyệt Địa điểm 11', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Duyệt địa điểm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Xem và duyệt Địa điểm 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Xem và duyệt Địa điểm \d+/, exact: true })).toHaveCount(10);
  await expect(page.getByRole('navigation', { name: 'Phân trang đóng góp' })).toHaveCount(0);
});

test('approving the last place in a filtered category reveals the other pending categories', async ({ page }) => {
  await setup(page, [pendingPlace('cafe'), pendingPlace('fuel', { title: 'Trạm xăng Sông Hàn', category: 'Cây xăng', thumbnail: null })]);
  await page.goto('/admin/contributions');
  await page.getByRole('combobox', { name: 'Lọc danh mục trong trang' }).selectOption('Cafe');
  await page.getByRole('button', { name: 'Xem và duyệt Cà phê Bên Sông', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Duyệt địa điểm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Xem và duyệt Trạm xăng Sông Hàn', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Lọc danh mục trong trang' })).toHaveValue('');
});

test('loading errors offer retry instead of a misleading empty moderation queue', async ({ page }) => {
  const state = await setup(page, [pendingPlace('cafe')]);
  state.failLoad = true;
  await page.goto('/admin/contributions');
  await expect(page.getByRole('alert')).toContainText('Chưa tải được danh sách');
  await expect(page.getByRole('heading', { name: 'Không có địa điểm đang chờ duyệt.' })).toHaveCount(0);
  state.failLoad = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Xem và duyệt Cà phê Bên Sông', exact: true })).toBeVisible();
});
