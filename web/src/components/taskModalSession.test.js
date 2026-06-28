import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTaskModalSessionKey,
  normalizeTaskModalOccurrenceKey,
} from './taskModalSession.js';

test('keeps the same modal session key across same-task data refreshes', () => {
  const before = getTaskModalSessionKey({
    id: 42,
    title: 'Draft before sync',
    description: 'old description',
    revision: 1,
    updated_at: '2026-06-28T12:00:00Z',
  });
  const after = getTaskModalSessionKey({
    id: 42,
    title: 'Draft after sync',
    description: 'new description',
    revision: 2,
    updated_at: '2026-06-28T12:01:00Z',
  });

  assert.equal(after, before);
});

test('changes the modal session key when switching recurring occurrences', () => {
  const first = getTaskModalSessionKey({
    id: 'occ_42_20260628',
    source_task_id: 42,
    occurrence_date: '2026-06-28',
  });
  const second = getTaskModalSessionKey({
    id: 'occ_42_20260629',
    source_task_id: 42,
    occurrence_date: '2026-06-29',
  });

  assert.notEqual(second, first);
});

test('normalizes ISO occurrence starts to the date portion', () => {
  assert.equal(
    normalizeTaskModalOccurrenceKey('2026-06-28T09:00:00+08:00'),
    '2026-06-28',
  );
});

test('includes new-task initial range in the modal session key', () => {
  assert.notEqual(
    getTaskModalSessionKey(null, { start: '2026-06-28T09:00', end: '', allDay: false }),
    getTaskModalSessionKey(null, { start: '2026-06-29T09:00', end: '', allDay: false }),
  );
});
