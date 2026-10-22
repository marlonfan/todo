import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { calendarAPI } from '../api/client';
import { getConfiguredSyncIntervalSeconds } from '../data/syncEngine';
import { getCalendarRange, putCalendarRange } from '../data/localStore';
import { buildEventsSignature, decomposeEventsByDay } from '../utils/calendarEvents';
import useCalendarCacheStore from '../stores/calendarCacheStore';
import { createCalendarRangeLoader } from '../data/calendarRangeLoader.js';

export { CALENDAR_CACHE_SCHEMA_VERSION } from '../data/calendarRangeLoader.js';

const FETCH_STALE_TIME = 10 * 60 * 1000; // 10 minutes
const MIN_CALENDAR_REFRESH_SECONDS = 10 * 60;
const calendarRanges = createCalendarRangeLoader({
  readRange: getCalendarRange,
  writeRange: putCalendarRange,
  fetchEvents: async (params) => (await calendarAPI.getEvents(params)).data,
});

function normalizeTimezoneName(value) {
  const next = String(value || '').trim();
  return next || 'UTC';
}

function resolveCalendarAutoRefreshMs() {
  const seconds = Number(getConfiguredSyncIntervalSeconds?.() || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return MIN_CALENDAR_REFRESH_SECONDS * 1000;
  }
  return Math.max(MIN_CALENDAR_REFRESH_SECONDS, Math.max(15, Math.floor(seconds))) * 1000;
}

/**
 * 主 Hook：获取并缓存日历数据
 * 数据流: TanStack Query -> IndexedDB (hit) -> Zustand, 然后缺失/过期段后台并行补拉 API -> write IndexedDB -> Zustand
 */
export function useCalendarFetch(startDate, endDate, timezone, options = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const processedSignatureRef = useRef('');
  const timezoneName = normalizeTimezoneName(timezone);
  const queryKey = ['calendar', 'range', startDate, endDate, timezoneName];

  const { isLoading, error, data, dataUpdatedAt, isFetching } = useQuery({
    queryKey,
    queryFn: () => calendarRanges.load(startDate, endDate, timezoneName, resolveCalendarAutoRefreshMs()),
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
    if (!enabled || !data) return undefined;
    let cancelled = false;
    void calendarRanges.refresh(data).then((refreshed) => {
      if (cancelled || refreshed === data) return;
      queryClient.setQueryData(queryKey, (current) => current === data ? refreshed : current);
    }).catch((error) => {
      console.error('Failed to refresh calendar ranges:', error);
    });
    return () => { cancelled = true; };
  }, [data, dataUpdatedAt, enabled, endDate, queryClient, startDate, timezoneName]);

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
      queryFn: async () => {
        const local = await calendarRanges.load(startDate, endDate, timezoneName, resolveCalendarAutoRefreshMs());
        return calendarRanges.refresh(local);
      },
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
  );
}

/**
 * 获取指定日期范围的事件映射（从 CacheSet）
 */
export function useEventsForRange(startDate, endDate, timezone) {
  const timezoneName = String(timezone || 'UTC');
  return useCalendarCacheStore(
    useCallback(
      (state) => state.getEventsMapForRange(startDate, endDate, timezoneName),
      [endDate, startDate, timezoneName],
    ),
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
