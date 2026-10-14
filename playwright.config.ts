// Screen tests: a real browser against the production build (`next start`)
// with a fresh embedded database and the demo users from scripts/seed.ts.
//   npm run build && npm run e2e      (npm run check does both)
// PW_CHANNEL=msedge (or chrome) uses an installed browser instead of the one
// from `npm run setup`.
import { defineConfig } from '@playwright/test';

const PORT = 3198;

export default defineConfig({
  testDir: 'tests/e2e',
  // One worker: the tests share one server and database.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  reporter: [['list']],
  outputDir: '.data/test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PW_CHANNEL || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `node scripts/e2e-server.mjs ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
