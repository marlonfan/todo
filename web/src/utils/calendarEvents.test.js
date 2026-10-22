import test from 'node:test';
import assert from 'node:assert/strict';
import dayjs from 'dayjs';
import {
  buildEventsSignature,
  decomposeEventsByDay,
  getEventDates,
  isReadOnlyCalendarEvent,
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

test('event signatures include details, recurrence identity and presentation fields', () => {
  const event = {
    id: 'subscription', title: 'Meeting', start: '2026-10-22T08:00:00Z',
    allDay: false, editable: false, backgroundColor: '#123456',
    extendedProps: { description: 'Before', location: 'Room A', instanceId: 'instance-a', readOnly: true },
  };
  const changes = [
    { allDay: true }, { editable: true }, { backgroundColor: '#654321' },
    ...['description', 'location', 'organizer', 'attendees', 'meetingLink', 'recurrenceText', 'instanceId', 'provider']
      .map((field) => ({ extendedProps: { ...event.extendedProps, [field]: 'changed' } })),
  ];
  for (const change of changes) {
    assert.notEqual(buildEventsSignature([event]), buildEventsSignature([{ ...event, ...change }]), JSON.stringify(change));
  }
});

test('event signatures ignore event order and object key order', () => {
  const a = { id: 'a', extendedProps: { location: 'Room A', description: 'Notes', nested: { b: 2, a: 1 } } };
  const reorderedA = { extendedProps: { nested: { a: 1, b: 2 }, description: 'Notes', location: 'Room A' }, id: 'a' };
  const b = { id: 'b', title: 'Other' };
  assert.equal(buildEventsSignature([a, b]), buildEventsSignature([b, reorderedA]));
});

test('event signature delimiters cannot hide changes across fields', () => {
  const a = { id: 'a', title: 'title|pending', extendedProps: { status: 'done' } };
  const b = { id: 'a', title: 'title', extendedProps: { status: 'pending|done' } };
  assert.notEqual(buildEventsSignature([a]), buildEventsSignature([b]));
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

test('isReadOnlyCalendarEvent treats caldav source and readonly flags as external events', () => {
  assert.equal(isReadOnlyCalendarEvent({
    id: 'cached-caldav',
    extendedProps: { source: 'caldav', taskId: 123 },
  }), true);
  assert.equal(isReadOnlyCalendarEvent({
    id: 'non-editable-caldav',
    editable: false,
    extendedProps: { taskId: 123 },
  }), true);
  assert.equal(isReadOnlyCalendarEvent({
    id: 'task-123',
    editable: true,
    extendedProps: { source: 'local_projection', taskId: 123 },
  }), false);
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
