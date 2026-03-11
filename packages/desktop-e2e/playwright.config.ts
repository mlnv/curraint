import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Electron tests are inherently serial – each test launches a new app
  // instance, no parallelism needed within a single spec file.
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: [['list']],
  // No browser projects – Playwright drives Electron directly.
});
