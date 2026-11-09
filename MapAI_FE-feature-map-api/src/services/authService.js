import API_BASE_URL, { request, saveTokens, clearTokens, decodeToken } from './api';

// The API may return {message}, ProblemDetails {detail}, or validation {errors}.
async function authRequest(path, options, fallback) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch {
    throw new Error('Không thể kết nối máy chủ. Vui lòng kiểm tra backend và kết nối mạng.');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const body = payload && typeof payload === 'object' ? payload : {};
    const legacyMessages = {
      'Invalid credentials': 'Email hoặc mật khẩu không chính xác.',
      'Account not active': 'Tài khoản chưa được kích hoạt. Vui lòng xác thực email trước khi đăng nhập.',
      'Email already exists': 'Email đã được đăng ký. Vui lòng đăng nhập hoặc gửi lại email xác thực.',
      'Verification token expired': 'Liên kết xác thực đã hết hạn. Vui lòng gửi lại email xác thực.',
      'Invalid verification token': 'Liên kết xác thực không hợp lệ. Vui lòng gửi lại email xác thực.',
    };
    const message = body.message || body.detail || Object.values(body.errors || {}).flat().join(' ') || fallback;
    const code = body.code || (path === '/auth/login' && response.status === 401 ? 'INVALID_CREDENTIALS'
      : message === 'Account not active' ? 'EMAIL_NOT_VERIFIED' : undefined);
    const error = new Error(code === 'INVALID_CREDENTIALS' ? 'Email hoặc mật khẩu không chính xác.' : legacyMessages[message] || message);
    error.code = code;
    error.status = response.status;
    throw error;
  }
  return response;
}

/**
 * API Auth
 */
export const authApi = {
  login: async (credentials) => {
    const response = await authRequest('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    }, 'Đăng nhập thất bại');
    
    const data = await response.json();
    const decoded = decodeToken(data.accessToken);
    const userId = decoded?.sub || decoded?.id || 'unknown'; 
    
    saveTokens(data.accessToken, data.refreshToken, userId);
    return { ...data, userId, decoded };
  },

  getMe: async () => {
    const response = await request('/auth/me');
    if (!response.ok) throw new Error('Không thể lấy thông tin người dùng');
    return await response.json();
  },

  register: async (userData) => {
    const response = await authRequest('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    }, 'Đăng ký thất bại');

    return await response.json();
  },

  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      clearTokens();
    }
  },

  forgotPassword: async (email) => {
    const response = await authRequest('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    }, 'Yêu cầu thất bại');
    return response;
  },

  verifyEmail: async (userId, token) => {
    const response = await authRequest(`/auth/verify-email?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }, 'Xác thực email thất bại');
    return response;
  },

  resendVerification: async (email) => {
    const response = await authRequest('/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() })
    }, 'Không thể gửi email xác thực.');
    return await response.json();
  },

  googleLogin: async (idToken) => {
    const response = await authRequest('/auth/google-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    }, 'Đăng nhập Google thất bại');

    const data = await response.json();
    const decoded = decodeToken(data.accessToken);
    const userId = decoded?.sub || decoded?.id || 'unknown';
    
    saveTokens(data.accessToken, data.refreshToken, userId);
    return { ...data, userId, decoded };
  },

  resetPassword: async (data) => {
    const response = await authRequest('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }, 'Đặt lại mật khẩu thất bại');
    return response;
  }
};
