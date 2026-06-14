import test from 'node:test';
import assert from 'node:assert/strict';
import { clampNumber, readTaskSplitRatio } from './taskListSplit.js';

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
