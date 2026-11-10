import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/admin-browser',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    viewport: { width: 1280, height: 800 },
    channel: 'chromium',
  },
  webServer: {
    command: 'npm run dev:admin -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
  },
});
