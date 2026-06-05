import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNextPendingFromProjectedTask, hasOptimisticOccurrenceStatusForTask } from './taskListRecurringProjection.js';

test('buildNextPendingFromProjectedTask predicts next weekly occurrence after optimistic completion', () => {
  const task = {
    id: 22,
    title: 'Weekly task',
    status: 'pending',
    priority: 0,
    start_time: '2026-06-01T09:00:00.000Z',
    end_time: '2026-06-01T10:00:00.000Z',
    recurrence_rule: {
      freq: 'weekly',
      interval: 1,
      byday: ['MO'],
    },
  };
  const optimisticStatusMap = {
    'instance:22:22_20260601': { status: 'completed', updatedAt: Date.now() },
    'date:22:2026-06-01': { status: 'completed', updatedAt: Date.now() },
  };

  assert.equal(hasOptimisticOccurrenceStatusForTask(optimisticStatusMap, 22), true);

  const next = buildNextPendingFromProjectedTask({
    task,
    optimisticStatusMap,
    serverStatusMap: new Map(),
    timezone: 'UTC',
  });

  assert.equal(next?.instanceId, '22_20260608');
  assert.equal(next?.occurrenceDate, '2026-06-08');
  assert.equal(next?.startISO, '2026-06-08T09:00:00.000Z');
});

test('buildNextPendingFromProjectedTask skips server-confirmed completed occurrences', () => {
  const task = {
    id: 33,
    title: 'Daily task',
    status: 'pending',
    start_time: '2026-06-01T09:00:00.000Z',
    recurrence_rule: {
      freq: 'daily',
      interval: 1,
    },
  };
  const optimisticStatusMap = {
    'date:33:2026-06-01': { status: 'completed', updatedAt: Date.now() },
  };
  const serverStatusMap = new Map([
    ['date:33:2026-06-02', 'completed'],
  ]);

  const next = buildNextPendingFromProjectedTask({
    task,
    optimisticStatusMap,
    serverStatusMap,
    timezone: 'UTC',
  });

  assert.equal(next?.instanceId, '33_20260603');
  assert.equal(next?.occurrenceDate, '2026-06-03');
});
