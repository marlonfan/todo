import { useRef, useEffect } from 'react';
import dayjs from 'dayjs';

/**
 * 日历数据预加载管理器（简化版）
 *
 * 预加载功能已暂时禁用以避免渲染循环
 * 核心的数据获取由 useCalendarFetch 处理
 *
 * @param {Object} params
 * @param {string} params.visibleStartDate - 当前可见范围的开始日期
 * @param {string} params.visibleEndDate - 当前可见范围的结束日期
 * @param {string} params.timezone - 时区
 * @param {number} params.prefetchPastDays - 向前预加载天数（默认 30）
 * @param {number} params.prefetchFutureDays - 向后预加载天数（默认 60）
 */
export function useCalendarPrefetchManager({
  visibleStartDate,
  visibleEndDate,
  timezone,
  prefetchPastDays = 30,
  prefetchFutureDays = 60,
}) {
  // 预加载功能暂时禁用，避免渲染循环
  // 核心 useCalendarFetch 会处理数据获取
  const prefetchImmediately = () => {
    console.log('[PrefetchManager] Prefetch temporarily disabled');
  };

  return {
    prefetchImmediately,
  };
}

export default useCalendarPrefetchManager;
