import { test, expect } from '@playwright/test';
import { createE2EAccount, registerUI, loginUI, getAuthToken } from './helpers/app';

test('auth: register then login', async ({ page }) => {
  const account = createE2EAccount();
  await registerUI(page, account);
  await loginUI(page, account);
  const token = await getAuthToken(page);
  expect(token).toBeTruthy();
});

test('auth: first service worker installation preserves form input without a reload', async ({ page }) => {
  await page.addInitScript(() => {
    const worker = navigator.serviceWorker;
    const register = worker.register.bind(worker);
    worker.register = (...args) => new Promise((resolve, reject) => {
      window.releaseWorkerRegistration = () => register(...args).then(resolve, reject);
    });
  });
  await page.goto('/register');
  const username = page.getByTestId('register-username-input');
  await username.fill('keep-first-install-input');
  await page.waitForFunction(() => typeof window.releaseWorkerRegistration === 'function');
  await page.evaluate(async () => {
    window.firstInstallDocument = true;
    await window.releaseWorkerRegistration();
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });
  await expect(username).toHaveValue('keep-first-install-input');
  expect(await page.evaluate(() => window.firstInstallDocument)).toBe(true);
});
