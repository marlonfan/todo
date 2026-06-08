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

test('buildProjectedEventsFromTasks filters skipped tasks', () => {
  const tasks = [
    {
      id: 3,
      title: 'skip',
      status: 'skipped',
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

  assert.equal(projected.length, 0);
});

test('buildProjectedEventsFromTasks excludes readonly caldav tasks', () => {
  const tasks = [
    {
      id: -101,
      title: 'caldav',
      status: 'pending',
      source: 'caldav',
      read_only: true,
      start_time: '2026-03-01T10:00:00Z',
      end_time: '2026-03-01T11:00:00Z',
      priority: 0,
    },
    {
      id: 7,
      title: 'local',
      status: 'pending',
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
  assert.equal(projected[0].extendedProps.taskId, 7);
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

test('buildProjectedEventsFromTasks expands recurring tasks in visible range with valid instance id', () => {
  const tasks = [
    {
      id: 22,
      title: 'recurring',
      status: 'pending',
      recurrence_rule: { freq: 'weekly', interval: 2, byday: ['MO'] },
      start_time: '2026-03-02T06:00:00Z',
      end_time: '2026-03-02T07:00:00Z',
      priority: 0,
    },
    {
      id: 23,
      title: 'single',
      status: 'pending',
      start_time: '2026-03-02T08:00:00Z',
      end_time: '2026-03-02T09:00:00Z',
      priority: 0,
    },
  ];

  const projected = buildProjectedEventsFromTasks(tasks, {
    rangeStart: '2026-03-01T00:00:00Z',
    rangeEnd: '2026-03-18T00:00:00Z',
    timezone: 'UTC',
    toCalendarISO: (v) => v,
  });

  assert.equal(projected.length, 3);
  const recurring = projected.filter((item) => item.extendedProps.taskId === 22);
  const single = projected.find((item) => item.extendedProps.taskId === 23);
  assert.equal(recurring.length, 2);
  assert.ok(single);
  assert.ok(recurring.every((item) => item.extendedProps.isRecurring === true));
  assert.ok(recurring.some((item) => item.extendedProps.instanceId === '22_20260302'));
  assert.ok(recurring.some((item) => item.extendedProps.instanceId === '22_20260316'));
});

test('buildProjectedEventsFromTasks projects recurring task even when dtstart is before range', () => {
  const tasks = [
    {
      id: 29,
      title: 'weekly friday 20:00',
      status: 'pending',
      recurrence_rule: { freq: 'weekly', interval: 1, byday: ['FR'] },
      start_time: '2026-03-06T12:00:00Z',
      end_time: '2026-03-06T12:30:00Z',
      priority: 0,
    },
  ];

  const projected = buildProjectedEventsFromTasks(tasks, {
    rangeStart: '2026-03-13T00:00:00Z',
    rangeEnd: '2026-03-20T00:00:00Z',
    timezone: 'UTC',
    toCalendarISO: (v) => v,
  });

  assert.equal(projected.length, 1);
  assert.equal(projected[0].id, '29_20260313');
  assert.equal(projected[0].start, '2026-03-13T12:00:00.000Z');
});

test('buildProjectedEventsFromTasks expands custom weekly interval with selected weekday', () => {
  const tasks = [
    {
      id: 31,
      title: 'every 3 weeks monday',
      status: 'pending',
      recurrence_rule: { freq: 'weekly', interval: 3, byday: ['MO'] },
      start_time: '2026-03-02T09:00:00Z',
      end_time: '2026-03-02T10:00:00Z',
      priority: 0,
    },
  ];

  const projected = buildProjectedEventsFromTasks(tasks, {
    rangeStart: '2026-03-01T00:00:00Z',
    rangeEnd: '2026-04-15T00:00:00Z',
    timezone: 'UTC',
    toCalendarISO: (v) => v,
  });

  assert.deepEqual(projected.map((item) => item.id), [
    '31_20260302',
    '31_20260323',
    '31_20260413',
  ]);
});

test('buildProjectedEventsFromTasks expands custom monthly interval on month day', () => {
  const tasks = [
    {
      id: 32,
      title: 'every 2 months on 15',
      status: 'pending',
      recurrence_rule: { freq: 'monthly', interval: 2, bydate: [15] },
      start_time: '2026-01-15T09:00:00Z',
      end_time: '2026-01-15T10:00:00Z',
      priority: 0,
    },
  ];

  const projected = buildProjectedEventsFromTasks(tasks, {
    rangeStart: '2026-01-01T00:00:00Z',
    rangeEnd: '2026-06-30T00:00:00Z',
    timezone: 'UTC',
    toCalendarISO: (v) => v,
  });

  assert.deepEqual(projected.map((item) => item.id), [
    '32_20260115',
    '32_20260315',
    '32_20260515',
  ]);
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

test('mergeCalendarEvents keeps server events even if local status index marks cancelled', () => {
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
  assert.equal(merged.length, 1);
  assert.equal(merged[0].extendedProps.taskId, 9);
});

test('mergeCalendarEvents does not prune server events by local presence set', () => {
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
  assert.equal(merged.length, 2);
  assert.ok(merged.some((item) => item.extendedProps.taskId === 1));
  assert.ok(merged.some((item) => item.extendedProps.taskId === 2));
});

test('mergeCalendarEvents keeps multiple server events sharing same taskId', () => {
  const server = [
    {
      id: 'ev-a',
      start: '2025-08-01T10:00:00Z',
      extendedProps: { taskId: 42, status: 'pending', isRecurring: false, readOnly: true, source: 'caldav' },
    },
    {
      id: 'ev-b',
      start: '2026-12-01T10:00:00Z',
      extendedProps: { taskId: 42, status: 'pending', isRecurring: false, readOnly: true, source: 'caldav' },
    },
  ];

  const merged = mergeCalendarEvents(server, [], { cancelled: new Set(), present: new Set() });
  assert.equal(merged.length, 2);
  assert.ok(merged.some((item) => item.id === 'ev-a'));
  assert.ok(merged.some((item) => item.id === 'ev-b'));
});

test('mergeCalendarEvents does not override readonly server event with projected duplicate', () => {
  const server = [
    {
      id: 'readonly-1',
      start: '2026-12-01T10:00:00Z',
      title: 'server',
      extendedProps: { taskId: 501, status: 'pending', isRecurring: false, readOnly: true, source: 'caldav' },
    },
  ];
  const projected = [
    {
      id: 'task-501',
      start: '2026-12-01T02:00:00Z',
      title: 'projected',
      extendedProps: { taskId: 501, status: 'pending', isRecurring: false, source: 'local_projection' },
    },
  ];

  const merged = mergeCalendarEvents(server, projected, { cancelled: new Set(), present: new Set() });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'readonly-1');
  assert.equal(merged[0].title, 'server');
});

test('mergeCalendarEvents keeps projected recurring fallback for instances missing from server cache', () => {
  const server = [
    {
      id: '22_20260302',
      start: '2026-03-02T06:00:00Z',
      title: 'server recurring',
      extendedProps: { taskId: 22, status: 'pending', isRecurring: true, instanceId: '22_20260302' },
    },
  ];
  const projected = [
    {
      id: '22_20260302',
      start: '2026-03-02T06:00:00Z',
      title: 'projected recurring',
      extendedProps: { taskId: 22, status: 'pending', isRecurring: true, instanceId: '22_20260302' },
    },
    {
      id: '22_20260309',
      start: '2026-03-09T06:00:00Z',
      title: 'projected recurring 2',
      extendedProps: { taskId: 22, status: 'pending', isRecurring: true, instanceId: '22_20260309' },
    },
  ];

  const merged = mergeCalendarEvents(server, projected, { cancelled: new Set(), present: new Set() });
  assert.equal(merged.length, 2);
  const weekA = merged.find((item) => item.id === '22_20260302');
  const weekB = merged.find((item) => item.id === '22_20260309');
  assert.ok(weekA);
  assert.ok(weekB);
  assert.equal(weekA.title, 'server recurring');
  assert.equal(weekB.title, 'projected recurring 2');
});

test('mergeCalendarEvents suppresses projected recurring instance when server marks it cancelled', () => {
  const server = [
    {
      id: '35_20260319',
      start: '2026-03-19T01:00:00Z',
      title: 'server cancelled recurring',
      extendedProps: { taskId: 35, status: 'cancelled', isRecurring: true, instanceId: '35_20260319' },
    },
  ];
  const projected = [
    {
      id: '35_20260319',
      start: '2026-03-19T01:00:00Z',
      title: 'projected recurring',
      extendedProps: { taskId: 35, status: 'pending', isRecurring: true, instanceId: '35_20260319' },
    },
    {
      id: '35_20260326',
      start: '2026-03-26T01:00:00Z',
      title: 'projected recurring 2',
      extendedProps: { taskId: 35, status: 'pending', isRecurring: true, instanceId: '35_20260326' },
    },
  ];

  const merged = mergeCalendarEvents(server, projected, { cancelled: new Set(), present: new Set() });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, '35_20260326');
});

test('mergeCalendarEvents suppresses projected recurring instance when server marks it skipped', () => {
  const server = [
    {
      id: '36_20260319',
      start: '2026-03-19T01:00:00Z',
      title: 'server skipped recurring',
      extendedProps: { taskId: 36, status: 'skipped', isRecurring: true, instanceId: '36_20260319' },
    },
  ];
  const projected = [
    {
      id: '36_20260319',
      start: '2026-03-19T01:00:00Z',
      title: 'projected recurring',
      extendedProps: { taskId: 36, status: 'pending', isRecurring: true, instanceId: '36_20260319' },
    },
    {
      id: '36_20260326',
      start: '2026-03-26T01:00:00Z',
      title: 'projected recurring 2',
      extendedProps: { taskId: 36, status: 'pending', isRecurring: true, instanceId: '36_20260326' },
    },
  ];

  const merged = mergeCalendarEvents(server, projected, { cancelled: new Set(), present: new Set() });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, '36_20260326');
});
