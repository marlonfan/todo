import { test, expect } from '@playwright/test';
import { createE2EAccount, registerAndLogin } from './helpers/app';

test('task split: default, drag, persistence, keyboard and narrow-screen layout', async ({ page }) => {
  await registerAndLogin(page, createE2EAccount());
  await page.goto('/tasks?view=all');
  const separator = page.getByRole('separator', { name: /拖动调整|Drag to resize/i });
  await expect(separator).toBeVisible();
  await expect(separator).toHaveAttribute('aria-valuenow', '55');
  await expect(separator).toHaveAttribute('aria-orientation', 'vertical');

  const before = await separator.boundingBox();
  await page.mouse.move(before.x + before.width / 2, before.y + 100);
  await page.mouse.down();
  await expect(page.locator('body')).toHaveClass(/task-split-resizing/);
  await page.mouse.move(before.x + 105, before.y + 100, { steps: 12 });
  await expect.poll(async () => Number(await separator.getAttribute('aria-valuenow'))).toBeGreaterThan(55);
  await page.mouse.up();
  await expect(page.locator('body')).not.toHaveClass(/task-split-resizing/);
  const resized = await separator.getAttribute('aria-valuenow');
  await page.reload();
  await expect(separator).toHaveAttribute('aria-valuenow', resized);

  await separator.focus();
  await page.keyboard.press('Home');
  await expect(separator).toHaveAttribute('aria-valuenow', '55');
  await page.keyboard.press('ArrowLeft');
  await expect(separator).toHaveAttribute('aria-valuenow', '52');
  await page.keyboard.press('ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', '55');

  await page.setViewportSize({ width: 900, height: 800 });
  await expect(separator).toBeHidden();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(separator).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByTestId('task-new-button').click();
  await expect(page.getByTestId('task-modal-title-input')).toBeVisible();
});

test('task split: losing window focus ends the drag and restores normal pointer behavior', async ({ page }) => {
  await registerAndLogin(page, createE2EAccount());
  await page.goto('/tasks?view=all');
  const separator = page.locator('.task-split-resizer');
  await expect(separator).toBeVisible();
  const rect = await separator.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + 100);
  await page.mouse.down();
  await expect(page.locator('body')).toHaveClass(/task-split-resizing/);
  await page.mouse.move(rect.x + 85, rect.y + 100);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('body')).not.toHaveClass(/task-split-resizing/);
  const stopped = await separator.getAttribute('aria-valuenow');
  await page.mouse.move(rect.x - 100, rect.y + 100);
  await page.mouse.up();
  await expect(separator).toHaveAttribute('aria-valuenow', stopped);
});
