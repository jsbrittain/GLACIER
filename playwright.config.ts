import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3030',
    trace: 'on-first-retry'
  },

  projects: [
    {
      name: 'Web (chromium)',
      use: {
        browserName: 'chromium',
        baseURL: 'http://localhost:3030',
        ...devices['Desktop Chrome']
      }
    },
    {
      name: 'Web (firefox)',
      use: {
        browserName: 'firefox',
        baseURL: 'http://localhost:3030',
        ...devices['Desktop Firefox']
      }
    },
    {
      name: 'Web (webkit)',
      use: {
        browserName: 'webkit',
        baseURL: 'http://localhost:3030',
        ...devices['Desktop Safari']
      }
    },
    {
      name: 'Electron',
      use: {
        browserName: 'chromium',
        ...devices['Desktop Chrome']
      }
    }
  ],
  webServer: {
    command: 'npm run server',
    url: 'http://localhost:3030',
    reuseExistingServer: !process.env.CI
  }
});
