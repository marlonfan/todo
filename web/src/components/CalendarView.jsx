import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import TaskModal from './TaskModal';
import InfiniteCalendarCanvas from './InfiniteCalendarCanvas';
import dayjs from 'dayjs';
import { getUserTimeGranularity, getUserTimezone } from '../utils/time';
import { toServerRangeBoundary } from '../utils/syncTime';
import { queryKeys } from '../query/keys';
import { IconSearch } from './icons/TaskIcons';
import { setTasksCache, updateTaskScheduleLocal, updateTaskStatusLocal } from '../data/taskMutations';
import { useTasksQuery } from '../query/hooks';
import { buildProjectedEventsFromTasks, buildTaskStatusIndex, mergeCalendarEvents } from './calendarEventMerge';
import { openSearchDialog } from '../state/searchOverlay';
import { useCalendarFetch, useEventsForRange } from '../hooks/useCalendarFetch';
import useCalendarCacheStore from '../stores/calendarCacheStore';

function normalizeCalendarDefaultView(value) {
  if (value === 'dayGridMonth' || value === 'timeGridWeek' || value === 'timeGridDay') {
    return value;
  }
  return 'timeGridWeek';
}

function readCalendarDefaultView() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return normalizeCalendarDefaultView(user.calendar_default_view);
  } catch {
    return 'timeGridWeek';
  }
}

const EN_WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ZH_WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

function roundLocalTimeToGranularity(current, granularity) {
  const safeGranularity = Math.max(1, Number.parseInt(granularity, 10) || 15);
  const minutes = current.minute();
  const roundedMinutes = Math.ceil(minutes / safeGranularity) * safeGranularity;
  return current.second(0).millisecond(0).minute(0).add(roundedMinutes, 'minute');
}

function normalizeMobileView(value) {
  if (value === 'timeGridDay' || value === 'timeGridThreeDay' || value === 'dayGridMonth') {
    return value;
  }
  return 'timeGridThreeDay';
}

function getWeekStripStart(dateValue) {
  const current = dayjs(dateValue);
  return current.subtract(current.day(), 'day').format('YYYY-MM-DD');
}

function getMobileStripStart(dateValue, viewValue) {
  const current = dayjs(dateValue).format('YYYY-MM-DD');
  if (viewValue === 'timeGridThreeDay') return dayjs(current).subtract(1, 'day').format('YYYY-MM-DD');
  if (viewValue === 'timeGridDay') return dayjs(current).subtract(3, 'day').format('YYYY-MM-DD');
  return getWeekStripStart(current);
}

function annotateOverlapCount(events, defaultDurationMinutes = 30) {
  if (!Array.isArray(events) || events.length <= 1) return events || [];
  const counts = new Array(events.length).fill(1);
  const ranges = events.map((event) => {
    const start = dayjs(event.start);
    const endBase = event.end ? dayjs(event.end) : start.add(defaultDurationMinutes, 'minute');
    const end = endBase.isAfter(start) ? endBase : start.add(defaultDurationMinutes, 'minute');
    return { start, end };
  });

  for (let i = 0; i < ranges.length; i += 1) {
    for (let j = i + 1; j < ranges.length; j += 1) {
      const overlap = ranges[i].start.isBefore(ranges[j].end) && ranges[j].start.isBefore(ranges[i].end);
      if (!overlap) continue;
      counts[i] += 1;
      counts[j] += 1;
    }
  }

  return events.map((event, index) => ({
    ...event,
    extendedProps: {
      ...(event.extendedProps || {}),
      overlapCount: counts[index],
    },
  }));
}

