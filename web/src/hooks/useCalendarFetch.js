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
const CALENDAR_CACHE_SCHEMA_VERSION = 2;

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
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.max(15, Math.floor(seconds)) * 1000;
}

function isCurrentCalendarCache(entry, timezoneName, start, end) {
  if (!entry) return false;
  if (Number(entry?.cache_version || 0) !== CALENDAR_CACHE_SCHEMA_VERSION) return false;
  if (String(entry?.timezone || '') !== String(timezoneName || '')) return false;
  if (String(entry?.start || '') !== String(start || '')) return false;
  if (String(entry?.end || '') !== String(end || '')) return false;
  return Array.isArray(entry?.events) || (entry?.events_by_date && typeof entry.events_by_date === 'object');
}

async function loadCalendarSegments(startDate, endDate, timezone) {
  const timezoneName = normalizeTimezoneName(timezone);
  const refreshMs = resolveCalendarAutoRefreshMs();
  const now = Date.now();
  const segments = buildRangeSegments(startDate, endDate, timezoneName);
  if (segments.length === 0) {
    return { timezone: timezoneName, segments: [], staleSegments: [] };
  }

  const loadedSegments = [];
  const staleSegments = [];
  for (const segment of segments) {
    const key = buildCalendarRangeKey(segment.start, segment.end, timezoneName);
    const cached = await getCalendarRange(key);
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
      continue;
    }

    const res = await calendarAPI.getEvents({
      start: segment.start,
      end: segment.end,
    });
    const events = Array.isArray(res.data) ? res.data : [];
    const eventsByDate = decomposeEventsByDay(events, timezoneName);
    await putCalendarRange({
      key,
      start: segment.start,
      end: segment.end,
      timezone: timezoneName,
      events,
      events_by_date: eventsByDate,
      cache_version: CALENDAR_CACHE_SCHEMA_VERSION,
      updated_at: Date.now(),
    });
    loadedSegments.push({
      ...segment,
      timezone: timezoneName,
      events,
      eventsByDate,
    });
  }

  return {
    timezone: timezoneName,
    segments: loadedSegments,
    staleSegments,
  };
}

/**
 * 主 Hook：获取并缓存日历数据
 * 数据流: TanStack Query -> IndexedDB (hit) / API (miss -> write IndexedDB) -> Zustand
 */
export function useCalendarFetch(startDate, endDate, timezone, options = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const processedSignatureRef = useRef('');
  const staleRefreshInFlightRef = useRef(new Set());
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
    if (!enabled || staleSegments.length === 0) return undefined;
    let cancelled = false;

    const refreshStaleSegments = async () => {
      const refreshedSegments = [];
      for (const segment of staleSegments) {
        if (cancelled) break;
        const segmentStart = String(segment?.start || '');
        const segmentEnd = String(segment?.end || '');
        if (!segmentStart || !segmentEnd) continue;
        const segmentTimezone = normalizeTimezoneName(segment?.timezone || data?.timezone || timezoneName);
        const inFlightKey = `${segmentTimezone}|${segmentStart}|${segmentEnd}`;
        if (staleRefreshInFlightRef.current.has(inFlightKey)) continue;

        staleRefreshInFlightRef.current.add(inFlightKey);
        try {
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
          refreshedSegments.push({
            start: segmentStart,
            end: segmentEnd,
            timezone: segmentTimezone,
            events,
            eventsByDate,
          });
        } catch (refreshError) {
          console.error('Failed to silently refresh stale calendar segment:', refreshError);
        } finally {
          staleRefreshInFlightRef.current.delete(inFlightKey);
        }
      }

      if (cancelled || refreshedSegments.length === 0) return;

      useCalendarCacheStore.getState().replaceFetchedSegments(
        refreshedSegments.map((segment) => ({
          start: segment.start,
          end: segment.end,
          timezone: segment.timezone,
          eventsByDate: segment.eventsByDate,
        })),
      );

      const refreshedMap = new Map(
        refreshedSegments.map((segment) => [`${segment.start}|${segment.end}`, segment]),
      );
      queryClient.setQueryData(queryKey, (prev) => {
        if (!prev || !Array.isArray(prev?.segments)) return prev;
        const nextSegments = prev.segments.map((segment) => {
          const key = `${segment.start}|${segment.end}`;
          const refreshed = refreshedMap.get(key);
          if (!refreshed) return segment;
          return {
            ...segment,
            events: refreshed.events,
            eventsByDate: refreshed.eventsByDate,
          };
        });
        const nextStale = Array.isArray(prev?.staleSegments)
          ? prev.staleSegments.filter((segment) => !refreshedMap.has(`${segment.start}|${segment.end}`))
          : [];
        return {
          ...prev,
          segments: nextSegments,
          staleSegments: nextStale,
        };
      });
    };

    refreshStaleSegments().catch(() => {});
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
      queryFn: () => loadCalendarSegments(startDate, endDate, timezoneName),
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
