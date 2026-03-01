import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProjectedEventsFromTasks,
  buildTaskStatusIndex,
  mergeCalendarEvents,
} from './calendarEventMerge.js';

test('buildProjectedEventsFromTasks filters cancelled tasks', () => {
  const tasks = [
    {
      id: 1,
      title: 'show',
      status: 'pending',
      start_time: '2026-03-01T10:00:00Z',
      end_time: '2026-03-01T11:00:00Z',
      priority: 0,
    },
    {
      id: 2,
      title: 'hide',
      status: 'cancelled',
      start_time: '2026-03-01T10:00:00Z',
      end_time: '2026-03-01T11:00:00Z',
      priority: 0,
    },
  ];
  const projected = buildProjectedEventsFromTasks(tasks, {
    rangeStart: '2026-03-01T00:00:00Z',
    rangeEnd: '2026-03-02T00:00:00Z',
    timezone: 'UTC',
    toCalendarISO: (v) => v,
  });

  assert.equal(projected.length, 1);
  assert.equal(projected[0].extendedProps.taskId, 1);
});

test('buildProjectedEventsFromTasks keeps timezone-boundary task in week/month ranges', () => {
  const tasks = [
    {
      id: 333,
      title: '333',
      status: 'pending',
      start_time: '2026-02-28T22:30:00Z',
      end_time: '2026-02-28T23:00:00Z',
      priority: 0,
    },
  ];

  const projected = buildProjectedEventsFromTasks(tasks, {
    // Asia/Shanghai month/week range boundary converted to server UTC.
    rangeStart: '2026-02-28T16:00:00Z',
    rangeEnd: '2026-03-31T16:00:00Z',
    timezone: 'Asia/Shanghai',
    toCalendarISO: (v) => v,
  });

  assert.equal(projected.length, 1);
  assert.equal(projected[0].extendedProps.taskId, 333);
  assert.equal(projected[0].title, '333');
});

test('mergeCalendarEvents removes cancelled server events and keeps recurring', () => {
  const server = [
    {
      id: 'ev1',
      start: '2026-03-01T10:00:00Z',
      extendedProps: { taskId: 1, status: 'cancelled', isRecurring: false },
    },
    {
      id: 'ev2',
      start: '2026-03-01T12:00:00Z',
      extendedProps: { taskId: 0, isRecurring: true, instanceId: 'r1' },
    },
  ];
  const projected = [
    {
      id: 'task-1',
      start: '2026-03-01T10:00:00Z',
      title: 'local',
      extendedProps: { taskId: 1, status: 'pending', isRecurring: false },
    },
  ];

  const merged = mergeCalendarEvents(server, projected, { cancelled: new Set() });
  assert.equal(merged.length, 2);
  assert.ok(merged.some((item) => item.extendedProps?.instanceId === 'r1'));
  assert.ok(merged.some((item) => item.extendedProps?.taskId === 1));
});

test('mergeCalendarEvents drops tasks cancelled in local status index', () => {
  const tasks = [{ id: 9, status: 'cancelled' }];
  const statusIndex = buildTaskStatusIndex(tasks);
  const server = [
    {
      id: 'ev9',
      start: '2026-03-01T10:00:00Z',
      extendedProps: { taskId: 9, status: 'pending', isRecurring: false },
    },
  ];

  const merged = mergeCalendarEvents(server, [], statusIndex);
  assert.equal(merged.length, 0);
});

test('mergeCalendarEvents prunes stale server events after local delete', () => {
  const tasks = [{ id: 1, status: 'pending' }];
  const statusIndex = buildTaskStatusIndex(tasks);
  const server = [
    {
      id: 'ev1',
      start: '2026-03-01T10:00:00Z',
      extendedProps: { taskId: 1, status: 'pending', isRecurring: false },
    },
    {
      id: 'ev2',
      start: '2026-03-01T11:00:00Z',
      extendedProps: { taskId: 2, status: 'pending', isRecurring: false },
    },
  ];

  const merged = mergeCalendarEvents(server, [], statusIndex);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].extendedProps.taskId, 1);
});
