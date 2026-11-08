export function validateMobileApiUrl(value, { development = false, platform = 'android' } = {}) {
  if (!value?.trim()) {
    throw new Error('Thiếu VITE_API_BASE_URL. Hãy tạo file .env.mobile.local hoặc .env.mobile-development.local theo MOBILE.md.');
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('VITE_API_BASE_URL cho mobile phải là URL tuyệt đối, gồm /api/v1.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('URL API phải dùng HTTP(S), không chứa thông tin đăng nhập, query hoặc fragment.');
  }
  const host = url.hostname.toLowerCase();
  if (['localhost', '0.0.0.0', '[::1]'].includes(host) || host.endsWith('.localhost') || host.startsWith('127.')) {
    throw new Error('localhost trên điện thoại là chính điện thoại. Dùng 10.0.2.2 cho Android Emulator hoặc IP Wi-Fi của máy chạy backend.');
  }
  if ((!development || platform === 'ios') && url.protocol !== 'https:') {
    throw new Error('Bản production và iOS cần API HTTPS với chứng chỉ hợp lệ. HTTP chỉ dành cho Android development.');
  }

  return url.href.replace(/\/$/, '');
}
