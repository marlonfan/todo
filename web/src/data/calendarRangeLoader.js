import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';
import { buildCalendarRangeKey } from './localStore.js';
import { decomposeEventsByDay } from '../utils/calendarEvents.js';
import { buildMissingRangeSegments } from '../utils/calendarFetchSegments.js';
import { CALENDAR_CACHE_SCHEMA_VERSION } from './calendarCacheVersion.js';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

export { CALENDAR_CACHE_SCHEMA_VERSION } from './calendarCacheVersion.js';
const FETCH_SEGMENT_MAX_DAYS = 120;

function normalizeTimezoneName(value) {
  const next = String(value || '').trim();
  return next || 'UTC';
}

function resolveInclusiveEndDay(start, end) {
  let endDay = end.startOf('day');
  if (end.isSame(endDay) && end.isAfter(start)) {
    endDay = endDay.subtract(1, 'day');
  }
  return endDay;
}

function buildRangeDayKeys(startDate, endDate, timezoneName) {
  if (!startDate || !endDate) return [];
  const start = dayjs(startDate).tz(timezoneName);
  const end = dayjs(endDate).tz(timezoneName);
  if (!start.isValid() || !end.isValid()) return [];

  const startDay = start.startOf('day');
  const endDay = resolveInclusiveEndDay(start, end);
  if (endDay.isBefore(startDay, 'day')) {
    return [startDay.format('YYYY-MM-DD')];
  }

  const dayKeys = [];
  let current = startDay;
  while (current.isBefore(endDay) || current.isSame(endDay, 'day')) {
    dayKeys.push(current.format('YYYY-MM-DD'));
    current = current.add(1, 'day');
  }
  return dayKeys;
}

function buildRangeSegments(startDate, endDate, timezoneName) {
  const dayKeys = buildRangeDayKeys(startDate, endDate, timezoneName);
  if (dayKeys.length === 0) return [];
  return buildMissingRangeSegments(dayKeys, timezoneName, FETCH_SEGMENT_MAX_DAYS);
}

function isCurrentCalendarCache(entry, timezoneName, start, end) {
  if (!entry) return false;
  if (Number(entry?.cache_version || 0) !== CALENDAR_CACHE_SCHEMA_VERSION) return false;
  if (String(entry?.timezone || '') !== String(timezoneName || '')) return false;
  if (String(entry?.start || '') !== String(start || '')) return false;
  if (String(entry?.end || '') !== String(end || '')) return false;
  return Array.isArray(entry?.events) || (entry?.events_by_date && typeof entry.events_by_date === 'object');
}

function buildSegmentIdentityKey(start, end, timezoneName) {
  return `${timezoneName}|${start}|${end}`;
}

function normalizeSegmentInfo(segment, fallbackTimezone = 'UTC') {
  const segmentStart = String(segment?.start || '');
  const segmentEnd = String(segment?.end || '');
  const segmentTimezone = normalizeTimezoneName(segment?.timezone || fallbackTimezone);
  if (!segmentStart || !segmentEnd) return null;
  return {
    start: segmentStart,
    end: segmentEnd,
    timezone: segmentTimezone,
  };
}

function removeSegmentsByIdentity(segments, removedKeys) {
  const list = Array.isArray(segments) ? segments : [];
  if (removedKeys.size === 0) return list;
  return list.filter((segment) => {
    const normalized = normalizeSegmentInfo(segment);
    if (!normalized) return true;
    const key = buildSegmentIdentityKey(normalized.start, normalized.end, normalized.timezone);
    return !removedKeys.has(key);
  });
}

function mergeSegmentsByIdentity(baseSegments, nextSegments) {
  const merged = new Map();
  const base = Array.isArray(baseSegments) ? baseSegments : [];
  const additions = Array.isArray(nextSegments) ? nextSegments : [];
  base.forEach((segment) => {
    const normalized = normalizeSegmentInfo(segment);
    if (!normalized) return;
    const key = buildSegmentIdentityKey(normalized.start, normalized.end, normalized.timezone);
    merged.set(key, segment);
  });
  additions.forEach((segment) => {
    const normalized = normalizeSegmentInfo(segment);
    if (!normalized) return;
    const key = buildSegmentIdentityKey(normalized.start, normalized.end, normalized.timezone);
    merged.set(key, segment);
  });
  return Array.from(merged.values());
}

