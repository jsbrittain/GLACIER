import { test as base, Page, ElectronApplication, _electron as electron } from '@playwright/test';

type Fixtures = {
  page: Page;
};

export const test = base.extend<Fixtures>({
  page: async ({ browser, page }, use, testInfo) => {
    if (testInfo.project.name.includes('Electron')) {
      const electronApp: ElectronApplication = await electron.launch({
        args: ['.', '--fullscreen', '--no-sandbox']
      });
      const win = await electronApp.firstWindow();

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
