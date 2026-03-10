import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import * as RRuleModule from 'rrule';
import { buildLunarYearlyOccurrenceStarts } from '../utils/lunar.js';

dayjs.extend(utc);
dayjs.extend(timezone);
const RRuleLegacyDefault = typeof Reflect !== 'undefined'
  ? Reflect.get(RRuleModule, 'default')
  : undefined;
const RRuleLegacyNamed = typeof Reflect !== 'undefined'
  ? Reflect.get(RRuleModule, 'rrule')
  : undefined;
const RRule = RRuleModule.RRule || RRuleLegacyDefault?.RRule || RRuleLegacyNamed?.RRule;

const RECURRENCE_FREQ_MAP = {
  daily: RRule.DAILY,
  weekly: RRule.WEEKLY,
  monthly: RRule.MONTHLY,
  yearly: RRule.YEARLY,
};

const RECURRENCE_WEEKDAY_MAP = {
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
  SU: RRule.SU,
};

function isTaskInRange(task, rangeStartISO, rangeEndISO) {
  if (!task || !rangeStartISO || !rangeEndISO) return false;
  const rangeStart = dayjs(rangeStartISO);
  const rangeEnd = dayjs(rangeEndISO);
  if (!rangeStart.isValid() || !rangeEnd.isValid()) return false;

  const startCandidate = task.start_time || task.startTime || task.due_date || task.dueDate;
  if (!startCandidate) return false;
  const taskStart = dayjs(startCandidate);
  if (!taskStart.isValid()) return false;

  const endCandidate = task.end_time || task.endTime;
  const taskEndRaw = endCandidate ? dayjs(endCandidate) : taskStart;
  const taskEnd = taskEndRaw.isValid() && taskEndRaw.isAfter(taskStart)
    ? taskEndRaw
    : taskStart.add(30, 'minute');

  return taskStart.isBefore(rangeEnd) && taskEnd.isAfter(rangeStart);
}

function parseRecurrenceRule(rawRule) {
  if (!rawRule) return null;
  if (typeof rawRule === 'object') return rawRule;
  if (typeof rawRule !== 'string') return null;
  try {
    return JSON.parse(rawRule);
  } catch {
    return null;
  }
}

function normalizeByDayList(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map((day) => String(day || '').trim().toUpperCase())
    .filter(Boolean);
}

function normalizeNumberList(rawList, min, max) {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value >= min && value <= max);
}

function toDateObject(value) {
  if (value == null) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = dayjs(value);
  if (!parsed.isValid()) return null;
  return parsed.toDate();
}

function resolveTaskDurationMs(rawStart, rawEnd) {
  const start = dayjs(rawStart);
  const end = dayjs(rawEnd);
  if (!start.isValid() || !end.isValid()) return null;
  const diff = end.diff(start);
  if (!Number.isFinite(diff) || diff <= 0) return null;
  return diff;
}

function isRecurringTaskPotentiallyInRange(task, rangeStartISO, rangeEndISO) {
  if (!task || !rangeStartISO || !rangeEndISO) return false;
  const rangeStart = dayjs(rangeStartISO);
  const rangeEnd = dayjs(rangeEndISO);
  if (!rangeStart.isValid() || !rangeEnd.isValid()) return false;

  const startCandidate = task.start_time || task.startTime || task.due_date || task.dueDate;
  if (!startCandidate) return false;
  const taskStart = dayjs(startCandidate);
  if (!taskStart.isValid()) return false;
  if (!taskStart.isBefore(rangeEnd)) return false;

  const recurrenceEndCandidate = task.recurrence_end_date || task.recurrenceEndDate;
  if (recurrenceEndCandidate) {
    const recurrenceEnd = dayjs(recurrenceEndCandidate);
    if (recurrenceEnd.isValid() && recurrenceEnd.isBefore(rangeStart)) {
      return false;
    }
  }

  return true;
}

function buildProjectedEvent(task, {
  id,
  start,
  end,
  allDay,
  isRecurring,
  instanceId,
  timezone,
}) {
  return {
    id,
    title: task.title || '',
    start: start || dayjs().tz(timezone).format('YYYY-MM-DDTHH:mm:ss[Z]'),
    end,
    allDay,
    editable: !task.read_only,
    extendedProps: {
      taskId: Number(task.id),
      description: isRecurring ? '' : (task.description || ''),
      status: task.status || 'pending',
      priority: Number.parseInt(task.priority, 10) || 0,
      isRecurring,
      instanceId: instanceId || undefined,
      syncState: task.sync_state || 'synced',
      readOnly: !!task.read_only,
      source: task.source || 'local_projection',
      externalId: task.external_ref || '',
    },
  };
}

