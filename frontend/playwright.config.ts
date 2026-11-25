import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests.
 *  - Default: starts the backend (in-memory H2) and Vite, then runs against http://localhost:5173.
 *  - E2E_BASE_URL=http://localhost:5174 npx playwright test  → reuse servers you already run.
 *  - E2E_EXTERNAL=1 also runs tests that need the internet (public WebSocket echo server).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const startServers = !process.env.E2E_BASE_URL;
const ci = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: ci ? 2 : undefined,
  retries: ci ? 1 : 0,
  forbidOnly: ci,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    // Locally use the installed Chrome (no browser download); CI installs Playwright's Chromium.
    channel: ci ? undefined : 'chrome',
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: startServers
    ? [
        {
          command: 'mvn -q -f ../backend/pom.xml spring-boot:run',
          url: 'http://localhost:8080/actuator/health',
          reuseExistingServer: !ci,
          timeout: 180_000,
          env: {
            SPRING_DATASOURCE_URL:
              'jdbc:h2:mem:magidoc-e2e;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1',
          },
        },
        { command: 'npm run dev -- --port 5173 --strictPort', url: baseURL, reuseExistingServer: !ci, timeout: 60_000 },
      ]
    : undefined,
});
