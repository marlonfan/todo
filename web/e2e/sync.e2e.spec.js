import { test, expect } from '@playwright/test';
import {
  createE2EAccount,
  registerAndLogin,
  loginUI,
  createTaskInUI,
  clickManualSync,
  getAuthedRequestContext,
} from './helpers/app';

test('sync: two sessions propagate create and complete via manual sync', async ({ browser, request }) => {
  const account = createE2EAccount();
  const title = `Sync Task ${Date.now()}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await registerAndLogin(pageA, account);
  await loginUI(pageB, account);

  await createTaskInUI(pageA, title);

  await clickManualSync(pageB);
  await pageB.goto('/tasks?view=all');
  const rowB = pageB.locator('[data-testid="task-row"]').filter({ hasText: title }).first();
  await expect(rowB).toBeVisible();

  const requestCtxB = await getAuthedRequestContext(request, pageB);

  const rowA = pageA.locator('[data-testid="task-row"]').filter({ hasText: title }).first();
  await expect(rowA).toBeVisible();
  await rowA.locator('[data-testid="task-row-status-checkbox"]').click();

  await clickManualSync(pageB);
  await expect.poll(async () => {
    const res = await requestCtxB.get('/api/tasks');
    if (!res.ok()) return '';
    const data = await res.json();
    const target = Array.isArray(data)
      ? data.find((item) => item?.title === title)
      : null;
    return target?.status || '';
  }).toBe('completed');

  await contextA.close();
  await contextB.close();
});
