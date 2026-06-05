import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTaskOverdueDays,
  isTaskOverdue,
  shouldIncludeTaskInTodayView,
  shouldIncludeTaskInUpcomingView,
} from './taskListOverdue.js';

const timezone = 'Asia/Shanghai';
const reference = '2026-06-06T12:00:00+08:00';

test('isTaskOverdue only treats pending tasks before today as overdue', () => {
  assert.equal(isTaskOverdue({
    status: 'pending',
    start_time: '2026-06-05T09:00:00+08:00',
  }, timezone, reference), true);

  assert.equal(isTaskOverdue({
    status: 'completed',
    start_time: '2026-06-05T09:00:00+08:00',
  }, timezone, reference), false);

  assert.equal(isTaskOverdue({
    status: 'pending',
    start_time: '2026-06-06T00:00:00+08:00',
  }, timezone, reference), false);
});

test('getTaskOverdueDays counts local calendar days', () => {
  assert.equal(getTaskOverdueDays({
    status: 'pending',
    start_time: '2026-06-03T23:30:00+08:00',
  }, timezone, reference), 3);
});

test('today view includes overdue and today pending tasks', () => {
  assert.equal(shouldIncludeTaskInTodayView({
    status: 'pending',
    start_time: '2026-06-05T18:00:00+08:00',
  }, timezone, reference), true);

  assert.equal(shouldIncludeTaskInTodayView({
    status: 'pending',
    start_time: '2026-06-06T22:00:00+08:00',
  }, timezone, reference), true);

  assert.equal(shouldIncludeTaskInTodayView({
    status: 'pending',
    start_time: '2026-06-07T09:00:00+08:00',
  }, timezone, reference), false);
});

test('upcoming view includes overdue and next seven local days', () => {
  assert.equal(shouldIncludeTaskInUpcomingView({
    status: 'pending',
    start_time: '2026-06-01T10:00:00+08:00',
  }, timezone, reference), true);

  assert.equal(shouldIncludeTaskInUpcomingView({
    status: 'pending',
    start_time: '2026-06-12T23:59:00+08:00',
  }, timezone, reference), true);

  assert.equal(shouldIncludeTaskInUpcomingView({
    status: 'pending',
    start_time: '2026-06-13T00:00:00+08:00',
  }, timezone, reference), false);
});