function buildRecurringProjectedEvents(task, options) {
  const {
    rangeStart,
    rangeEnd,
    rawStart,
    rawEnd,
    timezone,
    toCalendarISO,
  } = options;

  const rule = parseRecurrenceRule(task?.recurrence_rule || task?.recurrenceRule);
  if (!rule) return [];

  const dtStart = toDateObject(rawStart);
  const rangeStartDate = toDateObject(rangeStart);
  const rangeEndDate = toDateObject(rangeEnd);
  if (!dtStart || !rangeStartDate || !rangeEndDate) return [];

  const freqKey = String(rule.freq || '').trim().toLowerCase();
  if (freqKey === 'lunar_yearly' || freqKey === 'lunar') {
    const lunarStarts = buildLunarYearlyOccurrenceStarts({
      anchorISO: rawStart,
      rangeStartISO: rangeStart,
      rangeEndISO: rangeEnd,
      recurrenceRule: rule,
      recurrenceEndISO: task?.recurrence_end_date || task?.recurrenceEndDate || '',
    });
    if (!Array.isArray(lunarStarts) || lunarStarts.length === 0) return [];
    const durationMs = resolveTaskDurationMs(rawStart, rawEnd);
    const seen = new Set();
    return lunarStarts.reduce((acc, startISO) => {
      const start = dayjs(startISO);
      if (!start.isValid()) return acc;
      const dayToken = start.utc().format('YYYYMMDD');
      const instanceId = `${task.id}_${dayToken}`;
      if (seen.has(instanceId)) return acc;
      seen.add(instanceId);
      const eventEndISO = (Number.isFinite(durationMs) && durationMs > 0)
        ? new Date(start.toDate().getTime() + durationMs).toISOString()
        : undefined;
      acc.push(buildProjectedEvent(task, {
        id: instanceId,
        start: toCalendarISO(startISO) || startISO,
        end: eventEndISO ? (toCalendarISO(eventEndISO) || eventEndISO) : undefined,
        allDay: !!(task.all_day || task.allDay),
        isRecurring: true,
        instanceId,
        timezone,
      }));
      return acc;
    }, []);
  }
  const freq = RECURRENCE_FREQ_MAP[freqKey];
  if (typeof freq === 'undefined') return [];

  const interval = Math.max(1, Number.parseInt(rule.interval, 10) || 1);
  const rruleOptions = {
    freq,
    interval,
    dtstart: dtStart,
  };

  const byDay = normalizeByDayList(rule.byday || rule.byDay);
  const byWeekday = byDay
    .map((day) => RECURRENCE_WEEKDAY_MAP[day])
    .filter(Boolean);
  if (byWeekday.length > 0) {
    rruleOptions.byweekday = byWeekday;
  }

  const byMonth = normalizeNumberList(rule.bymonth || rule.byMonth, 1, 12);
  if (byMonth.length > 0) {
    rruleOptions.bymonth = byMonth;
  }

  const byMonthDay = normalizeNumberList(
    rule.bydate || rule.byDate || rule.bymonthday || rule.byMonthDay,
    1,
    31,
  );
  if (byMonthDay.length > 0) {
    rruleOptions.bymonthday = byMonthDay;
  }

  const count = Number.parseInt(rule.count, 10);
  if (Number.isFinite(count) && count > 0) {
    rruleOptions.count = count;
  }

  const untilCandidate = task?.recurrence_end_date || task?.recurrenceEndDate || rule?.until;
  const until = toDateObject(untilCandidate);
  if (until) {
    rruleOptions.until = until;
  }

  let recurrence;
  try {
    recurrence = new RRule(rruleOptions);
  } catch {
    return [];
  }

  let occurrences = [];
  try {
    occurrences = recurrence.between(rangeStartDate, rangeEndDate, true);
  } catch {
    occurrences = [];
  }
  if (!Array.isArray(occurrences) || occurrences.length === 0) return [];

  const durationMs = resolveTaskDurationMs(rawStart, rawEnd);
  const seen = new Set();
  const projected = [];
  occurrences.forEach((occurrenceDate) => {
    const startISO = occurrenceDate.toISOString();
    const dayToken = dayjs(startISO).utc().format('YYYYMMDD');
    const instanceId = `${task.id}_${dayToken}`;
    if (seen.has(instanceId)) return;
    seen.add(instanceId);
    const eventEndISO = (Number.isFinite(durationMs) && durationMs > 0)
      ? new Date(occurrenceDate.getTime() + durationMs).toISOString()
      : undefined;
    projected.push(buildProjectedEvent(task, {
      id: instanceId,
      start: toCalendarISO(startISO) || startISO,
      end: eventEndISO ? (toCalendarISO(eventEndISO) || eventEndISO) : undefined,
      allDay: !!(task.all_day || task.allDay),
      isRecurring: true,
      instanceId,
      timezone,
    }));
  });

  return projected;
}

