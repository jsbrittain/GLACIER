import { test as base, Page, ElectronApplication, _electron as electron } from '@playwright/test';

type Fixtures = {
  appPage: Page;
};

export const test = base.extend<Fixtures>({
  appPage: async ({ browser, page }, use, testInfo) => {
    if (testInfo.project.name.includes('Electron')) {
      const electronApp: ElectronApplication = await electron.launch({
        args: ['.', '--fullscreen', '--no-sandbox'],
      });
      const win = await electronApp.firstWindow();
      await use(win);
      await electronApp.close();
    } else {
      await page.goto('/');
      await use(page);
    }
  },
});

export const expect = test.expect;
