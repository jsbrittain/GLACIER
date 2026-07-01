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
  await page.waitForEvent('console', {
    predicate: (msg) =>
      text instanceof RegExp ? text.test(msg.text()) : msg.text().includes(text),
    timeout
  });
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
  const docs_path = path.resolve(path.join(glacier_path, 'docs'));
  fs.mkdirSync(docs_path, { recursive: true });

  // Open the path setup dialog
  await page.click('#settings-reopen-setup');
  await page.fill('#setup-config-folder', `${library_path}`);
  await page.fill('#setup-documents-folder', `${docs_path}`);
  await page.click('#setup-continue-button');

  // Navigate to Library tab (permissions switches were moved here)
  await page.click('#settings-library-panel');

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

  // Navigate to Library page
  await page.click('#sidebar-library-button');

  // Wait for the library UI to be interactive rather than asserting exact empty-state text
  const actionsButton = page.locator('#library-actions-menu-button');
  await expect(actionsButton).toBeVisible({ timeout: TIMEOUT_30s });
  await expect(actionsButton).toBeEnabled({ timeout: TIMEOUT_30s });

  // Add repository
  const repo_owner = 'jsbrittain';
  const repo_name = 'workflow-runner-test-nextflow';

  await actionsButton.click();
  await expect(page.locator('#library-actions-menu-add-repo')).toBeVisible({
    timeout: TIMEOUT_10s
  });
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

  // Confirm the installation dialog (security check)
  const installDialog = page.getByRole('dialog', { name: 'Confirm Workflow Installation' });
  await expect(installDialog).toBeVisible({ timeout: TIMEOUT_10s });
  await installDialog.getByRole('button', { name: 'Install' }).click();

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

  // Open the path setup dialog
  const docs_path = path.resolve(path.join(os.tmpdir(), 'GLACIER-docs-' + Date.now().toString()));
  fs.mkdirSync(docs_path, { recursive: true });
  await page.click('#settings-reopen-setup');
  await page.fill('#setup-config-folder', `${local_collections_path}`);
  await page.fill('#setup-documents-folder', `${docs_path}`);
  await page.click('#setup-continue-button');

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

  // Check that workflow completes (5 second workflow)
  await expect(page.getByText('Completed')).toBeVisible({
    timeout: TIMEOUT_30s
  });
});

async function runOutdirWorkflow(
  page: Page,
  docsPath: string,
  autoOutdirOn: boolean,
): Promise<string> {
  // Set autoOutdir to desired state
  await page.click('#sidebar-settings-button');
  await page.click('#settings-general-panel');
  const checkbox = page.getByLabel('Auto-resolve outdir parameter');
  if (autoOutdirOn) {
    await checkbox.check();
  } else {
    await checkbox.uncheck();
  }

  // Navigate to Library and select outdir workflow
  await page.click('#sidebar-library-button');
  await page.click('#card-outdir');

  // Extract instance name from Parameters page header: "[<name>] <workflow name>"
  const headerText = await page.locator('h6').filter({ hasText: /\[/ }).first().textContent();
  const instanceName = headerText?.match(/\[(.+?)\]/)?.[1];
  if (!instanceName) throw new Error('Could not extract instance name from header');

  // Launch workflow
  await page.getByRole('button', { name: 'Launch Workflow' }).click();

  // Wait for completion
  await expect(page.getByText('Completed')).toBeVisible({ timeout: TIMEOUT_60s });

  return instanceName;
}

test('outdir workflow — autoOutdir OFF', async ({ page }) => {
  const local_collections_path = path.resolve(path.join(__dirname, '..', 'test-data'));
  const docs_path = path.resolve(path.join(os.tmpdir(), 'GLACIER-docs-' + Date.now().toString()));
  fs.mkdirSync(docs_path, { recursive: true });

  // Setup paths
  await page.click('#sidebar-settings-button');
  await page.click('#settings-general-panel');
  await page.click('#settings-reopen-setup');
  await page.fill('#setup-config-folder', `${local_collections_path}`);
  await page.fill('#setup-documents-folder', `${docs_path}`);
  await page.click('#setup-continue-button');

  const instanceName = await runOutdirWorkflow(page, docs_path, false);

  // With autoOutdir OFF, outdir defaults to ./results inside the instance path
  const instancePath = path.join(docs_path, 'instances', 'glacier', 'outdir@main', instanceName);
  expect(fs.existsSync(path.join(instancePath, 'results', 'output.txt'))).toBe(true);
  expect(fs.existsSync(path.join(instancePath, 'results', 'report.html'))).toBe(true);

  // Output directory should not contain these files
  const outputPath = path.join(docs_path, 'output', 'glacier', 'outdir@main', instanceName);
  expect(fs.existsSync(path.join(outputPath, 'output.txt'))).toBe(false);
});

test('outdir workflow — autoOutdir ON', async ({ page }) => {
  const local_collections_path = path.resolve(path.join(__dirname, '..', 'test-data'));
  const docs_path = path.resolve(path.join(os.tmpdir(), 'GLACIER-docs-' + Date.now().toString()));
  fs.mkdirSync(docs_path, { recursive: true });

  // Setup paths
  await page.click('#sidebar-settings-button');
  await page.click('#settings-general-panel');
  await page.click('#settings-reopen-setup');
  await page.fill('#setup-config-folder', `${local_collections_path}`);
  await page.fill('#setup-documents-folder', `${docs_path}`);
  await page.click('#setup-continue-button');

  const instanceName = await runOutdirWorkflow(page, docs_path, true);

  // With autoOutdir ON, files should be in the output directory
  const outputPath = path.join(docs_path, 'output', 'glacier', 'outdir@main', instanceName);
  expect(fs.existsSync(path.join(outputPath, 'output.txt'))).toBe(true);
  expect(fs.existsSync(path.join(outputPath, 'report.html'))).toBe(true);

  // Instance path should not have a results folder (files went to outdir instead)
  const instancePath = path.join(docs_path, 'instances', 'glacier', 'outdir@main', instanceName);
  expect(fs.existsSync(path.join(instancePath, 'results'))).toBe(false);
});
