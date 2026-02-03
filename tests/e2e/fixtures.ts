import { test as base, Page, ElectronApplication, _electron as electron } from '@playwright/test';

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

      await use(win);
      await electronApp.close();
    } else {
      await page.goto('/');
      await use(page);
    }
  }
});

export const expect = test.expect;