export function buildProjectedEventsFromTasks(tasks, options) {
  const {
    rangeStart,
    rangeEnd,
    timezone,
    toCalendarISO,
  } = options;
  const list = Array.isArray(tasks) ? tasks : [];

  return list
    .filter((task) => (task?.status || 'pending') !== 'cancelled')
    .filter((task) => !(task?.read_only || String(task?.source || '') === 'caldav'))
    .filter((task) => {
      const isRecurring = !!(task?.recurrence_rule || task?.recurrenceRule);
      if (isRecurring) {
        return isRecurringTaskPotentiallyInRange(task, rangeStart, rangeEnd);
      }
      return isTaskInRange(task, rangeStart, rangeEnd);
    })
    .flatMap((task) => {
      const rawStart = task.start_time || task.startTime || task.due_date || task.dueDate;
      const rawEnd = task.end_time || task.endTime || null;
      const allDay = !!(task.all_day || task.allDay);
      const isRecurring = !!(task?.recurrence_rule || task?.recurrenceRule);
      if (isRecurring) {
        const recurringProjected = buildRecurringProjectedEvents(task, {
          rangeStart,
          rangeEnd,
          rawStart,
          rawEnd,
          timezone,
          toCalendarISO,
        });
        if (recurringProjected.length > 0) {
          return recurringProjected;
        }
      }

      if (!rawStart) return [];
      if (!isTaskInRange(task, rangeStart, rangeEnd)) return [];
      const projectedInstanceID = isRecurring
        ? `${task.id}_${dayjs(rawStart).utc().format('YYYYMMDD')}`
        : '';

      return [buildProjectedEvent(task, {
        id: projectedInstanceID || `task-${task.id}`,
        start: toCalendarISO(rawStart) || rawStart,
        end: rawEnd ? (toCalendarISO(rawEnd) || rawEnd) : undefined,
        allDay,
        isRecurring,
        instanceId: projectedInstanceID || '',
        timezone,
      })];
    });
}

export function buildTaskStatusIndex(tasks) {
  const source = Array.isArray(tasks) ? tasks : [];
  const cancelled = new Set();
  const present = new Set();
  source.forEach((task) => {
    const taskID = Number(task?.id || 0);
    if (!taskID) return;
    present.add(taskID);
    if ((task.status || 'pending') === 'cancelled') {
      cancelled.add(taskID);
    }
  });
  return { cancelled, present };
}

function buildRecurringInstanceKey(event) {
  const ext = event?.extendedProps || {};
  const taskID = Number(ext?.taskId || 0);
  if (!taskID) return '';
  const instanceID = String(ext?.instanceId || event?.id || '').trim();
  if (instanceID) {
    return `${taskID}:${instanceID}`;
  }
  const start = dayjs(event?.start || '');
  if (!start.isValid()) return '';
  return `${taskID}:${start.utc().format('YYYYMMDD')}`;
}

export function mergeCalendarEvents(serverEvents, projectedEvents, taskStatusIndex = { cancelled: new Set(), present: null }) {
  const base = Array.isArray(serverEvents) ? serverEvents : [];
  const projected = Array.isArray(projectedEvents) ? projectedEvents : [];
  const projectedNonRecurringByTaskID = new Map();
  const projectedRecurring = [];
  const consumedNonRecurringTaskIDs = new Set();
  const serverRecurringInstanceKeys = new Set();
  const merged = [];

  projected.forEach((event) => {
    const taskID = Number(event?.extendedProps?.taskId || 0);
    if (!taskID) return;
    const isRecurring = !!event?.extendedProps?.isRecurring;
    if (isRecurring) {
      projectedRecurring.push(event);
      return;
    }
    projectedNonRecurringByTaskID.set(taskID, event);
  });

  base.forEach((event) => {
    const taskID = Number(event?.extendedProps?.taskId || 0);
    const serverStatus = event?.extendedProps?.status || 'pending';
    const isRecurring = !!event?.extendedProps?.isRecurring;
    if (taskID && serverStatus === 'cancelled') {
      if (isRecurring) {
        const recurringKey = buildRecurringInstanceKey(event);
        if (recurringKey) {
          serverRecurringInstanceKeys.add(recurringKey);
        }
      }
      return;
    }
    if (!taskID) {
      merged.push(event);
      return;
    }
    if (isRecurring) {
      // Server recurring instances are authoritative for the same instance key.
      const recurringKey = buildRecurringInstanceKey(event);
      if (recurringKey) {
        serverRecurringInstanceKeys.add(recurringKey);
      }
      merged.push(event);
      return;
    }

    const projectedEvent = projectedNonRecurringByTaskID.get(taskID);
    const eventSource = String(event?.extendedProps?.source || '');
    const isReadOnly = !!event?.extendedProps?.readOnly || eventSource === 'caldav';
    if (!projectedEvent) {
      merged.push(event);
      return;
    }
    if (isReadOnly) {
      consumedNonRecurringTaskIDs.add(taskID);
      merged.push(event);
      return;
    }
    if (consumedNonRecurringTaskIDs.has(taskID)) {
      merged.push(event);
      return;
    }

    consumedNonRecurringTaskIDs.add(taskID);
    merged.push({
      ...event,
      ...projectedEvent,
      id: event?.id || projectedEvent?.id,
      extendedProps: {
        ...(event?.extendedProps || {}),
        ...(projectedEvent?.extendedProps || {}),
      },
    });
  });

  projectedNonRecurringByTaskID.forEach((event, taskID) => {
    if (consumedNonRecurringTaskIDs.has(taskID)) return;
    merged.push(event);
  });

  projectedRecurring.forEach((event) => {
    const recurringKey = buildRecurringInstanceKey(event);
    if (recurringKey && serverRecurringInstanceKeys.has(recurringKey)) return;
    merged.push(event);
  });

  return merged;
}
