import { test, expect } from '@playwright/test';
import {
  createE2EAccount,
  clickManualSync,
  registerAndLogin,
  getAuthedRequestContext,
} from './helpers/app';

test('task: add, edit, complete', async ({ page, request }) => {
  const account = createE2EAccount();
  const title = `UI Task ${Date.now()}`;
  const editedTitle = `${title} edited`;

  await registerAndLogin(page, account);
  await page.goto('/tasks?view=all');

  await page.getByTestId('task-new-button').click();
  await page.getByTestId('task-modal-title-input').fill(title);
  await page.getByTestId('task-modal-save-button').click();

  const createdRow = page.locator('[data-testid="task-row"]').filter({ hasText: title }).first();
  await expect(createdRow).toBeVisible();
  await createdRow.click();

  const detailTitleInput = page.getByTestId('task-detail-title-input');
  await detailTitleInput.fill(editedTitle);
  await expect(page.locator('[data-testid="task-row"]').filter({ hasText: editedTitle }).first()).toBeVisible();
  await detailTitleInput.blur();

  const requestCtx = await getAuthedRequestContext(request, page);
  await expect.poll(async () => {
    const res = await requestCtx.get('/api/tasks');
    if (!res.ok()) return '';
    const data = await res.json();
    const target = Array.isArray(data)
      ? data.find((item) => item?.title === editedTitle)
      : null;
    return target ? target.title : '';
  }).toBe(editedTitle);

  const editedRow = page.locator('[data-testid="task-row"]').filter({ hasText: editedTitle }).first();
  await expect(editedRow).toBeVisible();
  await editedRow.locator('[data-testid="task-row-status-checkbox"]').click();

  await expect.poll(async () => {
    const res = await requestCtx.get('/api/tasks');
    if (!res.ok()) return '';
    const data = await res.json();
    const target = Array.isArray(data)
      ? data.find((item) => item?.title === editedTitle)
      : null;
    return target?.status || '';
  }).toBe('completed');

});

test('task: opening the detail date picker does not shade the Windows title bar', async ({ page }) => {
  const account = createE2EAccount();
  const title = `Date Picker Title Bar ${Date.now()}`;

  await registerAndLogin(page, account);
  await page.goto('/tasks?view=all');
  await page.evaluate(() => {
    document.documentElement.classList.add('todo-electron', 'todo-platform-win32');
    const dragRegion = document.createElement('div');
    dragRegion.className = 'desktop-window-drag-region';
    document.body.appendChild(dragRegion);
  });

  const titleBarShade = () => page.locator('.desktop-window-drag-region').evaluate((element) => {
    const style = getComputedStyle(element, '::after');
    return {
      content: style.content,
      backgroundColor: style.backgroundColor,
    };
  });

  await page.getByTestId('task-new-button').click();
  await expect.poll(titleBarShade).toEqual({
    content: '""',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  });
  await page.getByTestId('task-modal-title-input').fill(title);
  await page.getByTestId('task-modal-save-button').click();

  const createdRow = page.locator('[data-testid="task-row"]').filter({ hasText: title }).first();
  await expect(createdRow).toBeVisible();
  await createdRow.click();

  await expect.poll(titleBarShade).toEqual({
    content: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0)',
  });
  await page.getByRole('button', { name: /^\d{2}\/\d{2} \d{2}:\d{2}$/ }).click();
  await expect(page.locator('.task-detail-time-panel .react-datepicker[role="dialog"]')).toBeVisible();
  await expect.poll(titleBarShade).toEqual({
    content: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0)',
  });
});

test('task: completed/deleted view sorting supports status time and created time', async ({ page, request }) => {
  const account = createE2EAccount();
  const requestCtxReady = registerAndLogin(page, account);
  await requestCtxReady;
  await page.goto('/tasks?view=all');
  const requestCtx = await getAuthedRequestContext(request, page);

  const createTask = async (title) => {
    await page.getByTestId('task-new-button').click();
    await page.getByTestId('task-modal-title-input').fill(title);
    await page.getByTestId('task-modal-save-button').click();
    await expect(page.locator('[data-testid="task-row"]').filter({ hasText: title }).first()).toBeVisible();
  };
  const firstTitle = `Sort A ${Date.now()}`;
  const secondTitle = `Sort B ${Date.now() + 1}`;
  await createTask(firstTitle);
  await page.waitForTimeout(2200);
  await createTask(secondTitle);
  let firstTask = null;
  let secondTask = null;
  await expect.poll(async () => {
    const listRes = await requestCtx.get('/api/tasks');
    if (!listRes.ok()) return false;
    const listData = await listRes.json();
    firstTask = Array.isArray(listData) ? listData.find((item) => item?.title === firstTitle) : null;
    secondTask = Array.isArray(listData) ? listData.find((item) => item?.title === secondTitle) : null;
    return !!(firstTask?.id && secondTask?.id);
  }, { timeout: 20_000 }).toBe(true);
  expect(firstTask?.id).toBeTruthy();
  expect(secondTask?.id).toBeTruthy();

  await requestCtx.patch(`/api/tasks/${secondTask.id}/status`, { data: { status: 'completed' } });
  await page.waitForTimeout(2200);
  await requestCtx.patch(`/api/tasks/${firstTask.id}/status`, { data: { status: 'completed' } });
  await clickManualSync(page);

  await page.goto('/tasks?view=completed');
  const completedRows = page.locator('[data-testid="task-row"] h3');
  await expect(completedRows.first()).toContainText(firstTitle);

  await page.getByTestId('task-sort-toggle-button').first().click();
  await page.getByTestId('task-sort-option-created_desc').first().click();
  await expect(completedRows.first()).toContainText(secondTitle);

  await requestCtx.patch(`/api/tasks/${secondTask.id}/status`, { data: { status: 'cancelled' } });
  await page.waitForTimeout(2200);
  await requestCtx.patch(`/api/tasks/${firstTask.id}/status`, { data: { status: 'cancelled' } });
  await clickManualSync(page);

  await page.goto('/tasks?view=deleted');
  const deletedRows = page.locator('[data-testid="task-row"] h3');
  await expect(deletedRows.first()).toContainText(firstTitle);

  await page.getByTestId('task-sort-toggle-button').first().click();
  await page.getByTestId('task-sort-option-created_desc').first().click();
  await expect(deletedRows.first()).toContainText(secondTitle);
});
