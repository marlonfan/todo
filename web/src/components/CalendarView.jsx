import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { calendarAPI } from '../api/client';
import TaskModal from './TaskModal';
import dayjs from 'dayjs';
import { getUserTimeGranularity, getUserTimezone } from '../utils/time';
import { toServerRangeBoundary } from '../utils/syncTime';
import { queryKeys } from '../query/keys';
import { IconSearch } from './icons/TaskIcons';
import { buildCalendarRangeKey, getCalendarRange, getMeta, listCalendarRanges, putCalendarRange, setMeta } from '../data/localStore';
import { updateTaskScheduleLocal, updateTaskStatusLocal } from '../data/taskMutations';
import { useTasksQuery } from '../query/hooks';
import { buildProjectedEventsFromTasks, buildTaskStatusIndex, mergeCalendarEvents } from './calendarEventMerge';
import { openSearchDialog } from '../state/searchOverlay';

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
  return 'timeGridDay';
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
  const prefetchPastDays = 14;
  const prefetchFutureDays = 45;
  return {
    start: safeStart.subtract(prefetchPastDays, 'day').startOf('day').toISOString(),
    end: safeEnd.add(prefetchFutureDays, 'day').endOf('day').toISOString(),
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

function buildCalendarSnapshotMetaKey(timezone) {
  return `calendar_last_success_snapshot:${timezone || 'UTC'}`;
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

const CALENDAR_CACHE_SCHEMA_VERSION = 2;
const CALENDAR_CACHE_REFRESH_MS = 10 * 60 * 1000;
const CALENDAR_AUTO_REVALIDATE_MS = 2 * 60 * 1000;

function isCurrentCalendarCache(entry) {
  return Number(entry?.cache_version || 0) === CALENDAR_CACHE_SCHEMA_VERSION;
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
  const calendarFetchInFlightRef = useRef(new Map());
  const wheelGestureRef = useRef({ sumX: 0, sumY: 0, lastAt: 0 });
  const wheelNavLockUntilRef = useRef(0);
  const desktopSwipeRef = useRef({ active: false, startX: 0, startY: 0, allow: false });
  const mobileContentSwipeRef = useRef({ active: false, startX: 0, startY: 0, lastX: 0, lastY: 0, allow: false, pointerId: null, lockedAxis: '' });
  const mobileNavAnimatingRef = useRef(false);
  const mobileClickSuppressUntilRef = useRef(0);
  const desktopViewportRef = useRef(null);
  const desktopNavAnimatingRef = useRef(false);
  const desktopMotionLayerRef = useRef(null);
  const desktopMoveRafRef = useRef(0);
  const readonlyModalHistoryRef = useRef({ hasEntry: false, ignoreNextPop: false });
  const moreEventsModalHistoryRef = useRef({ hasEntry: false, ignoreNextPop: false });
  const lastCalendarRevalidateAtRef = useRef(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [moreEventsOpen, setMoreEventsOpen] = useState(false);
  const [moreEventsDateLabel, setMoreEventsDateLabel] = useState('');
  const [moreEvents, setMoreEvents] = useState([]);
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
      { value: 'timeGridDay', label: t('calendar.day') },
      { value: 'timeGridThreeDay', label: i18n.language === 'zh-CN' ? '三日' : '3-day' },
      { value: 'dayGridMonth', label: t('calendar.month') },
    ],
    [i18n.language, t]
  );
  const viewOptions = isCompactMobile ? mobileViewOptions : desktopViewOptions;

  const mobileDateStrip = useMemo(() => {
    const start = dayjs(mobileStripStartDate);
    return Array.from({ length: mobileStripDays }, (_, index) => start.add(index, 'day'));
  }, [mobileStripDays, mobileStripStartDate]);

  const todayDateString = useMemo(() => dayjs().tz(timezone).format('YYYY-MM-DD'), [timezone]);

  useEffect(() => {
    const syncCalendarPrefs = () => {
      setCalendarDefaultView(readCalendarDefaultView());
      setTimezone(getUserTimezone());
      setCalendarPool({ start: '', end: '' });
    };
    window.addEventListener('user:profile-updated', syncCalendarPrefs);
    window.addEventListener('storage', syncCalendarPrefs);
    return () => {
      window.removeEventListener('user:profile-updated', syncCalendarPrefs);
      window.removeEventListener('storage', syncCalendarPrefs);
    };
  }, []);

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
    const expectedStart = getMobileStripStart(mobileCurrentDate, activeCalendarView);
    if (expectedStart !== mobileStripStartDate && stripAnimationRef.current.phase === 'idle') {
      setMobileStripStartDate(expectedStart);
    }
  }, [activeCalendarView, mobileCurrentDate, mobileStripStartDate]);

  const currentCalendarQueryKey = useMemo(
    () => queryKeys.calendar.events(calendarPool.start || '', calendarPool.end || '', timezone),
    [calendarPool.end, calendarPool.start, timezone]
  );
  const taskStatusIndex = useMemo(
    () => buildTaskStatusIndex(tasksForProjection),
    [tasksForProjection]
  );

  const toServerISO = useCallback((value) => {
    return toServerRangeBoundary(value, timezone);
  }, [timezone]);

  const toCalendarISO = useCallback((isoString) => {
    if (!isoString) return null;

    if (timezone === 'UTC') {
      return dayjs(isoString).utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
    }

    return dayjs(isoString).tz(timezone).format('YYYY-MM-DDTHH:mm:ss[Z]');
  }, [timezone]);

  const fetchCalendarRangeFromServer = useCallback(async (rangeStart, rangeEnd, options = {}) => {
    if (!rangeStart || !rangeEnd) return [];
    const requestKey = `${timezone}|${rangeStart}|${rangeEnd}`;
    const existing = calendarFetchInFlightRef.current.get(requestKey);
    if (existing) {
      const deduped = await existing;
      if (options.updateQuery) {
        queryClient.setQueryData(queryKeys.calendar.events(rangeStart, rangeEnd, timezone), deduped);
      }
      return deduped;
    }

    const fetchPromise = (async () => {
      const res = await calendarAPI.getEvents({
        start: toServerISO(rangeStart),
        end: toServerISO(rangeEnd),
      });
      const list = Array.isArray(res.data) ? res.data : [];
      const mapped = list
        .map((event) => ({
          ...event,
          start: toCalendarISO(event.start),
          end: event.end ? toCalendarISO(event.end) : undefined,
        }))
        .filter((event) => (event?.extendedProps?.status || 'pending') !== 'cancelled');
      const projected = buildProjectedEventsFromTasks(tasksForProjection, {
        rangeStart,
        rangeEnd,
        timezone,
        toCalendarISO,
      });
      const merged = mergeCalendarEvents(mapped, projected, taskStatusIndex);
      const annotated = annotateOverlapCount(merged, Math.max(15, timeGranularity));
      const cacheKey = buildCalendarRangeKey(rangeStart, rangeEnd, timezone);

      await putCalendarRange({
        key: cacheKey,
        start: rangeStart,
        end: rangeEnd,
        timezone,
        events: merged,
        cache_version: CALENDAR_CACHE_SCHEMA_VERSION,
        updated_at: Date.now(),
      });
      await setMeta(buildCalendarSnapshotMetaKey(timezone), {
        start: rangeStart,
        end: rangeEnd,
        timezone,
        events: merged,
        cache_version: CALENDAR_CACHE_SCHEMA_VERSION,
        updated_at: Date.now(),
      });

      emitCalendarTrace({
        source: 'server_merge',
        range_start: rangeStart,
        range_end: rangeEnd,
        projected_count: projected.length,
        event_count: annotated.length,
      });

      return annotated;
    })();

    calendarFetchInFlightRef.current.set(requestKey, fetchPromise);
    try {
      const annotated = await fetchPromise;
      if (options.updateQuery) {
        queryClient.setQueryData(queryKeys.calendar.events(rangeStart, rangeEnd, timezone), annotated);
      }
      return annotated;
    } finally {
      calendarFetchInFlightRef.current.delete(requestKey);
    }
  }, [queryClient, taskStatusIndex, tasksForProjection, timeGranularity, timezone, toCalendarISO, toServerISO]);

  const {
    data: pooledEvents = [],
    isFetching: loading,
  } = useQuery({
    queryKey: currentCalendarQueryKey,
    enabled: Boolean(calendarPool.start && calendarPool.end),
    staleTime: 60 * 1000,
    placeholderData: (previousData) => previousData ?? [],
    queryFn: async () => {
      const projectedRangeStart = toServerISO(calendarPool.start) || calendarPool.start;
      const projectedRangeEnd = toServerISO(calendarPool.end) || calendarPool.end;
      const projected = buildProjectedEventsFromTasks(tasksForProjection, {
        rangeStart: projectedRangeStart,
        rangeEnd: projectedRangeEnd,
        timezone,
        toCalendarISO,
      });
      const cacheKey = buildCalendarRangeKey(calendarPool.start, calendarPool.end, timezone);
      const cached = await getCalendarRange(cacheKey);
      if (cached?.events && Array.isArray(cached.events) && isCurrentCalendarCache(cached)) {
        const age = Date.now() - Number(cached.updated_at || 0);
        if (age > CALENDAR_CACHE_REFRESH_MS) {
          fetchCalendarRangeFromServer(calendarPool.start, calendarPool.end, { updateQuery: true }).catch((err) => {
            console.error('Failed to refresh stale calendar cache:', err);
          });
        }
        const merged = mergeCalendarEvents(cached.events, projected, taskStatusIndex);
        return annotateOverlapCount(merged, Math.max(15, timeGranularity));
      }

      // Fallback to any cached range that fully covers requested window.
      const rangeEntries = await listCalendarRanges();
      const covering = (Array.isArray(rangeEntries) ? rangeEntries : [])
        .filter((entry) => isCurrentCalendarCache(entry))
        .filter((entry) => entry?.timezone === timezone)
        .filter((entry) => isRangeCoveredByPool(calendarPool.start, calendarPool.end, entry))
        .sort((a, b) => Number(b?.updated_at || 0) - Number(a?.updated_at || 0));
      const fallback = covering[0];
      if (fallback?.events && Array.isArray(fallback.events)) {
        const age = Date.now() - Number(fallback.updated_at || 0);
        if (age > CALENDAR_CACHE_REFRESH_MS) {
          fetchCalendarRangeFromServer(calendarPool.start, calendarPool.end, { updateQuery: true }).catch((err) => {
            console.error('Failed to refresh stale fallback calendar cache:', err);
          });
        }
        const clippedFallback = filterEventsForRange(
          fallback.events,
          calendarPool.start,
          calendarPool.end,
          Math.max(15, timeGranularity)
        );
        const merged = mergeCalendarEvents(clippedFallback, projected, taskStatusIndex);
        return annotateOverlapCount(merged, Math.max(15, timeGranularity));
      }

      try {
        return await fetchCalendarRangeFromServer(calendarPool.start, calendarPool.end);
      } catch (error) {
        const snapshot = await getMeta(buildCalendarSnapshotMetaKey(timezone), null);
        const snapshotEvents = isCurrentCalendarCache(snapshot) && Array.isArray(snapshot?.events) ? snapshot.events : [];
        if (snapshotEvents.length > 0) {
          const merged = mergeCalendarEvents(snapshotEvents, projected, taskStatusIndex);
          emitCalendarTrace({
            source: 'snapshot_fallback',
            range_start: calendarPool.start,
            range_end: calendarPool.end,
            projected_count: projected.length,
            event_count: merged.length,
          });
          return annotateOverlapCount(merged, Math.max(15, timeGranularity));
        }
        throw error;
      }
    },
  });

  const revalidateVisibleCalendar = useCallback((reason = 'interval') => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (!calendarPool.start || !calendarPool.end) return;
    const now = Date.now();
    if (now - lastCalendarRevalidateAtRef.current < 25 * 1000) return;
    lastCalendarRevalidateAtRef.current = now;
    fetchCalendarRangeFromServer(calendarPool.start, calendarPool.end, { updateQuery: true }).catch((error) => {
      console.error(`Failed to revalidate calendar (${reason}):`, error);
    });
  }, [calendarPool.end, calendarPool.start, fetchCalendarRangeFromServer]);

  useEffect(() => {
    if (!calendarPool.start || !calendarPool.end) return undefined;
    if (typeof window === 'undefined') return undefined;
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      revalidateVisibleCalendar('visibility');
    };
    const onFocus = () => {
      revalidateVisibleCalendar('focus');
    };
    const timer = window.setInterval(() => {
      revalidateVisibleCalendar('interval');
    }, CALENDAR_AUTO_REVALIDATE_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [calendarPool.end, calendarPool.start, revalidateVisibleCalendar]);

  useEffect(() => {
    if (!calendarPool.start || !calendarPool.end) return;
    const projectedRangeStart = toServerISO(calendarPool.start) || calendarPool.start;
    const projectedRangeEnd = toServerISO(calendarPool.end) || calendarPool.end;
    const projected = buildProjectedEventsFromTasks(tasksForProjection, {
      rangeStart: projectedRangeStart,
      rangeEnd: projectedRangeEnd,
      timezone,
      toCalendarISO,
    });
    if (!projected.length) return;

    queryClient.setQueryData(currentCalendarQueryKey, (prev) => {
      const merged = mergeCalendarEvents(prev, projected, taskStatusIndex);
      return annotateOverlapCount(merged, Math.max(15, timeGranularity));
    });
    emitCalendarTrace({
      source: 'tasks_projection',
      range_start: calendarPool.start,
      range_end: calendarPool.end,
      projected_count: projected.length,
    });
  }, [
    calendarPool.end,
    calendarPool.start,
    currentCalendarQueryKey,
    queryClient,
    tasksForProjection,
    taskStatusIndex,
    timeGranularity,
    timezone,
    toCalendarISO,
    toServerISO,
  ]);

  const updateCurrentCalendarEvents = useCallback((updater) => {
    let nextEventsSnapshot = null;
    queryClient.setQueryData(currentCalendarQueryKey, (prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const next = typeof updater === 'function' ? updater(base) : updater;
      nextEventsSnapshot = Array.isArray(next) ? next : base;
      return nextEventsSnapshot;
    });

    if (!calendarPool.start || !calendarPool.end || !Array.isArray(nextEventsSnapshot)) return;
    const cacheKey = buildCalendarRangeKey(calendarPool.start, calendarPool.end, timezone);
    putCalendarRange({
      key: cacheKey,
      start: calendarPool.start,
      end: calendarPool.end,
      timezone,
      events: nextEventsSnapshot,
      cache_version: CALENDAR_CACHE_SCHEMA_VERSION,
      updated_at: Date.now(),
    }).catch((error) => {
      console.error('Failed to persist calendar range cache:', error);
    });
  }, [calendarPool.end, calendarPool.start, currentCalendarQueryKey, queryClient, timezone]);

  useEffect(() => {
    if (!dateRange.start || !dateRange.end) return;
    if (isRangeCoveredByPool(dateRange.start, dateRange.end, calendarPool)) return;
    setCalendarPool(buildCalendarPoolRange(dateRange.start, dateRange.end));
  }, [calendarPool, dateRange.end, dateRange.start]);

  const events = useMemo(() => {
    const clipped = filterEventsForRange(
      pooledEvents,
      dateRange.start,
      dateRange.end,
      Math.max(15, timeGranularity)
    );
    return annotateOverlapCount(clipped, Math.max(15, timeGranularity));
  }, [dateRange.end, dateRange.start, pooledEvents, timeGranularity]);

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
      setMobileStripStartDate(getMobileStripStart(focusedDate, normalizedView));
      pendingFocusDateRef.current = '';
      if (normalizedView !== mobileView) {
        setMobileView(normalizedView);
      }
    }
  };

  const handleDateClick = (info) => {
    if (Date.now() < mobileClickSuppressUntilRef.current) return;
    const start = dayjs(info.date).utc();
    const end = info.allDay ? start.endOf('day') : start.add(timeGranularity, 'minute');

    setSelectedTask(null);
    setSelectedRange({
      allDay: !!info.allDay,
      start: start.format(info.allDay ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm'),
      end: end ? end.format(info.allDay ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm') : '',
    });
    setModalOpen(true);
  };

  const handleSelect = (info) => {
    if (Date.now() < mobileClickSuppressUntilRef.current) return;
    const start = dayjs(info.start).utc();
    let end = dayjs(info.end).utc();

    if (info.allDay) {
      end = end.subtract(1, 'day');
    }

    setSelectedTask(null);
    setSelectedRange({
      allDay: !!info.allDay,
      start: start.format(info.allDay ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm'),
      end: end.format(info.allDay ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm'),
    });
    setModalOpen(true);
  };

  const jumpToMobileDate = (dateValue) => {
    const targetDate = dayjs(dateValue).format('YYYY-MM-DD');
    pendingFocusDateRef.current = targetDate;
    setMobileCurrentDate(targetDate);
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.changeView(mobileView);
    api.gotoDate(targetDate);
  };

  const handleGoToday = () => {
    const today = dayjs().tz(timezone).format('YYYY-MM-DD');
    pendingFocusDateRef.current = today;
    setMobileCurrentDate(today);
    setMobileStripStartDate(getMobileStripStart(today, activeCalendarView));
    stripAnimationRef.current = { phase: 'idle', direction: 0, width: 0 };
    setStripTransitionMs(0);
    setStripTranslateX(0);

    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.changeView(isCompactMobile ? mobileView : calendarDefaultView);
    api.gotoDate(today);
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

      const api = calendarRef.current?.getApi();
      if (api) {
        api.gotoDate(nextCurrent);
      }

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

  const applyDesktopMotion = useCallback((x, y, duration = 0) => {
    const layer = desktopMotionLayerRef.current;
    if (!layer) return;
    layer.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    layer.style.transition = duration > 0
      ? `transform ${duration}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
      : 'none';
  }, []);

  const setDesktopAnimatingClass = useCallback((active) => {
    const viewport = desktopViewportRef.current;
    if (!viewport) return;
    viewport.classList.toggle('calendar-animating', Boolean(active));
  }, []);

  const runDesktopNavigateAnimation = useCallback((direction, axis = 'x') => {
    if (isCompactMobile) return false;
    if (desktopNavAnimatingRef.current) return false;
    const api = calendarRef.current?.getApi();
    if (!api) return false;

    const width = desktopViewportRef.current?.clientWidth || 0;
    const height = desktopViewportRef.current?.clientHeight || 0;
    // Keep previous frame visible to avoid "white flash" during navigation.
    const baseDistance = Math.max(96, axis === 'y' ? height : width);
    const distance = Math.round(baseDistance * 0.22);
    const outOffset = direction > 0 ? -distance : distance;

    desktopNavAnimatingRef.current = true;
    setDesktopAnimatingClass(true);
    applyDesktopMotion(axis === 'x' ? outOffset : 0, axis === 'y' ? outOffset : 0, 180);

    window.setTimeout(() => {
      if (direction > 0) api.next();
      else api.prev();

      const inOffset = -outOffset;
      applyDesktopMotion(axis === 'x' ? inOffset : 0, axis === 'y' ? inOffset : 0, 0);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applyDesktopMotion(0, 0, 220);
          window.setTimeout(() => {
            desktopNavAnimatingRef.current = false;
            setDesktopAnimatingClass(false);
          }, 280);
        });
      });
    }, 180);

    return true;
  }, [applyDesktopMotion, isCompactMobile, setDesktopAnimatingClass]);

  const runMobileNavigateAnimation = useCallback((direction) => {
    if (!isCompactMobile) return false;
    if (mobileNavAnimatingRef.current) return false;
    const api = calendarRef.current?.getApi();
    if (!api) return false;

    const width = desktopViewportRef.current?.clientWidth || 0;
    const distance = Math.round(Math.max(64, width * 0.12));
    const outOffset = direction > 0 ? -distance : distance;

    mobileNavAnimatingRef.current = true;
    setDesktopAnimatingClass(true);
    applyDesktopMotion(outOffset, 0, 140);

    window.setTimeout(() => {
      if (direction > 0) api.next();
      else api.prev();
      applyDesktopMotion(-outOffset, 0, 0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applyDesktopMotion(0, 0, 180);
          window.setTimeout(() => {
            mobileNavAnimatingRef.current = false;
            setDesktopAnimatingClass(false);
          }, 220);
        });
      });
    }, 140);

    return true;
  }, [applyDesktopMotion, isCompactMobile, setDesktopAnimatingClass]);

  const handleNavigatePeriod = (direction) => {
    if (isCompactMobile) {
      const api = calendarRef.current?.getApi();
      if (!api) return;
      if (direction < 0) api.prev();
      else api.next();
      return;
    }
    const axis = activeCalendarView === 'dayGridMonth' ? 'y' : 'x';
    runDesktopNavigateAnimation(direction > 0 ? 1 : -1, axis);
  };

  const isReadOnlyInteractionTarget = useCallback((target) => {
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(
      target.closest('.fc-popover') ||
      target.closest('.modal-content')
    );
  }, []);

  const handleDesktopCalendarWheel = useCallback((event) => {
    if (isCompactMobile) return;
    if (!event) return;
    if (desktopNavAnimatingRef.current) return;

    const now = Date.now();
    if (now < wheelNavLockUntilRef.current) return;

    const gesture = wheelGestureRef.current;
    if (now - gesture.lastAt > 220) {
      gesture.sumX = 0;
      gesture.sumY = 0;
    }
    gesture.lastAt = now;
    gesture.sumX += event.deltaX;
    gesture.sumY += event.deltaY;

    const isMonthView = activeCalendarView === 'dayGridMonth';
    const threshold = 70;
    let direction = 0;

    if (isMonthView) {
      if (Math.abs(gesture.sumY) >= threshold && Math.abs(gesture.sumY) >= Math.abs(gesture.sumX) * 0.8) {
        direction = gesture.sumY > 0 ? 1 : -1;
      }
    } else {
      const horizontalDominant = Math.abs(gesture.sumX) >= Math.max(threshold, Math.abs(gesture.sumY) * 1.1);
      const shiftVertical = event.shiftKey && Math.abs(gesture.sumY) >= threshold;
      if (horizontalDominant) {
        direction = gesture.sumX > 0 ? 1 : -1;
      } else if (shiftVertical) {
        direction = gesture.sumY > 0 ? 1 : -1;
      }
    }

    if (!direction) return;

    event.preventDefault();
    event.stopPropagation();
    gesture.sumX = 0;
    gesture.sumY = 0;
    wheelNavLockUntilRef.current = now + (isMonthView ? 430 : 320);
    runDesktopNavigateAnimation(direction, isMonthView ? 'y' : 'x');
  }, [activeCalendarView, isCompactMobile, runDesktopNavigateAnimation]);

  const handleDesktopSwipeStart = useCallback((event) => {
    if (isCompactMobile) return;
    if (!event?.isPrimary) return;
    if (activeCalendarView === 'dayGridMonth') return;
    if (isReadOnlyInteractionTarget(event.target)) return;
    if (desktopNavAnimatingRef.current) return;
    desktopSwipeRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      allow: true,
    };
  }, [activeCalendarView, isCompactMobile]);

  const handleDesktopSwipeMove = useCallback((event) => {
    const swipe = desktopSwipeRef.current;
    if (!swipe.active || !swipe.allow) return;
    const dx = event.clientX - swipe.startX;
    const dy = event.clientY - swipe.startY;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      event.preventDefault();
      if (desktopMoveRafRef.current) return;
      desktopMoveRafRef.current = requestAnimationFrame(() => {
        desktopMoveRafRef.current = 0;
        applyDesktopMotion(dx * 0.92, 0, 0);
      });
    }
  }, [applyDesktopMotion]);

  const handleDesktopSwipeEnd = useCallback((event) => {
    const swipe = desktopSwipeRef.current;
    if (!swipe.active || !swipe.allow) return;
    desktopSwipeRef.current.active = false;

    const dx = event.clientX - swipe.startX;
    const dy = event.clientY - swipe.startY;
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.15;
    if (!horizontal || Math.abs(dx) < 64) {
      applyDesktopMotion(0, 0, 220);
      return;
    }
    runDesktopNavigateAnimation(dx < 0 ? 1 : -1, 'x');
  }, [applyDesktopMotion, runDesktopNavigateAnimation]);

  useEffect(() => {
    if (!isCompactMobile) return undefined;
    const root = desktopViewportRef.current;
    if (!root) return undefined;
    const state = mobileContentSwipeRef.current;

    const onTouchStart = (event) => {
      if (activeCalendarView === 'dayGridMonth') return;
      const touch = event.touches?.[0];
      if (!touch) return;
      if (isReadOnlyInteractionTarget(event.target)) return;
      state.active = true;
      state.startX = touch.clientX;
      state.startY = touch.clientY;
      state.lastX = touch.clientX;
      state.lastY = touch.clientY;
      state.allow = true;
      state.pointerId = null;
      state.lockedAxis = '';
    };

    const onTouchMove = (event) => {
      if (!state.active || !state.allow) return;
      const touch = event.touches?.[0];
      if (!touch) return;
      state.lastX = touch.clientX;
      state.lastY = touch.clientY;
      const dx = touch.clientX - state.startX;
      const dy = touch.clientY - state.startY;
      if (!state.lockedAxis) {
        if (Math.abs(dx) >= 8 || Math.abs(dy) >= 8) {
          state.lockedAxis = Math.abs(dx) > Math.abs(dy) * 1.05 ? 'x' : 'y';
        }
      }
      if (state.lockedAxis === 'x') {
        mobileClickSuppressUntilRef.current = Date.now() + 450;
        applyDesktopMotion(dx * 0.42, 0, 0);
      }
      if (state.lockedAxis === 'x' && event.cancelable) {
        event.preventDefault();
      }
    };

    const onTouchEndLike = (event) => {
      if (!state.active || !state.allow) return;
      state.active = false;
      const touch = event.changedTouches?.[0];
      const endX = touch?.clientX ?? state.lastX;
      const endY = touch?.clientY ?? state.lastY;
      const dx = endX - state.startX;
      const dy = endY - state.startY;
      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.15;
      if (!horizontal || Math.abs(dx) < 36) {
        applyDesktopMotion(0, 0, 160);
        return;
      }
      mobileClickSuppressUntilRef.current = Date.now() + 500;
      runMobileNavigateAnimation(dx < 0 ? 1 : -1);
    };

    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    root.addEventListener('touchend', onTouchEndLike, { passive: true });
    root.addEventListener('touchcancel', onTouchEndLike, { passive: true });
    return () => {
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
      root.removeEventListener('touchend', onTouchEndLike);
      root.removeEventListener('touchcancel', onTouchEndLike);
    };
  }, [activeCalendarView, applyDesktopMotion, isCompactMobile, isReadOnlyInteractionTarget, runMobileNavigateAnimation]);

  const handleChangeView = (nextView) => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.changeView(nextView);
    if (isCompactMobile) {
      setMobileView(normalizeMobileView(nextView));
    } else {
      setCalendarDefaultView(normalizeCalendarDefaultView(nextView));
    }
  };

  const formatReadonlyEventDateTime = useCallback((value, allDay = false) => {
    if (!value) return '';
    const parsed = dayjs(value);
    if (!parsed.isValid()) return '';
    if (allDay) return parsed.utc().format('YYYY-MM-DD');
    return parsed.utc().format('YYYY-MM-DD HH:mm');
  }, []);

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
    const instanceId = info.event.id;
    const cachedTasks = queryClient.getQueryData(queryKeys.tasks.all);
    const cachedTask = Array.isArray(cachedTasks)
      ? cachedTasks.find((task) => task.id === taskId)
      : null;

    if (cachedTask) {
      setSelectedTask({
        ...cachedTask,
        id: taskId,
        instanceId,
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
    const instanceId = eventLike?.id;
    const cachedTasks = queryClient.getQueryData(queryKeys.tasks.all);
    const cachedTask = Array.isArray(cachedTasks)
      ? cachedTasks.find((task) => task.id === taskId)
      : null;

    if (cachedTask) {
      setSelectedTask({
        ...cachedTask,
        id: taskId,
        instanceId,
      });
      setSelectedRange(null);
      setModalOpen(true);
      return;
    }

    if (!cachedTask) {
      alert(t('calendar.loadTaskFailed'));
    }
  }, [openReadonlyEventModal, queryClient, t]);

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

  const handleQuickComplete = async (event) => {
    if (event?.extendedProps?.readOnly) return;
    const taskId = event.extendedProps.taskId;
    const instanceId = event.extendedProps.instanceId || event.id;
    const isRecurring = !!event.extendedProps.isRecurring;
    const currentStatus = event.extendedProps.status || 'pending';
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const previousEvents = queryClient.getQueryData(currentCalendarQueryKey);
    updateCurrentCalendarEvents((prev) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((item) => {
        if (item.id !== event.id) return item;
        return {
          ...item,
          extendedProps: {
            ...item.extendedProps,
            status: nextStatus,
          },
        };
      });
    });

    try {
      const payload = {
        status: nextStatus,
      };
      if (isRecurring) {
        payload.instance_id = instanceId;
      }
      await updateTaskStatusLocal(queryClient, taskId, payload);
    } catch (err) {
      updateCurrentCalendarEvents(previousEvents);
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

    const previousEvents = queryClient.getQueryData(currentCalendarQueryKey);
    const optimisticStart = dayjs(info.event.start).utc().toISOString();
    const optimisticEnd = info.event.end ? dayjs(info.event.end).utc().toISOString() : undefined;
    updateCurrentCalendarEvents((prev) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((item) => (item.id === info.event.id ? { ...item, start: optimisticStart, end: optimisticEnd } : item));
    });

    try {
      await updateTaskScheduleLocal(queryClient, taskId, {
        start_time: newStart,
        end_time: newEnd,
        all_day: info.event.allDay,
      });
    } catch (err) {
      updateCurrentCalendarEvents(previousEvents);
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

    const previousEvents = queryClient.getQueryData(currentCalendarQueryKey);
    const optimisticStart = dayjs(info.event.start).utc().toISOString();
    const optimisticEnd = info.event.end ? dayjs(info.event.end).utc().toISOString() : undefined;
    updateCurrentCalendarEvents((prev) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((item) => (item.id === info.event.id ? { ...item, start: optimisticStart, end: optimisticEnd } : item));
    });

    try {
      await updateTaskScheduleLocal(queryClient, taskId, {
        start_time: newStart,
        end_time: newEnd,
        all_day: info.event.allDay,
      });
    } catch (err) {
      updateCurrentCalendarEvents(previousEvents);
      console.error('Failed to resize event:', err);
      info.revert();
    } finally {
      clearTouchDragUIState();
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedTask(null);
    setSelectedRange(null);
  };

  const handleTaskSaved = (savedTask) => {
    handleModalClose();
    if (savedTask?.id) {
      queryClient.setQueryData(queryKeys.tasks.all, (prev) => {
        const base = Array.isArray(prev) ? prev : [];
        const exists = base.some((task) => task.id === savedTask.id);
        if (exists) {
          return base.map((task) => (task.id === savedTask.id ? savedTask : task));
        }
        return [savedTask, ...base];
      });
    }
    if (calendarPool.start && calendarPool.end) {
      fetchCalendarRangeFromServer(calendarPool.start, calendarPool.end, { updateQuery: true }).catch((error) => {
        console.error('Failed to refresh calendar after save:', error);
      });
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
    if (readOnly) {
      list.push('event-readonly');
    }
    return list;
  }, []);

  return (
    <div className="calendar-shell relative h-full flex flex-col bg-slate-100">
      <div className="calendar-topbar sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-3 py-2 md:px-4">
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => handleNavigatePeriod(-1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="previous period"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={handleGoToday}
              className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              {t('calendar.today')}
            </button>
            <button
              type="button"
              onClick={() => handleNavigatePeriod(1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="next period"
            >
              ›
            </button>
          </div>

          <div className="min-w-0 flex-1 px-2 text-center">
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              title={t('common.search')}
            >
              <IconSearch className="h-4 w-4" />
            </button>
            {!isCompactMobile && (
              <button
                type="button"
                onClick={handleMobileQuickCreate}
                className="inline-flex h-8 items-center rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
                title={t('task.newTask')}
              >
                + {t('task.newTask')}
              </button>
            )}
          </div>
        </div>

        <div className="px-3 pb-2 md:px-4">
          <div className="inline-flex w-full items-center rounded-xl border border-slate-200 bg-white p-1">
            {viewOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleChangeView(option.value)}
                className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  activeCalendarView === option.value
                    ? 'bg-slate-200 text-slate-800'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isCompactMobile && activeCalendarView !== 'dayGridMonth' && (
        <div className="border-b border-slate-200 bg-white/90 px-2 pt-1.5 pb-2 backdrop-blur">
            <div
              ref={stripViewportRef}
              className="overflow-hidden rounded-xl"
              onPointerDown={handleStripPointerDown}
              onPointerMove={handleStripPointerMove}
              onPointerUp={handleStripPointerEnd}
              onPointerCancel={handleStripPointerEnd}
            >
              <div
                className="grid w-full gap-1"
                style={{
                  gridTemplateColumns: `repeat(${mobileStripDays}, minmax(0, 1fr))`,
                  transform: `translate3d(${stripTranslateX}px, 0, 0)`,
                  transition: stripTransitionMs > 0
                    ? `transform ${stripTransitionMs}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
                    : 'none',
                  touchAction: 'pan-y',
                }}
                onTransitionEnd={handleStripTransitionEnd}
              >
                {mobileDateStrip.map((dateValue) => {
                  const dateKey = dateValue.format('YYYY-MM-DD');
                  const active = dateKey === mobileCurrentDate;
                  const isToday = dateKey === todayDateString;
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={(event) => {
                        if (suppressStripClickRef.current) {
                          event.preventDefault();
                          return;
                        }
                        jumpToMobileDate(dateKey);
                      }}
                      className={`flex w-full flex-col items-center rounded-xl px-1 py-1.5 text-xs transition ${
                        active
                          ? 'bg-blue-600 text-white shadow-sm'
                          : isToday
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-[10px] leading-4">{mobileWeekdayShort[dateValue.day()]}</span>
                      <span className="text-sm font-semibold leading-4">{dateValue.format('D')}</span>
                    </button>
                  );
                })}
              </div>
            </div>
        </div>
      )}

      <div className={`relative min-h-0 flex-1 ${isCompactMobile ? 'px-1 pt-1 pb-8' : 'overflow-auto p-3 md:p-4'}`}>
        <div
          ref={desktopViewportRef}
          className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_-28px_rgba(15,23,42,0.55)]"
          onWheel={handleDesktopCalendarWheel}
          onPointerDown={handleDesktopSwipeStart}
          onPointerMove={handleDesktopSwipeMove}
          onPointerUp={handleDesktopSwipeEnd}
          onPointerCancel={handleDesktopSwipeEnd}
          onPointerLeave={handleDesktopSwipeEnd}
          style={{ touchAction: isCompactMobile ? 'auto' : (activeCalendarView === 'dayGridMonth' ? 'pan-y' : 'pan-x pan-y') }}
        >
          <div
            className="h-full"
            ref={desktopMotionLayerRef}
            style={{ willChange: 'transform', transform: 'translate3d(0, 0, 0)' }}
          >
            <FullCalendar
              key={`${activeCalendarView}-${timezone}-${calendarLocale}-${isCompactMobile ? 'mobile' : 'desktop'}`}
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={activeCalendarView}
              initialDate={initialDate}
              locale={calendarLocale}
              timeZone="UTC"
              headerToolbar={false}
              views={{
                timeGridThreeDay: {
                  type: 'timeGrid',
                  duration: { days: 3 },
                },
              }}
              buttonText={{
                today: t('calendar.today'),
                month: t('calendar.month'),
                week: t('calendar.week'),
                day: t('calendar.day'),
              }}
              editable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={activeCalendarView === 'dayGridMonth'}
              dayMaxEventRows={activeCalendarView === 'dayGridMonth'}
              eventMaxStack={activeCalendarView === 'dayGridMonth' ? undefined : 99}
              fixedWeekCount={false}
              weekends={true}
              events={events}
              eventContent={renderEventContent}
              eventClassNames={getEventClassNames}
              dateClick={handleDateClick}
              select={handleSelect}
              eventClick={handleEventClick}
              moreLinkClick={handleMoreLinkClick}
              eventDragStart={(info) => {
                const nativeEvent = info?.jsEvent;
                const pointerType = nativeEvent?.pointerType || '';
                const coarsePointer = typeof window !== 'undefined' &&
                  window.matchMedia &&
                  window.matchMedia('(hover: none) and (pointer: coarse)').matches;
                const isTouch = pointerType === 'touch' || coarsePointer;
                if (!isTouch) return;
                touchDraggingEventRef.current = true;
                const root = calendarRef.current?.elRef?.current;
                if (root) {
                  root.classList.add('is-touch-dragging');
                }
              }}
              eventDragStop={() => {
                clearTouchDragUIState();
              }}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              datesSet={handleDatesSet}
              height="100%"
              nowIndicator={true}
              now={calendarNow}
              scrollTime={initialScrollTime}
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }}
              slotDuration={slotDuration}
              snapDuration={slotDuration}
              displayEventEnd={true}
              slotEventOverlap={true}
              className={`todo-calendar ${isCompactMobile ? 'mobile-calendar' : 'desktop-calendar'}`}
            />
          </div>
        </div>
      </div>

      {isCompactMobile && (
        <button
          type="button"
          onClick={handleMobileQuickCreate}
          className="fixed bottom-20 right-4 z-20 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg"
          title={t('task.newTask')}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5V19" />
            <path d="M5 12H19" />
          </svg>
        </button>
      )}

      {loading && events.length === 0 && (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={requestCloseReadonlyEventModal}>
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
              <h3 className="flex min-w-0 items-center gap-1.5 pr-2 text-sm font-semibold text-slate-800">
                <span className="truncate">{readonlyEventDetail.title || 'Untitled event'}</span>
                {readonlyEventDetail.allDay && (
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-50 text-[10px] text-blue-700"
                    title="All day"
                    aria-label="All day"
                  >
                    ☀
                  </span>
                )}
              </h3>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                onClick={requestCloseReadonlyEventModal}
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5 px-3 py-2.5 text-sm text-slate-700">
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
                  <div className="max-h-20 space-y-0.5 overflow-y-auto pr-1">
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
                    className="block break-all text-blue-700 hover:underline"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={requestCloseMoreEventsModal}>
          <div
            className="w-full max-w-md border border-slate-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-800">
                {moreEventsDateLabel} · {t('task.taskCount', { count: moreEvents.length })}
              </h3>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-slate-100"
                onClick={requestCloseMoreEventsModal}
              >
                ✕
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-2">
              {moreEvents.map((event) => {
                if (event.allDay) {
                  return (
                    <button
                      key={event.id}
                      type="button"
                      className="mb-1 block w-full border border-slate-200 px-2 py-1.5 text-left hover:bg-slate-50"
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
                const startLabel = event.start ? dayjs(event.start).utc().format('HH:mm') : '--:--';
                const endLabel = event.end ? dayjs(event.end).utc().format('HH:mm') : '';
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="mb-1 block w-full border border-slate-200 px-2 py-1.5 text-left hover:bg-slate-50"
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
