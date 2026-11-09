import { test, expect } from '@playwright/test';

const email = 'student@example.com';
const password = 'test-only-password';
const headers = { 'access-control-allow-origin': '*' };

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ json: [], headers }));
});

async function fillLogin(page) {
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.locator('form').getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}

async function fillRegistration(page) {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Đăng ký MapAI' })).toBeVisible();
  await expect(page.getByText('Yêu cầu cấp quyền', { exact: true })).toHaveCount(0);
  await page.getByLabel('Họ và tên', { exact: true }).fill('Sinh viên');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản MapAI' }).click();
}

test('incorrect password shows the API message and saves no session', async ({ page }) => {
  await page.route('**/auth/login', route => route.fulfill({
    status: 401, json: { code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng.' }, headers,
  }));
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Đăng nhập MapAI' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng ký', exact: true })).toBeVisible();
  await fillLogin(page);
  await expect(page.getByRole('alert')).toHaveText('Email hoặc mật khẩu không đúng.');
  await expect(page.getByRole('button', { name: 'Gửi lại email xác thực' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
});

test('unverified user can resend email and sees cooldown errors', async ({ page }) => {
  await page.route('**/auth/login', route => route.fulfill({
    status: 403, json: { code: 'EMAIL_NOT_VERIFIED', message: 'Bạn chưa xác thực email. Không cần quản trị viên duyệt.' }, headers,
  }));
  let attempts = 0;
  await page.route('**/auth/resend-verification', route => {
    expect(route.request().postDataJSON()).toEqual({ email });
    attempts++;
    return route.fulfill({ status: attempts === 1 ? 200 : 429, headers,
      json: attempts === 1 ? { message: 'Liên kết xác thực mới đã được gửi. Vui lòng kiểm tra Spam.' }
        : { code: 'VERIFICATION_COOLDOWN', message: 'Vui lòng chờ 60 giây giữa hai lần gửi email xác thực.' },
    });
  });
  await page.goto('/login');
  await fillLogin(page);
  await expect(page.getByRole('alert')).toContainText('Bạn chưa xác thực email');
  const resend = page.getByRole('button', { name: 'Gửi lại email xác thực' });
  await resend.click();
  await expect(page.getByRole('status')).toContainText('Liên kết xác thực mới đã được gửi');
  await resend.click();
  await expect(page.getByRole('alert')).toContainText('Vui lòng chờ 60 giây');
  expect(attempts).toBe(2);
});

test('registration omits role and keeps verification instructions visible on login', async ({ page }) => {
  let registration;
  await page.route('**/auth/register', route => {
    registration = route.request().postDataJSON();
    return route.fulfill({ json: { requiresEmailVerification: true }, headers });
  });
  await fillRegistration(page);
  await expect(page).toHaveURL(/\/login$/);
  expect(registration).not.toHaveProperty('role');
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue(email);
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveValue('');
  await expect(page.getByRole('status')).toContainText('không cần chờ quản trị viên duyệt');
  await expect(page.getByRole('button', { name: 'Gửi lại email xác thực' })).toBeVisible();
});

test('SMTP failure explains that the account exists and offers resend instead of registering again', async ({ page }) => {
  await page.route('**/auth/register', route => route.fulfill({ status: 503, headers,
    json: { code: 'VERIFICATION_EMAIL_UNAVAILABLE', message: 'Tài khoản chưa được xác thực vì không gửi được email. Vui lòng thử Gửi lại email xác thực.' },
  }));
  await fillRegistration(page);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('status')).toContainText('không gửi được email');
  await expect(page.getByRole('button', { name: 'Gửi lại email xác thực' })).toBeVisible();
});

test('one-use email link is verified once under React StrictMode and preserves Base64 characters', async ({ page }) => {
  let attempts = 0;
  await page.route('**/auth/verify-email?**', async route => {
    attempts++;
    expect(new URL(route.request().url()).searchParams.get('token')).toBe('a+b/c==');
    await new Promise(resolve => setTimeout(resolve, 100));
    await route.fulfill({ status: attempts === 1 ? 200 : 400, json: {}, headers });
  });
  await page.goto('/verify-email?userId=test&token=a%2Bb%2Fc%3D%3D');
  await expect(page.getByRole('heading', { name: 'Xác thực thành công' })).toBeVisible();
  expect(attempts).toBe(1);
  await page.getByRole('link', { name: 'Đi đến Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('expired email link displays recovery instructions from the API', async ({ page }) => {
  await page.route('**/auth/verify-email?**', route => route.fulfill({ status: 400, headers,
    json: { code: 'VERIFICATION_EXPIRED', message: 'Liên kết xác thực đã hết hạn. Vui lòng gửi lại email xác thực.' },
  }));
  await page.goto('/verify-email?userId=test&token=expired');
  await expect(page.getByRole('heading', { name: 'Xác thực thất bại' })).toBeVisible();
  await expect(page.getByText('Bạn có thể gửi lại email xác thực từ trang đăng nhập.')).toBeVisible();
});

test('network failure and non-JSON server error produce readable login errors', async ({ page }) => {
  let attempts = 0;
  await page.route('**/auth/login', route => {
    attempts++;
    if (attempts === 1) return route.abort('failed');
    return route.fulfill({ status: 502, body: '<html>Bad gateway</html>', contentType: 'text/html', headers });
  });
  await page.goto('/login');
  await fillLogin(page);
  await expect(page.getByRole('alert')).toContainText('Không thể kết nối máy chủ');
  await page.locator('form').getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Đăng nhập thất bại');
});
