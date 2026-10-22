import test from 'node:test';
import assert from 'node:assert/strict';
import { clampNumber, getTaskSplitBounds, readTaskSplitRatio, writeTaskSplitRatio } from './taskListSplit.js';

test('clampNumber clamps within range', () => {
  assert.equal(clampNumber(5, 0, 10), 5);
  assert.equal(clampNumber(-1, 0, 10), 0);
  assert.equal(clampNumber(15, 0, 10), 10);
});

test('clampNumber falls back to min on non-finite input', () => {
  assert.equal(clampNumber('abc', 2, 10), 2);
  assert.equal(clampNumber(undefined, 2, 10), 2);
  assert.equal(clampNumber(NaN, 2, 10), 2);
});

test('clampNumber treats missing bounds as 0', () => {
  // safeMin=0, safeMax=max(0,0)=0, so any finite value clamps to 0
  assert.equal(clampNumber(5), 0);
  assert.equal(clampNumber(-3), 0);
});

test('readTaskSplitRatio returns default when window is unavailable', () => {
  // node test runner has no global window
  assert.equal(readTaskSplitRatio(), 0.55);
});

test('readTaskSplitRatio uses the default for missing or invalid saved preferences', (t) => {
  t.after(() => { delete globalThis.window; });
  for (const stored of [null, '', 'invalid', 'Infinity']) {
    globalThis.window = { localStorage: { getItem: () => stored } };
    assert.equal(readTaskSplitRatio(), 0.55, `stored value: ${stored}`);
  }
});

test('split preferences tolerate unavailable storage', (t) => {
  t.after(() => { delete globalThis.window; });
  globalThis.window = {
    get localStorage() { throw new Error('Storage is disabled'); },
  };
  assert.equal(readTaskSplitRatio(), 0.55);
  assert.doesNotThrow(() => writeTaskSplitRatio(0.6));
});

test('split preferences preserve valid values and clamp values outside the allowed range', (t) => {
  t.after(() => { delete globalThis.window; });
  for (const [stored, expected] of [['0.6', 0.6], ['0.1', 0.25], ['0.9', 0.75]]) {
    globalThis.window = { localStorage: { getItem: () => stored } };
    assert.equal(readTaskSplitRatio(), expected);
  }
  let saved;
  globalThis.window = { localStorage: { setItem: (key, value) => { saved = [key, value]; } } };
  writeTaskSplitRatio(0.6);
  assert.deepEqual(saved, ['todo:taskListDetailSplitRatio', '0.6000']);
});

test('split bounds respect both pane minimum widths and the persisted ratio limits', () => {
  assert.deepEqual(getTaskSplitBounds(0), { min: 0.25, max: 0.75 });
  assert.deepEqual(getTaskSplitBounds(800), { min: 320 / 792, max: 1 - 340 / 792 });
  assert.deepEqual(getTaskSplitBounds(2000), { min: 0.25, max: 0.75 });
});