// Both visible-range loading and prefetching use this cache/retry policy.
export function createCalendarRangeLoader({ readRange, writeRange, fetchEvents, now = Date.now }) {
  const inFlight = new Map();

  function fetchSegment(segment) {
    const { start, end, timezone } = segment;
    const key = buildCalendarRangeKey(start, end, timezone);
    if (inFlight.has(key)) return inFlight.get(key);
    const pending = (async () => {
      const response = await fetchEvents({ start, end });
      const events = Array.isArray(response) ? response : [];
      const eventsByDate = decomposeEventsByDay(events, timezone);
      try {
        await writeRange({
          key, start, end, timezone, events, events_by_date: eventsByDate,
          cache_version: CALENDAR_CACHE_SCHEMA_VERSION, updated_at: now(),
        });
      } catch (error) {
        console.error('Failed to persist calendar range; using server data:', error);
      }
      return { start, end, timezone, events, eventsByDate };
    })().finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
    return pending;
  }

  async function load(startDate, endDate, timezone, refreshMs = 10 * 60 * 1000) {
    const timezoneName = normalizeTimezoneName(timezone);
    const loadedAt = now();
    const segments = buildRangeSegments(startDate, endDate, timezoneName);
    if (segments.length === 0) {
      return { timezone: timezoneName, segments: [], staleSegments: [], missingSegments: [] };
    }

    const loadedSegments = [];
    const staleSegments = [];
    const missingSegments = [];

    const localResults = await Promise.all(segments.map(async (segment) => {
      const key = buildCalendarRangeKey(segment.start, segment.end, timezoneName);
      let cached;
      try {
        cached = await readRange(key);
      } catch (error) {
        console.error('Failed to read calendar range; falling back to server:', error);
      }
      return { segment, cached };
    }));

    localResults.forEach(({ segment, cached }) => {
      if (isCurrentCalendarCache(cached, timezoneName, segment.start, segment.end)) {
        const cachedEvents = Array.isArray(cached.events) ? cached.events : [];
        const cachedEventsByDate = cached?.events_by_date && typeof cached.events_by_date === 'object'
          ? cached.events_by_date
          : decomposeEventsByDay(cachedEvents, timezoneName);
        loadedSegments.push({
          ...segment,
          timezone: timezoneName,
          events: cachedEvents,
          eventsByDate: cachedEventsByDate,
        });
        const updatedAt = Number(cached?.updated_at || 0);
        if (refreshMs > 0 && (!Number.isFinite(updatedAt) || updatedAt <= 0 || (loadedAt - updatedAt) >= refreshMs)) {
          staleSegments.push({
            start: segment.start,
            end: segment.end,
            timezone: timezoneName,
          });
        }
        return;
      }
      missingSegments.push({
        start: segment.start,
        end: segment.end,
        timezone: timezoneName,
      });
    });

    return {
      timezone: timezoneName,
      segments: loadedSegments,
      staleSegments,
      missingSegments,
    };
  }

  async function refresh(snapshot) {
    const targets = mergeSegmentsByIdentity(snapshot.missingSegments, snapshot.staleSegments);
    if (targets.length === 0) return snapshot;
    const refreshed = (await Promise.all(targets.map(async (target) => {
      const segment = normalizeSegmentInfo(target, snapshot.timezone);
      if (!segment) return null;
      try { return await fetchSegment(segment); } catch { return null; }
    }))).filter(Boolean);
    if (refreshed.length === 0) return snapshot;
    const refreshedKeys = new Set(refreshed.map((segment) => buildSegmentIdentityKey(
      segment.start, segment.end, segment.timezone,
    )));
    return {
      ...snapshot,
      segments: mergeSegmentsByIdentity(snapshot.segments, refreshed),
      staleSegments: removeSegmentsByIdentity(snapshot.staleSegments, refreshedKeys),
      missingSegments: removeSegmentsByIdentity(snapshot.missingSegments, refreshedKeys),
    };
  }

  return { load, refresh };
}
