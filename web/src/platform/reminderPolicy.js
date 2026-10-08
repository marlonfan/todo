import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export function resolveTaskReminderMinutes(task, user) {
  if (!task || !user || (task.status || 'pending') !== 'pending') return null;
  if (task.reminder_policy === 'none') return null;
  if (task.reminder_policy === 'offset') {
    const value = task.reminder_minutes_before;
    return Number.isInteger(value) && value >= 0 && value <= 10080 ? value : null;
  }
  if (!user.default_reminder_enabled) return null;
  const value = Number(user.default_reminder_minutes);
  return Number.isFinite(value) && value > 0 ? value : 5;
}

export function resolveReminderStart(baseDate, allDay, user) {
  if (!allDay) return baseDate;
  const zone = user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const raw = String(user.default_morning_time || '09:00');
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : '09:00';
  const date = dayjs(baseDate).tz(zone).format('YYYY-MM-DD');
  return dayjs.tz(date + ' ' + clock, zone).toDate();
}
