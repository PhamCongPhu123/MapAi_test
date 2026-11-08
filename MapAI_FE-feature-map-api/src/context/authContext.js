import { createContext } from "react";

export const AuthContext = createContext({
  user: null,
  login: () => {},
  register: () => {},
  logout: () => {},
  googleLogin: () => {},
  forgotPassword: () => {},
  refreshUser: () => {},
  isLoading: true,
});
