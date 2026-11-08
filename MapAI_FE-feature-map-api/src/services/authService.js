import API_BASE_URL, { request, saveTokens, clearTokens, decodeToken } from './api';

/**
 * API Auth
 */
export const authApi = {
  login: async (credentials) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Đăng nhập thất bại');
    }
    
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
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Đăng ký thất bại');
    }

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
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!response.ok) throw new Error('Yêu cầu thất bại');
    return response;
  },

  verifyEmail: async (userId, token) => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-email?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Xác thực email thất bại');
    }
    return response;
  },

  googleLogin: async (idToken) => {
    const response = await fetch(`${API_BASE_URL}/auth/google-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Đăng nhập Google thất bại');
    }

    const data = await response.json();
    const decoded = decodeToken(data.accessToken);
    const userId = decoded?.sub || decoded?.id || 'unknown';
    
    saveTokens(data.accessToken, data.refreshToken, userId);
    return { ...data, userId, decoded };
  },

  resetPassword: async (data) => {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Đặt lại mật khẩu thất bại');
    }
    return response;
  }
};
