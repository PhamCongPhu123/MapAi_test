import { mockStreetTiles } from './helpers/basemap.js';
import { test, expect } from '@playwright/test';

const photoUrl = 'https://images.example.test/community-place.png';
const photoFile = { name: 'place.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1cAAAAASUVORK5CYII=', 'base64') };

async function setup(page) {
  const state = {
    actor: { id: 'student', fullName: 'Sinh viên MapAI', role: 'User' },
    places: [{ id: 'cafe-1', title: 'Quán Cộng Đồng', category: 'Cafe', latitude: 16.06, longitude: 108.22, address: '12 Đường thử nghiệm', rating: 4.9, totalReviews: 100, images: [], tags: [] }],
    contributions: [], reviews: [], failSave: false, failUpload: false, failSubmit: false, uploads: 0,
  };
  await page.addInitScript(() => localStorage.setItem('accessToken', `header.${btoa(JSON.stringify({ sub: 'student' }))}.signature`));
  await mockStreetTiles(page);
  await page.route(photoUrl, route => route.fulfill({ contentType: 'image/png', body: photoFile.buffer }));
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const method = route.request().method();
    const respond = (json, status = 200) => route.fulfill({ status, json, headers: { 'access-control-allow-origin': '*' } });
    const noContent = () => route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    if (path === '/auth/me') return respond(state.actor);
    if (path.startsWith('/map/')) return respond({ message: 'External search unavailable' }, 503);
    if (path === '/location/upload-thumbnail' && method === 'POST') {
      state.uploads++;
      expect(route.request().headers()['content-type']).toContain('multipart/form-data; boundary=');
      return state.failUpload ? respond({ message: 'Không thể tải ảnh lên.' }, 503) : respond({ url: photoUrl });
    }
    if (path === '/location/contributions' && method === 'POST') {
      if (state.failSubmit) return respond({ message: 'Chưa thể gửi đóng góp. Hãy thử lại.' }, 503);
      const body = route.request().postDataJSON();
      if (state.contributions.some(place => place.title === body.title)) return respond({ message: 'Địa điểm này đã tồn tại hoặc đang chờ duyệt.' }, 409);
      const place = { ...body, id: `proposal-${state.contributions.length + 1}`, status: 1, createdAt: new Date().toISOString() };
      state.contributions.push(place);
      return respond(place, 201);
    }
    if (path === '/location/contributions/mine' || path === '/location/contributions/pending') {
      const items = path.endsWith('pending') ? state.contributions.filter(place => place.status === 1) : state.contributions;
      return respond({ items, page: 1, pageSize: 10, totalCount: items.length });
    }
    if (/\/contributions\/[^/]+\/moderation$/.test(path)) {
      const id = path.split('/')[3];
      const body = route.request().postDataJSON();
      const place = state.contributions.find(place => place.id === id);
      place.status = body.status;
      place.moderationNote = body.note;
      if (body.status === 0) state.places.push({ ...place, isUserContribution: true });
      return noContent();
    }
    if (/\/reviews\/me$/.test(path)) {
      if (state.failSave) return respond({ message: 'Chưa lưu được đánh giá. Vui lòng thử lại.' }, 503);
      if (method === 'DELETE') state.reviews = state.reviews.filter(review => !review.isMine);
      else {
        const body = route.request().postDataJSON();
        state.reviews = state.reviews.filter(review => !review.isMine);
        state.reviews.push({ id: 'mine', authorName: state.actor.fullName, ...body, isMine: true, createdAt: new Date().toISOString() });
      }
      return method === 'DELETE' ? noContent() : respond(state.reviews.find(review => review.isMine));
    }
    if (path.endsWith('/reviews')) return respond({
      items: state.reviews, myReview: state.reviews.find(review => review.isMine) || null,
      totalCount: state.reviews.length, averageRating: state.reviews.length ? state.reviews.reduce((sum, review) => sum + review.rating, 0) / state.reviews.length : null,
      page: 1, pageSize: 10,
    });
    if (path === '/location') {
      const title = url.searchParams.get('title')?.toLowerCase() || '';
      return respond(state.places.filter(place => place.title.toLowerCase().includes(title)));
    }
    if (path.startsWith('/location/')) {
      const place = state.places.find(place => place.id === path.split('/')[2]);
      return place ? respond(place) : respond({ message: 'Không tìm thấy địa điểm.' }, 404);
    }
    return respond([]);
  });
  return state;
}

