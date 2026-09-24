import { test, expect } from '@playwright/test';

if (process.env.E2E_CHROME_EXECUTABLE) {
  test.use({ launchOptions: { executablePath: process.env.E2E_CHROME_EXECUTABLE }, video: 'off' });
}

const cachedUser = { id: 1, username: 'cached-user', timezone: 'Asia/Shanghai' };

async function startWithCachedSession(page, meStatus, refreshStatus, user = cachedUser) {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'test-session-token');
    if (user) localStorage.setItem('user', JSON.stringify(user));
  }, user);
  await page.route('**/api/auth/me', (route) => {
    if (meStatus === 'offline') return route.abort('failed');
    return route.fulfill({ status: meStatus, json: { error: 'unavailable' } });
  });
  if (refreshStatus) {
    await page.route('**/api/auth/refresh', (route) =>
      route.fulfill({
        status: refreshStatus,
        json: refreshStatus === 200 ? { token: 'renewed-test-token' } : { error: 'unavailable' },
      }));
  }
  await page.goto('/login');
}

test('keeps cached login when the initial account check is offline', async ({ page }) => {
  await startWithCachedSession(page, 'offline');
  await expect.poll(() => page.url().endsWith('/login')).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('test-session-token');
});

test('keeps cached login when refreshing a rejected request fails temporarily', async ({ page }) => {
  await startWithCachedSession(page, 401, 503);
  await expect.poll(() => page.url().endsWith('/login')).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('test-session-token');
});

test('clears login when the server rejects the refresh token', async ({ page }) => {
  await startWithCachedSession(page, 401, 401);
  await expect(page.getByTestId('login-username-input')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});

test('shows retry instead of login when offline without a cached user', async ({ page }) => {
  await startWithCachedSession(page, 'offline', null, null);
  await expect(page.locator('#root button.btn-primary')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('test-session-token');
});

test('clears login when the retried account check is also rejected', async ({ page }) => {
  await startWithCachedSession(page, 401, 200);
  await expect(page.getByTestId('login-username-input')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});
