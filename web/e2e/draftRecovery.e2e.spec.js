import { test, expect } from '@playwright/test';
import { createE2EAccount, registerAndLogin, getAuthedRequestContext } from './helpers/app';

for (const store of ['tasks', 'outbox']) {
  test('draft recovery: ' + store + ' write failure survives switching, reload and retry', async ({ page, request }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await registerAndLogin(page, createE2EAccount());
    const api = await getAuthedRequestContext(request, page);
    const first = await api.post('/api/tasks', { data: { title: 'Draft recovery original', priority: 0 } });
    const second = await api.post('/api/tasks', { data: { title: 'Other recovery task', priority: 0 } });
    expect(first.ok()).toBe(true);
    expect(second.ok()).toBe(true);
    const original = await first.json();
    const other = await second.json();
    await page.addInitScript(({ store, taskID }) => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (value, ...args) {
        const id = this.name === 'outbox' ? value?.entity_id : value?.id;
        if (window.failDraftWrites && this.name === store && Number(id) === taskID) {
          throw new DOMException('Simulated draft persistence failure', 'QuotaExceededError');
        }
        return put.call(this, value, ...args);
      };
    }, { store, taskID: original.id });
    await page.goto('/tasks?view=all');
    const firstRow = page.locator('[data-testid="task-row"][data-task-id="' + original.id + '"]');
    const secondRow = page.locator('[data-testid="task-row"][data-task-id="' + other.id + '"]');
    await firstRow.getByRole('button', { name: 'Draft recovery original', exact: true }).click();
    const title = page.getByTestId('task-detail-title-input');
    await expect(title).toHaveValue('Draft recovery original');
    await page.evaluate(() => { window.failDraftWrites = true; });
    await title.fill('Recovered draft content');
    const recovery = page.getByTestId('task-draft-recovery');
    await expect(recovery).toBeVisible();
    await expect(firstRow).toContainText('Recovered draft content');
    await secondRow.getByRole('button', { name: 'Other recovery task', exact: true }).click();
    await expect(title).toHaveValue('Other recovery task');
    await firstRow.getByRole('button', { name: 'Recovered draft content', exact: true }).click();
    await expect(title).toHaveValue('Recovered draft content');

    page.once('dialog', (dialog) => dialog.accept());
    await page.reload();
    await expect(recovery).toBeVisible();
    // The new document has no injected write failure. Recovery still requires an
    // explicit retry, so a restored draft cannot overwrite server data silently.
    await recovery.getByRole('button', { name: /^(重试|Retry)$/ }).click();
    await expect(recovery).toBeHidden();
    await expect.poll(async () => (await (await api.get('/api/tasks/' + original.id)).json()).title)
      .toBe('Recovered draft content');
    expect((await (await api.get('/api/tasks/' + other.id)).json()).title).toBe('Other recovery task');
    expect(pageErrors).toEqual([]);
  });
}

for (const creating of [false, true]) {
  for (const store of ['tasks', 'outbox']) {
    test('modal recovery @mobile: ' + (creating ? 'new' : 'existing') + ' task survives ' + store + ' failure and reload without duplicates', async ({ page, request }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await registerAndLogin(page, createE2EAccount());
      const api = await getAuthedRequestContext(request, page);
      const originalTitle = 'Modal original';
      const title = 'Modal durable recovery';
      let taskID = 0;
      if (!creating) {
        const res = await api.post('/api/tasks', { data: { title: originalTitle, priority: 0 } });
        expect(res.ok()).toBe(true);
        taskID = (await res.json()).id;
      }
      await page.addInitScript(({ store, title }) => {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (value, ...args) {
          const candidate = this.name === 'outbox' ? value?.payload : value;
          if (window.failModalWrites && this.name === store && candidate?.title === title) {
            throw new DOMException('Simulated modal persistence failure', 'QuotaExceededError');
          }
          return put.call(this, value, ...args);
        };
      }, { store, title });
      await page.goto('/tasks?view=all');
      if (creating) await page.getByTestId('task-new-button').click();
      else await page.getByRole('button', { name: originalTitle, exact: true }).click();
      const input = page.getByTestId('task-modal-title-input');
      await input.fill(title);
      await page.evaluate(() => { window.failModalWrites = true; });
      await page.getByTestId('task-modal-save-button').click();
      await expect(page.locator('.task-modal-shell').getByRole('alert')).toBeVisible();
      await expect(input).toHaveValue(title);
      await expect(page.getByTestId('task-modal-save-button')).toBeEnabled();
      const before = await (await api.get('/api/tasks')).json();
      expect(before.filter((task) => task.title === title)).toHaveLength(0);
      page.once('dialog', (dialog) => dialog.accept());
      await page.reload();
      const recovery = page.getByTestId('task-draft-recovery');
      await expect(recovery).toBeVisible();
      await recovery.getByRole('button', { name: /^(重试|Retry)$/ }).click();
      await expect(recovery).toBeHidden();
      await expect.poll(async () => {
        const tasks = await (await api.get('/api/tasks')).json();
        return tasks.filter((task) => task.title === title).map((task) => ({ title: task.title, sameID: creating || task.id === taskID }));
      }).toEqual([{ title, sameID: true }]);
      expect(errors).toEqual([]);
    });
  }
}

for (const store of ['tasks', 'outbox']) {
  test('quick creation: ' + store + ' failure retains text and repeated Enter recovers one task', async ({ page, request }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await registerAndLogin(page, createE2EAccount());
    const api = await getAuthedRequestContext(request, page);
    const title = 'Quick durable recovery';
    await page.addInitScript(({ store, title }) => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (value, ...args) {
        const candidate = this.name === 'outbox' ? value?.payload : value;
        if (window.failQuickWrites && this.name === store && candidate?.title === title) {
          throw new DOMException('Simulated quick creation failure', 'QuotaExceededError');
        }
        return put.call(this, value, ...args);
      };
    }, { store, title });
    await page.goto('/tasks?view=all');
    const input = page.getByRole('textbox', { name: /^(快速添加任务|Quick add task)$/ });
    await input.fill(title);
    await page.evaluate(() => { window.failQuickWrites = true; });
    await input.press('Enter');
    const recovery = page.getByTestId('task-draft-recovery');
    await expect(recovery).toBeVisible();
    await expect(input).toHaveValue(title);
    await input.press('Enter');
    await expect(recovery).toContainText(/1/);
    page.once('dialog', (dialog) => dialog.accept());
    await page.reload();
    await expect(recovery).toBeVisible();
    await recovery.getByRole('button', { name: /^(重试|Retry)$/ }).click();
    await expect(recovery).toBeHidden();
    await expect.poll(async () => {
      const tasks = await (await api.get('/api/tasks')).json();
      return tasks.filter((task) => task.title === title).length;
    }).toBe(1);
    expect(errors).toEqual([]);
  });
}
