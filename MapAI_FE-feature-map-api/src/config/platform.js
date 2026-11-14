import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
// Google Identity Services is a browser SDK, not a native WebView sign-in flow.
export const canUseGoogleWebLogin = !isNative
  && import.meta.env.VITE_BUILD_TARGET !== 'mobile'
  && Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim());
