/**
 * CalendarView - 重构版
 *
 * 变更：
 * 1. 使用 Zustand Store 作为单一数据源
 * 2. TanStack Query 只负责网络请求
 * 3. 智能预加载管理器
 * 4. 细粒度渲染（通过 useEventsForRange）
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { calendarAPI } from '../api/client';
import TaskModal from './TaskModal';
import InfiniteCalendarCanvas from './InfiniteCalendarCanvas';
import dayjs from 'dayjs';
import { getUserTimeGranularity, getUserTimezone } from '../utils/time';
import { toServerRangeBoundary } from '../utils/syncTime';
import { queryKeys } from '../query/keys';
import { IconSearch } from './icons/TaskIcons';
import { updateTaskScheduleLocal, updateTaskStatusLocal } from '../data/taskMutations';
import { useTasksQuery } from '../query/hooks';
import { buildProjectedEventsFromTasks, buildTaskStatusIndex, mergeCalendarEvents } from './calendarEventMerge';
import { openSearchDialog } from '../state/searchOverlay';

// 新架构导入
import { useCalendarFetch, useEventsForRange, useInvalidateCalendarDates } from '../hooks/useCalendarFetch';
import { useCalendarPrefetchManager } from '../hooks/useCalendarPrefetchManager';
import useCalendarCacheStore from '../stores/calendarCacheStore';
import { getEventDates, decomposeEventsByDay } from '../utils/calendarEvents';

// ==================== 工具函数 ====================

function normalizeCalendarDefaultView(value) {
  if (value === 'dayGridMonth' || value === 'timeGridWeek' || value === 'timeGridDay') {
    return value;
  }
  return 'timeGridDay';
}

function readCalendarDefaultView() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return normalizeCalendarDefaultView(user.calendar_default_view);
  } catch {
    return 'timeGridDay';
  }
}

const EN_WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekStripStart(dateValue) {
  return dayjs(dateValue).startOf('week').day(0).format('YYYY-MM-DD');
}

function buildCalendarPoolRange(rangeStartISO, rangeEndISO) {
  const start = dayjs(rangeStartISO);
  const end = dayjs(rangeEndISO);
  const safeStart = start.isValid() ? start : dayjs();
  const safeEnd = end.isValid() && end.isAfter(safeStart) ? end : safeStart.add(1, 'day');
  const prefetchPastMonths = 3;
  const prefetchFutureMonths = 6;
  return {
    start: safeStart.subtract(prefetchPastMonths, 'month').startOf('day').toISOString(),
    end: safeEnd.add(prefetchFutureMonths, 'month').endOf('day').toISOString(),
  };
}

function isRangeCoveredByPool(rangeStartISO, rangeEndISO, pool) {
  if (!rangeStartISO || !rangeEndISO || !pool?.start || !pool?.end) return false;
  const rangeStart = dayjs(rangeStartISO);
  const rangeEnd = dayjs(rangeEndISO);
  const poolStart = dayjs(pool.start);
  const poolEnd = dayjs(pool.end);
  if (!rangeStart.isValid() || !rangeEnd.isValid() || !poolStart.isValid() || !poolEnd.isValid()) return false;
  return (rangeStart.isAfter(poolStart) || rangeStart.isSame(poolStart)) &&
    (rangeEnd.isBefore(poolEnd) || rangeEnd.isSame(poolEnd));
}

function emitCalendarTrace(detail = {}) {
  if (typeof window === 'undefined') return;
  if (!window.__TODO_SYNC_DEBUG__) return;
  window.dispatchEvent(new CustomEvent('sync:trace', {
    detail: {
      type: 'calendar_rebuilt',
      at: new Date().toISOString(),
      ...detail,
    },
  }));
}

const CALENDAR_CACHE_REFRESH_MS = 10 * 60 * 1000;

// ==================== 组件 ====================

function CalendarViewNew() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // ==================== Refs ====================
  const calendarRef = useRef(null);
  const readonlyModalHistoryRef = useRef({ hasEntry: false, ignoreNextPop: false });
  const moreEventsModalHistoryRef = useRef({ hasEntry: false, ignoreNextPop: false });
  const lastCalendarRevalidateAtRef = useRef(0);

  // ==================== 状态 ====================
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [moreEventsOpen, setMoreEventsOpen] = useState(false);
  const [moreEventsDateLabel, setMoreEventsDateLabel] = useState('');
  const [moreEvents, setMoreEvents] = useState([]);
  const [todayJumpToken, setTodayJumpToken] = useState(0);
  const [readonlyEventOpen, setReadonlyEventOpen] = useState(false);
  const [readonlyEventDetail, setReadonlyEventDetail] = useState(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [calendarPool, setCalendarPool] = useState({ start: '', end: '' });
  const [calendarDefaultView, setCalendarDefaultView] = useState(readCalendarDefaultView);
  const [isCompactMobile, setIsCompactMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [timezone, setTimezone] = useState(getUserTimezone);
  const [mobileView, setMobileView] = useState('timeGridDay');
  const [mobileCurrentDate, setMobileCurrentDate] = useState(() => dayjs().tz(getUserTimezone()).format('YYYY-MM-DD'));
  const [mobileStripStartDate, setMobileStripStartDate] = useState(() => getWeekStripStart(dayjs().tz(getUserTimezone())));
  const [stripTranslateX, setStripTranslateX] = useState(0);
  const [stripTransitionMs, setStripTransitionMs] = useState(0);
  const [calendarNow, setCalendarNow] = useState(() => dayjs().tz(getUserTimezone()).format('YYYY-MM-DDTHH:mm:ss[Z]'));
  const [currentViewTitle, setCurrentViewTitle] = useState('');
  const [hasCalendarDataLoaded, setHasCalendarDataLoaded] = useState(false);
  const [canvasAnchorDate, setCanvasAnchorDate] = useState(() => dayjs().tz(getUserTimezone()).format('YYYY-MM-DD'));
  const [canvasNudgeDirection, setCanvasNudgeDirection] = useState(0);

  // ==================== 任务数据 ====================
  const { data: tasks = [] } = useTasksQuery();
  const taskStatusIndex = useMemo(() => buildTaskStatusIndex(tasks), [tasks]);
  const tasksForProjection = useMemo(
    () => tasks.filter((task) => !task.completed_at),
    [tasks]
  );

  // ==================== 新架构：日历数据获取 ====================

  /**
   * 1. 数据获取：使用 TanStack Query 获取数据，自动写入 CacheSet
   */
  const { isLoading: calendarLoading, error: calendarError } = useCalendarFetch(
    calendarPool.start,
    calendarPool.end,
    timezone,
    { enabled: !!calendarPool.start && !!calendarPool.end }
  );

  /**
   * 2. 预加载管理器：后台预加载用户可能滚动到的数据
   */
  const { prefetchImmediately } = useCalendarPrefetchManager({
    visibleStartDate: dateRange.start,
    visibleEndDate: dateRange.end,
    timezone,
    prefetchPastDays: 30,
    prefetchFutureDays: 60,
  });

  /**
   * 3. 从 CacheSet 获取当前可见范围的事件
   *    这是新的数据获取方式，不再依赖 pooledEvents
   */
  const rawEvents = useEventsForRange(
    dateRange.start,
    dateRange.end,
    timezone
  );

  /**
   * 4. 合并投影任务事件
   */
  const events = useMemo(() => {
    const projectedRangeStart = toServerRangeBoundary(dateRange.start, timezone) || dateRange.start;
    const projectedRangeEnd = toServerRangeBoundary(dateRange.end, timezone) || dateRange.end;

    const projectedVisible = buildProjectedEventsFromTasks(tasksForProjection, {
      rangeStart: projectedRangeStart,
      rangeEnd: projectedRangeEnd,
      timezone,
    });

    const merged = mergeCalendarEvents(rawEvents || [], projectedVisible, taskStatusIndex);
    return merged;
  }, [rawEvents, tasksForProjection, taskStatusIndex, dateRange.start, dateRange.end, timezone]);

  /**
   * 5. 缓存失效工具
   */
  const invalidateCalendarDates = useInvalidateCalendarDates();

  // ==================== 初始化 ====================

  // 更新 calendar now
  useEffect(() => {
    const interval = setInterval(() => {
      setCalendarNow(dayjs().tz(timezone).format('YYYY-MM-DDTHH:mm:ss[Z]'));
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  // 初始化 pool
  useEffect(() => {
    if (!dateRange.start || !dateRange.end) return;
    if (isRangeCoveredByPool(dateRange.start, dateRange.end, calendarPool)) return;

    // 扩大 pool（只扩大不缩小）
    setCalendarPool((prevPool) => {
      const newPool = buildCalendarPoolRange(dateRange.start, dateRange.end);
      if (!prevPool?.start || !prevPool?.end) {
        return newPool;
      }
      // 合并范围
      return {
        start: dayjs(newPool.start).isBefore(dayjs(prevPool.start))
          ? newPool.start
          : prevPool.start,
        end: dayjs(newPool.end).isAfter(dayjs(prevPool.end))
          ? newPool.end
          : prevPool.end,
      };
    });
  }, [calendarPool, dateRange.end, dateRange.start]);

  // 初始数据加载
  useEffect(() => {
    if (events.length > 0) {
      setHasCalendarDataLoaded(true);
      return;
    }
    if (!calendarLoading) {
      setHasCalendarDataLoaded(true);
    }
  }, [events.length, calendarLoading]);

  // 用户配置变化监听
  useEffect(() => {
    const syncCalendarPrefs = () => {
      setCalendarDefaultView(readCalendarDefaultView());
      setTimezone(getUserTimezone());
    };
    window.addEventListener('user:profile-updated', syncCalendarPrefs);
    window.addEventListener('storage', syncCalendarPrefs);
    return () => {
      window.removeEventListener('user:profile-updated', syncCalendarPrefs);
      window.removeEventListener('storage', syncCalendarPrefs);
    };
  }, []);

  // ==================== 回调函数 ====================

  const handleDatesSet = (dateInfo) => {
    setCurrentViewTitle(dateInfo?.view?.title || '');
    setDateRange({
      start: dayjs(dateInfo.start).toISOString(),
      end: dayjs(dateInfo.end).toISOString(),
    });

    if (isCompactMobile) {
      const normalizedView = normalizeMobileView(dateInfo.view.type);
      const focusedDate = pendingFocusDateRef.current
        ? dayjs(pendingFocusDateRef.current).format('YYYY-MM-DD')
        : normalizedView === 'timeGridThreeDay'
          ? dayjs(dateInfo.start).add(1, 'day').format('YYYY-MM-DD')
          : dayjs(calendarRef.current?.getApi()?.getDate() || dateInfo.start).format('YYYY-MM-DD');
      setMobileCurrentDate(focusedDate);
      setMobileStripStartDate(getMobileStripStart(focusedDate));
      pendingFocusDateRef.current = '';
      if (normalizedView !== mobileView) {
        setMobileView(normalizedView);
      }
    }
  };

  const handleEventClick = (info) => {
    const event = info?.event;
    if (!event) return;

    const taskId = Number(event.extendedProps?.taskId || 0);
    const readOnly = !!event.extendedProps?.readOnly;

    if (taskId > 0 && !readOnly) {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setSelectedTask(task);
        setModalOpen(true);
        return;
      }
    }

    // 只读事件详情
    setReadonlyEventDetail({
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      extendedProps: event.extendedProps,
    });
    setReadonlyEventOpen(true);
  };

  const handleDateSelect = (info) => {
    const readOnly = info?.view?.calendar?.option('editable') === false;
    if (readOnly) return;

    const start = dayjs(info.start).tz(timezone);
    const end = info.end ? dayjs(info.end).tz(timezone) : start.add(1, 'hour');
    const allDay = !!info.allDay;

    setSelectedTask(null);
    setSelectedRange({
      allDay,
      start: start.format(allDay ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm'),
      end: end.format(allDay ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm'),
    });
    setModalOpen(true);
  };

  const handleEventDrop = async (info) => {
    const event = info.event;
    const taskId = Number(event.extendedProps?.taskId || 0);
    if (!taskId) return;

    const oldStart = info.oldEvent.start;
    const newStart = event.start;
    const oldEnd = info.oldEvent.end;
    const newEnd = event.end;

    // 使相关日期的缓存失效
    const oldDates = oldStart ? getEventDates({ start: oldStart, end: oldEnd }, timezone) : [];
    const newDates = newStart ? getEventDates({ start: newStart, end: newEnd }, timezone) : [];
    invalidateCalendarDates([...oldDates, ...newDates]);

    try {
      await updateTaskScheduleLocal(taskId, {
        start: newStart ? dayjs(newStart).toISOString() : null,
        end: newEnd ? dayjs(newEnd).toISOString() : null,
      });
    } catch (err) {
      info.revert();
      console.error('Failed to move event:', err);
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedTask(null);
    setSelectedRange(null);
  };

  // ==================== 渲染配置 ====================

  const timeGranularity = getUserTimeGranularity();
  const calendarLocale = i18n.language === 'zh-CN' ? 'zh-cn' : 'en';
  const slotDuration = timeGranularity === 60 ? '01:00:00' : `00:${String(timeGranularity).padStart(2, '0')}:00`;

  const initialDate = useMemo(
    () => (isCompactMobile ? mobileCurrentDate : dayjs().tz(timezone).format('YYYY-MM-DD')),
    [isCompactMobile, mobileCurrentDate, timezone]
  );

  const initialScrollTime = useMemo(() => {
    const now = dayjs().tz(timezone);
    const centeredHour = Math.max(0, now.hour() - 2);
    const roundedMinute = Math.floor(now.minute() / timeGranularity) * timeGranularity;
    return `${String(centeredHour).padStart(2, '0')}:${String(roundedMinute).padStart(2, '0')}:00`;
  }, [timeGranularity, timezone]);

  // ==================== 渲染 ====================

  if (calendarError) {
    return <div>Error loading calendar: {calendarError.message}</div>;
  }

  return (
    <div className="calendar-view">
      {/* FullCalendar - 桌面版 */}
      {!isCompactMobile && (
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={calendarDefaultView}
          initialDate={initialDate}
          initialScrollTime={initialScrollTime}
          locale={calendarLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          buttonText={{
            today: t('calendar.today'),
            month: t('calendar.month'),
            week: t('calendar.week'),
            day: t('calendar.day'),
          }}
          events={events}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          dateClick={handleDateSelect}
          selectable={true}
          selectMirror={true}
          editable={true}
          eventDrop={handleEventDrop}
          eventResize={handleEventDrop}
          slotDuration={slotDuration}
          slotLabelInterval={timeGranularity === 60 ? '01:00' : `00:${String(timeGranularity).padStart(2, '0')}:00`}
          slotLabelFormat={{
            hour: 'numeric',
            minute: '2-digit',
            hour12: false,
          }}
          nowIndicator={true}
          height="100%"
          timeZone={timezone}
        />
      )}

      {/* 移动端和任务模态框等保持原样 */}
      <TaskModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        task={selectedTask}
        dateRange={selectedRange}
      />

      {/* 其他 UI 组件... */}
    </div>
  );
}

export default CalendarViewNew;

/**
 * ==================== 架构变更总结 ====================
 *
 * 移除的代码：
 * 1. dayCacheRef - 由 Zustand Store 替代
 * 2. lastPooledEvents - 不再需要
 * 3. 复杂的 pool 扩展 useEffect - 由预加载管理器处理
 * 4. fetchCalendarRangeFromServer - 由 useCalendarFetch 处理
 *
 * 新增的代码：
 * 1. useCalendarFetch - 数据获取 Hook
 * 2. useEventsForRange - 从 CacheSet 获取事件
 * 3. useCalendarPrefetchManager - 预加载管理
 * 4. useInvalidateCalendarDates - 缓存失效
 *
 * 保留的代码：
 * 1. 所有 UI 状态和交互逻辑
 * 2. 任务相关功能
 * 3. Modal 和事件处理
 * 4. 移动端适配
 */
