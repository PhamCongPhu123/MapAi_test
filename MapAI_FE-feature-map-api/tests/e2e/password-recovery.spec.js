import { test, expect } from '@playwright/test';

async function api(page, handler = async () => false) {
  await page.route('**/api/v1/**', async route => {
    if (await handler(route)) return;
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) {
      await route.fulfill({ json: { id: 'test-user', fullName: 'Test User', email: 'user@example.test', role: 'User' } });
    } else if (url.pathname.endsWith('/location')) {
      await route.fulfill({ json: [] });
    } else {
      await route.fulfill({ status: 404, json: { message: 'Unexpected API request in browser test' } });
    }
  });
}

test('login exposes password recovery and recovery handles rate limits clearly', async ({ page }) => {
  await api(page, async route => {
    if (!route.request().url().endsWith('/forgot-password')) return false;
    await route.fulfill({ status: 429, body: '' });
    return true;
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Quên mật khẩu?' }).click();
  await expect(page.getByRole('heading', { name: 'Khôi phục mật khẩu' })).toBeVisible();
  await page.getByLabel('Email đã đăng ký').fill('user@example.test');
  await page.getByRole('button', { name: 'Gửi yêu cầu khôi phục' }).click();
  await expect(page.getByRole('alert')).toContainText('thử lại sau một phút');
});

test('forgot password confirms a request and reports email delivery errors', async ({ page }) => {
  let fail = true;
  await api(page, async route => {
    if (!route.request().url().endsWith('/forgot-password')) return false;
    expect(route.request().postDataJSON()).toEqual({ email: 'user@example.test' });
    await route.fulfill(fail ? { status: 503, json: { message: 'Chưa thể gửi email khôi phục.' } } : { json: { message: 'Sent' } });
    return true;
  });
  await page.goto('/forgot-password');
  await page.getByLabel('Email đã đăng ký').fill('user@example.test');
  await page.getByRole('button', { name: 'Gửi yêu cầu khôi phục' }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa thể gửi email');
  fail = false;
  await page.getByRole('button', { name: 'Gửi yêu cầu khôi phục' }).click();
  await expect(page.getByRole('heading', { name: 'Đã gửi yêu cầu!' })).toBeVisible();
  await expect(page.getByText(/60 phút/)).toBeVisible();
});

test('reset form guards missing links, mismatched passwords and expired links', async ({ page }) => {
  let requests = 0;
  await api(page, async route => {
    if (!route.request().url().endsWith('/reset-password')) return false;
    requests++;
    await route.fulfill({ status: 400, json: { message: 'Liên kết không hợp lệ hoặc đã hết hạn.' } });
    return true;
  });
  await page.goto('/reset-password');
  await expect(page.getByRole('alert')).toContainText('Liên kết không hợp lệ');
  await expect(page.getByRole('button', { name: 'Cập nhật mật khẩu' })).toBeDisabled();
  await page.goto('/reset-password?userId=test-user&token=test-token');
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('new-password');
  await page.getByLabel('Xác nhận mật khẩu mới').fill('different-password');
  await page.getByRole('button', { name: 'Cập nhật mật khẩu' }).click();
  await expect(page.getByRole('alert')).toContainText('không khớp');
  expect(requests).toBe(0);
  await page.getByLabel('Xác nhận mật khẩu mới').fill('new-password');
  await page.getByRole('button', { name: 'Cập nhật mật khẩu' }).click();
  await expect(page.getByRole('alert')).toContainText('đã hết hạn');
  expect(requests).toBe(1);
  await expect(page.getByRole('button', { name: 'Yêu cầu liên kết đặt lại mật khẩu mới' })).toBeVisible();
});

test('reset success clears old tokens and never logs the reset secret', async ({ page }) => {
  const logs = [];
  page.on('console', message => logs.push(message.text()));
  await page.addInitScript(() => {
    localStorage.setItem('refreshToken', 'old-refresh');
    localStorage.setItem('accessToken', `header.${btoa(JSON.stringify({ id: 'test-user' }))}.signature`);
  });
  await api(page, async route => {
    if (!route.request().url().endsWith('/reset-password')) return false;
    expect(route.request().postDataJSON()).toEqual({ userId: 'test-user', token: 'sensitive-token', newPassword: 'new-password' });
    await route.fulfill({ json: { message: 'Password updated successfully.' } });
    return true;
  });
  await page.goto('/reset-password?userId=test-user&token=sensitive-token');
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('new-password');
  await page.getByLabel('Xác nhận mật khẩu mới').fill('new-password');
  await page.getByRole('button', { name: 'Cập nhật mật khẩu' }).click();
  await expect(page.getByRole('heading', { name: 'Thành công!' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBeNull();
  expect(logs.some(message => message.includes('sensitive-token'))).toBe(false);
  await page.getByRole('button', { name: 'Đăng nhập ngay' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
});
