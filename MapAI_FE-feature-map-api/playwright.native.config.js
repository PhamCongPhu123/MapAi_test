import { defineConfig } from '@playwright/test';

export default defineConfig({
  outputDir: 'test-results-native',
  testDir: './tests/e2e', testMatch: 'native-offline.spec.js', workers: 1, timeout: 45000,
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://localhost:4175', serviceWorkers: 'block', trace: 'retain-on-failure',
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
});
