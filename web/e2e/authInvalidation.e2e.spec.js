import { test, expect } from '@playwright/test';

for (const desktop of [false, true]) {
  test('auth invalidation returns ' + (desktop ? 'Electron' : 'Web') + ' to login without script errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((desktop) => {
      if (desktop) window.todoElectron = { platform: 'darwin' };
      if (sessionStorage.getItem('e2e-session-seeded')) return;
      sessionStorage.setItem('e2e-session-seeded', '1');
      localStorage.setItem('token', 'test-session');
      localStorage.setItem('user', JSON.stringify({ id: 1, username: 'cached', timezone: 'UTC' }));
    }, desktop);
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      let json = [];
      if (path.endsWith('/auth/me')) json = { id: 1, username: 'cached', timezone: 'UTC' };
      if (path.endsWith('/tasks/sync')) json = { tasks: [], deleted: [], next_cursor: 'v1:0', has_more: false };
      if (path.endsWith('/tasks/occurrences')) json = { items: [], next_cursor: 0, has_more: false };
      return route.fulfill({ status: 200, json });
    });
    await page.goto(desktop ? '/#/tasks' : '/tasks');
    await expect(page.getByTestId('task-new-button')).toBeVisible();
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('todo:auth-invalidated'));
    });
    await expect(page).toHaveURL(desktop ? /#\/login$/ : /\/login$/);
    await expect(page.getByTestId('login-username-input')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
