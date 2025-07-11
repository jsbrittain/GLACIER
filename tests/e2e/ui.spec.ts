import cssEscape from 'css.escape';
import { test, expect } from './fixtures';
import { Page } from '@playwright/test';

const TIMEOUT_10s = 10_000;
const TIMEOUT_60s = 60_000;

async function waitForLogLine(page: Page, text: string | RegExp, timeout = 60000) {
  await expect(page.locator('#logMessage > p').filter({ hasText: text })).toBeVisible({ timeout });
}

test('should show title', async ({ page }) => {
  await expect(page).toHaveTitle(/IceFlow/i);
});

test('end-to-end test', async ({ page }) => {
  await expect(page).toHaveTitle(/IceFlow/i);

  // Clone a repository
  await page.click('#collections-clone-button');

  // Expect log messages to appear
  const workflow_name = 'jsbrittain/workflow-runner-testworkflow';
  await waitForLogLine(page, new RegExp(`^Cloned ${workflow_name} to `));

  // Navigate to Library page
  await page.click('#sidebar-library-button');

  // Sync the repository
  await page.click(`#collections-sync-${cssEscape(workflow_name)}`);

  // Expect log messages to appear
  let log_message = 'Repo synced';
  await waitForLogLine(page, 'Repo synced');

  // Click the Run button
  await page.click(`#collections-run-${cssEscape(workflow_name)}`);

  // Launch Workflow
  await page.getByRole('button', { name: 'Launch Workflow' }).click();
  await waitForLogLine(page, /^Container started with ID:/);
});
