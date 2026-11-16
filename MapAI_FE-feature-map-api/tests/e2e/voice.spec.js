import { test, expect } from '@playwright/test';
import { setupMap, readyMap } from './helpers/unified.js';
async function speechFixture(page, { local = true, supported = true } = {}) {
  await page.addInitScript(({ local, supported }) => {
    const records = { starts: [], spoken: [], cancelled: 0, hold: false, current: null };
    window.__voice = records;
    class Recognition {
      processLocally = false;
      static available = async () => local ? 'available' : 'unavailable';
      start() { records.current = this; records.starts.push({ language: this.lang, local: this.processLocally }); }
      abort() { this.aborted = true; }
    }
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: supported ? Recognition : undefined });
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: undefined });
    records.emit = (text, final = false, confidence = .95) => {
      const result = [{ transcript: text, confidence }]; result.isFinal = final;
      records.current?.onresult?.({ results: [result] });
    };
    records.fail = error => records.current?.onerror?.({ error });
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [{ lang: 'vi-VN', localService: true }, { lang: 'en-US', localService: true }],
      speak: u => { records.spoken.push({ text: u.text, language: u.lang }); if (!records.hold) setTimeout(() => u.onend?.(), 50); },
      cancel: () => { records.cancelled++; }, addEventListener() {}, removeEventListener() {},
    } });
  }, { local, supported });
}
async function openChat(page) { const open = page.getByRole('button', { name: 'Mở trợ lý AI', exact: true }); if (await open.isVisible()) await open.click(); }

test('EN speech sends one transcript through existing ChatAI and reads a clean English reply', async ({ page }, testInfo) => {
  await speechFixture(page); await setupMap(page);
  const requests = [];
  await page.route('**/api/v1/ai/ask', route => { requests.push(route.request().postDataJSON()); return route.fulfill({ json: { message: '**I found the bus stop.** [Details](https://example.test).', language: 'en-US', places: [{ canonicalId: 'osm:node:11363578173', sourceType: 'openstreetmap', osmType: 'node', osmId: '11363578173', name: 'Viet Han (to Hoi An)', lat: 15.9735, lng: 108.2545, categoryMapping: 'bus' }] } }); });
  await readyMap(page); await openChat(page);
  await page.getByRole('button', { name: 'English (EN)', exact: true }).click();
  await page.getByRole('button', { name: 'Ask by voice', exact: true }).click();
  await page.evaluate(() => window.__voice.emit('Find bus stops Viet Han'));
  await expect(page.getByRole('region', { name: 'Voice transcript', exact: true })).toContainText('Find bus stops Viet Han');
  if (testInfo.project.name === 'mobile') await page.screenshot({ path: '/tmp/mapai-voice-mobile.png' });
  await page.evaluate(() => { window.__voice.emit('Find bus stops Viet Han', true); window.__voice.emit('duplicate', true); });
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].language).toBe('en-US'); expect(requests[0].userInput).toBe('Find bus stops Viet Han');
  await expect.poll(() => page.evaluate(() => window.__voice.spoken.length)).toBe(1);
  const spoken = await page.evaluate(() => window.__voice.spoken[0]);
  expect(spoken.language).toBe('en-US'); expect(spoken.text).not.toMatch(/\*|https/);
  await expect(page.getByText('Viet Han (to Hoi An)', { exact: true })).toBeVisible();
});

test('VI local speech opens offline OSM directions without API requests', async ({ page, context }) => {
  await speechFixture(page); const calls = await setupMap(page); await readyMap(page); await openChat(page);
  await context.setOffline(true); const before = calls.length;
  await page.getByRole('button', { name: 'Hỏi bằng giọng nói', exact: true }).click();
  await page.evaluate(() => window.__voice.emit('Chỉ đường đến bến xe buýt Việt Hàn', true));
  await expect(page.getByPlaceholder('Chọn điểm đến...')).toHaveValue(/Việt\s+Hàn|Viet\s+Han/);
  expect(calls.length).toBe(before);
  await expect.poll(() => page.evaluate(() => window.__voice.spoken.length)).toBe(1);
  expect(await page.evaluate(() => window.__voice.starts[0])).toEqual({ language: 'vi-VN', local: true });
});

test('offline speech without a local model leaves typing and cached English search available', async ({ page, context }) => {
  await speechFixture(page, { local: false }); const calls = await setupMap(page); await readyMap(page); await openChat(page);
  await page.getByRole('button', { name: 'English (EN)', exact: true }).click(); await context.setOffline(true); const before = calls.length;
  await page.getByRole('button', { name: 'Ask by voice', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Offline speech recognition is unavailable' })).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Ask MapAI', exact: true }); await expect(input).toBeFocused();
  await input.fill('Find bus stops Viet Han'); await input.press('Enter');
  await expect(page.getByText('Viet Han (to Hoi An)', { exact: true })).toBeVisible();
  expect(calls.length).toBe(before); expect(await page.evaluate(() => window.__voice.starts.length)).toBe(0);
});

test('permission denial preserves typed draft; mute and language preferences survive reload', async ({ page }) => {
  await speechFixture(page); await setupMap(page); await readyMap(page); await openChat(page);
  await page.getByRole('textbox', { name: 'Hỏi trợ lý MapAI', exact: true }).fill('Bản nháp của tôi');
  await page.getByRole('button', { name: 'Hỏi bằng giọng nói', exact: true }).click();
  await page.evaluate(() => window.__voice.fail('not-allowed'));
  await expect(page.getByRole('status').filter({ hasText: 'Micro đang bị chặn' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Hỏi trợ lý MapAI', exact: true })).toHaveValue('Bản nháp của tôi');
  await page.getByRole('button', { name: 'Tự động đọc câu trả lời', exact: true }).click();
  await page.getByRole('button', { name: 'English (EN)', exact: true }).click();
  await page.reload(); await openChat(page);
  await expect(page.getByRole('button', { name: 'English (EN)', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Automatic voice replies', exact: true })).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('microphone interrupts reading and changing language discards partial speech', async ({ page }) => {
  await speechFixture(page); const calls = await setupMap(page); await readyMap(page); await openChat(page);
  await page.evaluate(() => { window.__voice.hold = true; });
  await page.getByRole('button', { name: 'Nghe lại câu trả lời', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Dừng đọc', exact: true })).toBeVisible();
  const before = await page.evaluate(() => window.__voice.cancelled);
  await page.getByRole('button', { name: 'Hỏi bằng giọng nói', exact: true }).click();
  await page.evaluate(() => window.__voice.emit('không được gửi'));
  await page.getByRole('button', { name: 'English (EN)', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Nội dung giọng nói', exact: true })).toHaveCount(0);
  await page.evaluate(() => window.__voice.emit('không được gửi', true));
  expect(calls.filter(p => p.endsWith('/ai/ask')).length).toBe(0);
  expect(await page.evaluate(() => window.__voice.cancelled)).toBeGreaterThan(before);
});
