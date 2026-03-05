import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_MAX_SEGMENT_DAYS = 45;

function normalizeTimezoneName(value) {
  const next = String(value || '').trim();
  return next || 'UTC';
}

function normalizeMissingDates(missingDates) {
  if (!Array.isArray(missingDates) || missingDates.length === 0) return [];
  const normalized = new Set();
  missingDates.forEach((dateValue) => {
    const dateKey = String(dateValue || '').trim().slice(0, 10);
    if (!dateKey) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
    normalized.add(dateKey);
  });
  return Array.from(normalized).sort();
}

function toRangeBoundaryISO(dateKey, timezoneName) {
  return dayjs.tz(dateKey, timezoneName).startOf('day').utc().toISOString();
}

function toNextDayBoundaryISO(dateKey, timezoneName) {
  return dayjs.tz(dateKey, timezoneName).startOf('day').add(1, 'day').utc().toISOString();
}

export function buildMissingDatesSignature(missingDates) {
  const days = normalizeMissingDates(missingDates);
  if (days.length === 0) return 'none';
  return `${days[0]}:${days[days.length - 1]}:${days.length}`;
}

export function buildMissingRangeSegments(missingDates, timezoneName = 'UTC', maxSegmentDays = DEFAULT_MAX_SEGMENT_DAYS) {
  const days = normalizeMissingDates(missingDates);
  if (days.length === 0) return [];

  const tzName = normalizeTimezoneName(timezoneName);
  const limit = Math.max(1, Number.parseInt(maxSegmentDays, 10) || DEFAULT_MAX_SEGMENT_DAYS);
  const segments = [];

  let segmentStart = days[0];
  let segmentEnd = days[0];
  let dayCount = 1;

  const pushSegment = () => {
    segments.push({
      startDay: segmentStart,
      endDay: segmentEnd,
      dayCount,
      start: toRangeBoundaryISO(segmentStart, tzName),
      end: toNextDayBoundaryISO(segmentEnd, tzName),
    });
  };

  for (let index = 1; index < days.length; index += 1) {
    const currentDay = days[index];
    const previousDayUTC = dayjs.utc(`${segmentEnd}T00:00:00Z`);
    const currentDayUTC = dayjs.utc(`${currentDay}T00:00:00Z`);
    const isConsecutive = currentDayUTC.diff(previousDayUTC, 'day') === 1;
    if (isConsecutive && dayCount < limit) {
      segmentEnd = currentDay;
      dayCount += 1;
      continue;
    }
    pushSegment();
    segmentStart = currentDay;
    segmentEnd = currentDay;
    dayCount = 1;
  }

  pushSegment();
  return segments;
}

