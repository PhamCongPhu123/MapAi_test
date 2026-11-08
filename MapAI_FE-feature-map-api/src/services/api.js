const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://localhost:7028/api/v1';

/**
 * Hàm hỗ trợ lấy token từ localStorage
 */
const getTokens = () => {
  return {
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
    userId: localStorage.getItem('userId')
  };
};

/**
 * Lưu token vào localStorage
 */
export const saveTokens = (accessToken, refreshToken, userId) => {
  if (accessToken) localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  if (userId) localStorage.setItem('userId', userId);
};

/**
 * Xóa token khỏi localStorage
 */
export const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userId');
  localStorage.removeItem('mapai_user');
};

/**
 * Giải mã JWT đơn giản (không cần thư viện) để lấy thông tin user/role
 */
export const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Lỗi giải mã token:", e);
    return null;
  }
};

/**
 * Hàm gọi API dùng chung (thay thế Axios interceptor)
 */
export const request = async (endpoint, options = {}) => {
  const { accessToken, refreshToken, userId } = getTokens();

  // 1. Request Interceptor: Thêm Authorization Header
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Nếu headers['Content-Type'] là undefined, xóa nó để trình duyệt tự động thiết lập (quan trọng cho FormData)
  if (headers['Content-Type'] === undefined) {
    delete headers['Content-Type'];
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const config = {
    ...options,
    headers,
  };

  let response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  // 2. Response Interceptor: Xử lý 401 Unauthorized và Refresh Token
  if (response.status === 401 && refreshToken && userId) {
    try {
      // Thử refresh token
      const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken, userId })
      });

      if (refreshResponse.ok) {
        const newTokens = await refreshResponse.json();
        saveTokens(newTokens.accessToken, newTokens.refreshToken, userId);

        // Thử lại request ban đầu với token mới
        headers['Authorization'] = `Bearer ${newTokens.accessToken}`;
        response = await fetch(`${API_BASE_URL}${endpoint}`, { ...config, headers });
      } else {
        // Refresh thất bại -> Logout
        clearTokens();
        window.location.href = '/login';
      }
    } catch (error) {
      console.error("Lỗi khi refresh token:", error);
      clearTokens();
      window.location.href = '/login';
    }
  }

  return response;
};

export default API_BASE_URL;
