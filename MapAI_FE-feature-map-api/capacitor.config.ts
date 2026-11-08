import type { CapacitorConfig } from '@capacitor/cli';

// Only the development sync command may enable local HTTP APIs.
const development = process.env.CAPACITOR_DEV === 'true';

const config: CapacitorConfig = {
  appId: 'vn.mapai.app',
  appName: 'MapAI',
  webDir: 'dist',
  backgroundColor: '#020617',
  server: {
    androidScheme: development ? 'http' : 'https',
  },
  android: {
    allowMixedContent: development,
  },
  plugins: {
    SystemBars: { insetsHandling: 'native' },
    StatusBar: { style: 'DARK', backgroundColor: '#020617' },
    Keyboard: { resize: 'body', resizeOnFullScreen: true },
  },
};

export default config;
