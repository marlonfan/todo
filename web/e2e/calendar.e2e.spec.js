import { test, expect } from '@playwright/test';
import {
  createE2EAccount,
  registerAndLogin,
  getAuthedRequestContext,
  formatUtcLocalInput,
} from './helpers/app';

test('calendar: view and drag event to update time', async ({ page, request }) => {
  const account = createE2EAccount();
  const title = `Calendar Drag ${Date.now()}`;

  await registerAndLogin(page, account);
  const requestCtx = await getAuthedRequestContext(request, page);

  const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const startInput = formatUtcLocalInput(start);
  const endInput = formatUtcLocalInput(end);

  const createRes = await requestCtx.post('/api/tasks', {
    data: {
      title,
      all_day: false,
      start_time_local: startInput,
      end_time_local: endInput,
      client_timezone: 'UTC',
      priority: 0,
      description: '',
      category_ids: [],
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const createdTask = await createRes.json();
  const taskID = Number(createdTask?.id || 0);
  expect(taskID).toBeGreaterThan(0);

  await page.goto('/');
  if (!page.url().endsWith('/')) {
    await page.goto('/');
  }

  const event = page.locator('.canvas-event').filter({ hasText: title }).first();
  await expect(event).toBeVisible();

  const box = await event.boundingBox();
  expect(box).toBeTruthy();
  const x = box.x + box.width / 2;
  const y = box.y + Math.max(8, box.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 70, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => {
    const res = await requestCtx.get(`/api/tasks/${taskID}`);
    if (!res.ok()) return '';
    const payload = await res.json();
    return String(payload?.start_time || '');
  }).not.toBe(startInput);

});
