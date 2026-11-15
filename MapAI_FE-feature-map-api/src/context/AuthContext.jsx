import { useState, useEffect, useCallback } from "react";
import { authApi } from "../services/authService";
import { userApi } from "../services/userService";
import { clearTokens } from "../services/api";
import { AuthContext } from "./authContext";
import { isOffline, useNetworkStatus } from '../offline/network';
import { isNative } from '../config/platform';
import { sessionStore, syncService } from '../sync/compositionRoot';

export const AuthProvider = ({ children }) => {
  const { offline } = useNetworkStatus();
  const [user, setUser] = useState(() => sessionStore.read()?.profile || null);
  const [isLoading, setIsLoading] = useState(true);

  const acceptUser = useCallback(async profile => {
    if (!sessionStore.save(profile)) return null;
    await syncService.activate(profile.id);
    if (sessionStore.owner() !== profile.id) return null;
    setUser(profile);
    void syncService.sync();
    return profile;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initAuth = async () => {
      const cached = sessionStore.read();
      if (isOffline() || (isNative && !import.meta.env.VITE_API_BASE_URL?.trim())) {
        setUser(cached?.profile || null);
        await syncService.activate(cached?.profile.id);
        if (!cancelled) setIsLoading(false);
        return;
      }
      if (localStorage.getItem('accessToken')) {
        try {
          const profile = await authApi.getMe();
          if (!cancelled) await acceptUser(profile);
        } catch (error) {
          if (!cancelled) {
            if ([401, 403].includes(error.status)) { clearTokens(); setUser(null); }
            else setUser(sessionStore.read()?.profile || null);
          }
        }
      }
      if (!cancelled) setIsLoading(false);
    };
    void initAuth();
    const cleared = () => { setUser(null); void syncService.activate('guest'); };
    const timer = setInterval(() => {
      if (isOffline() && !sessionStore.read()) cleared();
    }, 1000);
    const switched = event => { if (['accessToken', 'mapai-verified-session'].includes(event.key)) { const cached = sessionStore.read(); setUser(cached?.profile || null); } };
    window.addEventListener('storage', switched);
    window.addEventListener('mapai:session-cleared', cleared);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('storage', switched); window.removeEventListener('mapai:session-cleared', cleared); };
  }, [offline, acceptUser]);

  const login = useCallback(async (email, password) => {
    await authApi.login({ email, password });
    try {
      const userData = await authApi.getMe();
      return await acceptUser(userData);
    } catch (error) {
      clearTokens();
      setUser(null);
      throw error;
    }
  }, [acceptUser]);

  const register = useCallback(async (userData) => {
    return await authApi.register(userData);
  }, []);

  const logout = useCallback(async () => {
    if (!isOffline()) void authApi.logout().catch(() => {});
    setUser(null); clearTokens(); sessionStorage.clear();
    await syncService.activate('guest');
  }, []);

  const googleLogin = useCallback(async (idToken) => {
    const data = await authApi.googleLogin(idToken);
    // Dùng /auth/me ngay sau khi google login
    const userData = await authApi.getMe();
    console.log("BE User Data (googleLogin):", userData);
    await acceptUser(userData);
    return data;
  }, [acceptUser]);

  const forgotPassword = useCallback(async (email) => {
    return await authApi.forgotPassword(email);
  }, []);

  const resetPassword = useCallback(async (data) => {
    const result = await authApi.resetPassword(data);
    clearTokens();
    setUser(null);
    return result;
  }, []);

  const refreshUser = useCallback(async () => {
    if (isOffline()) return sessionStore.read()?.profile;
    try {
      // /user/infor sẽ được gọi khi vào trang Profile để lấy chi tiết
      const userData = await userApi.getProfile();
      console.log("BE User Data (refreshUser):", userData);
      return await acceptUser(userData);
    } catch (e) {
      console.error("Cập nhật thông tin profile (/user/infor) thất bại:", e);
    }
  }, [acceptUser]);


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
        offlineSession: offline && Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
