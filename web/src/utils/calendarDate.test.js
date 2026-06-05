import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCalendarViewTitle,
  getCalendarDisplayEnd,
  parseCalendarDate,
} from './calendarDate.js';

test('parseCalendarDate treats plain date as date in target timezone', () => {
  const got = parseCalendarDate('2026-06-05', 'America/Los_Angeles');
  assert.equal(got.format('YYYY-MM-DD'), '2026-06-05');
  assert.equal(got.hour(), 0);
});

test('parseCalendarDate converts instants into target timezone day', () => {
  const got = parseCalendarDate('2026-06-04T16:00:00.000Z', 'Asia/Shanghai');
  assert.equal(got.format('YYYY-MM-DD'), '2026-06-05');
  assert.equal(got.hour(), 0);
});

test('getCalendarDisplayEnd keeps a one-day view on the same local date', () => {
  const start = parseCalendarDate('2026-06-06', 'Asia/Shanghai');
  const got = getCalendarDisplayEnd(start, 1);
  assert.equal(got.format('YYYY-MM-DD HH:mm:ss'), '2026-06-06 23:59:59');
});

test('formatCalendarViewTitle formats day view from the visible start date', () => {
  const title = formatCalendarViewTitle(
    'timeGridDay',
    '2026-06-05T16:00:00.000Z',
    '2026-06-06T15:59:59.999Z',
    'Asia/Shanghai',
  );
  assert.equal(title, '2026/6/6');
});

test('formatCalendarViewTitle formats week view without subtracting an extra day', () => {
  const title = formatCalendarViewTitle(
    'timeGridWeek',
    '2026-05-31T16:00:00.000Z',
    '2026-06-07T15:59:59.999Z',
    'Asia/Shanghai',
  );
  assert.equal(title, '2026/6/1 - 6/7');
});
