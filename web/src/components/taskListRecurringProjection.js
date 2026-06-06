import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';
import { buildRecurringProjectedEvents } from './calendarEventMerge.js';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

function normalizeOccurrenceDate(value, timezone) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = dayjs(raw);
  if (!parsed.isValid()) return '';
  return parsed.tz(timezone).format('YYYY-MM-DD');
}

function buildOccurrenceStatusKeys(taskID, instanceID, occurrenceDate, timezone) {
  const numericTaskID = Number(taskID || 0);
  if (!numericTaskID) return [];
  const keys = [];
  const normalizedInstanceID = String(instanceID || '').trim();
  if (normalizedInstanceID) {
    keys.push(`instance:${numericTaskID}:${normalizedInstanceID}`);
  }
  const normalizedDate = normalizeOccurrenceDate(occurrenceDate, timezone);
  if (normalizedDate) {
    keys.push(`date:${numericTaskID}:${normalizedDate}`);
  }
  return keys;
}

function readStatusFromMap(statusMap, keys) {
  const map = statusMap && typeof statusMap === 'object' ? statusMap : {};
  for (const key of keys) {
    const value = typeof map.get === 'function' ? map.get(key) : map?.[key]?.status;
    const status = String(value || '').trim();
    if (status) return status;
  }
  return '';
}

function parseOccurrenceDateFromStatusKey(taskID, key) {
  const normalizedTaskID = Number(taskID || 0);
  if (!normalizedTaskID) return '';
  const text = String(key || '').trim();
  const datePrefix = `date:${normalizedTaskID}:`;
  if (text.startsWith(datePrefix)) {
    const value = text.slice(datePrefix.length);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  }
  const instancePrefix = `instance:${normalizedTaskID}:${normalizedTaskID}_`;
  if (text.startsWith(instancePrefix)) {
    const token = text.slice(instancePrefix.length);
    if (/^\d{8}$/.test(token)) {
      return `${token.slice(0, 4)}-${token.slice(4, 6)}-${token.slice(6, 8)}`;
    }
  }
  return '';
}

export function hasOptimisticOccurrenceStatusForTask(optimisticStatusMap, taskID) {
  const normalizedTaskID = Number(taskID || 0);
  if (!normalizedTaskID || !optimisticStatusMap || typeof optimisticStatusMap !== 'object') return false;
  return Object.entries(optimisticStatusMap).some(([key, value]) => {
    if (!key.startsWith(`instance:${normalizedTaskID}:`) && !key.startsWith(`date:${normalizedTaskID}:`)) {
      return false;
    }
    const status = String(value?.status || '').trim();
    return status !== '' && status !== 'pending';
  });
}

function resolveProjectionRangeStart(task, optimisticStatusMap, timezone) {
  const taskID = Number(task?.id || 0);
  const dates = [];
  if (taskID && optimisticStatusMap && typeof optimisticStatusMap === 'object') {
    Object.entries(optimisticStatusMap).forEach(([key, value]) => {
      const status = String(value?.status || '').trim();
      if (!status || status === 'pending') return;
      const date = parseOccurrenceDateFromStatusKey(taskID, key);
      if (date) dates.push(date);
    });
  }
  dates.sort();
  if (dates[0]) {
    return dayjs.tz(dates[0], timezone).startOf('day');
  }

  const now = dayjs().tz(timezone);
  const rawStart = task?.start_time || task?.startTime || task?.due_date || task?.dueDate;
  const anchor = dayjs(rawStart || '').tz(timezone);
  if (anchor.isValid() && anchor.isAfter(now)) {
    return now.startOf('day');
  }
  return anchor.isValid() ? anchor.startOf('day') : now.startOf('day');
}

function resolveProjectionRangeEnd(rangeStart, task) {
  const rule = task?.recurrence_rule || task?.recurrenceRule || {};
  const freq = String(rule?.freq || '').trim().toLowerCase();
  const interval = Math.max(1, Number.parseInt(rule?.interval, 10) || 1);
  switch (freq) {
    case 'daily':
      return rangeStart.add(Math.max(14, interval * 3), 'day').endOf('day');
    case 'weekly':
      return rangeStart.add(Math.max(8, interval * 3), 'week').endOf('day');
    case 'monthly':
      return rangeStart.add(Math.max(12, interval * 3), 'month').endOf('day');
    case 'yearly':
    case 'lunar':
    case 'lunar_yearly':
      return rangeStart.add(Math.max(4, interval * 3), 'year').endOf('day');
    default:
      return rangeStart.add(1, 'year').endOf('day');
  }
}

