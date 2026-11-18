import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the real Keycloak (crm-admin realm) and UMS from local-docker.
 * Credentials come from the environment (see e2e/README.md); nothing is hard-coded.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5175',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: 'http://localhost:5175', reuseExistingServer: true, timeout: 60_000 },
});
