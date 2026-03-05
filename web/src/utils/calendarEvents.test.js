import test from 'node:test';
import assert from 'node:assert/strict';
import dayjs from 'dayjs';
import {
  buildEventsSignature,
  decomposeEventsByDay,
  getEventDates,
} from './calendarEvents.js';

test('buildEventsSignature changes when event content changes but length stays same', () => {
  const before = [{
    id: 'event-1',
    title: 'Before',
    start: '2026-03-05T08:00:00.000Z',
    end: '2026-03-05T09:00:00.000Z',
    extendedProps: { status: 'pending', taskId: 1 },
  }];
  const after = [{
    id: 'event-1',
    title: 'After',
    start: '2026-03-05T08:00:00.000Z',
    end: '2026-03-05T09:00:00.000Z',
    extendedProps: { status: 'pending', taskId: 1 },
  }];

  assert.notEqual(buildEventsSignature(before), buildEventsSignature(after));
});

test('decomposeEventsByDay segments readonly cross-day events for each day', () => {
  const map = decomposeEventsByDay([
    {
      id: 'ext-overnight',
      title: 'Overnight',
      start: '2026-03-05T23:00:00.000Z',
      end: '2026-03-06T02:00:00.000Z',
      extendedProps: { readOnly: true, source: 'caldav' },
    },
  ], 'UTC');

  assert.equal(map['2026-03-05'].length, 1);
  assert.equal(map['2026-03-06'].length, 1);
  assert.match(map['2026-03-05'][0].id, /::2026-03-05$/);
  assert.match(map['2026-03-06'][0].id, /::2026-03-06$/);
  assert.equal(map['2026-03-06'][0].start, '2026-03-06T00:00:00.000Z');
  assert.equal(dayjs(map['2026-03-05'][0].end).utc().format('YYYY-MM-DD'), '2026-03-05');
});

test('decomposeEventsByDay keeps editable task event as single start-day record', () => {
  const map = decomposeEventsByDay([
    {
      id: 'task-42',
      title: 'Editable Task',
      start: '2026-03-05T23:00:00.000Z',
      end: '2026-03-06T02:00:00.000Z',
      extendedProps: { taskId: 42, readOnly: false, source: 'local_projection' },
    },
  ], 'UTC');

  assert.equal(map['2026-03-05'].length, 1);
  assert.equal(map['2026-03-05'][0].id, 'task-42');
  assert.ok(Array.isArray(map['2026-03-06']));
  assert.equal(map['2026-03-06'].length, 0);
});

test('getEventDates treats midnight end as exclusive boundary', () => {
  const dates = getEventDates({
    start: '2026-03-05T22:00:00.000Z',
    end: '2026-03-06T00:00:00.000Z',
  }, 'UTC');

  assert.deepEqual(dates, ['2026-03-05']);
});