export function buildNextPendingFromProjectedTask({
  task,
  optimisticStatusMap,
  serverStatusMap,
  timezone,
}) {
  const taskID = Number(task?.id || 0);
  if (!taskID) return null;
  const rawStart = task?.start_time || task?.startTime || task?.due_date || task?.dueDate;
  if (!rawStart) return null;

  const rangeStart = resolveProjectionRangeStart(task, optimisticStatusMap, timezone);
  const rangeEnd = resolveProjectionRangeEnd(rangeStart, task);
  const projected = buildRecurringProjectedEvents(task, {
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    rawStart,
    rawEnd: task?.end_time || task?.endTime || null,
    timezone,
    toCalendarISO: (value) => (value ? dayjs(value).utc().toISOString() : null),
  });
  if (!Array.isArray(projected) || projected.length === 0) return null;

  const candidates = projected
    .map((event) => {
      const start = dayjs(event?.start || '');
      if (!start.isValid()) return null;
      const occurrenceDate = normalizeOccurrenceDate(event?.start || '', timezone)
        || start.tz(timezone).format('YYYY-MM-DD');
      const rawInstanceID = String(event?.extendedProps?.instanceId || event?.id || '').trim();
      const instanceID = rawInstanceID || `${taskID}_${occurrenceDate.replace(/-/g, '')}`;
      const keys = buildOccurrenceStatusKeys(taskID, instanceID, occurrenceDate, timezone);
      const optimisticStatus = readStatusFromMap(optimisticStatusMap, keys);
      const serverStatus = readStatusFromMap(serverStatusMap, keys);
      const status = optimisticStatus || serverStatus || 'pending';
      if (status !== 'pending') return null;
      const end = event?.end ? dayjs(event.end) : null;
      return {
        instanceId: instanceID,
        occurrenceDate,
        startISO: start.toISOString(),
        endISO: end && end.isValid() ? end.toISOString() : null,
        title: String(task?.title || ''),
        description: String(task?.description || ''),
        priority: task?.priority,
        createdAt: task?.created_at || task?.createdAt || '',
        completedAt: null,
        deletedAt: null,
        status,
        startLocal: start.tz(timezone),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (!left.startLocal.isSame(right.startLocal)) {
        return left.startLocal.valueOf() - right.startLocal.valueOf();
      }
      return left.instanceId.localeCompare(right.instanceId);
    });

  return candidates[0] || null;
}

function readOccurrenceTaskID(item) {
  return Number(item?.task_id || item?.taskID || item?.source_task_id || item?.sourceTaskID || 0);
}

function readOccurrenceInstanceID(item) {
  return String(item?.instance_id || item?.instanceId || '').trim();
}

function readOccurrenceDate(item, timezone) {
  return normalizeOccurrenceDate(
    item?.occurrence_date
      || item?.occurrenceDate
      || item?.original_date
      || item?.originalDate
      || item?.start_time
      || item?.startTime
      || '',
    timezone,
  );
}

function buildProjectedOccurrenceItem(taskID, nextPending) {
  const numericTaskID = Number(taskID || 0);
  if (!numericTaskID || !nextPending?.instanceId || !nextPending?.occurrenceDate) return null;
  return {
    task_id: numericTaskID,
    taskID: numericTaskID,
    instance_id: nextPending.instanceId,
    instanceId: nextPending.instanceId,
    occurrence_date: nextPending.occurrenceDate,
    occurrenceDate: nextPending.occurrenceDate,
    start_time: nextPending.startISO,
    startTime: nextPending.startISO,
    end_time: nextPending.endISO,
    endTime: nextPending.endISO,
    title: nextPending.title,
    description: nextPending.description,
    priority: nextPending.priority,
    created_at: nextPending.createdAt,
    createdAt: nextPending.createdAt,
    completed_at: nextPending.completedAt,
    completedAt: nextPending.completedAt,
    deleted_at: nextPending.deletedAt,
    deletedAt: nextPending.deletedAt,
    status: nextPending.status || 'pending',
    optimistic_projected: true,
  };
}

export function upsertProjectedNextOccurrence(currentOccurrences, taskID, nextPending, timezone = 'UTC') {
  const projected = buildProjectedOccurrenceItem(taskID, nextPending);
  if (!projected) return Array.isArray(currentOccurrences) ? currentOccurrences : [];

  const numericTaskID = Number(taskID || 0);
  const projectedInstanceID = readOccurrenceInstanceID(projected);
  const projectedDate = readOccurrenceDate(projected, timezone);
  const existing = Array.isArray(currentOccurrences) ? currentOccurrences : [];
  const filtered = existing.filter((item) => {
    if (readOccurrenceTaskID(item) !== numericTaskID) return true;
    const itemInstanceID = readOccurrenceInstanceID(item);
    if (projectedInstanceID && itemInstanceID && itemInstanceID === projectedInstanceID) return false;
    const itemDate = readOccurrenceDate(item, timezone);
    if (projectedDate && itemDate && itemDate === projectedDate) return false;
    return true;
  });

  return [projected, ...filtered];
}
