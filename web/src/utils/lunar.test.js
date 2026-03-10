import test from 'node:test';
import assert from 'node:assert/strict';
import dayjs from 'dayjs';
import {
  LUNAR_TIMEZONE,
  nextLocalInputFromLunarSelection,
  solarDateFromLunarSelection,
} from './lunar.js';

test('nextLocalInputFromLunarSelection keeps current-year occurrence when it is still upcoming', () => {
  const currentYearDate = solarDateFromLunarSelection({
    year: 2026,
    month: 2,
    day: 14,
    isLeapMonth: false,
  });
  assert.ok(currentYearDate);

  const result = nextLocalInputFromLunarSelection(
    { month: 2, day: 14, isLeapMonth: false },
    {
      currentValue: `${currentYearDate}T09:30`,
      allDay: false,
      timezoneName: LUNAR_TIMEZONE,
      fromValue: `${currentYearDate}T08:00`,
      fallbackTime: '09:00',
      searchYears: 3,
    },
  );

  assert.equal(result, `${currentYearDate}T09:30`);
});

test('nextLocalInputFromLunarSelection rolls to next year when current-year occurrence has passed', () => {
  const currentYearDate = solarDateFromLunarSelection({
    year: 2026,
    month: 2,
    day: 14,
    isLeapMonth: false,
  });
  const nextYearDate = solarDateFromLunarSelection({
    year: 2027,
    month: 2,
    day: 14,
    isLeapMonth: false,
  });
  assert.ok(currentYearDate);
  assert.ok(nextYearDate);

  const result = nextLocalInputFromLunarSelection(
    { month: 2, day: 14, isLeapMonth: false },
    {
      currentValue: `${currentYearDate}T09:30`,
      allDay: false,
      timezoneName: LUNAR_TIMEZONE,
      fromValue: `${currentYearDate}T23:59`,
      fallbackTime: '09:00',
      searchYears: 3,
    },
  );

  assert.equal(result, `${nextYearDate}T09:30`);
});

test('nextLocalInputFromLunarSelection returns all-day date for next valid occurrence', () => {
  const currentYearDate = solarDateFromLunarSelection({
    year: 2026,
    month: 2,
    day: 14,
    isLeapMonth: false,
  });
  const nextYearDate = solarDateFromLunarSelection({
    year: 2027,
    month: 2,
    day: 14,
    isLeapMonth: false,
  });
  assert.ok(currentYearDate);
  assert.ok(nextYearDate);

  const fromDate = dayjs(currentYearDate).add(1, 'day').format('YYYY-MM-DD');
  const result = nextLocalInputFromLunarSelection(
    { month: 2, day: 14, isLeapMonth: false },
    {
      currentValue: currentYearDate,
      allDay: true,
      timezoneName: LUNAR_TIMEZONE,
      fromValue: fromDate,
      fallbackTime: '09:00',
      searchYears: 3,
    },
  );

  assert.equal(result, nextYearDate);
});