function filterEventsForRange(events, rangeStartISO, rangeEndISO, defaultDurationMinutes = 30) {
  const list = Array.isArray(events) ? events : [];
  if (!rangeStartISO || !rangeEndISO) return list;
  const rangeStart = dayjs(rangeStartISO);
  const rangeEnd = dayjs(rangeEndISO);
  if (!rangeStart.isValid() || !rangeEnd.isValid()) return list;

  return list.filter((event) => {
    const start = dayjs(event?.start);
    if (!start.isValid()) return false;
    const endRaw = event?.end ? dayjs(event.end) : start.add(defaultDurationMinutes, 'minute');
    const end = endRaw.isValid() && endRaw.isAfter(start) ? endRaw : start.add(defaultDurationMinutes, 'minute');
    return start.isBefore(rangeEnd) && end.isAfter(rangeStart);
  });
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

// Simplified expand function for calendar pool
function expandCalendarPool(existingPool, newRangeStartISO, newRangeEndISO) {
  if (!existingPool?.start || !existingPool?.end) {
    return buildCalendarPoolRange(newRangeStartISO, newRangeEndISO);
  }

  const newRange = buildCalendarPoolRange(newRangeStartISO, newRangeEndISO);
  const poolStart = dayjs(existingPool.start);
  const poolEnd = dayjs(existingPool.end);
  const newStart = dayjs(newRange.start);
  const newEnd = dayjs(newRange.end);

  // Expand to the earlier start and later end (never shrink)
  const expandedStart = newStart.isBefore(poolStart) ? newStart : poolStart;
  const expandedEnd = newEnd.isAfter(poolEnd) ? newEnd : poolEnd;

  return {
    start: expandedStart.toISOString(),
    end: expandedEnd.toISOString(),
  };
}

function buildOccurrenceInstanceKey(taskID, instanceID, occurrenceDate) {
  const normalizedInstanceID = String(instanceID || '').trim();
  if (/^\d+_\d{8}$/.test(normalizedInstanceID)) {
    return normalizedInstanceID;
  }
  const normalizedDate = String(occurrenceDate || '').trim();
  const normalizedTaskID = Number(taskID || 0);
  if (!normalizedDate || !normalizedTaskID) return '';
  return `${normalizedTaskID}_${normalizedDate.replace(/-/g, '')}`;
}

function CalendarView() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: tasksForProjection = [] } = useTasksQuery();
  const calendarRef = useRef(null);
  const stripViewportRef = useRef(null);
  const stripDragRef = useRef({ active: false, startX: 0, deltaX: 0 });
  const stripAnimationRef = useRef({ phase: 'idle', direction: 0, width: 0 });
  const suppressStripClickRef = useRef(false);
  const pendingFocusDateRef = useRef('');
  const touchDraggingEventRef = useRef(false);
  const wheelGestureRef = useRef({ sumX: 0, sumY: 0, lastAt: 0 });
  const wheelNavLockUntilRef = useRef(0);
  const datesSetTimerRef = useRef(null);
  const desktopSwipeRef = useRef({ active: false, startX: 0, startY: 0, allow: false });
  const mobileContentSwipeRef = useRef({ active: false, startX: 0, startY: 0, lastX: 0, lastY: 0, allow: false, pointerId: null, lockedAxis: '' });
  const mobileNavAnimatingRef = useRef(false);
  const mobileClickSuppressUntilRef = useRef(0);
  const desktopViewportRef = useRef(null);
  const desktopNavAnimatingRef = useRef(false);
  const desktopMotionLayerRef = useRef(null);
  const desktopMoveRafRef = useRef(0);
  const viewDropdownRef = useRef(null);
  const readonlyModalHistoryRef = useRef({ hasEntry: false, ignoreNextPop: false });
  const moreEventsModalHistoryRef = useRef({ hasEntry: false, ignoreNextPop: false });
  const readonlyModalOpenedAtRef = useRef(0);
  const moreEventsModalOpenedAtRef = useRef(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [instanceDescriptionOverrides, setInstanceDescriptionOverrides] = useState({});
  const [moreEventsOpen, setMoreEventsOpen] = useState(false);
  const [moreEventsDateLabel, setMoreEventsDateLabel] = useState('');
  const [moreEvents, setMoreEvents] = useState([]);
  const [todayJumpToken, setTodayJumpToken] = useState(0);
  const [readonlyEventOpen, setReadonlyEventOpen] = useState(false);
  const [readonlyEventDetail, setReadonlyEventDetail] = useState(null);
  const [dateRange, setDateRange] = useState(() => {
    const view = readCalendarDefaultView();
    const now = dayjs();
    let start, end;
    if (view === 'dayGridMonth') {
      start = now.startOf('month').startOf('week');
      end = now.endOf('month').endOf('week');
    } else if (view === 'timeGridDay') {
      start = now.startOf('day');
      end = now.endOf('day');
    } else {
      start = now.startOf('week');
      end = now.endOf('week');
    }
    return { start: start.toISOString(), end: end.toISOString() };
  });
  const [calendarPool, setCalendarPool] = useState(() => {
    const view = readCalendarDefaultView();
    const now = dayjs();
    let start, end;
    if (view === 'dayGridMonth') {
      start = now.startOf('month').startOf('week');
      end = now.endOf('month').endOf('week');
    } else if (view === 'timeGridDay') {
      start = now.startOf('day');
      end = now.endOf('day');
    } else {
      start = now.startOf('week');
      end = now.endOf('week');
    }
    return buildCalendarPoolRange(start.toISOString(), end.toISOString());
  });
  const [calendarDefaultView, setCalendarDefaultView] = useState(readCalendarDefaultView);
  const [isCompactMobile, setIsCompactMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [timezone, setTimezone] = useState(getUserTimezone);
  const [mobileView, setMobileView] = useState('timeGridThreeDay');
  const [mobileCurrentDate, setMobileCurrentDate] = useState(() => dayjs().tz(getUserTimezone()).format('YYYY-MM-DD'));
  const [mobileStripStartDate, setMobileStripStartDate] = useState(() => getWeekStripStart(dayjs().tz(getUserTimezone())));
  const [stripTranslateX, setStripTranslateX] = useState(0);
  const [stripTransitionMs, setStripTransitionMs] = useState(0);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [calendarNow, setCalendarNow] = useState(() => dayjs().tz(getUserTimezone()).format('YYYY-MM-DDTHH:mm:ss[Z]'));
  const [currentViewTitle, setCurrentViewTitle] = useState('');
  const [hasCalendarDataLoaded, setHasCalendarDataLoaded] = useState(false);
  const [canvasAnchorDate, setCanvasAnchorDate] = useState(() => dayjs().tz(getUserTimezone()).format('YYYY-MM-DD'));
  const [canvasNudgeDirection, setCanvasNudgeDirection] = useState(0);
  const timezoneRef = useRef(timezone);

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

  useEffect(() => {
    const syncNow = () => {
      setCalendarNow(dayjs().tz(timezone).format('YYYY-MM-DDTHH:mm:ss[Z]'));
    };
    syncNow();
    const timer = window.setInterval(syncNow, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [timezone]);

  useEffect(() => () => {
    if (desktopMoveRafRef.current) {
      cancelAnimationFrame(desktopMoveRafRef.current);
      desktopMoveRafRef.current = 0;
    }
  }, []);

  const activeCalendarView = isCompactMobile ? normalizeMobileView(mobileView) : calendarDefaultView;
  const mobileStripDays = activeCalendarView === 'timeGridThreeDay' ? 3 : 7;
  const mobileStripStepDays = activeCalendarView === 'timeGridThreeDay' ? 3 : 7;
  const mobileWeekdayShort = i18n.language === 'zh-CN' ? ZH_WEEKDAY_SHORT : EN_WEEKDAY_SHORT;

  const desktopViewOptions = useMemo(
    () => [
      { value: 'dayGridMonth', label: t('calendar.month') },
      { value: 'timeGridWeek', label: t('calendar.week') },
      { value: 'timeGridDay', label: t('calendar.day') },
    ],
    [t]
  );

  const mobileViewOptions = useMemo(
    () => [
      { value: 'timeGridThreeDay', label: i18n.language === 'zh-CN' ? '三日' : '3-day' },
      { value: 'timeGridDay', label: t('calendar.day') },
      { value: 'dayGridMonth', label: t('calendar.month') },
    ],
    [i18n.language, t]
  );
  const viewOptions = isCompactMobile ? mobileViewOptions : desktopViewOptions;
  const activeViewOption = useMemo(
    () => viewOptions.find((option) => option.value === activeCalendarView) || viewOptions[0] || null,
    [activeCalendarView, viewOptions]
  );

  const mobileDateStrip = useMemo(() => {
    const start = dayjs(mobileStripStartDate);
    return Array.from({ length: mobileStripDays }, (_, index) => start.add(index, 'day'));
  }, [mobileStripDays, mobileStripStartDate]);

  const todayDateString = useMemo(() => dayjs().tz(timezone).format('YYYY-MM-DD'), [timezone]);

  useEffect(() => {
    const syncCalendarPrefs = () => {
      useCalendarCacheStore.getState().clear();
      setCalendarDefaultView(readCalendarDefaultView());
      setTimezone(getUserTimezone());
      setCalendarPool({ start: '', end: '' });
      setDateRange({ start: '', end: '' });
      setHasCalendarDataLoaded(false);
    };
    window.addEventListener('user:profile-updated', syncCalendarPrefs);
    window.addEventListener('storage', syncCalendarPrefs);
    return () => {
      window.removeEventListener('user:profile-updated', syncCalendarPrefs);
      window.removeEventListener('storage', syncCalendarPrefs);
    };
  }, []);

  useEffect(() => {
    if (!viewDropdownOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!viewDropdownRef.current) return;
      if (viewDropdownRef.current.contains(event.target)) return;
      setViewDropdownOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setViewDropdownOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewDropdownOpen]);

  useEffect(() => {
    setViewDropdownOpen(false);
  }, [activeCalendarView]);

  useEffect(() => {
    if (timezoneRef.current === timezone) return;
    timezoneRef.current = timezone;
    useCalendarCacheStore.getState().clear();
    setCalendarPool({ start: '', end: '' });
    setDateRange({ start: '', end: '' });
    setHasCalendarDataLoaded(false);
  }, [timezone]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setIsCompactMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const requestCloseMoreEventsModal = useCallback(() => {
    const state = moreEventsModalHistoryRef.current;
    if (typeof window !== 'undefined' && state.hasEntry) {
      state.ignoreNextPop = true;
      state.hasEntry = false;
      window.history.back();
    }
    setMoreEventsOpen(false);
  }, []);

  useEffect(() => {
    if (!moreEventsOpen || typeof window === 'undefined') return undefined;
    const baseState = window.history.state && typeof window.history.state === 'object'
      ? window.history.state
      : {};
    window.history.pushState({ ...baseState, __todoModal: 'calendar-more-events' }, '');
    moreEventsModalHistoryRef.current.hasEntry = true;
    moreEventsModalHistoryRef.current.ignoreNextPop = false;

    const handlePopState = () => {
      const state = moreEventsModalHistoryRef.current;
      if (state.ignoreNextPop) {
        state.ignoreNextPop = false;
        return;
      }
      if (!state.hasEntry) return;
      state.hasEntry = false;
      setMoreEventsOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') requestCloseMoreEventsModal();
    };

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('keydown', handleKeyDown);
      moreEventsModalHistoryRef.current.ignoreNextPop = false;
      moreEventsModalHistoryRef.current.hasEntry = false;
    };
  }, [moreEventsOpen, requestCloseMoreEventsModal]);

  useEffect(() => {
    if (!moreEventsOpen) return;
    moreEventsModalOpenedAtRef.current = Date.now();
  }, [moreEventsOpen]);

  const handleMoreEventsBackdropClick = useCallback((event) => {
    if (event.target !== event.currentTarget) return;
    if (Date.now() - moreEventsModalOpenedAtRef.current < 280) return;
    requestCloseMoreEventsModal();
  }, [requestCloseMoreEventsModal]);

  useEffect(() => {
    const expectedStart = getMobileStripStart(mobileCurrentDate, activeCalendarView);
    if (expectedStart !== mobileStripStartDate && stripAnimationRef.current.phase === 'idle') {
      setMobileStripStartDate(expectedStart);
    }
  }, [activeCalendarView, mobileCurrentDate, mobileStripStartDate]);

  const taskStatusIndex = useMemo(
    () => buildTaskStatusIndex(tasksForProjection),
    [tasksForProjection]
  );

  const toServerISO = useCallback((value) => {
    return toServerRangeBoundary(value, timezone);
  }, [timezone]);

  const toCalendarISO = useCallback((isoString) => {
    if (!isoString) return null;
    return dayjs(isoString).utc().toISOString();
  }, []);

  const resolveEventTaskDescription = useCallback((eventLike, cachedTask = null) => {
    const ext = eventLike?.extendedProps || {};
    const isRecurring = !!ext?.isRecurring;
    const taskID = Number(ext?.taskId || cachedTask?.id || 0);
    const occurrenceDate = eventLike?.start
      ? dayjs(eventLike.start).tz(timezone).format('YYYY-MM-DD')
      : '';
    const key = buildOccurrenceInstanceKey(
      taskID,
      ext?.instanceId || eventLike?.id,
      occurrenceDate,
    );
    if (key && Object.prototype.hasOwnProperty.call(instanceDescriptionOverrides, key)) {
      return String(instanceDescriptionOverrides[key] ?? '');
    }
    const eventDescription = typeof ext?.description === 'string' ? ext.description : null;
    if (eventDescription !== null && eventDescription.trim() !== '') {
      return eventDescription;
    }
    return String(cachedTask?.description || '');
  }, [instanceDescriptionOverrides, timezone]);

  // ==================== 新架构：日历数据获取 ====================

  /**
   * 1. 数据获取：使用 TanStack Query 获取数据，自动写入 CacheSet
   */
  const { isLoading: calendarLoading } = useCalendarFetch(
    calendarPool.start,
    calendarPool.end,
    timezone,
    { enabled: !!calendarPool.start && !!calendarPool.end }
  );

  /**
   * 2. 从 CacheSet 获取当前可见范围的事件
   *    这是新的数据获取方式，不再依赖 pooledEvents
   */
  const rawEvents = useEventsForRange(
    dateRange.start,
    dateRange.end,
    timezone
  );


  useEffect(() => {
    if (!dateRange.start || !dateRange.end) return;
    if (isRangeCoveredByPool(dateRange.start, dateRange.end, calendarPool)) return;

    // Expand the pool to cover the new range, never shrink
    setCalendarPool((prevPool) => {
      const expandedPool = expandCalendarPool(prevPool, dateRange.start, dateRange.end);
      console.log('[Pool] Expanding from', prevPool?.start?.substring(0, 10), '-', prevPool?.end?.substring(0, 10), 'to', expandedPool.start.substring(0, 10), '-', expandedPool.end.substring(0, 10));
      return expandedPool;
    });
  }, [dateRange.end, dateRange.start]);

  // ==================== 事件计算（使用新架构） ====================
  // 合并投影任务事件
  const events = useMemo(() => {
    const projectedRangeStart = toServerRangeBoundary(dateRange.start, timezone) || dateRange.start;
    const projectedRangeEnd = toServerRangeBoundary(dateRange.end, timezone) || dateRange.end;

    const projectedVisible = buildProjectedEventsFromTasks(tasksForProjection, {
      rangeStart: projectedRangeStart,
      rangeEnd: projectedRangeEnd,
      timezone,
      toCalendarISO,
    });

    // 将对象转换为数组（rawEvents 是 Record<DateString, Event[]>）
    const rawEventsArray = [];
    if (rawEvents && typeof rawEvents === 'object') {
      // 遍历日期范围，收集所有事件
      let current = dayjs(dateRange.start).tz(timezone).startOf('day');
      const end = dayjs(dateRange.end).tz(timezone).startOf('day');
      while (current.isBefore(end) || current.isSame(end, 'day')) {
        const dayKey = current.format('YYYY-MM-DD');
        const dayEvents = rawEvents[dayKey];
        if (dayEvents && Array.isArray(dayEvents)) {
          rawEventsArray.push(...dayEvents);
        }
        current = current.add(1, 'day');
      }
    }

    const merged = mergeCalendarEvents(rawEventsArray, projectedVisible, taskStatusIndex);
    return merged;
  }, [rawEvents, tasksForProjection, taskStatusIndex, dateRange.start, dateRange.end, timezone, toCalendarISO]);


  useEffect(() => {
    if (events.length > 0) {
      setHasCalendarDataLoaded(true);
      return;
    }
    if (!calendarLoading) {
      setHasCalendarDataLoaded(true);
    }
  }, [events.length, calendarLoading]);

  const handleDatesSet = (dateInfo) => {
    clearTimeout(datesSetTimerRef.current);
    datesSetTimerRef.current = setTimeout(() => {
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
        setMobileStripStartDate(getMobileStripStart(focusedDate, normalizedView));
        pendingFocusDateRef.current = '';
        if (normalizedView !== mobileView) {
          setMobileView(normalizedView);
        }
      }
    }, 100);
  };

  const openCreateRange = useCallback((range) => {
    if (!range?.start) return;
    const start = dayjs(range.start).tz(timezone);
    const end = range.end ? dayjs(range.end).tz(timezone) : start.add(timeGranularity, 'minute');
    const allDay = !!range.allDay;
    setSelectedTask(null);
    setSelectedRange({
      allDay,
      start: start.format(allDay ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm'),
      end: end.format(allDay ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm'),
    });
    setModalOpen(true);
  }, [timeGranularity, timezone]);

  const jumpToMobileDate = (dateValue) => {
    const targetDate = dayjs(dateValue).format('YYYY-MM-DD');
    setMobileCurrentDate(targetDate);
    setCanvasAnchorDate(targetDate);
    setCanvasNudgeDirection(0);
  };

  const handleGoToday = () => {
    const today = dayjs().tz(timezone).format('YYYY-MM-DD');
    setMobileCurrentDate(today);
    setCanvasAnchorDate(today);
    setCanvasNudgeDirection(0);
    setTodayJumpToken((prev) => prev + 1);
    setMobileStripStartDate(getMobileStripStart(today, activeCalendarView));
    stripAnimationRef.current = { phase: 'idle', direction: 0, width: 0 };
    setStripTransitionMs(0);
    setStripTranslateX(0);

  };

  const startStripSlide = (direction) => {
    const width = stripViewportRef.current?.offsetWidth || 0;
    if (width <= 0) return false;
    stripAnimationRef.current = { phase: 'out', direction, width };
    setStripTransitionMs(340);
    setStripTranslateX(direction > 0 ? -width : width);
    return true;
  };

  const handleStripPointerDown = (event) => {
    if (!isCompactMobile || stripAnimationRef.current.phase !== 'idle') return;
    stripDragRef.current = { active: true, startX: event.clientX, deltaX: 0 };
    suppressStripClickRef.current = false;
    setStripTransitionMs(0);
    setStripTranslateX(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleStripPointerMove = (event) => {
    if (!stripDragRef.current.active) return;
    const deltaX = event.clientX - stripDragRef.current.startX;
    stripDragRef.current.deltaX = deltaX;
    if (Math.abs(deltaX) > 6) {
      suppressStripClickRef.current = true;
    }
    setStripTranslateX(deltaX);
  };

  const handleStripPointerEnd = (event) => {
    if (!stripDragRef.current.active) return;
    const deltaX = stripDragRef.current.deltaX;
    stripDragRef.current.active = false;
    stripDragRef.current.deltaX = 0;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const threshold = 30;
    if (Math.abs(deltaX) < threshold) {
      stripAnimationRef.current = { phase: 'rebound', direction: 0, width: 0 };
      setStripTransitionMs(220);
      setStripTranslateX(0);
      setTimeout(() => {
        suppressStripClickRef.current = false;
      }, 0);
      return;
    }

    const direction = deltaX < 0 ? 1 : -1;
    if (!startStripSlide(direction)) {
      stripAnimationRef.current = { phase: 'rebound', direction: 0, width: 0 };
      setStripTransitionMs(220);
      setStripTranslateX(0);
    }

    setTimeout(() => {
      suppressStripClickRef.current = false;
    }, 0);
  };

  const handleStripTransitionEnd = () => {
    const animation = stripAnimationRef.current;
    if (animation.phase === 'out') {
      const nextStart = dayjs(mobileStripStartDate).add(animation.direction * mobileStripStepDays, 'day').format('YYYY-MM-DD');
      const nextCurrent = dayjs(mobileCurrentDate).add(animation.direction * mobileStripStepDays, 'day').format('YYYY-MM-DD');

      pendingFocusDateRef.current = nextCurrent;
      setMobileStripStartDate(nextStart);
      setMobileCurrentDate(nextCurrent);
      setCanvasAnchorDate(nextCurrent);
      setCanvasNudgeDirection(0);

      stripAnimationRef.current = { ...animation, phase: 'in' };
      setStripTransitionMs(0);
      setStripTranslateX(animation.direction > 0 ? animation.width : -animation.width);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setStripTransitionMs(320);
          setStripTranslateX(0);
        });
      });
      return;
    }

    stripAnimationRef.current = { phase: 'idle', direction: 0, width: 0 };
    setStripTransitionMs(0);
    setStripTranslateX(0);
  };

  const handleMobileQuickCreate = () => {
    const baseDate = dayjs(mobileCurrentDate);
    const nowLocal = dayjs().tz(timezone);
    const isToday = mobileCurrentDate === nowLocal.format('YYYY-MM-DD');
    const start = isToday
      ? roundLocalTimeToGranularity(nowLocal, timeGranularity)
      : baseDate.hour(9).minute(0).second(0).millisecond(0);
    const end = start.add(timeGranularity, 'minute');

    setSelectedTask(null);
    setSelectedRange({
      allDay: false,
      start: start.format('YYYY-MM-DDTHH:mm'),
      end: end.format('YYYY-MM-DDTHH:mm'),
    });
    setModalOpen(true);
  };

  const clearTouchDragUIState = useCallback(() => {
    touchDraggingEventRef.current = false;
    const root = calendarRef.current?.elRef?.current;
    if (root) {
      root.classList.remove('is-touch-dragging');
      root.querySelectorAll('.fc-event-selected').forEach((node) => node.classList.remove('fc-event-selected'));
    }
    const activeElement = document.activeElement;
    if (activeElement && typeof activeElement.blur === 'function') {
      activeElement.blur();
    }
  }, []);

  const canvasOffsetRef = useRef({ x: 0, y: 0 });

  const applyDesktopMotion = useCallback((x, y, duration = 0) => {
    const layer = desktopMotionLayerRef.current;
    if (!layer) return;
    layer.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    layer.style.transition = duration > 0
      ? `transform ${duration}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
      : 'none';
  }, []);

  const getCanvasAxis = useCallback(() => (
    activeCalendarView === 'dayGridMonth' ? 'y' : 'x'
  ), [activeCalendarView]);

  const getCanvasStepPx = useCallback(() => {
    const viewport = desktopViewportRef.current;
    if (!viewport) return 80;
    if (activeCalendarView === 'dayGridMonth') {
      const weekRow = viewport.querySelector('.fc-daygrid-body tr');
      const h = weekRow?.getBoundingClientRect?.().height || (viewport.clientHeight / 6);
      return Math.max(16, h || 80);
    }
    if (activeCalendarView === 'timeGridWeek') {
      const dayCol = viewport.querySelector('.fc-timegrid-col');
      const w = dayCol?.getBoundingClientRect?.().width || (viewport.clientWidth / 7);
      return Math.max(20, w || 80);
    }
    if (activeCalendarView === 'timeGridThreeDay') {
      const dayCol = viewport.querySelector('.fc-timegrid-col');
      const w = dayCol?.getBoundingClientRect?.().width || (viewport.clientWidth / 3);
      return Math.max(20, w || 80);
    }
    return Math.max(24, viewport.clientWidth || 80);
  }, [activeCalendarView]);

  const shiftCalendarBySteps = useCallback((steps) => {
    if (!steps) return;
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const direction = steps > 0 ? 1 : -1;
    const amount = Math.abs(steps);
    if (activeCalendarView === 'dayGridMonth') {
      api.incrementDate({ weeks: direction * amount });
      return;
    }
    api.incrementDate({ days: direction * amount });
  }, [activeCalendarView]);

  const applyCanvasDelta = useCallback((deltaPx, axisOverride = '') => {
    const axis = axisOverride || getCanvasAxis();
    const step = getCanvasStepPx();
    if (!Number.isFinite(deltaPx) || Math.abs(deltaPx) < 0.1 || step <= 0) return;

    if (axis === 'x') {
      canvasOffsetRef.current.x += deltaPx;
      let steps = 0;
      while (canvasOffsetRef.current.x <= -step) {
        canvasOffsetRef.current.x += step;
        steps += 1;
      }
      while (canvasOffsetRef.current.x >= step) {
        canvasOffsetRef.current.x -= step;
        steps -= 1;
      }
      if (steps !== 0) {
        shiftCalendarBySteps(steps);
      }
    } else {
      canvasOffsetRef.current.y += deltaPx;
      let steps = 0;
      while (canvasOffsetRef.current.y <= -step) {
        canvasOffsetRef.current.y += step;
        steps += 1;
      }
      while (canvasOffsetRef.current.y >= step) {
        canvasOffsetRef.current.y -= step;
        steps -= 1;
      }
      if (steps !== 0) {
        shiftCalendarBySteps(steps);
      }
    }

    applyDesktopMotion(canvasOffsetRef.current.x, canvasOffsetRef.current.y, 0);
  }, [applyDesktopMotion, getCanvasAxis, getCanvasStepPx, shiftCalendarBySteps]);

  const handleNavigatePeriod = (direction) => {
    if (!direction) return;
    const step = direction > 0 ? 1 : -1;
    const base = dayjs(canvasAnchorDate || dayjs().tz(timezone).format('YYYY-MM-DD'));
    let next = base;
    if (activeCalendarView === 'dayGridMonth') {
      next = base.add(step, 'month');
    } else if (activeCalendarView === 'timeGridWeek') {
      next = base.add(step * 7, 'day');
    } else if (activeCalendarView === 'timeGridThreeDay') {
      next = base.add(step * 3, 'day');
    } else {
      next = base.add(step, 'day');
    }
    const nextDate = next.format('YYYY-MM-DD');
    setCanvasAnchorDate(nextDate);
    setCanvasNudgeDirection(0);
    if (isCompactMobile) {
      setMobileCurrentDate(nextDate);
      setMobileStripStartDate(getMobileStripStart(nextDate, activeCalendarView));
    }
  };

  const isReadOnlyInteractionTarget = useCallback((target) => {
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(
      target.closest('.fc-popover') ||
      target.closest('.modal-content') ||
      target.closest('.fc-event') ||
      target.closest('input,textarea,button,select,a')
    );
  }, []);

  const handleDesktopCalendarWheel = useCallback((event) => {
    if (!event) return;
    if (isReadOnlyInteractionTarget(event.target)) return;
    const axis = getCanvasAxis();
    if (!isCompactMobile && axis === 'x' && !event.shiftKey) return;
    const primaryDelta = axis === 'y'
      ? event.deltaY
      : (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY);
    if (!Number.isFinite(primaryDelta) || Math.abs(primaryDelta) < 0.3) return;
    event.preventDefault();
    event.stopPropagation();
    wheelGestureRef.current.lastAt = Date.now();
    applyCanvasDelta(-primaryDelta, axis);
  }, [applyCanvasDelta, getCanvasAxis, isCompactMobile, isReadOnlyInteractionTarget]);

  const handleDesktopSwipeStart = useCallback((event) => {
    if (!event?.isPrimary) return;
    if (isReadOnlyInteractionTarget(event.target)) return;
    desktopSwipeRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      allow: true,
      axis: getCanvasAxis(),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [getCanvasAxis, isReadOnlyInteractionTarget]);

  const handleDesktopSwipeMove = useCallback((event) => {
    const swipe = desktopSwipeRef.current;
    if (!swipe.active || !swipe.allow) return;
    const dx = event.clientX - swipe.startX;
    const dy = event.clientY - swipe.startY;
    const axis = swipe.axis || 'x';
    if (axis === 'x') {
      if (Math.abs(dx) <= Math.abs(dy) * 0.9) return;
      if (event.cancelable) event.preventDefault();
      applyCanvasDelta(dx - (swipe.lastDX || 0), 'x');
      swipe.lastDX = dx;
    } else {
      if (Math.abs(dy) <= Math.abs(dx) * 0.9) return;
      if (event.cancelable) event.preventDefault();
      applyCanvasDelta(dy - (swipe.lastDY || 0), 'y');
      swipe.lastDY = dy;
    }
    mobileClickSuppressUntilRef.current = Date.now() + 350;
  }, [applyCanvasDelta]);

  const handleDesktopSwipeEnd = useCallback((event) => {
    const swipe = desktopSwipeRef.current;
    if (!swipe.active || !swipe.allow) return;
    desktopSwipeRef.current.active = false;
    swipe.lastDX = 0;
    swipe.lastDY = 0;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleChangeView = (nextView) => {
    canvasOffsetRef.current = { x: 0, y: 0 };
    applyDesktopMotion(0, 0, 0);
    setCanvasNudgeDirection(0);
    if (isCompactMobile) {
      setMobileView(normalizeMobileView(nextView));
    } else {
      setCalendarDefaultView(normalizeCalendarDefaultView(nextView));
    }
  };

  const formatReadonlyEventDateTime = useCallback((value, allDay = false) => {
    if (!value) return '';
    const parsed = dayjs(value).tz(timezone);
    if (!parsed.isValid()) return '';
    if (allDay) return parsed.format('YYYY-MM-DD');
    return parsed.format('YYYY-MM-DD HH:mm');
  }, [timezone]);

  const buildReadonlyEventDetail = useCallback((eventLike) => {
    const ext = eventLike?.extendedProps || {};
    const allDay = !!eventLike?.allDay;
    return {
      title: String(eventLike?.title || ''),
      allDay,
      startText: formatReadonlyEventDateTime(eventLike?.start, allDay),
      endText: formatReadonlyEventDateTime(eventLike?.end, allDay),
      description: String(ext?.description || '').trim(),
      source: String(ext?.source || 'caldav'),
      provider: String(ext?.provider || 'caldav'),
      location: String(ext?.location || '').trim(),
      organizer: String(ext?.organizer || '').trim(),
      attendees: Array.isArray(ext?.attendees) ? ext.attendees.filter(Boolean) : [],
      meetingLink: String(ext?.meetingLink || '').trim(),
      taskId: Number(ext?.taskId || 0),
    };
  }, [formatReadonlyEventDateTime]);

  const openReadonlyEventModal = useCallback((eventLike) => {
    readonlyModalOpenedAtRef.current = Date.now();
    setReadonlyEventDetail(buildReadonlyEventDetail(eventLike));
    setReadonlyEventOpen(true);
  }, [buildReadonlyEventDetail]);

  const closeReadonlyEventModal = useCallback(() => {
    setReadonlyEventOpen(false);
    setReadonlyEventDetail(null);
  }, []);

  const requestCloseReadonlyEventModal = useCallback(() => {
    const state = readonlyModalHistoryRef.current;
    if (typeof window !== 'undefined' && state.hasEntry) {
      state.ignoreNextPop = true;
      state.hasEntry = false;
      window.history.back();
    }
    closeReadonlyEventModal();
  }, [closeReadonlyEventModal]);

  const handleReadonlyBackdropClick = useCallback((event) => {
    if (event.target !== event.currentTarget) return;
    if (Date.now() - readonlyModalOpenedAtRef.current < 280) return;
    requestCloseReadonlyEventModal();
  }, [requestCloseReadonlyEventModal]);

  useEffect(() => {
    if (!readonlyEventOpen || typeof window === 'undefined') return undefined;
    const baseState = window.history.state && typeof window.history.state === 'object'
      ? window.history.state
      : {};
    window.history.pushState({ ...baseState, __todoModal: 'calendar-readonly-event' }, '');
    readonlyModalHistoryRef.current.hasEntry = true;
    readonlyModalHistoryRef.current.ignoreNextPop = false;

    const handlePopState = () => {
      const state = readonlyModalHistoryRef.current;
      if (state.ignoreNextPop) {
        state.ignoreNextPop = false;
        return;
      }
      if (!state.hasEntry) return;
      state.hasEntry = false;
      closeReadonlyEventModal();
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        requestCloseReadonlyEventModal();
      }
    };
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('keydown', handleKeyDown);
      readonlyModalHistoryRef.current.ignoreNextPop = false;
      readonlyModalHistoryRef.current.hasEntry = false;
    };
  }, [closeReadonlyEventModal, readonlyEventOpen, requestCloseReadonlyEventModal]);

  const isHttpLink = useCallback((value) => /^https?:\/\//i.test(String(value || '').trim()), []);

  const handleEventClick = async (info) => {
    if (Date.now() < mobileClickSuppressUntilRef.current) return;
    if (info?.event?.extendedProps?.readOnly) {
      openReadonlyEventModal({
        id: info.event.id,
        title: info.event.title,
        start: info.event.start,
        end: info.event.end,
        allDay: info.event.allDay,
        extendedProps: info.event.extendedProps || {},
      });
      return;
    }
    const taskId = info.event.extendedProps.taskId;
    const instanceId = info.event.extendedProps.instanceId || info.event.id;
    const occurrenceDate = info?.event?.start
      ? dayjs(info.event.start).tz(timezone).format('YYYY-MM-DD')
      : '';
    const occurrenceStart = info?.event?.start
      ? dayjs(info.event.start).toISOString()
      : '';
    const occurrenceEnd = info?.event?.end
      ? dayjs(info.event.end).toISOString()
      : '';
    const cachedTasks = queryClient.getQueryData(queryKeys.tasks.all);
    const cachedTask = Array.isArray(cachedTasks)
      ? cachedTasks.find((task) => task.id === taskId)
      : null;

    if (cachedTask) {
      setSelectedTask({
        ...cachedTask,
        id: taskId,
        description: resolveEventTaskDescription(info.event, cachedTask),
        status: info?.event?.extendedProps?.status || cachedTask.status,
        instanceId,
        occurrenceDate,
        occurrenceStart,
        occurrenceEnd,
      });
      setSelectedRange(null);
      setModalOpen(true);
      return;
    }

    if (!cachedTask) {
      alert(t('calendar.loadTaskFailed'));
    }
  };

  const openTaskFromCalendarEvent = useCallback(async (eventLike) => {
    if (eventLike?.extendedProps?.readOnly) {
      openReadonlyEventModal(eventLike);
      return;
    }
    const taskId = Number(eventLike?.extendedProps?.taskId || 0);
    if (!taskId) return;
    const instanceId = eventLike?.extendedProps?.instanceId || eventLike?.id;
    const occurrenceDate = eventLike?.start
      ? dayjs(eventLike.start).tz(timezone).format('YYYY-MM-DD')
      : '';
    const occurrenceStart = eventLike?.start
      ? dayjs(eventLike.start).toISOString()
      : '';
    const occurrenceEnd = eventLike?.end
      ? dayjs(eventLike.end).toISOString()
      : '';
    const cachedTasks = queryClient.getQueryData(queryKeys.tasks.all);
    const cachedTask = Array.isArray(cachedTasks)
      ? cachedTasks.find((task) => task.id === taskId)
      : null;

    if (cachedTask) {
      setSelectedTask({
        ...cachedTask,
        id: taskId,
        description: resolveEventTaskDescription(eventLike, cachedTask),
        status: eventLike?.extendedProps?.status || cachedTask.status,
        instanceId,
        occurrenceDate,
        occurrenceStart,
        occurrenceEnd,
      });
      setSelectedRange(null);
      setModalOpen(true);
      return;
    }

    if (!cachedTask) {
      alert(t('calendar.loadTaskFailed'));
    }
  }, [openReadonlyEventModal, queryClient, resolveEventTaskDescription, t, timezone]);

  const handleMoreLinkClick = useCallback((info) => {
    const allSegs = Array.isArray(info?.allSegs) ? info.allSegs : [];
    const list = allSegs
      .map((seg) => seg.event)
      .filter(Boolean)
      .map((event) => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        extendedProps: event.extendedProps || {},
      }));

    const dateValue = info?.date ? dayjs(info.date).tz(timezone) : dayjs().tz(timezone);
    setMoreEventsDateLabel(dateValue.format('YYYY-MM-DD'));
    setMoreEvents(list);
    setMoreEventsOpen(true);
    return 'none';
  }, [timezone]);

  const handleCanvasMoreOpen = useCallback((payload) => {
    const list = Array.isArray(payload?.events) ? payload.events : [];
    const dateValue = payload?.date ? dayjs(payload.date).tz(timezone) : dayjs().tz(timezone);
    setMoreEventsDateLabel(dateValue.format('YYYY-MM-DD'));
    setMoreEvents(list.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      extendedProps: event.extendedProps || {},
    })));
    setMoreEventsOpen(true);
  }, [timezone]);

  const handleQuickComplete = async (event) => {
    if (event?.extendedProps?.readOnly) return;
    const taskId = event.extendedProps.taskId;
    const instanceId = event.extendedProps.instanceId || event.id;
    const isRecurring = !!event.extendedProps.isRecurring;
    const currentStatus = event.extendedProps.status || 'pending';
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';

    try {
      const payload = {
        status: nextStatus,
      };
      if (isRecurring) {
        const validInstanceID = /^\d+_\d{8}$/.test(String(instanceId || '').trim());
        if (validInstanceID) {
          payload.instance_id = instanceId;
        }
        if (event?.start) {
          payload.occurrence_date = dayjs(event.start).tz(timezone).format('YYYY-MM-DD');
        }
      }
      await updateTaskStatusLocal(queryClient, taskId, payload);
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const handleEventDrop = async (info) => {
    if (info?.event?.extendedProps?.readOnly) {
      info.revert();
      return;
    }
    const taskId = info.event.extendedProps.taskId;
    const isRecurring = info.event.extendedProps.isRecurring;
    const newStart = toServerISO(info.event.start);
    const newEnd = info.event.end ? toServerISO(info.event.end) : null;

    if (isRecurring) {
      if (!confirm(t('calendar.recurringMoveConfirm'))) {
        info.revert();
        return;
      }
    }

    try {
      await updateTaskScheduleLocal(queryClient, taskId, {
        start_time: newStart,
        end_time: newEnd,
        all_day: info.event.allDay,
      });
    } catch (err) {
      console.error('Failed to update schedule:', err);
      info.revert();
    } finally {
      clearTouchDragUIState();
    }
  };

  const handleEventResize = async (info) => {
    if (info?.event?.extendedProps?.readOnly) {
      info.revert();
      return;
    }
    const taskId = info.event.extendedProps.taskId;
    const isRecurring = info.event.extendedProps.isRecurring;
    const newStart = toServerISO(info.event.start);
    const newEnd = info.event.end ? toServerISO(info.event.end) : null;

    if (isRecurring) {
      if (!confirm(t('calendar.recurringResizeConfirm'))) {
        info.revert();
        return;
      }
    }

    try {
      await updateTaskScheduleLocal(queryClient, taskId, {
        start_time: newStart,
        end_time: newEnd,
        all_day: info.event.allDay,
      });
    } catch (err) {
      console.error('Failed to resize event:', err);
      info.revert();
    } finally {
      clearTouchDragUIState();
    }
  };

  const handleCanvasEventMove = useCallback(async ({ event, start, end, allDay }) => {
    if (!event || event?.extendedProps?.readOnly) return;
    const taskId = Number(event?.extendedProps?.taskId || 0);
    if (!taskId) return;

    try {
      await updateTaskScheduleLocal(queryClient, taskId, {
        start_time: start ? dayjs(start).utc().toISOString() : null,
        end_time: end ? dayjs(end).utc().toISOString() : null,
        all_day: !!allDay,
      });
    } catch (err) {
      console.error('Failed to move canvas event:', err);
    }
  }, [queryClient]);

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedTask(null);
    setSelectedRange(null);
  };

  const handleTaskSaved = (savedTask, saveContext = null) => {
    handleModalClose();
    const hasOccurrenceScope = !!(
      saveContext?.is_occurrence_scoped
      || String(saveContext?.instance_id || '').trim()
      || String(saveContext?.occurrence_date || '').trim()
    );
    if (hasOccurrenceScope) {
      const fallbackTaskID = Number(saveContext?.task_id || savedTask?.id || selectedTask?.id || 0);
      const fallbackOccurrenceDate = String(
        saveContext?.occurrence_date
        || selectedTask?.occurrenceDate
        || selectedTask?.occurrence_date
        || ''
      ).trim();
      const key = buildOccurrenceInstanceKey(
        fallbackTaskID,
        saveContext?.instance_id || selectedTask?.instanceId || selectedTask?.instance_id || '',
        fallbackOccurrenceDate,
      );
      if (key) {
        setInstanceDescriptionOverrides((prev) => ({
          ...prev,
          [key]: String(saveContext?.description || ''),
        }));
      }
    } else if (savedTask?.id) {
      setTasksCache(queryClient, (prev) => {
        const exists = prev.some((task) => Number(task?.id) === Number(savedTask.id));
        if (exists) {
          return prev.map((task) => (Number(task?.id) === Number(savedTask.id) ? savedTask : task));
        }
        return [savedTask, ...prev];
      });
    }
    if (!hasOccurrenceScope) {
      window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['calendar'] });
      }, 250);
    }
  };

  const renderEventContent = (arg) => {
    const completed = arg.event.extendedProps.status === 'completed';
    const readOnly = !!arg.event.extendedProps?.readOnly;
    const isReadonlyExternal = readOnly;
    const isMonthView = activeCalendarView === 'dayGridMonth';
    const hideTimeForView = activeCalendarView === 'timeGridDay' || activeCalendarView === 'timeGridWeek' || activeCalendarView === 'timeGridThreeDay';
    const hasTimeText = Boolean(arg.timeText) && !arg.event.allDay && !hideTimeForView;
    if (isMonthView) {
      const suffix = hasTimeText ? ` ${arg.timeText}` : '';
      return (
        <div className={`min-w-0 py-0.5 ${isCompactMobile ? 'px-0.5 text-[10px]' : 'px-1 text-[11px]'}`} title={arg.event.title}>
          <span className={`block min-w-0 truncate leading-tight ${completed ? 'line-through opacity-80' : ''}`}>
            {arg.event.title}
            {suffix ? <span className="text-slate-500">{suffix}</span> : null}
          </span>
        </div>
      );
    }
    return (
      <div
        className={`flex min-w-0 items-center ${isReadonlyExternal && isCompactMobile ? 'gap-0.5 py-[1px] px-[1px] text-[9px]' : `gap-1 py-0.5 ${isCompactMobile ? 'px-0.5 text-[10px]' : 'px-1 text-[11px]'}`}`}
        title={arg.event.title}
      >
        {hasTimeText && (
          <span className="shrink-0 text-[10px] font-medium text-slate-500">
            {arg.timeText}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <span
            className={`block min-w-0 truncate leading-tight ${completed ? 'line-through opacity-80' : ''}`}
          >
            {arg.event.title}
          </span>
        </div>
      </div>
    );
  };

  const getEventClassNames = useCallback((arg) => {
    const ext = arg?.event?.extendedProps || {};
    const source = String(ext.source || '');
    const readOnly = !!ext.readOnly;
    const list = [];
    if (readOnly || source === 'caldav') {
      list.push('event-readonly');
    }
    return list;
  }, []);

  const handleCanvasRangeChange = useCallback((startISO, endISO, meta = null) => {
    if (meta?.phase && meta.phase !== 'commit') return;
    setDateRange((prev) => {
      if (prev.start === startISO && prev.end === endISO) return prev;
      return { start: startISO, end: endISO };
    });
    const start = dayjs(meta?.displayStart || startISO);
    const end = dayjs(meta?.displayEnd || endISO);
    const mid = start.add(end.diff(start, 'minute') / 2, 'minute');
    let nextTitle = '';
    if (activeCalendarView === 'dayGridMonth') {
      nextTitle = mid.format('YYYY年M月');
    } else if (activeCalendarView === 'timeGridWeek') {
      nextTitle = `${start.format('YYYY/M/D')} - ${end.subtract(1, 'day').format('M/D')}`;
    } else {
      nextTitle = mid.format('YYYY/M/D');
    }
    setCurrentViewTitle((prev) => (prev === nextTitle ? prev : nextTitle));
  }, [activeCalendarView]);

  const handleCanvasCenterDateChange = useCallback((dateValue) => {
    if (!dateValue) return;
    if (!isCompactMobile) return;
    setMobileCurrentDate(dateValue);
    setMobileStripStartDate(getMobileStripStart(dateValue, activeCalendarView));
  }, [activeCalendarView, isCompactMobile]);

  return (
    <div className="calendar-shell md-page relative flex h-full flex-col [&_button:focus]:outline-none [&_button:focus-visible]:outline-none">
      <div className="calendar-topbar sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-3 py-2 md:px-4">
          <div className="inline-flex items-center gap-2">
            <div className={`inline-flex items-center rounded-md border border-[hsl(var(--blue-border))] bg-white shadow-none ${isCompactMobile ? 'h-9' : 'p-0.5'}`}>
              <button
                type="button"
                onClick={() => handleNavigatePeriod(-1)}
                className={`md-icon-btn text-slate-600 hover:bg-white hover:text-blue-900 focus:outline-none focus-visible:outline-none ${
                  isCompactMobile ? 'h-full w-8 text-sm' : 'h-8 w-8'
                }`}
                aria-label="previous period"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={handleGoToday}
                className={`inline-flex items-center rounded-md text-xs font-medium text-slate-700 hover:bg-white hover:text-blue-900 focus:outline-none focus-visible:outline-none ${
                  isCompactMobile ? 'h-full px-3' : 'h-8 px-2.5'
                }`}
              >
                {t('calendar.today')}
              </button>
              <button
                type="button"
                onClick={() => handleNavigatePeriod(1)}
                className={`md-icon-btn text-slate-600 hover:bg-white hover:text-blue-900 focus:outline-none focus-visible:outline-none ${
                  isCompactMobile ? 'h-full w-8 text-sm' : 'h-8 w-8'
                }`}
                aria-label="next period"
              >
                ›
              </button>
            </div>
            <div ref={viewDropdownRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={viewDropdownOpen}
                aria-label="calendar view selector"
                onClick={() => setViewDropdownOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1 rounded-md border border-[hsl(var(--blue-border))] bg-white text-xs font-medium text-slate-800 shadow-none hover:bg-[hsl(var(--soft-blue))] focus:outline-none focus-visible:outline-none ${
                  isCompactMobile ? 'h-9 px-3' : 'h-10 px-3'
                }`}
              >
                <span>{activeViewOption?.label || t('calendar.month')}</span>
                <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 transition-transform ${viewDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 7l5 6 5-6" />
                </svg>
              </button>
              {viewDropdownOpen && (
                <div className="absolute left-0 top-11 z-40 min-w-[7.5rem] overflow-hidden rounded-md border border-[hsl(var(--blue-border))] bg-white py-1 shadow-lg">
                  {viewOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        handleChangeView(option.value);
                        setViewDropdownOpen(false);
                      }}
                      className={`flex w-full items-center px-3 py-2 text-left text-xs font-medium focus:outline-none focus-visible:outline-none ${
                        activeCalendarView === option.value
                          ? 'bg-[hsl(var(--soft-blue-strong))] text-blue-950'
                          : 'text-slate-700 hover:bg-[hsl(var(--soft-blue))] hover:text-blue-950'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`min-w-0 flex-1 px-2 text-center ${isCompactMobile ? 'hidden' : ''}`}>
            <h2 className="truncate text-sm font-semibold tracking-tight text-slate-800 md:text-base">
              {currentViewTitle || t('nav.calendar')}
            </h2>
            {!isCompactMobile && (
              <p className="truncate text-[11px] text-slate-500">
                {t('settings.timezone')}: {timezone === 'Asia/Shanghai' ? t('settings.timezoneCST') : timezone}
              </p>
            )}
          </div>

          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => openSearchDialog()}
              className={`inline-flex items-center justify-center rounded-md border border-[hsl(var(--blue-border))] bg-white text-slate-600 hover:bg-[hsl(var(--soft-blue))] hover:text-blue-900 focus:outline-none focus-visible:outline-none ${
                isCompactMobile ? 'h-9 w-9' : 'h-8 w-8'
              }`}
              title={t('common.search')}
            >
              <IconSearch className="h-4 w-4" />
            </button>
            {!isCompactMobile && (
              <button
                type="button"
                onClick={handleMobileQuickCreate}
                className="btn-primary inline-flex h-8 items-center rounded-lg px-3 py-0 text-xs font-semibold focus:outline-none focus-visible:outline-none"
                title={t('task.newTask')}
              >
                + {t('task.newTask')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={`relative min-h-0 flex-1 ${isCompactMobile ? '' : 'overflow-auto'}`}>
        <div
          ref={desktopViewportRef}
          className="h-full overflow-hidden bg-white"
          style={{ touchAction: 'auto' }}
        >
          <div
            className="h-full"
            ref={desktopMotionLayerRef}
            style={{ willChange: 'transform', transform: 'translate3d(0, 0, 0)' }}
          >
            <InfiniteCalendarCanvas
              view={activeCalendarView}
              timezone={timezone}
              anchorDate={canvasAnchorDate}
              timeGranularity={timeGranularity}
              nudgeDirection={canvasNudgeDirection}
              onNudgeConsumed={() => setCanvasNudgeDirection(0)}
              events={events}
              onRangeChange={handleCanvasRangeChange}
              onCenterDateChange={handleCanvasCenterDateChange}
              onCreateRange={openCreateRange}
              onOpenEvent={(eventLike) => openTaskFromCalendarEvent(eventLike)}
              onOpenMore={handleCanvasMoreOpen}
              onMoveEvent={handleCanvasEventMove}
              todayJumpToken={todayJumpToken}
            />
          </div>
        </div>
      </div>

      {isCompactMobile && (
        <button
          type="button"
          onClick={handleMobileQuickCreate}
          className="btn-primary fixed bottom-20 right-4 z-20 inline-flex h-12 w-12 items-center justify-center rounded-full p-0 text-white shadow-sm"
          title={t('task.newTask')}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5V19" />
            <path d="M5 12H19" />
          </svg>
        </button>
      )}

      {!hasCalendarDataLoaded && calendarLoading && events.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-40">
          <div className="text-lg">{t('common.loading')}</div>
        </div>
      )}

      {modalOpen && (
        <TaskModal
          task={selectedTask}
          initialRange={selectedRange}
          onClose={handleModalClose}
          onSaved={handleTaskSaved}
        />
      )}

      {readonlyEventOpen && readonlyEventDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={handleReadonlyBackdropClick}>
          <div
            className="md-card w-full max-w-lg shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <h3 className="flex min-w-0 items-center gap-1.5 pr-2 text-sm font-semibold text-slate-800">
                <span className="truncate">{readonlyEventDetail.title || 'Untitled event'}</span>
                {readonlyEventDetail.allDay && (
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-500"
                    title="All day"
                    aria-label="All day"
                  >
                    ☀
                  </span>
                )}
              </h3>
              <button
                type="button"
                className="md-icon-btn h-7 w-7"
                onClick={requestCloseReadonlyEventModal}
              >
                ✕
              </button>
            </div>
            <div className="mobile-scrollbar-hidden max-h-[65vh] space-y-1.5 overflow-y-auto px-3 py-2.5 text-sm text-slate-700">
              <div className="grid grid-cols-[58px_1fr] items-start gap-2 px-1 py-0.5 text-xs">
                <span className="font-medium text-slate-500">Source</span>
                <span className="font-medium text-slate-800">{readonlyEventDetail.source || 'caldav'}</span>
              </div>
              <div className="grid grid-cols-[58px_1fr] items-start gap-2 px-1 py-0.5 text-xs">
                <span className="font-medium text-slate-500">Time</span>
                <span className="font-medium text-slate-800">
                  {(readonlyEventDetail.startText || '-') + ' - ' + (readonlyEventDetail.endText || '-')}
                </span>
              </div>
              {readonlyEventDetail.provider === 'feishu' && readonlyEventDetail.location && (
                <div className="grid grid-cols-[58px_1fr] items-start gap-2 px-1 py-0.5 text-xs">
                  <span className="font-medium text-slate-500">Location</span>
                  <p className="break-words text-slate-700">{readonlyEventDetail.location}</p>
                </div>
              )}
              {readonlyEventDetail.provider === 'feishu' && readonlyEventDetail.organizer && (
                <div className="grid grid-cols-[58px_1fr] items-start gap-2 px-1 py-0.5 text-xs">
                  <span className="font-medium text-slate-500">Organizer</span>
                  <p className="break-words text-slate-700">{readonlyEventDetail.organizer}</p>
                </div>
              )}
              {readonlyEventDetail.provider === 'feishu' && readonlyEventDetail.attendees.length > 0 && (
                <div className="grid grid-cols-[58px_1fr] items-start gap-2 px-1 py-0.5 text-xs">
                  <span className="font-medium text-slate-500">Attendees</span>
                  <div className="mobile-scrollbar-hidden max-h-20 space-y-0.5 overflow-y-auto pr-1">
                    {readonlyEventDetail.attendees.map((item) => (
                      <p key={item} className="break-words text-slate-700">{item}</p>
                    ))}
                  </div>
                </div>
              )}
              {readonlyEventDetail.provider === 'feishu' && readonlyEventDetail.meetingLink && isHttpLink(readonlyEventDetail.meetingLink) && (
                <div className="grid grid-cols-[58px_1fr] items-start gap-2 px-1 py-0.5 text-xs">
                  <span className="font-medium text-slate-500">Meeting</span>
                  <a
                    href={readonlyEventDetail.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all text-sky-700 hover:underline"
                  >
                    {readonlyEventDetail.meetingLink}
                  </a>
                </div>
              )}
              {readonlyEventDetail.provider === 'feishu' && readonlyEventDetail.description && (
                <div className="grid grid-cols-[58px_1fr] items-start gap-2 px-1 py-0.5 text-xs">
                  <span className="font-medium text-slate-500">Description</span>
                  <p className="whitespace-pre-wrap break-words text-slate-700">{readonlyEventDetail.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {moreEventsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={handleMoreEventsBackdropClick}>
          <div
            className="md-card w-full max-w-md shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-800">
                {moreEventsDateLabel} · {t('task.taskCount', { count: moreEvents.length })}
              </h3>
              <button
                type="button"
                className="md-icon-btn h-7 w-7"
                onClick={requestCloseMoreEventsModal}
              >
                ✕
              </button>
            </div>
            <div className="mobile-scrollbar-hidden max-h-[65vh] overflow-y-auto p-2">
              {moreEvents.map((event) => {
                if (event.allDay) {
                  return (
                    <button
                      key={event.id}
                      type="button"
                      className="mb-1 block w-full rounded-md border border-[hsl(var(--blue-border))] border-l-2 border-l-[hsl(var(--neutral-blue))] bg-[hsl(var(--soft-blue-strong))] px-2.5 py-1.5 text-left transition-colors hover:bg-[hsl(var(--soft-blue))]"
                      onClick={() => {
                        requestCloseMoreEventsModal();
                        openTaskFromCalendarEvent(event);
                      }}
                      title={event.title}
                    >
                      <div className="truncate text-xs font-medium text-slate-800">{event.title}</div>
                      <div className="text-[11px] text-slate-500">{t('task.allDay') || 'All day'}</div>
                    </button>
                  );
                }
                const startLabel = event.start ? dayjs(event.start).tz(timezone).format('HH:mm') : '--:--';
                const endLabel = event.end ? dayjs(event.end).tz(timezone).format('HH:mm') : '';
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="mb-1 block w-full rounded-md border border-[hsl(var(--blue-border))] border-l-2 border-l-[hsl(var(--neutral-blue))] bg-[hsl(var(--soft-blue-strong))] px-2.5 py-1.5 text-left transition-colors hover:bg-[hsl(var(--soft-blue))]"
                    onClick={() => {
                      requestCloseMoreEventsModal();
                      openTaskFromCalendarEvent(event);
                    }}
                    title={event.title}
                  >
                    <div className="truncate text-xs font-medium text-slate-800">{event.title}</div>
                    <div className="text-[11px] text-slate-500">{endLabel ? `${startLabel} - ${endLabel}` : startLabel}</div>
                  </button>
                );
              })}
              {moreEvents.length === 0 && (
                <div className="px-2 py-6 text-center text-xs text-slate-500">{t('calendar.noEvents')}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CalendarView;
