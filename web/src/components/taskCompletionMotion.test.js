import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { TASK_ROW_COMPLETE_EXIT_MS } from './taskListConstants.js';
import { getTaskCompletionStageDelay, prefersReducedMotion } from './taskCompletionMotion.js';

const cssPath = fileURLToPath(new URL('../index.css', import.meta.url));

test('completion staging skips the delay when reduced motion is preferred', () => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    matchMedia: () => ({ matches: true }),
  };

  try {
    assert.equal(prefersReducedMotion(), true);
    assert.equal(getTaskCompletionStageDelay(), 0);
  } finally {
    if (typeof previousWindow === 'undefined') delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('completion staging keeps the animation duration by default', () => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    matchMedia: () => ({ matches: false }),
  };

  try {
    assert.equal(prefersReducedMotion(), false);
    assert.equal(getTaskCompletionStageDelay(), TASK_ROW_COMPLETE_EXIT_MS);
  } finally {
    if (typeof previousWindow === 'undefined') delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('completion exit animation only uses compositor-friendly properties', async () => {
  const css = await readFile(cssPath, 'utf8');
  const animationStart = css.indexOf('@keyframes task-row-complete-exit');
  const animationEnd = css.indexOf('@keyframes task-row-complete-progress', animationStart);
  const animation = animationStart >= 0 && animationEnd > animationStart
    ? css.slice(animationStart, animationEnd)
    : '';

  assert.match(animation, /opacity:/);
  assert.match(animation, /transform:/);
  assert.doesNotMatch(animation, /max-height:|padding(?:-top|-bottom)?:|border-bottom-width:/);
});
