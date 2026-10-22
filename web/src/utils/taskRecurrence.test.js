import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecurrenceRule, parseRecurrenceSelection, buildRecurrenceRule, buildRecurrenceSummaryLabel, getRecurrenceIntervalForType } from './taskRecurrence.js';

const fallback = '2026-10-22T09:00';

test('rule parsing accepts stored JSON and objects but rejects malformed and non-rule values', () => {
  const rule = { freq: 'weekly', interval: 2, byday: ['MO'] };
  assert.equal(parseRecurrenceRule(rule), rule);
  assert.deepEqual(parseRecurrenceRule(JSON.stringify(rule)), rule);
  for (const value of [null, false, 1, 'false', 'null', '1', '[]', [], '{invalid']) {
    assert.equal(parseRecurrenceRule(value), null);
  }
});

for (const [type, rule] of [
  ['daily', { freq: 'daily', interval: 1 }],
  ['weekly', { freq: 'weekly', interval: 1, byday: ['MO', 'FR'] }],
  ['biweekly', { freq: 'weekly', interval: 2, byday: ['MO', 'FR'] }],
  ['custom_weekly', { freq: 'weekly', interval: 5, byday: ['MO', 'FR'] }],
  ['monthly', { freq: 'monthly', interval: 1, bydate: [29] }],
  ['custom_monthly', { freq: 'monthly', interval: 5, bydate: [29] }],
  ['yearly', { freq: 'yearly', interval: 1 }],
  ['lunar', { freq: 'lunar_yearly', interval: 1, lunar_month: 8, lunar_day: 15, lunar_is_leap_month: false }],
]) {
  test('shared selection roundtrip preserves ' + type + ' rules in both editors', () => {
    const selection = parseRecurrenceSelection(rule, fallback);
    assert.equal(selection.type, type);
    assert.deepEqual(buildRecurrenceRule(selection), rule);
  });
}

test('custom intervals, monthly date aliases and configured workdays use one normalization policy', () => {
  for (const alias of ['bydate', 'byDate', 'bymonthday']) {
    assert.equal(parseRecurrenceSelection({ freq: 'monthly', [alias]: [0, 33, 18] }, fallback).monthDate, 18);
  }
  assert.equal(parseRecurrenceSelection({ freq: 'monthly' }, fallback).monthDate, 22);
  assert.deepEqual(buildRecurrenceRule({ type: 'custom_weekly', days: [], interval: 300 }, { workDayKeys: ['TU', 'SA'] }),
    { freq: 'weekly', interval: 99, byday: ['TU', 'SA'] });
  assert.deepEqual(buildRecurrenceRule({ type: 'custom_monthly', interval: 0, monthDate: 50 }),
    { freq: 'monthly', interval: 2, bydate: [31] });
  assert.equal(buildRecurrenceRule({ type: 'daily' }, { enabled: false }), null);
});

test('shared summaries use the same interval as the submitted rule', () => {
  const t = (key, values = {}) => ({ key, ...values });
  assert.deepEqual(buildRecurrenceSummaryLabel(true, 'custom_monthly', [], t, { interval: 4, monthDate: 29 }),
    { key: 'task.customMonthlySummary', count: 4, date: 29 });
  assert.equal(getRecurrenceIntervalForType('custom_monthly', 4), 4);
  assert.equal(buildRecurrenceSummaryLabel(false, 'daily', [], (key) => key), 'task.repeatOff');
});
