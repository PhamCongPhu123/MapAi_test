import { useSyncExternalStore } from 'react';

const media = window.matchMedia('(max-width: 1023px)');
const subscribe = callback => {
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};

export const useCompactLayout = () => useSyncExternalStore(subscribe, () => media.matches);
