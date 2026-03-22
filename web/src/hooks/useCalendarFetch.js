import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';
import { calendarAPI } from '../api/client';
import { getConfiguredSyncIntervalSeconds } from '../data/syncEngine';
import { buildCalendarRangeKey, getCalendarRange, putCalendarRange } from '../data/localStore';
import { buildEventsSignature, decomposeEventsByDay } from '../utils/calendarEvents';
import { buildMissingRangeSegments } from '../utils/calendarFetchSegments';
import useCalendarCacheStore from '../stores/calendarCacheStore';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

const FETCH_STALE_TIME = 10 * 60 * 1000; // 10 minutes
const FETCH_SEGMENT_MAX_DAYS = 120;
const MIN_CALENDAR_REFRESH_SECONDS = 10 * 60;
export const CALENDAR_CACHE_SCHEMA_VERSION = 2;

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

function resolveCalendarAutoRefreshMs() {
  const seconds = Number(getConfiguredSyncIntervalSeconds?.() || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return MIN_CALENDAR_REFRESH_SECONDS * 1000;
  }
  return Math.max(MIN_CALENDAR_REFRESH_SECONDS, Math.max(15, Math.floor(seconds))) * 1000;
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

async function fetchCalendarSegmentFromServer(segmentStart, segmentEnd, segmentTimezone) {
  const res = await calendarAPI.getEvents({
    start: segmentStart,
    end: segmentEnd,
  });
  const events = Array.isArray(res.data) ? res.data : [];
  const eventsByDate = decomposeEventsByDay(events, segmentTimezone);
  await putCalendarRange({
    key: buildCalendarRangeKey(segmentStart, segmentEnd, segmentTimezone),
    start: segmentStart,
    end: segmentEnd,
    timezone: segmentTimezone,
    events,
    events_by_date: eventsByDate,
    cache_version: CALENDAR_CACHE_SCHEMA_VERSION,
    updated_at: Date.now(),
  });
  return {
    start: segmentStart,
    end: segmentEnd,
    timezone: segmentTimezone,
    events,
    eventsByDate,
  };
}

async function loadCalendarSegments(startDate, endDate, timezone) {
  const timezoneName = normalizeTimezoneName(timezone);
  const refreshMs = resolveCalendarAutoRefreshMs();
  const now = Date.now();
  const segments = buildRangeSegments(startDate, endDate, timezoneName);
  if (segments.length === 0) {
    return { timezone: timezoneName, segments: [], staleSegments: [], missingSegments: [] };
  }

  const loadedSegments = [];
  const staleSegments = [];
  const missingSegments = [];

  const localResults = await Promise.all(segments.map(async (segment) => {
    const key = buildCalendarRangeKey(segment.start, segment.end, timezoneName);
    const cached = await getCalendarRange(key);
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
      if (refreshMs > 0 && (!Number.isFinite(updatedAt) || updatedAt <= 0 || (now - updatedAt) >= refreshMs)) {
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

async function loadAndRefreshCalendarSegments(startDate, endDate, timezone) {
  const local = await loadCalendarSegments(startDate, endDate, timezone);
  const refreshTargets = mergeSegmentsByIdentity(local.missingSegments, local.staleSegments);
  if (refreshTargets.length === 0) return local;

  const refreshedSegments = (await Promise.all(refreshTargets.map(async (segment) => {
    const normalized = normalizeSegmentInfo(segment, local.timezone);
    if (!normalized) return null;
    try {
      return await fetchCalendarSegmentFromServer(normalized.start, normalized.end, normalized.timezone);
    } catch {
      return null;
    }
  }))).filter(Boolean);

  if (refreshedSegments.length === 0) return local;
  return {
    ...local,
    segments: mergeSegmentsByIdentity(local.segments, refreshedSegments),
    staleSegments: [],
    missingSegments: [],
  };
}

/**
 * 主 Hook：获取并缓存日历数据
 * 数据流: TanStack Query -> IndexedDB (hit) -> Zustand, 然后缺失/过期段后台并行补拉 API -> write IndexedDB -> Zustand
 */
export function useCalendarFetch(startDate, endDate, timezone, options = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const processedSignatureRef = useRef('');
  const backgroundRefreshInFlightRef = useRef(new Set());
  const timezoneName = normalizeTimezoneName(timezone);
  const queryKey = ['calendar', 'range', startDate, endDate, timezoneName];

  const { isLoading, error, data, isFetching } = useQuery({
    queryKey,
    queryFn: () => loadCalendarSegments(startDate, endDate, timezoneName),
    enabled: enabled && !!startDate && !!endDate && !!timezoneName,
    staleTime: FETCH_STALE_TIME,
    refetchInterval: () => {
      const refreshMs = resolveCalendarAutoRefreshMs();
      return refreshMs > 0 ? refreshMs : false;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!data || !Array.isArray(data.segments) || data.segments.length === 0) return;
    const signature = [
      String(data.timezone || ''),
      data.segments
        .map((segment) => [
          String(segment.start || ''),
          String(segment.end || ''),
          buildEventsSignature(segment.events),
        ].join('|'))
        .join('||'),
    ].join('|');
    if (processedSignatureRef.current === signature) return;
    processedSignatureRef.current = signature;

    const preparedSegments = data.segments.map((segment) => ({
      start: segment.start,
      end: segment.end,
      timezone: segment.timezone || timezoneName,
      eventsByDate: segment?.eventsByDate && typeof segment.eventsByDate === 'object'
        ? segment.eventsByDate
        : decomposeEventsByDay(segment.events, segment.timezone || timezoneName),
    }));
    useCalendarCacheStore.getState().replaceFetchedSegments(preparedSegments);
  }, [data, timezoneName]);

  useEffect(() => {
    const staleSegments = Array.isArray(data?.staleSegments) ? data.staleSegments : [];
    const missingSegments = Array.isArray(data?.missingSegments) ? data.missingSegments : [];
    const refreshTargets = mergeSegmentsByIdentity(staleSegments, missingSegments);
    if (!enabled || refreshTargets.length === 0) return undefined;
    let cancelled = false;

    const refreshCalendarSegments = async () => {
      const pendingTargets = [];
      refreshTargets.forEach((segment) => {
        const normalized = normalizeSegmentInfo(segment, data?.timezone || timezoneName);
        if (!normalized) return;
        const inFlightKey = buildSegmentIdentityKey(
          normalized.start,
          normalized.end,
          normalized.timezone,
        );
        if (backgroundRefreshInFlightRef.current.has(inFlightKey)) return;
        backgroundRefreshInFlightRef.current.add(inFlightKey);
        pendingTargets.push(normalized);
      });

      if (pendingTargets.length === 0) return;

      const refreshedSegments = (await Promise.all(pendingTargets.map(async (segment) => {
        const inFlightKey = buildSegmentIdentityKey(segment.start, segment.end, segment.timezone);
        try {
          return await fetchCalendarSegmentFromServer(segment.start, segment.end, segment.timezone);
        } catch (refreshError) {
          console.error('Failed to silently refresh calendar segment:', refreshError);
          return null;
        } finally {
          backgroundRefreshInFlightRef.current.delete(inFlightKey);
        }
      }))).filter(Boolean);

      if (cancelled || refreshedSegments.length === 0) return;

      useCalendarCacheStore.getState().replaceFetchedSegments(refreshedSegments.map((segment) => ({
        start: segment.start,
        end: segment.end,
        timezone: segment.timezone,
        eventsByDate: segment.eventsByDate,
      })));

      const refreshedKeys = new Set(refreshedSegments.map((segment) => buildSegmentIdentityKey(
        segment.start,
        segment.end,
        segment.timezone,
      )));

      queryClient.setQueryData(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          segments: mergeSegmentsByIdentity(prev?.segments, refreshedSegments),
          staleSegments: removeSegmentsByIdentity(prev?.staleSegments, refreshedKeys),
          missingSegments: removeSegmentsByIdentity(prev?.missingSegments, refreshedKeys),
        };
      });
    };

    refreshCalendarSegments().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [data, enabled, endDate, queryClient, startDate, timezoneName]);

  const isFullyCached = useCalendarCacheStore(
    useCallback(
      (state) => state.isRangeFullyCached(startDate, endDate, timezoneName),
      [startDate, endDate, timezoneName],
    ),
  );

  return {
    isLoading,
    isFetching,
    error,
    isFullyCached,
    refetch: () => queryClient.refetchQueries({ queryKey: ['calendar', 'range', startDate, endDate, timezoneName] }),
  };
}

/**
 * 预加载 Hook：在后台将指定范围预热到 IndexedDB + Zustand
 */
export function useCalendarPrefetch(startDate, endDate, timezone) {
  const queryClient = useQueryClient();

  const prefetch = useCallback(() => {
    const timezoneName = normalizeTimezoneName(timezone);
    if (!startDate || !endDate) return;
    queryClient.prefetchQuery({
      queryKey: ['calendar', 'range', startDate, endDate, timezoneName],
      queryFn: () => loadAndRefreshCalendarSegments(startDate, endDate, timezoneName),
      staleTime: FETCH_STALE_TIME,
    }).catch(() => {});
  }, [endDate, queryClient, startDate, timezone]);

  return { prefetch };
}

/**
 * 获取指定日期的事件（从 CacheSet）
 */
export function useEventsForDate(dateString, timezone = 'UTC') {
  return useCalendarCacheStore(
    (state) => state.getEventsForDate(dateString, timezone),
    (a, b) => a === b,
  );
}

/**
 * 获取指定日期范围的事件映射（从 CacheSet）
 */
export function useEventsForRange(startDate, endDate, timezone) {
  const timezoneName = String(timezone || 'UTC');
  return useCalendarCacheStore(
    useCallback((state) => state.getEventsMapForTimezone(timezoneName), [timezoneName]),
  );
}

/**
 * 使指定日期的缓存失效（用于数据更新后）
 */
export function useInvalidateCalendarDates() {
  return useCallback((dateStrings, timezone = 'UTC') => {
    useCalendarCacheStore.getState().invalidateDates(dateStrings, timezone);
  }, []);
}
