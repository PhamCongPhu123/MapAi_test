import { useEffect, useEffectEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { isNative } from '../config/platform';
import { nativeAuthPath } from '../utils/nativeNavigation';

export default function NativeAppBridge() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleAuthLink = useEffectEvent(({ url }) => {
    const path = nativeAuthPath(url);
    if (path) navigate(path, { replace: true });
  });
  const handleBack = useEffectEvent(() => {
    const event = new Event('mapai:back', { cancelable: true });
    if (!window.dispatchEvent(event)) return;
    if (window.history.state?.idx > 0) navigate(-1);
    else if (pathname !== '/') navigate('/', { replace: true });
    else App.minimizeApp().catch(console.warn);
  });

  useEffect(() => {
    if (!isNative) return;
    let disposed = false;
    const openAuthLink = ({ url }) => {
      if (!disposed) handleAuthLink({ url });
    };
    const listener = App.addListener('appUrlOpen', openAuthLink);
    App.getLaunchUrl().then(link => {
      if (link) openAuthLink(link);
    }).catch(error => console.warn('Không thể đọc liên kết mở ứng dụng:', error));
    StatusBar.setStyle({ style: Style.Dark }).catch(error => console.warn('Status bar:', error));

    return () => {
      disposed = true;
      listener.then(handle => handle.remove()).catch(console.warn);
    };
  }, []);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    const listener = App.addListener('backButton', () => {
      // Give open sheets/dialogs a chance to handle Back before changing routes.
      handleBack();
    });
    return () => { listener.then(handle => handle.remove()).catch(console.warn); };
  }, []);

  return null;
}
