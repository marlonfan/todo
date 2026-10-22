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
  const originalStart = Date.parse(createdTask.start_time);
  const originalDuration = Date.parse(createdTask.end_time) - originalStart;
  expect(Number.isFinite(originalStart)).toBe(true);
  expect(originalDuration).toBe(60 * 60 * 1000);

  // Opening / directly applies the account's default-tab redirect. Navigate
  // through the app so we drag the active calendar, not its kept-alive DOM.
  await page.goto('/tasks?view=all');
  await page.getByRole('link', { name: /^(日历|Calendar)$/ }).click();
  await expect(page).toHaveURL(/\/$/);

  const event = page.locator('.canvas-event').filter({ hasText: title }).first();
  await expect(event).toBeVisible();
  // Initial cache hydration can replace a visible node. Hover waits for the
  // event's layout to settle before reading coordinates for the gesture.
  await event.hover();

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
    if (!res.ok()) return null;
    const payload = await res.json();
    const updatedStart = Date.parse(payload.start_time);
    return {
      moved: Number.isFinite(updatedStart) && updatedStart !== originalStart,
      duration: Date.parse(payload.end_time) - updatedStart,
    };
  }).toEqual({ moved: true, duration: originalDuration });

});

test('calendar: subscription details refresh when only notes and location change', async ({ page }) => {
  await page.clock.install({ time: new Date() });
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  let revision = 1;
  const title = 'Subscription cache detail';
  await page.route('**/api/calendar?*', async (route) => {
    const url = new URL(route.request().url());
    const visible = start.getTime() >= Date.parse(url.searchParams.get('start'))
      && start.getTime() < Date.parse(url.searchParams.get('end'));
    await route.fulfill({ json: visible ? [{
      id: 'readonly-cache-test', title, start: start.toISOString(), end: end.toISOString(), editable: false,
      extendedProps: { readOnly: true, source: 'caldav', description: `Cache notes ${revision}`, location: `Cache room ${revision}` },
    }] : [] });
  });
  await registerAndLogin(page, createE2EAccount());
  await page.getByRole('link', { name: /^(日历|Calendar)$/ }).click();
  const event = page.locator('.canvas-event').filter({ hasText: title }).first();
  await expect(event).toBeVisible();
  await event.click();
  const detail = page.locator('.readonly-event-card');
  await expect(detail).toContainText('Cache notes 1');
  await expect(detail).toContainText('Cache room 1');
  await detail.getByRole('button', { name: /^(关闭|Close)$/ }).click();
  await expect(detail).toBeHidden();

  revision = 2;
  const refreshed = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/calendar');
  await page.clock.fastForward(10 * 60 * 1000 + 1000);
  await refreshed;
  await page.clock.runFor(500);
  await event.click();
  await expect(detail).toContainText('Cache notes 2');
  await expect(detail).toContainText('Cache room 2');
});
