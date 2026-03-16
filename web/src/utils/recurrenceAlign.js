import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const WEEKDAY_MAP = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

const TIMEZONE_PARSE_FORMATS = ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD'];

function parseInput(value, timezoneName = '') {
  const raw = String(value || '').trim();
  if (!raw || /^invalid date$/i.test(raw)) return null;

  if (!timezoneName) {
    const parsed = dayjs(raw);
    return parsed.isValid() ? parsed : null;
  }

  const normalized = raw.replace('T', ' ');
  for (const format of TIMEZONE_PARSE_FORMATS) {
    try {
      const parsed = dayjs.tz(normalized, format, timezoneName);
      if (parsed.isValid()) return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

function clampMonthlyDate(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(31, Math.max(1, parsed));
}

function normalizeRecurrenceDays(days) {
  return [...new Set(
    (Array.isArray(days) ? days : [])
      .map((day) => WEEKDAY_MAP[String(day || '').toUpperCase()])
      .filter((day) => Number.isInteger(day))
  )];
}

function formatOutput(value, allDay) {
  return allDay ? value.format('YYYY-MM-DD') : value.format('YYYY-MM-DDTHH:mm');
}

function withAnchorClock(dateValue, anchorStart, allDay) {
  if (allDay) return dateValue.startOf('day');
  return dateValue
    .hour(anchorStart.hour())
    .minute(anchorStart.minute())
    .second(anchorStart.second())
    .millisecond(0);
}

export function alignStartInputToNearestRecurrence({
  startInput,
  recurrenceType,
  recurrenceDays = [],
  recurrenceDate = 1,
  allDay = false,
  referenceInput = '',
  timezoneName = '',
}) {
  const start = parseInput(startInput, timezoneName);
  if (!start) return startInput || '';
  const reference = parseInput(referenceInput, timezoneName);
  const baseline = start;
  const type = String(recurrenceType || 'daily');

  if (type === 'weekly' || type === 'biweekly') {
    const targets = normalizeRecurrenceDays(recurrenceDays);
    if (targets.length === 0) return formatOutput(start, allDay);
    const searchStart = baseline.startOf('day');
    for (let offset = 0; offset <= 14; offset += 1) {
      const currentDay = searchStart.add(offset, 'day');
      if (!targets.includes(currentDay.day())) continue;
      const candidate = withAnchorClock(currentDay, start, allDay);
      if (candidate.isBefore(baseline)) continue;
      return formatOutput(candidate, allDay);
    }
    return formatOutput(start, allDay);
  }

  if (type === 'monthly') {
    const targetDate = clampMonthlyDate(recurrenceDate, start.date());
    const monthCursor = baseline.startOf('month');
    for (let offset = 0; offset <= 24; offset += 1) {
      const monthStart = monthCursor.add(offset, 'month');
      const dayValue = Math.min(targetDate, monthStart.daysInMonth());
      const candidate = withAnchorClock(monthStart.date(dayValue), start, allDay);
      if (candidate.isBefore(baseline)) continue;
      return formatOutput(candidate, allDay);
    }
    return formatOutput(start, allDay);
  }

  if (type === 'yearly') {
    const targetMonth = start.month();
    const targetDay = start.date();
    const startYear = baseline.year();
    for (let offset = 0; offset <= 12; offset += 1) {
      const yearValue = startYear + offset;
      const yearBase = baseline
        .year(yearValue)
        .month(targetMonth)
        .date(1)
        .startOf('day');
      if (!yearBase.isValid()) continue;
      const dayValue = Math.min(targetDay, yearBase.daysInMonth());
      const candidate = withAnchorClock(yearBase.date(dayValue), start, allDay);
      if (candidate.isBefore(baseline)) continue;
      return formatOutput(candidate, allDay);
    }
    return formatOutput(start, allDay);
  }

  return formatOutput(start, allDay);
}
