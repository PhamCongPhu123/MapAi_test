import base from './playwright.offline.config.js';
export default { ...base, outputDir: 'test-results-places', testMatch: ['multisource.spec.js'], timeout: 60000,
  webServer: { ...base.webServer, reuseExistingServer: false } };
