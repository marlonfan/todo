import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNextPendingFromProjectedTask,
  hasOptimisticOccurrenceStatusForTask,
  upsertProjectedNextOccurrence,
} from './taskListRecurringProjection.js';

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

test('upsertProjectedNextOccurrence inserts projected pending occurrence first', () => {
  const next = upsertProjectedNextOccurrence([], 44, {
    instanceId: '44_20260608',
    occurrenceDate: '2026-06-08',
    startISO: '2026-06-08T09:00:00.000Z',
    endISO: '2026-06-08T10:00:00.000Z',
    title: 'Weekly task',
    description: 'projected',
    priority: 1,
    createdAt: '2026-06-01T00:00:00.000Z',
    completedAt: null,
    deletedAt: null,
    status: 'pending',
  }, 'UTC');

  assert.equal(next.length, 1);
  assert.equal(next[0].task_id, 44);
  assert.equal(next[0].instance_id, '44_20260608');
  assert.equal(next[0].occurrence_date, '2026-06-08');
  assert.equal(next[0].optimistic_projected, true);
});

test('upsertProjectedNextOccurrence deduplicates by instance id and occurrence date', () => {
  const existing = [
    {
      task_id: 44,
      instance_id: '44_20260608',
      occurrence_date: '2026-06-08',
      start_time: '2026-06-08T08:00:00.000Z',
      title: 'stale same instance',
      status: 'pending',
    },
    {
      task_id: 44,
      instance_id: '44_20260615',
      occurrence_date: '2026-06-08',
      start_time: '2026-06-08T08:30:00.000Z',
      title: 'stale same date',
      status: 'pending',
    },
    {
      task_id: 45,
      instance_id: '45_20260608',
      occurrence_date: '2026-06-08',
      start_time: '2026-06-08T08:00:00.000Z',
      title: 'other task',
      status: 'pending',
    },
  ];

  const next = upsertProjectedNextOccurrence(existing, 44, {
    instanceId: '44_20260608',
    occurrenceDate: '2026-06-08',
    startISO: '2026-06-08T09:00:00.000Z',
    endISO: null,
    title: 'fresh projected',
    description: '',
    priority: 0,
    createdAt: '',
    completedAt: null,
    deletedAt: null,
    status: 'pending',
  }, 'UTC');

  assert.equal(next.length, 2);
  assert.equal(next[0].title, 'fresh projected');
  assert.equal(next[0].start_time, '2026-06-08T09:00:00.000Z');
  assert.equal(next[1].task_id, 45);
});
