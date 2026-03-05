import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { calendarAPI } from '../api/client';
import { buildEventsSignature, decomposeEventsByDay } from '../utils/calendarEvents';
import { buildMissingRangeSegments } from '../utils/calendarFetchSegments';
import useCalendarCacheStore from '../stores/calendarCacheStore';

const FETCH_STALE_TIME = 10 * 60 * 1000; // 10 minutes
const FETCH_SEGMENT_MAX_DAYS = 120;

/**
 * 主 Hook：获取并缓存日历数据
 */
export function useCalendarFetch(startDate, endDate, timezone, options = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const processedSignatureRef = useRef('');
  const timezoneName = String(timezone || '').trim() || 'UTC';
  const queryKey = ['calendar', 'missing', startDate, endDate, timezoneName];

  const { isLoading, error, data, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const latestMissingDates = useCalendarCacheStore
        .getState()
        .getMissingDates(startDate, endDate, timezoneName);
      const segments = buildMissingRangeSegments(latestMissingDates, timezoneName, FETCH_SEGMENT_MAX_DAYS);
      if (segments.length === 0) {
        return { timezone: timezoneName, segments: [] };
      }

      const fetchedSegments = [];
      for (const segment of segments) {
        const res = await calendarAPI.getEvents({
          start: segment.start,
          end: segment.end,
        });
        const events = Array.isArray(res.data) ? res.data : [];
        fetchedSegments.push({
          ...segment,
          timezone: timezoneName,
          events,
        });
      }

      return {
        timezone: timezoneName,
        segments: fetchedSegments,
      };
    },
    enabled: enabled && !!startDate && !!endDate && !!timezoneName,
    staleTime: FETCH_STALE_TIME,
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
      eventsByDate: decomposeEventsByDay(segment.events, segment.timezone || timezoneName),
    }));
    useCalendarCacheStore.getState().replaceFetchedSegments(preparedSegments);
  }, [data]);

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
    refetch: () => queryClient.refetchQueries({ queryKey: ['calendar', 'missing', startDate, endDate, timezoneName] }),
  };
}

/**
 * 预加载 Hook：在后台预加载指定范围的数据
 */
export function useCalendarPrefetch(startDate, endDate, timezone) {
  const queryClient = useQueryClient();

  const prefetch = useCallback(() => {
    const timezoneName = String(timezone || '').trim() || 'UTC';
    const missingDates = useCalendarCacheStore.getState().getMissingDates(startDate, endDate, timezoneName);
    const segments = buildMissingRangeSegments(missingDates, timezoneName, FETCH_SEGMENT_MAX_DAYS);
    if (segments.length === 0) return;

    (async () => {
      for (const segment of segments) {
        await queryClient.prefetchQuery({
          queryKey: ['calendar', 'raw', segment.start, segment.end, timezoneName],
          queryFn: async () => {
            const res = await calendarAPI.getEvents({
              start: segment.start,
              end: segment.end,
            });

            const events = Array.isArray(res.data) ? res.data : [];
            const eventsByDate = decomposeEventsByDay(events, timezoneName);
            useCalendarCacheStore.getState().replaceRangeEvents(segment.start, segment.end, timezoneName, eventsByDate);
            useCalendarCacheStore.getState().addLoadedRange(segment.start, segment.end, timezoneName);

            return { events, ...segment, timezone: timezoneName };
          },
          staleTime: FETCH_STALE_TIME,
        });
      }
    })().catch(() => {});
  }, [startDate, endDate, timezone, queryClient]);

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
