import test from 'node:test';
import assert from 'node:assert/strict';
import useCalendarCacheStore from './calendarCacheStore.js';

function makeEvent(id, title, start, end = '') {
  return {
    id,
    title,
    start,
    end,
    allDay: false,
    extendedProps: {
      status: 'pending',
      taskId: 0,
      readOnly: true,
      source: 'caldav',
    },
  };
}

test.beforeEach(() => {
  useCalendarCacheStore.getState().clear();
});

test('replaceRangeEvents clears stale events inside fetched range and keeps empty-day marker', () => {
  const store = useCalendarCacheStore.getState();

  store.replaceRangeEvents(
    '2026-03-01T00:00:00.000Z',
    '2026-03-03T23:59:59.999Z',
    'UTC',
    {
      '2026-03-01': [makeEvent('a', 'A', '2026-03-01T08:00:00.000Z')],
      '2026-03-02': [makeEvent('b', 'B', '2026-03-02T08:00:00.000Z')],
    },
  );

  let bucket = store.getEventsMapForTimezone('UTC');
  assert.equal(bucket['2026-03-02'].length, 1);

  const changed = store.replaceRangeEvents(
    '2026-03-01T00:00:00.000Z',
    '2026-03-03T23:59:59.999Z',
    'UTC',
    {
      '2026-03-01': [makeEvent('a', 'A', '2026-03-01T08:00:00.000Z')],
    },
  );

  bucket = store.getEventsMapForTimezone('UTC');
  assert.ok(Array.isArray(bucket['2026-03-02']));
  assert.equal(bucket['2026-03-02'].length, 0);
  assert.ok(changed.has('2026-03-02'));
  assert.equal(
    store.isRangeFullyCached('2026-03-01T00:00:00.000Z', '2026-03-03T23:59:59.999Z', 'UTC'),
    true,
  );
});

test('calendar cache is isolated by timezone bucket', () => {
  const store = useCalendarCacheStore.getState();

  store.replaceRangeEvents(
    '2026-03-01T00:00:00.000Z',
    '2026-03-01T23:59:59.999Z',
    'UTC',
    {
      '2026-03-01': [makeEvent('utc-1', 'UTC Event', '2026-03-01T08:00:00.000Z')],
    },
  );

  store.replaceRangeEvents(
    '2026-03-01T00:00:00+08:00',
    '2026-03-01T23:59:59+08:00',
    'Asia/Shanghai',
    {
      '2026-03-01': [makeEvent('cst-1', 'CST Event', '2026-03-01T08:00:00+08:00')],
    },
  );

  assert.equal(store.getEventsForDate('2026-03-01', 'UTC')[0].id, 'utc-1');
  assert.equal(store.getEventsForDate('2026-03-01', 'Asia/Shanghai')[0].id, 'cst-1');

  store.clear('UTC');
  assert.equal(store.getEventsForDate('2026-03-01', 'UTC').length, 0);
  assert.equal(store.getEventsForDate('2026-03-01', 'Asia/Shanghai').length, 1);
});

test('replaceFetchedSegments batches multiple segment updates', () => {
  const store = useCalendarCacheStore.getState();

  const changed = store.replaceFetchedSegments([
    {
      start: '2026-03-01T00:00:00.000Z',
      end: '2026-03-02T00:00:00.000Z',
      timezone: 'UTC',
      eventsByDate: {
        '2026-03-01': [makeEvent('s1', 'S1', '2026-03-01T08:00:00.000Z')],
      },
    },
    {
      start: '2026-03-02T00:00:00.000Z',
      end: '2026-03-03T00:00:00.000Z',
      timezone: 'UTC',
      eventsByDate: {
        '2026-03-02': [makeEvent('s2', 'S2', '2026-03-02T08:00:00.000Z')],
      },
    },
  ]);

  assert.equal(changed.size, 2);
  assert.equal(store.getEventsForDate('2026-03-01', 'UTC').length, 1);
  assert.equal(store.getEventsForDate('2026-03-02', 'UTC').length, 1);
  const next = useCalendarCacheStore.getState();
  assert.equal(Array.isArray(next.metadata.loadedRanges), true);
  assert.equal(next.metadata.loadedRanges.length, 2);
});

test('range event map snapshot stays stable when unrelated days change', () => {
  const store = useCalendarCacheStore.getState();

  store.replaceFetchedSegments([
    {
      start: '2026-03-01T00:00:00.000Z',
      end: '2026-03-04T00:00:00.000Z',
      timezone: 'UTC',
      eventsByDate: {
        '2026-03-01': [makeEvent('s1', 'S1', '2026-03-01T08:00:00.000Z')],
        '2026-03-02': [makeEvent('s2', 'S2', '2026-03-02T08:00:00.000Z')],
      },
    },
  ]);

  const first = store.getEventsMapForRange(
    '2026-03-01T00:00:00.000Z',
    '2026-03-03T00:00:00.000Z',
    'UTC',
  );

  store.replaceFetchedSegments([
    {
      start: '2026-04-01T00:00:00.000Z',
      end: '2026-04-02T00:00:00.000Z',
      timezone: 'UTC',
      eventsByDate: {
        '2026-04-01': [makeEvent('outside', 'Outside', '2026-04-01T08:00:00.000Z')],
      },
    },
  ]);

  const afterUnrelatedChange = store.getEventsMapForRange(
    '2026-03-01T00:00:00.000Z',
    '2026-03-03T00:00:00.000Z',
    'UTC',
  );
  assert.equal(afterUnrelatedChange, first);

  store.replaceFetchedSegments([
    {
      start: '2026-03-02T00:00:00.000Z',
      end: '2026-03-03T00:00:00.000Z',
      timezone: 'UTC',
      eventsByDate: {
        '2026-03-02': [makeEvent('s2b', 'S2 changed', '2026-03-02T09:00:00.000Z')],
      },
    },
  ]);

  const afterVisibleChange = store.getEventsMapForRange(
    '2026-03-01T00:00:00.000Z',
    '2026-03-03T00:00:00.000Z',
    'UTC',
  );
  assert.notEqual(afterVisibleChange, first);
  assert.equal(afterVisibleChange['2026-03-02'][0].id, 's2b');
});

test('removeTaskEvents keeps read-only subscription events visible', () => {
  const store = useCalendarCacheStore.getState();

  store.replaceFetchedSegments([
    {
      start: '2026-03-01T00:00:00.000Z',
      end: '2026-03-02T00:00:00.000Z',
      timezone: 'UTC',
      eventsByDate: {
        '2026-03-01': [
          {
            id: 'task-8',
            title: 'Local task',
            start: '2026-03-01T08:00:00.000Z',
            extendedProps: { taskId: 8, status: 'pending', source: 'task' },
          },
          {
            id: 'caldav-8',
            title: 'Subscribed event',
            start: '2026-03-01T09:00:00.000Z',
            extendedProps: { taskId: 8, status: 'pending', readOnly: true, source: 'caldav' },
          },
        ],
      },
    },
  ]);

  const changed = store.removeTaskEvents([8]);
  const dayEvents = store.getEventsForDate('2026-03-01', 'UTC');

  assert.equal(changed.has('UTC|2026-03-01'), true);
  assert.equal(dayEvents.length, 1);
  assert.equal(dayEvents[0].id, 'caldav-8');
});
