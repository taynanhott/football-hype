import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @football/server exec tsx src/index.ts',
      url: 'http://127.0.0.1:2568/health',
      env: {
        NODE_ENV: 'test',
        STORE: 'memory',
        DATASET_FILE: process.env.E2E_DATASET_FILE ?? '',
        PORT: '2568',
        TEST_NOW: '2026-10-26T15:00:00.000Z',
      },
      reuseExistingServer: false,
    },
    {
      command: `pnpm --filter @football/client dev --host 127.0.0.1 --port ${port} --strictPort --mode test`,
      url: baseURL,
      reuseExistingServer: false,
      env: { VITE_GAME_SERVER_URL: 'ws://127.0.0.1:2568', VITE_TEST_AUTH: 'true' },
    },
  ],
});