test('submit a place using GPS and map pin, preserve draft, then see pending status', async ({ page, context }, testInfo) => {
  const state = await setup(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 16.07, longitude: 108.23 });
  await page.goto('/map');
  await page.getByRole('button', { name: '+ Thêm địa điểm', exact: true }).click();
  await page.getByLabel('Tên địa điểm', { exact: true }).fill('Quán mới gần nhà');
  await page.getByLabel('Địa chỉ', { exact: true }).fill('21 Đường cộng đồng');
  const descriptionField = page.getByRole('region', { name: 'Mô tả địa điểm', exact: true });
  const photoField = page.getByRole('region', { name: 'Ảnh địa điểm', exact: true });
  await expect(descriptionField.getByRole('textbox')).toBeVisible();
  await expect(photoField.getByLabel('Ảnh địa điểm')).toHaveAttribute('type', 'file');
  await descriptionField.getByRole('textbox').fill('Quán có sân vườn, mở cửa từ 7 giờ.');
  await photoField.scrollIntoViewIfNeeded();
  await page.locator('.community-dialog').screenshot({ path: testInfo.outputPath('description-and-photo.png') });
  await page.getByRole('region', { name: 'Ảnh địa điểm', exact: true }).getByLabel('Ảnh địa điểm').setInputFiles(photoFile);
  await expect(page.getByAltText('Ảnh địa điểm xem trước')).toBeVisible();
  expect(state.uploads).toBe(0);
  await page.getByRole('button', { name: 'Dùng vị trí hiện tại' }).click();
  await expect(page.getByLabel('Vĩ độ', { exact: true })).toHaveValue('16.07');
  await page.getByRole('button', { name: 'Chọn trên bản đồ' }).click();
  await expect(page.getByText('Kéo bản đồ để đặt ghim đúng vị trí địa điểm.')).toBeVisible();
  await page.getByRole('button', { name: 'Dùng vị trí ghim này' }).click();
  await expect(page.getByLabel('Tên địa điểm', { exact: true })).toHaveValue('Quán mới gần nhà');
  await expect(page.getByAltText('Ảnh địa điểm xem trước')).toBeVisible();
  await page.getByRole('button', { name: 'Gửi địa điểm chờ duyệt' }).click();
  await expect(page.getByText('Đã gửi địa điểm, đang chờ quản trị viên duyệt.')).toBeVisible();
  expect(state.contributions[0].status).toBe(1);
  expect(state.contributions[0].thumbnail).toBe(photoUrl);
  expect(state.contributions[0].description).toBe('Quán có sân vườn, mở cửa từ 7 giờ.');
  expect(state.uploads).toBe(1);
  expect(state.places).toHaveLength(1);
  await page.getByRole('button', { name: 'Hoàn tất', exact: true }).click();
  await page.getByRole('button', { name: 'Đóng góp của tôi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quán mới gần nhà', exact: true })).toBeVisible();
  await expect(page.getByText('Chờ duyệt', { exact: true })).toBeVisible();
  await expect(page.getByAltText('Ảnh Quán mới gần nhà')).toBeVisible();
  await page.getByRole('button', { name: 'Đóng danh sách đóng góp' }).click();
  await page.getByRole('button', { name: 'Về trang chủ' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(errors).toEqual([]);
});

