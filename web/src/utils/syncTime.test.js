import test from 'node:test';
import assert from 'node:assert/strict';
import { toServerRangeBoundary } from './syncTime.js';

test('toServerRangeBoundary keeps UTC boundary in UTC mode', () => {
  const got = toServerRangeBoundary('2026-03-01T00:00:00.000Z', 'UTC');
  assert.equal(got, '2026-03-01T00:00:00.000Z');
});

test('toServerRangeBoundary converts projected Asia/Shanghai wall-clock boundary back to UTC', () => {
  const got = toServerRangeBoundary('2026-03-01T00:00:00.000Z', 'Asia/Shanghai');
  assert.equal(got, '2026-02-28T16:00:00.000Z');
});
