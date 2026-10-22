import { test, expect } from '@playwright/test';
import { createE2EAccount, registerAndLogin, getAuthedRequestContext } from './helpers/app';

for (const mobile of [false, true]) {
  test('recurrence: custom monthly rule keeps interval/date through ' + (mobile ? 'modal @mobile' : 'desktop detail'), async ({ page, request }) => {
    if (mobile) await page.setViewportSize({ width: 375, height: 812 });
    await registerAndLogin(page, createE2EAccount());
    const api = await getAuthedRequestContext(request, page);
    const title = 'Monthly recurrence contract';
    await page.goto('/tasks?view=all');
    await page.getByTestId('task-new-button').click();
    await page.getByTestId('task-modal-title-input').fill(title);
    await page.getByTitle(/^(不重复|Does not repeat|No repeat)$/).click();
    const panel = page.locator('.task-recurrence-popover');
    await panel.getByRole('button', { name: /^(开启重复|Enable repeat)$/ }).click();
    await panel.getByRole('button', { name: /^(自定义|Custom)$/ }).click();
    await panel.getByRole('button', { name: /^(每 X 月|Every X months)$/ }).click();
    await panel.getByRole('spinbutton').fill('3');
    await panel.locator('.task-quick-date-trigger').click();
    await panel.getByRole('button', { name: '15', exact: true }).click();
    await panel.getByRole('button', { name: /^(确认|Confirm)$/ }).click();
    await expect(page.getByTitle('每 3 月 15 日').filter({ visible: true })).toBeVisible();
    await page.getByTestId('task-modal-save-button').click();
    const row = page.getByTestId('task-row').filter({ hasText: title }).first();
    await expect(row).toBeVisible();
    let taskID;
    await expect.poll(async () => {
      const tasks = await (await api.get('/api/tasks')).json();
      const task = tasks.find((item) => item.title === title);
      taskID = task?.id;
      return typeof task?.recurrence_rule === 'string' ? JSON.parse(task.recurrence_rule) : task?.recurrence_rule;
    }).toEqual({ freq: 'monthly', interval: 3, bydate: [15] });
    await row.click();
    await page.getByTitle('每 3 月 15 日').filter({ visible: true }).click();
    await expect(panel.getByRole('spinbutton')).toHaveValue('3');
    await expect(panel.locator('.task-quick-date-value')).toHaveText('15');
    await panel.getByRole('button', { name: /^(增加间隔|Increase interval)$/ }).click();
    await panel.getByRole('button', { name: /^(确认|Confirm)$/ }).click();
    await expect(page.getByTitle('每 4 月 15 日').filter({ visible: true })).toBeVisible();
    if (mobile) await page.getByTestId('task-modal-save-button').click();
    await expect.poll(async () => {
      const task = await (await api.get('/api/tasks/' + taskID)).json();
      return typeof task?.recurrence_rule === 'string' ? JSON.parse(task.recurrence_rule) : task?.recurrence_rule;
    }).toEqual({ freq: 'monthly', interval: 4, bydate: [15] });
  });
}
