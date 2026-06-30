import { test, expect } from '@playwright/test';
import { createE2EAccount, registerAndLogin } from './helpers/app';

test('mobile smoke @mobile: register, login and open tasks/calendar', async ({ page }) => {
  const account = createE2EAccount();

  await registerAndLogin(page, account);
  await page.goto('/tasks?view=all');
  await expect(page.locator('body')).toContainText(/Todo|任务|Tasks/i);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /width=device-width/);
  await expect(page.locator('.mobile-top-bar')).toBeVisible();
  await expect(page.locator('.mobile-bottom-nav')).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCSS('position', 'fixed');

  await page.goto('/');
  if (!page.url().endsWith('/')) {
    await page.goto('/');
  }
  await expect(page.locator('.canvas-event, [aria-label="calendar view selector"]').first()).toBeVisible();
});
