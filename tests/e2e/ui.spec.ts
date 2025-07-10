import { test, expect } from './fixtures';

test('should show title', async ({ appPage }) => {
  await expect(appPage).toHaveTitle(/IceFlow/i);
});
