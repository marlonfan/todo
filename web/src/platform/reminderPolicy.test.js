import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTaskReminderMinutes, resolveReminderStart } from './reminderPolicy.js';

test('task reminders override account defaults consistently', () => {
  const enabled = { default_reminder_enabled: true, default_reminder_minutes: 5 };
  const disabled = { ...enabled, default_reminder_enabled: false };
  assert.equal(resolveTaskReminderMinutes({ reminder_policy: 'none' }, enabled), null);
  assert.equal(resolveTaskReminderMinutes({ reminder_policy: 'offset', reminder_minutes_before: 30 }, enabled), 30);
  assert.equal(resolveTaskReminderMinutes({ reminder_policy: 'offset', reminder_minutes_before: 0 }, disabled), 0);
  assert.equal(resolveTaskReminderMinutes({ reminder_policy: 'inherit' }, disabled), null);
  assert.equal(resolveTaskReminderMinutes({ reminder_policy: 'inherit' }, enabled), 5);
  assert.equal(resolveTaskReminderMinutes({ status: 'completed', reminder_policy: 'offset', reminder_minutes_before: 30 }, enabled), null);
  assert.equal(resolveTaskReminderMinutes({ reminder_policy: 'offset', reminder_minutes_before: null }, enabled), null);
});

test('all-day reminders use the account timezone, including DST', () => {
  assert.equal(resolveReminderStart(new Date('2026-10-10T16:00:00Z'), true, { timezone: 'Asia/Shanghai', default_morning_time: '09:00' }).toISOString(), '2026-10-11T01:00:00.000Z');
  assert.equal(resolveReminderStart(new Date('2026-03-08T05:00:00Z'), true, { timezone: 'America/New_York', default_morning_time: '09:00' }).toISOString(), '2026-03-08T13:00:00.000Z');
});
