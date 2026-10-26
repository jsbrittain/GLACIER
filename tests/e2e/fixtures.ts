import { test as base, Page, ElectronApplication, _electron as electron } from '@playwright/test';

async function dismissStartupDialog(page: Page) {
  await page.waitForLoadState();
  const continueBtn = page.locator('#setup-continue-button');
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(500);
  }
}

type Fixtures = {
  page: Page;
};

export const test = base.extend<Fixtures>({
  page: async ({ browser, page }, use, testInfo) => {
    if (testInfo.project.name.includes('Electron')) {
      // Electron mode

      const electronApp: ElectronApplication = await electron.launch({
        args: ['.', '--fullscreen', '--no-sandbox']
      });

      // Capture main process stdout/stderr
      const proc = await electronApp.process();
      proc.stdout.on('data', (chunk) => process.stdout.write(`[main] ${chunk}`));
      proc.stderr.on('data', (chunk) => process.stderr.write(`[main:error] ${chunk}`));

      const win = await electronApp.firstWindow();

      // Capture renderer console
      win.on('console', (msg) => console.log(`[renderer:${msg.type()}] ${msg.text()}`));
      win.on('pageerror', (err) => console.error(`[renderer:error] ${err}`));

      await electronApp.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win.setBounds({ width: 1024, height: 768 });
        win.setFullScreen(true);
      });

      await dismissStartupDialog(win);

      await use(win);

      // Electron can fail to quit on some CI runners (observed on the x64 macOS
      // runner), which surfaces as "Worker teardown timeout of 30000ms exceeded"
      // and eventually burns the whole job timeout. Give it a chance to close
      // cleanly, then make sure the process is gone before the worker exits.
      await Promise.race([
        electronApp.close().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 10_000))
      ]);
      if (proc.exitCode === null && !proc.killed) {
        proc.kill('SIGKILL');
      }
    } else {
      await page.goto('/');
      await dismissStartupDialog(page);
      await use(page);
    }
  }
});

export const expect = test.expect;
