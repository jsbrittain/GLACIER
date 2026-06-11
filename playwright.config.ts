import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function hasElectron(): boolean {
  const pathFile = path.join(__dirname, 'node_modules', 'electron', 'path.txt');
  if (!fs.existsSync(pathFile)) return false;
  const binName = fs.readFileSync(pathFile, 'utf-8').trim();
  const binPath = path.join(__dirname, 'node_modules', 'electron', 'dist', binName);
  return fs.existsSync(binPath);
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // tests inside a file must run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // tests rebuild workflow library, so must run sequentially
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3030',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
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
    ...(hasElectron()
      ? [
          {
            name: 'Electron',
            use: {
              browserName: 'chromium',
              ...devices['Desktop Chrome']
            }
          }
        ]
      : [])
  ],
  webServer: {
    command: 'npm run server',
    url: 'http://localhost:3030',
    reuseExistingServer: !process.env.CI
  }
});
