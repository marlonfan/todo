import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { calendarAPI } from '../api/client';
import { decomposeEventsByDay } from '../utils/calendarEvents';
import useCalendarCacheStore from '../stores/calendarCacheStore';

/**
 * 日历数据获取 Hook
 *
 * 职责：
 * 1. 使用 TanStack Query 处理网络请求
 * 2. 将获取的数据写入全局 CacheSet
 * 3. 智能合并，只更新变更的日期
 */

const FETCH_STALE_TIME = 10 * 60 * 1000; // 10 minutes

/**
 * 主 Hook：获取并缓存日历数据
 *
 * @param {string} startDate - ISO 格式开始日期
 * @param {string} endDate - ISO 格式结束日期
 * @param {string} timezone - 时区
 * @param {Object} options - 选项
 * @param {boolean} options.enabled - 是否启用查询
 * @returns {Object} - { isLoading, error, refetch }
 */
export function useCalendarFetch(startDate, endDate, timezone, options = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  // 构建 query key（包含所有影响数据的因素）
  const queryKey = ['calendar', 'raw', startDate, endDate, timezone];

  // 使用 ref 来追踪是否已经处理过这批数据
  const processedDataRef = useRef(null);

  // TanStack Query：只负责网络请求
  const { isLoading, error, data, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      console.log('[useCalendarFetch] Fetching calendar data:', { startDate, endDate, timezone });

      // 调用 API
      const res = await calendarAPI.getEvents({
        start: startDate,
        end: endDate,
      });

      const events = Array.isArray(res.data) ? res.data : [];
      console.log('[useCalendarFetch] Received', events.length, 'events from API');

      // 返回原始数据
      return { events, startDate, endDate, timezone };
    },
    enabled: enabled && !!startDate && !!endDate && !!timezone,
    staleTime: FETCH_STALE_TIME,
  });

  // 当有新数据时，写入 CacheSet
  useEffect(() => {
    if (!data?.events) return;

    // 避免重复处理同一批数据
    const dataKey = `${startDate}|${endDate}|${data.events.length}`;
    if (processedDataRef.current === dataKey) return;
    processedDataRef.current = dataKey;

    const { events, startDate: fetchedStart, endDate: fetchedEnd, timezone: fetchedTz } = data;

    // 按天分解事件
    const eventsByDate = decomposeEventsByDay(events, fetchedTz);

    console.log('[useCalendarFetch] Merging', eventsByDate.size, 'days into cache');

    // 智能合并到 CacheSet（只有变更的日期才会更新引用）
    const changedDates = useCalendarCacheStore.getState().mergeEvents(eventsByDate);

    console.log('[useCalendarFetch] Changed dates:', changedDates.size, 'out of', eventsByDate.size);

    // 记录已加载的范围
    useCalendarCacheStore.getState().addLoadedRange(fetchedStart, fetchedEnd, fetchedTz);
  }, [data, startDate, endDate]);

  // 从缓存池检查数据（使用 ref 避免选择器导致的重渲染）
  const isFullyCached = useRef(false);
  isFullyCached.current = useCalendarCacheStore(
    (state) => state.isRangeFullyCached(startDate, endDate)
  );

  return {
    isLoading,
    isFetching,
    error,
    isFullyCached: isFullyCached.current,
    refetch: () => queryClient.refetchQueries({ queryKey }),
  };
}

/**
 * 预加载 Hook：在后台预加载指定范围的数据
 *
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} timezone
 */
export function useCalendarPrefetch(startDate, endDate, timezone) {
  const queryClient = useQueryClient();

  const prefetch = useCallback(() => {
    const missingDates = useCalendarCacheStore.getState().getMissingDates(startDate, endDate);

    if (missingDates.length === 0) {
      console.log('[useCalendarPrefetch] Range already cached, skipping prefetch');
      return;
    }

    console.log('[useCalendarPrefetch] Prefetching', missingDates.length, 'missing dates');

    queryClient.prefetchQuery({
      queryKey: ['calendar', 'raw', startDate, endDate, timezone],
      queryFn: async () => {
        const res = await calendarAPI.getEvents({
          start: startDate,
          end: endDate,
        });

        const events = Array.isArray(res.data) ? res.data : [];

        // 按天分解并合并到缓存
        const eventsByDate = decomposeEventsByDay(events, timezone);
        useCalendarCacheStore.getState().mergeEvents(eventsByDate);

        return { events, startDate, endDate, timezone };
      },
      staleTime: FETCH_STALE_TIME,
    });
  }, [startDate, endDate, timezone, queryClient]);

  return { prefetch };
}

/**
 * 获取指定日期的事件（从 CacheSet）
 *
 * @param {string} dateString - YYYY-MM-DD 格式
 * @returns {CalendarEvent[]}
 */
export function useEventsForDate(dateString) {
  return useCalendarCacheStore(
    (state) => state.getEventsForDate(dateString),
    // 自定义对比函数：只有当该日期的引用变化时才重新渲染
    (a, b) => {
      // 浅比较数组引用
      return a === b;
    }
  );
}

/**
 * 获取指定日期范围的事件（从 CacheSet）
 *
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} timezone
 * @returns {Map<DateString, CalendarEvent[]>} - 返回整个 Map，由调用方过滤
 */
export function useEventsForRange(startDate, endDate, timezone) {
  // 直接返回 Map，让调用方在 useMemo 中过滤
  // 这样选择器只有在 Map 引用变化时才会触发更新
  return useCalendarCacheStore((state) => state.eventsByDate);
}

/**
 * 使指定日期的缓存失效（用于数据更新后）
 *
 * @param {string[]} dateStrings
 */
export function useInvalidateCalendarDates() {
  return useCallback((dateStrings) => {
    useCalendarCacheStore.getState().invalidateDates(dateStrings);
  }, []);
}
