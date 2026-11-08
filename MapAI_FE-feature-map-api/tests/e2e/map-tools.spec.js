import { test, expect } from '@playwright/test';

const routeData = {
  distance: 180, duration: 60, geometry: { type: 'LineString', coordinates: [[108.22, 16.06], [108.221, 16.061]] },
  legs: [{ steps: [{ distance: 180, duration: 60, name: 'Đường thử nghiệm', maneuver: { type: 'depart', modifier: 'straight', location: [108.22, 16.06] } }] }],
};
async function setup(page, context) {
  const state = {
    action: { type: 'NEAREST_SEARCH', value: { category: 'fuel', radius: 5000 } },
    search: { categoryName: 'Cây xăng', warnings: [], places: [{ id: 'osm:node:1', name: 'Cây xăng kiểm thử', lat: 16.061, lng: 108.221, source: 'openstreetmap', category: 'fuel', distanceMeters: 150 }] },
    searches: [], chats: [], directions: [], nearestRoutes: [],
  };
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 16.06, longitude: 108.22 });
  await page.addInitScript(() => {
    localStorage.setItem('accessToken', `header.${btoa(JSON.stringify({ sub: 'student' }))}.signature`);
    sessionStorage.setItem('user_location', JSON.stringify({ lat: 10, lng: 105, timestamp: 1 }));
  });
  await page.route('https://demotiles.maplibre.org/**', route => route.fulfill({
    json: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0f172a' } }] },
    headers: { 'access-control-allow-origin': '*' },
  }));
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const respond = json => route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
    if (path.endsWith('/auth/me')) return respond({ id: 'student', fullName: 'Sinh viên', role: 'User' });
    if (path.endsWith('/ai/ask')) {
      const body = route.request().postDataJSON();
      state.chats.push(body);
      return respond({ message: 'Đang xử lý yêu cầu bản đồ.', action: body.userInput === 'Chỉ đường đến đó' ? { type: 'SET_DIRECTION', destination: body.selectedLocation } : state.action });
    }
    if (path.endsWith('/map/nearest') || path.endsWith('/map/places')) { state.searches.push(url); return respond(state.search); }
    if (path.endsWith('/map/nearest/direction')) {
      state.nearestRoutes.push(route.request().postDataJSON());
      return respond({ search: state.search, destination: state.search.places[0], route: routeData });
    }
    if (path.endsWith('/map/direction')) { state.directions.push(route.request().postDataJSON()); return respond(routeData); }
    return respond([]);
  });
  await page.goto('/map');
  await page.getByRole('button', { name: 'Vị trí của tôi', exact: true }).waitFor();
  const open = page.getByRole('button', { name: 'Mở trợ lý AI' });
  if (await open.isVisible()) await open.click();
  return state;
}
async function ask(page, text) {
  const input = page.getByPlaceholder('Hỏi trợ lý MapAI...');
  await input.fill(text);
  await input.press('Enter');
}

test('chat nearest command uses fresh GPS, then follow-up routes to the actual result', async ({ page, context }) => {
  const state = await setup(page, context);
  await ask(page, 'Tôi muốn tìm cây xăng gần nhất');
  await expect(page.getByText(/Trong dữ liệu tìm được, Cây xăng kiểm thử gần nhất/)).toBeVisible();
  expect(state.searches[0].searchParams.get('lat')).toBe('16.06');
  expect(state.searches[0].searchParams.get('lng')).toBe('108.22');
  expect(state.searches[0].searchParams.get('category')).toBe('fuel');
  await expect(page.getByText(/150 m theo đường thẳng/)).toBeVisible();
  await ask(page, 'Chỉ đường đến đó');
  await expect(page.getByText('Lập lộ trình', { exact: true })).toBeVisible();
  await expect.poll(() => state.directions.length).toBe(1);
  expect(state.directions[0].endLat).toBe(16.061);
  expect(state.chats[1].selectedLocation.id).toBe('osm:node:1');
  expect(state.chats[1].chatHistory.some(message => message.role === 'model' && typeof message.text === 'string')).toBe(true);
});

test('route-to-nearest draws supplied walking route without recalculating a driving route', async ({ page, context }) => {
  const state = await setup(page, context);
  state.action = { type: 'ROUTE_TO_NEAREST', value: { category: 'fuel', radius: 2000, mode: 'foot' } };
  await ask(page, 'Chỉ đường đến cây xăng gần nhất đi bộ');
  await expect(page.getByText('Lập lộ trình', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Phương tiện: Đi bộ' })).toHaveAttribute('aria-pressed', 'true');
  expect(state.nearestRoutes[0].mode).toBe('foot');
  expect(state.nearestRoutes[0].radius).toBe(2000);
  expect(state.directions).toHaveLength(0);
});

test('denied GPS does not fall back to stale stored position or call nearest API', async ({ page, context }) => {
  const state = await setup(page, context);
  await page.evaluate(() => { navigator.geolocation.getCurrentPosition = (_success, error) => error({ code: 1, message: 'denied' }); });
  await ask(page, 'Tìm cây xăng gần nhất');
  await expect(page.getByText('Cần vị trí hiện tại để tìm gần bạn. Hãy cho phép định vị rồi thử lại.', { exact: true })).toBeVisible();
  expect(state.searches).toHaveLength(0);
});

test('named-center search uses geocoded center rather than requesting user GPS', async ({ page, context }) => {
  const state = await setup(page, context);
  state.action = { type: 'SEARCH_POIS', value: { category: 'cafe', radius: 2000, center: { name: 'Cầu Rồng', lat: 16.061, lng: 108.227 } } };
  await page.evaluate(() => { navigator.geolocation.getCurrentPosition = () => { window.__unexpectedGps = true; }; });
  await ask(page, 'Tìm cafe quanh Cầu Rồng');
  await expect(page.getByText(/Tìm thấy 1 địa điểm trong bán kính 2 km\./)).toBeVisible();
  expect(state.searches[0].pathname).toMatch(/\/places$/);
  expect(state.searches[0].searchParams.get('lat')).toBe('16.061');
  expect(await page.evaluate(() => window.__unexpectedGps)).toBeUndefined();
});

test('empty partial data is disclosed without inventing a nearest station', async ({ page, context }) => {
  const state = await setup(page, context);
  state.search.places = [];
  state.search.warnings = ['Không tải được OpenStreetMap; dữ liệu có thể chưa đầy đủ.'];
  await ask(page, 'Cây xăng gần nhất');
  await expect(page.getByText(/Chưa tìm thấy Cây xăng trong bán kính 5 km/)).toBeVisible();
  await expect(page.getByText(/dữ liệu có thể chưa đầy đủ/)).toBeVisible();
  expect(state.directions).toHaveLength(0);
});

test('untrusted station names stay text in map popups', async ({ page, context }) => {
  const state = await setup(page, context);
  state.search.places[0].name = '<img src=x onerror="window.__mapXss=true">';
  await ask(page, 'Cây xăng gần nhất');
  await expect(page.getByText(/Trong dữ liệu tìm được,/)).toBeVisible();
  const closeChat = page.getByRole('button', { name: 'Đóng trợ lý AI' });
  await closeChat.click();
  const marker = page.locator('.maplibregl-marker').filter({ has: page.locator('svg') });
  await marker.click();
  await expect(page.locator('.maplibregl-popup-content')).toContainText('<img src=x');
  await expect(page.locator('.maplibregl-popup-content img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__mapXss)).toBeUndefined();
});
