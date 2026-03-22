import { test, expect } from '@playwright/test';
import { createE2EAccount, registerUI, loginUI, getAuthToken } from './helpers/app';

test('auth: register then login', async ({ page }) => {
  const account = createE2EAccount();
  await registerUI(page, account);
  await loginUI(page, account);
  const token = await getAuthToken(page);
  expect(token).toBeTruthy();
});