test('photo can be removed and invalid files are rejected inside the existing dialog', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/map');
  await page.getByRole('button', { name: '+ Thêm địa điểm', exact: true }).click();
  await page.getByRole('region', { name: 'Ảnh địa điểm', exact: true }).getByLabel('Ảnh địa điểm').setInputFiles(photoFile);
  await expect(page.getByAltText('Ảnh địa điểm xem trước')).toBeVisible();
  await page.getByRole('button', { name: 'Xóa ảnh', exact: true }).click();
  await expect(page.getByAltText('Ảnh địa điểm xem trước')).toHaveCount(0);
  await page.getByRole('region', { name: 'Ảnh địa điểm', exact: true }).getByLabel('Ảnh địa điểm').setInputFiles({ name: 'image.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert')).toContainText('Chỉ chấp nhận');
  await page.getByRole('region', { name: 'Ảnh địa điểm', exact: true }).getByLabel('Ảnh địa điểm').setInputFiles({ ...photoFile, buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(page.getByRole('alert')).toContainText('tối đa 5 MB');
  expect(state.uploads).toBe(0);
  expect(new URL(page.url()).pathname).toBe('/map');
});

test('failed photo upload preserves the pending draft and retry reuses the uploaded photo', async ({ page }) => {
  const state = await setup(page);
  state.failUpload = true;
  await page.goto('/map');
  await page.getByRole('button', { name: '+ Thêm địa điểm', exact: true }).click();
  await page.getByLabel('Tên địa điểm', { exact: true }).fill('Quán có ảnh');
  await page.getByLabel('Địa chỉ', { exact: true }).fill('12 Đà Nẵng');
  await page.getByRole('region', { name: 'Ảnh địa điểm', exact: true }).getByLabel('Ảnh địa điểm').setInputFiles(photoFile);
  await page.getByRole('button', { name: 'Gửi địa điểm chờ duyệt' }).click();
  await expect(page.getByRole('alert')).toContainText('Không thể tải ảnh');
  await expect(page.getByAltText('Ảnh địa điểm xem trước')).toBeVisible();
  await expect(page.getByLabel('Tên địa điểm', { exact: true })).toHaveValue('Quán có ảnh');
  expect(state.contributions).toHaveLength(0);
  state.failUpload = false;
  state.failSubmit = true;
  await page.getByRole('button', { name: 'Gửi địa điểm chờ duyệt' }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa thể gửi đóng góp');
  expect(state.uploads).toBe(2);
  state.failSubmit = false;
  await page.getByRole('button', { name: 'Gửi địa điểm chờ duyệt' }).click();
  await expect(page.getByText('Đã gửi địa điểm, đang chờ quản trị viên duyệt.')).toBeVisible();
  expect(state.uploads).toBe(2);
  expect(state.contributions[0]).toMatchObject({ status: 1, thumbnail: photoUrl });
  expect(state.places).toHaveLength(1);
});

test('a place can still be submitted for moderation without a photo', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/map');
  await page.getByRole('button', { name: '+ Thêm địa điểm', exact: true }).click();
  await page.getByLabel('Tên địa điểm', { exact: true }).fill('Quán không ảnh');
  await page.getByLabel('Địa chỉ', { exact: true }).fill('12 Đà Nẵng');
  await page.getByRole('button', { name: 'Gửi địa điểm chờ duyệt' }).click();
  await expect(page.getByText('Đã gửi địa điểm, đang chờ quản trị viên duyệt.')).toBeVisible();
  expect(state.uploads).toBe(0);
  expect(state.contributions[0]).toMatchObject({ status: 1, thumbnail: null });
  expect(state.places).toHaveLength(1);
});

test('duplicate proposal reports an error and keeps entered details', async ({ page }) => {
  const state = await setup(page);
  state.contributions.push({ id: 'duplicate', title: 'Quán đã gửi', status: 1 });
  await page.goto('/map');
  await page.getByRole('button', { name: '+ Thêm địa điểm', exact: true }).click();
  await page.getByLabel('Tên địa điểm', { exact: true }).fill('Quán đã gửi');
  await page.getByLabel('Địa chỉ', { exact: true }).fill('12 Địa chỉ');
  await page.getByRole('button', { name: 'Gửi địa điểm chờ duyệt' }).click();
  await expect(page.getByRole('alert')).toContainText('đã tồn tại');
  await expect(page.getByLabel('Tên địa điểm', { exact: true })).toHaveValue('Quán đã gửi');
});

test('approved local places remain searchable when external map search fails', async ({ page }) => {
  await setup(page);
  await page.goto('/map');
  await page.getByPlaceholder('Tìm địa điểm, địa chỉ...').fill('Cộng Đồng');
  await page.getByRole('button', { name: /Quán Cộng Đồng/ }).click();
  await expect(page).toHaveURL(/placeId=cafe-1/);
  await expect(page.locator('.place-detail-card').getByRole('heading', { name: 'Quán Cộng Đồng', exact: true })).toBeVisible();
});

test('approved MapAI marker opens its stored place directly', async ({ page }) => {
  await setup(page);
  await page.goto('/map');
  const canvas = page.locator('.maplibregl-canvas');
  await page.getByRole('button', { name: 'Vị trí của tôi', exact: true }).waitFor();
  // The fixture place sits at the initial map center.
  await expect(async () => {
    const bounds = await canvas.boundingBox();
    await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
    await expect(page.locator('.place-detail-card')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 8000 });
  await expect(page.locator('.place-detail-card').getByRole('heading', { name: 'Quán Cộng Đồng', exact: true })).toBeVisible();
});

test('write, edit and delete one community review without changing imported ratings', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/map?placeId=cafe-1');
  const section = page.getByRole('region', { name: 'Đánh giá cộng đồng MapAI' });
  await expect(section.getByText('Chưa có đánh giá. Hãy chia sẻ trải nghiệm đầu tiên!')).toBeVisible();
  await section.getByRole('button', { name: '5 sao', exact: true }).click();
  await section.getByLabel('Chia sẻ trải nghiệm').fill('Món ngon, phục vụ tốt');
  await section.getByRole('button', { name: 'Gửi đánh giá', exact: true }).click();
  await expect(section.getByText('5.0/5 · 1 đánh giá', { exact: true })).toBeVisible();
  expect(state.places[0].rating).toBe(4.9);
  await section.getByRole('button', { name: '3 sao', exact: true }).click();
  await section.getByLabel('Chia sẻ trải nghiệm').fill('Đã cập nhật: món ngon nhưng chờ lâu');
  await section.getByRole('button', { name: 'Cập nhật đánh giá', exact: true }).click();
  await expect(section.getByText('3.0/5 · 1 đánh giá', { exact: true })).toBeVisible();
  expect(state.reviews).toHaveLength(1);
  await section.getByRole('button', { name: 'Xóa đánh giá của tôi' }).click();
  await section.getByRole('button', { name: 'Xác nhận xóa đánh giá' }).click();
  await expect(section.getByText('Chưa có đánh giá. Hãy chia sẻ trải nghiệm đầu tiên!')).toBeVisible();
  expect(state.reviews).toHaveLength(0);
});

test('failed review save keeps the draft available for retry', async ({ page }) => {
  const state = await setup(page);
  state.failSave = true;
  await page.goto('/map?placeId=cafe-1');
  const section = page.getByRole('region', { name: 'Đánh giá cộng đồng MapAI' });
  await section.getByRole('button', { name: '4 sao', exact: true }).click();
  await section.getByLabel('Chia sẻ trải nghiệm').fill('Bản đánh giá chưa gửi');
  await section.getByRole('button', { name: 'Gửi đánh giá', exact: true }).click();
  await expect(section.getByRole('alert')).toContainText('Chưa lưu được');
  await expect(section.getByLabel('Chia sẻ trải nghiệm')).toHaveValue('Bản đánh giá chưa gửi');
  state.failSave = false;
  await section.getByRole('button', { name: 'Gửi đánh giá', exact: true }).click();
  await expect(section.getByText('4.0/5 · 1 đánh giá', { exact: true })).toBeVisible();
});

test('admin approves a contribution and must provide a reason to reject another', async ({ page }) => {
  const state = await setup(page);
  state.actor.role = 'Admin';
  state.contributions.push(
    { id: 'pending-a', title: 'Cafe chờ duyệt', thumbnail: photoUrl, status: 1, address: '12 Đà Nẵng', latitude: 16.06, longitude: 108.22, createdAt: new Date().toISOString() },
    { id: 'pending-b', title: 'Địa điểm sai', status: 1, address: '99 Đà Nẵng', latitude: 16.05, longitude: 108.23, createdAt: new Date().toISOString() },
  );
  await page.goto('/admin/contributions');
  const approved = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Cafe chờ duyệt', exact: true }) });
  await expect(approved.getByAltText('Ảnh Cafe chờ duyệt')).toBeVisible();
  await approved.getByRole('button', { name: 'Duyệt địa điểm', exact: true }).click();
  await expect(approved).toHaveCount(0);
  expect(state.places.some(place => place.id === 'pending-a')).toBe(true);
  expect(state.places.find(place => place.id === 'pending-a').thumbnail).toBe(photoUrl);
  const rejected = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Địa điểm sai', exact: true }) });
  await rejected.getByRole('button', { name: 'Từ chối', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ghi lý do từ chối');
  await rejected.getByLabel('Ghi chú cho Địa điểm sai').fill('Địa chỉ không khớp vị trí');
  await rejected.getByRole('button', { name: 'Từ chối', exact: true }).click();
  await expect(page.getByText('Không có địa điểm đang chờ duyệt.')).toBeVisible();
  expect(state.contributions.find(place => place.id === 'pending-b').moderationNote).toBe('Địa chỉ không khớp vị trí');
});
