import { defineConfig } from '@playwright/test';

export default defineConfig({
  outputDir: 'test-results-offline',
  testDir: './tests/e2e', fullyParallel: false, workers: 2, timeout: 45000,
  testMatch: ['offline.spec.js', 'appearance.spec.js', 'gps-and-sheet.spec.js', 'package-integrity.spec.js', 'unified.spec.js'],
  expect: { timeout: 12000 },
  use: {
    baseURL: 'http://localhost:4173', trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [{ name: 'desktop', use: { viewport: { width: 1365, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
  webServer: { command: 'npm run preview -- --host 0.0.0.0 --port 4173', port: 4173, reuseExistingServer: !process.env.CI },
});
