import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import cssEscape from 'css.escape';
import { test, expect } from './fixtures';
import { Page } from '@playwright/test';
import { fileURLToPath } from 'url';

/*
 * Insert 'await page.pause();' to debug tests in playwright inspector
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TIMEOUT_10s = 10_000;
const TIMEOUT_30s = 30_000;
const TIMEOUT_60s = 60_000;

async function waitForLogLine(page: Page, text: string | RegExp, timeout = 60000) {
  await expect(page.locator('#logMessage > p').filter({ hasText: text })).toBeVisible({ timeout });
}

test('show title', async ({ page }) => {
  await expect(page).toHaveTitle(/GLACIER/i);
});

test('clone a repository', async ({ page }) => {
  // === Setup temporary library path ==================================================

  // Navigate to Settings page
  await page.click('#sidebar-settings-button');

  // Set library path to a temporary folder
  await page.click('#settings-general-panel');
  const glacier_path = path.resolve(path.join(os.tmpdir(), 'GLACIER-' + Date.now().toString()));
  fs.rmSync(glacier_path, { recursive: true, force: true });
  expect(fs.existsSync(glacier_path)).toBe(false);
  const library_path = path.resolve(path.join(glacier_path, 'library'));
  fs.mkdirSync(library_path, { recursive: true }); // rebuild
  await page.fill('#settings-collections-path', `${library_path}`);
  await page.locator('#settings-collections-path').blur();

  // Set documents path to a temporary folder
  const docs_path = path.resolve(path.join(glacier_path, 'docs'));
  fs.mkdirSync(docs_path, { recursive: true });
  await page.fill('#settings-documents-path', `${docs_path}`);
  await page.locator('#settings-documents-path').blur();

  // Ensure repositories and catalogues can be modified in settings
  await page.check('#settings-permit-add-catalogues');
  await page.check('#settings-permit-catalogue-modifications');
  await page.check('#settings-permit-add-repos');

  // Use English language for this test
  await page.click('#settings-language-panel');
  await page.click('#settings-language-select');
  await page.locator('[role="listbox"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[role="option"]').filter({ hasText: 'English' }).click({ force: true });

  // === Clone a repository ============================================================

  // Check that the Library is empty
  await page.click('#sidebar-library-button');
  await expect(page.getByText('No repositories installed.')).toBeVisible({ timeout: TIMEOUT_10s });

  // Add repository
  const repo_owner = 'jsbrittain';
  const repo_name = 'workflow-runner-test-nextflow';

  // Click Actions menu button
  await page.click('#library-actions-menu-button');
  await page.click('#library-actions-menu-add-repo');
  // Fill in repo details
  await page.fill('#query-add-workflow-repo-url', `${repo_owner}/${repo_name}`);
  await page.fill('#query-add-workflow-repo-version', 'main');
  await page.click('#query-add-workflow-dialog-okay-button');
  // Wait for workflow to be added
  await expect(page.getByText('User collection')).toBeVisible({ timeout: TIMEOUT_10s });
  await expect(page.getByText(repo_name)).toBeVisible({ timeout: TIMEOUT_10s });
  // Click Install (clone the repository)
  await page.click(`#install-${cssEscape(repo_name)}`);

  // Wait for clone to complete before attempting to run
  await waitForLogLine(page, /Cloned/, TIMEOUT_60s);

  // Create an instance of the workflow (redirects to Parameters page)
  await page.click(`#card-${cssEscape(repo_name)}`);
  // 'Launch Workflow' button should now be visible
  await expect(page.getByRole('button', { name: 'Launch Workflow' })).toBeVisible({
    timeout: TIMEOUT_10s
  });
});

test('launch local workflow', async ({ page }) => {
  const local_collections_path = path.resolve(path.join(__dirname, '..', 'test-data'));

  // Navigate to Settings page
  await page.click('#sidebar-settings-button');

  // Get the library path
  await page.click('#settings-general-panel');
  await page.fill('#settings-collections-path', `${local_collections_path}`);
  await page.locator('#settings-collections-path').blur();

  // Set documents path to a temporary folder
  const docs_path = path.resolve(path.join(os.tmpdir(), 'GLACIER-docs-' + Date.now().toString()));
  fs.mkdirSync(docs_path, { recursive: true });
  await page.fill('#settings-documents-path', `${docs_path}`);
  await page.locator('#settings-documents-path').blur();

  // --- Navigate to Library page
  await page.click('#sidebar-library-button');
  const repo_name = 'sleep';

  // Create an instance of the workflow (redirects to Parameters page)
  await page.click(`#card-${cssEscape(repo_name)}`);

  // Default display is Description, switch to Parameters tab
  await page.click('#parameters-params-tab');

  // Set sleep time parameter
  await page.getByLabel('Sleep Time').fill('5'); // 5 second sleep
  await page.getByLabel('Sleep Time').blur();

  // Launch workflow
  await page.getByRole('button', { name: 'Launch Workflow' }).click();

  // Check that workflow completes (3 second workflow)
  await expect(page.locator('h6').filter({ hasText: 'Completed' })).toBeVisible({
    timeout: TIMEOUT_30s
  });
});
