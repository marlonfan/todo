/**
 * 日历组件重构 - 集成示例
 *
 * 这个文件展示了如何使用新的架构重构 CalendarView 组件
 */

import React, { useState, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import dayjs from 'dayjs';
import { useCalendarFetch, useEventsForRange, useInvalidateCalendarDates } from '../hooks/useCalendarFetch';
import { useCalendarPrefetchManager } from '../hooks/useCalendarPrefetchManager';
import CalendarDayCell from './CalendarDayCell';
import useCalendarCacheStore from '../stores/calendarCacheStore';
import { getEventDates } from '../utils/calendarEvents';

function CalendarViewNew({ timezone = 'Asia/Shanghai' }) {
  // ==================== 状态管理 ====================
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [selectedDate, setSelectedDate] = useState(null);

  // ==================== 核心 Hook ====================

  // 1. 数据获取 Hook：使用 TanStack Query 获取数据，自动写入 CacheSet
  const { isLoading, error } = useCalendarFetch(
    dateRange.start,
    dateRange.end,
    timezone
  );

  // 2. 预加载管理器：在后台预加载用户可能滚动到的数据
  const { prefetchImmediately } = useCalendarPrefetchManager({
    visibleStartDate: dateRange.start,
    visibleEndDate: dateRange.end,
    timezone,
    prefetchPastDays: 30,  // 向前预加载 30 天
    prefetchFutureDays: 60, // 向后预加载 60 天
    debounceMs: 300,
  });

  // 3. 从 CacheSet 获取当前可见范围的事件（按需计算）
  const visibleEvents = useEventsForRange(
    dateRange.start,
    dateRange.end,
    timezone
  );

  // 4. 缓存失效 Hook
  const invalidateDates = useInvalidateCalendarDates();

  // ==================== 初始化 ====================
  useEffect(() => {
    // 组件挂载时立即预加载初始范围
    const today = dayjs().tz(timezone);
    const initialStart = today.subtract(14, 'day').startOf('day').toISOString();
    const initialEnd = today.add(45, 'day').endOf('day').toISOString();

    setDateRange({ start: initialStart, end: initialEnd });

    // 等状态更新后再预加载
    setTimeout(() => {
      prefetchImmediately();
    }, 100);
  }, [timezone, prefetchImmediately]);

  // ==================== 事件处理 ====================

  const handleDatesSet = (dateInfo) => {
    const start = dayjs(dateInfo.start).toISOString();
    const end = dayjs(dateInfo.end).toISOString();
    setDateRange({ start, end });
  };

  const handleEventUpdate = async (updatedEvent) => {
    // 1. 使相关日期的缓存失效
    const affectedDates = getEventDates(updatedEvent, timezone);
    invalidateDates(affectedDates);

    // 2. 发送 API 请求更新服务器数据
    // await calendarAPI.updateEvent(updatedEvent.id, updatedEvent);

    // 3. 重新获取该日期的数据（TanStack Query 会自动处理）
    // 或者直接合并到缓存
    // useCalendarCacheStore.getState().mergeEvents(newEventsByDate);
  };

  // ==================== 渲染 ====================

  if (error) {
    return <div>Error loading calendar: {error.message}</div>;
  }

  return (
    <div className="calendar-view">
      {/* 传统 FullCalendar 集成方式 */}
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={visibleEvents}
        datesSet={handleDatesSet}
        eventChange={handleEventUpdate}
        timezone={timezone}
        height="100%"
      />

      {/* 或者：细粒度组件方式（完全控制渲染） */}
      {/* <CalendarGridView
        startDate={dateRange.start}
        endDate={dateRange.end}
        timezone={timezone}
      /> */}
    </div>
  );
}

/**
 * 细粒度渲染示例：每个天单元格独立订阅
 */
function CalendarGridView({ startDate, endDate, timezone }) {
  const days = useMemo(() => {
    const start = dayjs(startDate).tz(timezone);
    const end = dayjs(endDate).tz(timezone);
    const days = [];

    let current = start;
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      days.push(current.format('YYYY-MM-DD'));
      current = current.add(1, 'day');
    }

    return days;
  }, [startDate, endDate, timezone]);

  return (
    <div className="calendar-grid">
      {days.map((day) => (
        <CalendarDayCell
          key={day}
          date={day}
          renderDay={(events, date) => (
            <div className="calendar-day">
              <div className="day-header">{date}</div>
              <div className="day-events">
                {events.map((event) => (
                  <div key={event.id} className="event">
                    {event.title}
                  </div>
                ))}
              </div>
            </div>
          )}
          renderEmpty={(date) => (
            <div className="calendar-day empty">
              <div className="day-header">{date}</div>
              <div className="day-events">No events</div>
            </div>
          )}
        />
      ))}
    </div>
  );
}

export default CalendarViewNew;

/**
 * ==================== 架构优势说明 ====================
 *
 * 1. 单一数据源 (Single Source of Truth)
 *    - 所有日历数据存储在 Zustand Store 中
 *    - 按日期索引：Map<DateString, Event[]>
 *    - 任何组件都可以通过 Hook 获取数据
 *
 * 2. 解耦获取与存储
 *    - TanStack Query 只负责网络请求
 *    - 数据写入 Store，不直接返回给 UI
 *    - UI 从 Store 读取，不依赖 Query 状态
 *
 * 3. 智能合并
 *    - 只有数据真正变化时才更新引用
 *    - 未变化的日期保持旧引用
 *    - 配合 React.memo 实现精确渲染
 *
 * 4. 细粒度订阅
 *    - CalendarDayCell 只订阅自己的日期
 *    - 该日期数据不变，组件不重渲染
 *    - 解决了"滚动时整个日历重渲染"的问题
 *
 * 5. 智能预加载
 *    - 根据用户滚动方向预加载
 *    - 检查已缓存范围，只请求缺失数据
 *    - 防抖避免频繁请求
 *
 * ==================== 数据流图 ====================
 *
 * 用户滚动
 *   ↓
 * dateRange 变化
 *   ↓
 * ┌─────────────────────────────────────────────────────────┐
 * │ useCalendarPrefetchManager                              │
 * │ - 计算需要预加载的范围                                   │
 * │ - 检查缓存中缺失的日期                                   │
 * │ - 触发后台 API 请求                                      │
 * └─────────────────────────────────────────────────────────┘
 *   ↓
 * ┌─────────────────────────────────────────────────────────┐
 * │ useCalendarFetch (TanStack Query)                       │
 * │ - 处理网络请求                                          │
 * │ - Loading/Error 状态                                    │
 * │ - 按天分解数据                                          │
 * └─────────────────────────────────────────────────────────┘
 *   ↓
 * ┌─────────────────────────────────────────────────────────┐
 * │ useCalendarCacheStore (Zustand)                         │
 * │ - 智能合并：只更新变化的日期                             │
 * │ - 保持不变的日期的旧引用                                 │
 * │ - 触发订阅者重新渲染（仅限变化的日期）                   │
 * └─────────────────────────────────────────────────────────┘
 *   ↓
 * ┌─────────────────────────────────────────────────────────┐
 * │ CalendarDayCell (细粒度组件)                            │
 * │ - 只订阅自己的日期                                       │
 * │ - 引用不变则不重渲染                                     │
 * │ - 未滚动的日期完全静默                                   │
 * └─────────────────────────────────────────────────────────┘
 */
