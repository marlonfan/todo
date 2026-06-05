import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

function resolveTimezoneName(timezoneName) {
  return timezoneName || dayjs.tz.guess?.() || 'UTC';
}

function normalizeReferenceDay(reference, timezoneName) {
  const tz = resolveTimezoneName(timezoneName);
  const parsed = reference == null ? dayjs() : dayjs(reference);
  return (parsed.isValid() ? parsed : dayjs()).tz(tz).startOf('day');
}

export function getTaskPrimaryTime(task) {
  return task?.start_time || task?.due_date || '';
}

export function getTaskPrimaryLocalTime(task, timezoneName) {
  const raw = getTaskPrimaryTime(task);
  if (!raw) return null;
  const parsed = dayjs(raw);
  if (!parsed.isValid()) return null;
  return parsed.tz(resolveTimezoneName(timezoneName));
}

export function isTaskOverdue(task, timezoneName, reference = null) {
  if (String(task?.status || '') !== 'pending') return false;
  const localTime = getTaskPrimaryLocalTime(task, timezoneName);
  if (!localTime) return false;
  return localTime.startOf('day').isBefore(normalizeReferenceDay(reference, timezoneName));
}

export function getTaskOverdueDays(task, timezoneName, reference = null) {
  if (!isTaskOverdue(task, timezoneName, reference)) return 0;
  const localTime = getTaskPrimaryLocalTime(task, timezoneName);
  return Math.max(0, normalizeReferenceDay(reference, timezoneName).diff(localTime.startOf('day'), 'day'));
}

export function isTaskWithinLocalRange(task, timezoneName, startInclusive, endExclusive) {
  const localTime = getTaskPrimaryLocalTime(task, timezoneName);
  if (!localTime) return false;
  return (
    (localTime.isAfter(startInclusive) || localTime.isSame(startInclusive))
    && localTime.isBefore(endExclusive)
  );
}

export function shouldIncludeTaskInTodayView(task, timezoneName, reference = null) {
  if (String(task?.status || '') !== 'pending') return false;
  const todayStart = normalizeReferenceDay(reference, timezoneName);
  return (
    isTaskOverdue(task, timezoneName, reference)
    || isTaskWithinLocalRange(task, timezoneName, todayStart, todayStart.add(1, 'day'))
  );
}

export function shouldIncludeTaskInUpcomingView(task, timezoneName, reference = null, days = 7) {
  if (String(task?.status || '') !== 'pending') return false;
  const todayStart = normalizeReferenceDay(reference, timezoneName);
  return (
    isTaskOverdue(task, timezoneName, reference)
    || isTaskWithinLocalRange(task, timezoneName, todayStart, todayStart.add(days, 'day'))
  );
}
