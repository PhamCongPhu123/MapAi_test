import { useEffect, useState, useSyncExternalStore } from 'react';
import { App } from '@capacitor/app';
import { isNative } from '../../config/platform';
import { makeVoiceAssistant } from '../compositionRoot';
export function useVoiceAssistant() {
  const [assistant] = useState(makeVoiceAssistant);
  const state = useSyncExternalStore(assistant.subscribe, assistant.getSnapshot);
  useEffect(() => {
    const hide = () => { if (document.hidden) assistant.cancel(); };
    document.addEventListener('visibilitychange', hide);
    let disposed = false, handle;
    if (isNative) void App.addListener('appStateChange', ({ isActive }) => { if (!isActive) assistant.cancel(); }).then(value => { if (disposed) void value.remove(); else handle = value; }).catch(() => {});
    return () => { disposed = true; document.removeEventListener('visibilitychange', hide); void handle?.remove(); assistant.cancel(); };
  }, [assistant]);
  return { ...state, assistant };
}
