import test from 'node:test';
import assert from 'node:assert/strict';
import { alignStartInputToNearestRecurrence } from './recurrenceAlign.js';

test('alignStartInputToNearestRecurrence aligns weekly start to next matching weekday', () => {
  const result = alignStartInputToNearestRecurrence({
    startInput: '2026-03-03T09:30',
    recurrenceType: 'weekly',
    recurrenceDays: ['FR'],
    referenceInput: '2026-03-04T08:00',
    allDay: false,
  });

  assert.equal(result, '2026-03-06T09:30');
});

test('alignStartInputToNearestRecurrence aligns monthly start to nearest valid month date', () => {
  const result = alignStartInputToNearestRecurrence({
    startInput: '2026-01-31T10:15',
    recurrenceType: 'monthly',
    recurrenceDate: 31,
    referenceInput: '2026-02-02T00:00',
    allDay: false,
  });

  assert.equal(result, '2026-01-31T10:15');
});

test('alignStartInputToNearestRecurrence aligns yearly start to next year when current year has passed', () => {
  const result = alignStartInputToNearestRecurrence({
    startInput: '2026-02-14T09:30',
    recurrenceType: 'yearly',
    referenceInput: '2026-03-01T00:00',
    allDay: false,
  });

  assert.equal(result, '2026-02-14T09:30');
});

test('alignStartInputToNearestRecurrence supports all-day output and timezone parsing', () => {
  const result = alignStartInputToNearestRecurrence({
    startInput: '2026-02-10',
    recurrenceType: 'biweekly',
    recurrenceDays: ['TH'],
    referenceInput: '2026-02-11',
    allDay: true,
    timezoneName: 'America/Los_Angeles',
  });

  assert.equal(result, '2026-02-12');
});

test('alignStartInputToNearestRecurrence treats custom weekly like weekly alignment', () => {
  const result = alignStartInputToNearestRecurrence({
    startInput: '2026-03-03T09:30',
    recurrenceType: 'custom_weekly',
    recurrenceDays: ['MO'],
    recurrenceInterval: 3,
    allDay: false,
  });

  assert.equal(result, '2026-03-09T09:30');
});

test('alignStartInputToNearestRecurrence treats custom monthly like monthly alignment', () => {
  const result = alignStartInputToNearestRecurrence({
    startInput: '2026-03-20',
    recurrenceType: 'custom_monthly',
    recurrenceDate: 15,
    recurrenceInterval: 2,
    allDay: true,
  });

  assert.equal(result, '2026-04-15');
});
