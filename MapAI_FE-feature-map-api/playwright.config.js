import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/offline.spec.js', '**/appearance.spec.js', '**/gps-and-sheet.spec.js', '**/package-integrity.spec.js', '**/unified.spec.js', '**/native-offline.spec.js'],
  fullyParallel: true,
  workers: 2,
  timeout: 45000,
  expect: { timeout: 12000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    env: { VITE_API_BASE_URL: 'http://127.0.0.1:5028/api/v1' },
    reuseExistingServer: false,
  },
});
