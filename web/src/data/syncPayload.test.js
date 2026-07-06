import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isOccurrenceScopedPayload,
  normalizeClientSubmittedAt,
  sanitizeConflictPayload,
} from './syncPayload.js';
import { isOccurrenceScopedPayload as helperScopedPayload } from './taskMutationHelpers.js';

test('detects occurrence-scoped payloads consistently', () => {
  assert.equal(isOccurrenceScopedPayload({ instance_id: '10_20260310' }), true);
  assert.equal(isOccurrenceScopedPayload({ occurrence_date: '2026-03-10' }), true);
  assert.equal(isOccurrenceScopedPayload({ instance_id: '   ', title: 'base task' }), false);
  assert.equal(isOccurrenceScopedPayload({ title: 'base task' }), false);
  assert.equal(helperScopedPayload({ occurrence_date: '2026-03-10' }), true);
});

test('sanitizes transport-only conflict payload fields', () => {
  const payload = sanitizeConflictPayload({
    title: 'Task',
    client_timezone: 'Asia/Shanghai',
    start_time_local: '2026-03-10 09:00',
    end_time_local: '2026-03-10 10:00',
    occurrence_date: '2026-03-10',
  });

  assert.deepEqual(payload, {
    title: 'Task',
    occurrence_date: '2026-03-10',
  });
});

test('normalizes valid client submitted timestamps and rejects invalid values', () => {
  assert.equal(
    normalizeClientSubmittedAt('2026-03-10T09:00:00+08:00'),
    '2026-03-10T01:00:00.000Z',
  );
  assert.equal(normalizeClientSubmittedAt('not-a-date'), '');
  assert.equal(normalizeClientSubmittedAt(''), '');
});
