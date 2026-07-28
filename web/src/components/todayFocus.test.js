import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTodayFocus } from './todayFocus.js';

const timezone = 'Asia/Shanghai';
const reference = '2026-07-28T12:00:00+08:00';

test('today focus replaces recurring series anchors with their next occurrences', () => {
  const result = calculateTodayFocus({
    timezone,
    reference,
    tasks: [
      { id: 1, status: 'pending', start_time: '2026-07-24T09:00:00+08:00' },
      {
        id: 2,
        status: 'pending',
        start_time: '2026-06-01T09:00:00+08:00',
        recurrence_rule: { freq: 'weekly' },
      },
      {
        id: 3,
        status: 'pending',
        start_time: '2026-06-02T09:00:00+08:00',
        recurrence_rule: { freq: 'weekly' },
      },
    ],
    nextOccurrences: [
      { task_id: 2, status: 'pending', start_time: '2026-07-30T09:00:00+08:00' },
      { task_id: 3, status: 'pending', start_time: '2026-07-28T09:00:00+08:00' },
    ],
    occurrenceHistory: [],
  });

  assert.deepEqual(result, { total: 2, completed: 0, ratio: 0 });
});

test('today focus counts completed base and recurring tasks in the user timezone', () => {
  const result = calculateTodayFocus({
    timezone,
    reference,
    tasks: [
      {
        id: 1,
        status: 'completed',
        completed_at: '2026-07-27T16:30:00Z',
      },
      {
        id: 2,
        status: 'completed',
        completed_at: '2026-07-27T15:30:00Z',
      },
    ],
    nextOccurrences: [],
    occurrenceHistory: [
      {
        task_id: 3,
        instance_id: '3_20260728',
        status: 'completed',
        completed_at: '2026-07-28T02:00:00Z',
      },
      {
        task_id: 3,
        instance_id: '3_20260728',
        status: 'completed',
        completed_at: '2026-07-28T02:00:00Z',
      },
    ],
  });

  assert.deepEqual(result, { total: 2, completed: 2, ratio: 1 });
});
