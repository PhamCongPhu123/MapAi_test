import { useState, useEffect, useCallback } from "react";
import { authApi } from "../services/authService";
import { userApi } from "../services/userService";
import { clearTokens, decodeToken } from "../services/api";
import { AuthContext } from "./authContext";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem("accessToken");
      if (accessToken) {
        try {
          const decoded = decodeToken(accessToken);
          if (decoded) {
            // Lấy thông tin cơ bản từ /auth/me khi khởi tạo
            const userData = await authApi.getMe();
            console.log("BE User Data (initAuth):", userData);
            setUser(userData);
          } else {
            clearTokens();
          }
        } catch (e) {
          console.error("Khởi tạo auth thất bại:", e);
          clearTokens();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    await authApi.login({ email, password });
    // Dùng /auth/me ngay sau khi login
    const userData = await authApi.getMe();
    console.log("BE User Data (login):", userData);
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (userData) => {
    return await authApi.register(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      clearTokens();
      // Xóa tất cả các dữ liệu khác nếu có
      sessionStorage.clear();
    }
  }, []);

  const googleLogin = useCallback(async (idToken) => {
    const data = await authApi.googleLogin(idToken);
    // Dùng /auth/me ngay sau khi google login
    const userData = await authApi.getMe();
    console.log("BE User Data (googleLogin):", userData);
    setUser(userData);
    return data;
  }, []);

  const forgotPassword = useCallback(async (email) => {
    return await authApi.forgotPassword(email);
  }, []);

  const resetPassword = useCallback(async (data) => {
    return await authApi.resetPassword(data);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      // /user/infor sẽ được gọi khi vào trang Profile để lấy chi tiết
      const userData = await userApi.getProfile();
      console.log("BE User Data (refreshUser):", userData);
      setUser(userData);
      return userData;
    } catch (e) {
      console.error("Cập nhật thông tin profile (/user/infor) thất bại:", e);
    }
  }, []);


  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        googleLogin,
        forgotPassword,
        resetPassword,
        refreshUser,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
