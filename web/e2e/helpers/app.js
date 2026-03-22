import { expect } from '@playwright/test';

export function createE2EAccount() {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10_000)}`;
  return {
    username: `e2e_pw_${suffix}`,
    email: `e2e_pw_${suffix}@example.com`,
    password: `Pw_${suffix}_123`,
  };
}

export async function registerUI(page, account) {
  await page.goto('/register');
  await page.getByTestId('register-username-input').fill(account.username);
  await page.getByTestId('register-email-input').fill(account.email);
  await page.getByTestId('register-password-input').fill(account.password);
  await page.getByTestId('register-confirm-password-input').fill(account.password);
  await page.getByTestId('register-submit-button').click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function loginUI(page, account) {
  await page.goto('/login');
  await page.getByTestId('login-username-input').fill(account.username);
  await page.getByTestId('login-password-input').fill(account.password);
  await page.getByTestId('login-submit-button').click();
  await expect(page).not.toHaveURL(/\/login$/);
}

export async function registerAndLogin(page, account) {
  await registerUI(page, account);
  await loginUI(page, account);
}

export async function getAuthToken(page) {
  return page.evaluate(() => localStorage.getItem('token') || '');
}

export async function getAuthedRequestContext(request, page) {
  const token = await getAuthToken(page);
  expect(token).toBeTruthy();
  const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:8080';
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  return {
    get: (url, options = {}) => request.get(`${baseURL}${url}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    }),
    post: (url, options = {}) => request.post(`${baseURL}${url}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    }),
    patch: (url, options = {}) => request.patch(`${baseURL}${url}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    }),
  };
}

export async function createTaskInUI(page, title) {
  await page.goto('/tasks?view=all');
  await page.getByTestId('task-new-button').click();
  await page.getByTestId('task-modal-title-input').fill(title);
  await page.getByTestId('task-modal-save-button').click();
  await expect(page.locator('[data-testid="task-row"]').filter({ hasText: title }).first()).toBeVisible();
}

export async function clickManualSync(page) {
  await page.goto('/settings');
  await page.getByTestId('settings-sync-tab').click();
  await page.getByTestId('settings-sync-now-button').click();
}

export function formatUtcLocalInput(date) {
  const pad = (v) => String(v).padStart(2, '0');
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mm = pad(date.getUTCMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}
