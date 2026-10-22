import { test, expect } from '@playwright/test';
import { createE2EAccount, registerAndLogin } from './helpers/app';

test('calendar keyboard: day/week/month events open with Enter/Space and return focus after closing', async ({ page }) => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const end = new Date(today.getTime() + 60 * 60 * 1000);
  const date = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  await page.route('**/api/calendar?*', async (route) => {
    const url = new URL(route.request().url());
    const visible = today.getTime() >= Date.parse(url.searchParams.get('start'))
      && today.getTime() < Date.parse(url.searchParams.get('end'));
    await route.fulfill({ json: visible ? [
      { id: 'keyboard-timed', title: 'Keyboard timed event', start: today.toISOString(), end: end.toISOString(), editable: false,
        extendedProps: { readOnly: true, source: 'caldav', description: 'Timed keyboard detail' } },
      { id: 'keyboard-allday', title: 'Keyboard all-day event', start: date, allDay: true, editable: false,
        extendedProps: { readOnly: true, source: 'caldav', description: 'All-day keyboard detail' } },
    ] : [] });
  });
  await registerAndLogin(page, createE2EAccount());
  await page.getByRole('link', { name: /^(日历|Calendar)$/ }).click();
  for (const view of [/^(日|Day)$/, /^(周|Week)$/, /^(月|Month)$/]) {
    const selector = page.getByRole('button', { name: 'calendar view selector' });
    await selector.click();
    await page.locator('.calendar-view-menu').getByRole('button', { name: view }).click();
    const timed = page.getByRole('button', { name: 'Keyboard timed event', exact: true });
    await expect(timed).toBeVisible();
    await expect(timed).toHaveAttribute('tabindex', '0');
    await selector.focus();
    for (let i = 0; i < 30; i += 1) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Keyboard timed event')) break;
    }
    await expect(timed).toBeFocused();
    await expect(timed).toHaveCSS('outline-style', 'solid');
    await expect(timed).toHaveCSS('outline-width', '2px');
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Keyboard timed event' });
    await expect(dialog).toContainText('Timed keyboard detail');
    await expect(dialog.getByRole('button', { name: /^(关闭|Close)$/ })).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(timed).toBeFocused();

    const allDay = page.getByRole('button', { name: 'Keyboard all-day event', exact: true });
    await allDay.focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('dialog', { name: 'Keyboard all-day event' })).toContainText('All-day keyboard detail');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(allDay).toBeFocused();

    // Native month clicks and canvas-owned day/week clicks must both work.
    await timed.click();
    await expect(dialog).toContainText('Timed keyboard detail');
    await dialog.getByRole('button', { name: /^(关闭|Close)$/ }).click();
    await expect(dialog).toBeHidden();
  }
  expect(await page.locator('[data-calendar-date][tabindex="0"]').count()).toBeLessThanOrEqual(42);
  expect(await page.locator('[data-calendar-date][tabindex="-1"]').count()).toBeGreaterThan(0);
});
