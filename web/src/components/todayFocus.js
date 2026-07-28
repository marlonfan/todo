import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';
import { shouldIncludeTaskInTodayView } from './taskListOverdue.js';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

function hasRecurrenceRule(task) {
  const rule = task?.recurrence_rule ?? task?.recurrenceRule;
  if (!rule) return false;
  if (typeof rule === 'string') {
    const value = rule.trim();
    return value !== '' && value !== '{}';
  }
  return typeof rule === 'object' && Object.keys(rule).length > 0;
}

function completedToday(value, timezone, reference) {
  if (!value) return false;
  const completedAt = dayjs(value);
  if (!completedAt.isValid()) return false;
  const today = dayjs(reference || undefined).tz(timezone);
  return completedAt.tz(timezone).format('YYYY-MM-DD') === today.format('YYYY-MM-DD');
}

function occurrenceKey(item, timezone) {
  const taskID = Number(item?.task_id || item?.taskID || 0);
  const instanceID = String(item?.instance_id || item?.instanceId || '').trim();
  if (taskID && instanceID) return `${taskID}:${instanceID}`;
  const start = dayjs(item?.start_time || item?.startTime || '');
  return `${taskID}:${start.isValid() ? start.tz(timezone).format('YYYY-MM-DD') : ''}`;
}

export function calculateTodayFocus({
  tasks,
  nextOccurrences,
  occurrenceHistory,
  timezone,
  reference = null,
}) {
  const baseTasks = Array.isArray(tasks) ? tasks : [];
  const recurringPending = (Array.isArray(nextOccurrences) ? nextOccurrences : [])
    .filter((item) => String(item?.status || 'pending') === 'pending')
    .map((item) => ({
      status: 'pending',
      start_time: item?.start_time || item?.startTime || '',
      due_date: item?.due_date || item?.dueDate || '',
    }));
  const pending = [
    ...baseTasks.filter((task) => !hasRecurrenceRule(task)),
    ...recurringPending,
  ].filter((task) => shouldIncludeTaskInTodayView(task, timezone, reference)).length;

  const completedBase = baseTasks.filter(
    (task) => (
      !hasRecurrenceRule(task)
      && String(task?.status || '') === 'completed'
      && completedToday(task?.completed_at || task?.completedAt, timezone, reference)
    ),
  ).length;

  const seenOccurrences = new Set();
  const completedRecurring = (Array.isArray(occurrenceHistory) ? occurrenceHistory : [])
    .filter((item) => {
      if (String(item?.status || '') !== 'completed') return false;
      if (!completedToday(item?.completed_at || item?.completedAt, timezone, reference)) return false;
      const key = occurrenceKey(item, timezone);
      if (seenOccurrences.has(key)) return false;
      seenOccurrences.add(key);
      return true;
    }).length;

  const completed = completedBase + completedRecurring;
  const total = pending + completed;
  return { total, completed, ratio: total > 0 ? completed / total : 0 };
}
