import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { calendarAPI, tasksAPI } from '../api/client';
import TaskModal from './TaskModal';
import dayjs from 'dayjs';
import { getUserTimeGranularity, getUserTimezone } from '../utils/time';
import { queryKeys } from '../query/keys';
import { IconList, IconSearch } from './icons/TaskIcons';

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

function CalendarView() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const calendarRef = useRef(null);
  const stripViewportRef = useRef(null);
  const mobileViewMenuRef = useRef(null);
  const stripDragRef = useRef({ active: false, startX: 0, deltaX: 0 });
  const stripAnimationRef = useRef({ phase: 'idle', direction: 0, width: 0 });
  const suppressStripClickRef = useRef(false);
  const pendingFocusDateRef = useRef('');

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [moreEventsOpen, setMoreEventsOpen] = useState(false);
  const [moreEventsDateLabel, setMoreEventsDateLabel] = useState('');
  const [moreEvents, setMoreEvents] = useState([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [calendarDefaultView, setCalendarDefaultView] = useState(readCalendarDefaultView);
  const [isCompactMobile, setIsCompactMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [mobileView, setMobileView] = useState('timeGridDay');
  const [mobileViewMenuOpen, setMobileViewMenuOpen] = useState(false);
  const [mobileCurrentDate, setMobileCurrentDate] = useState(() => dayjs().tz(getUserTimezone()).format('YYYY-MM-DD'));
  const [mobileStripStartDate, setMobileStripStartDate] = useState(() => getWeekStripStart(dayjs().tz(getUserTimezone())));
  const [stripTranslateX, setStripTranslateX] = useState(0);
  const [stripTransitionMs, setStripTransitionMs] = useState(0);
  const [calendarNow, setCalendarNow] = useState(() => dayjs().tz(getUserTimezone()).format('YYYY-MM-DDTHH:mm:ss[Z]'));

  const timezone = getUserTimezone();
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

  const activeCalendarView = isCompactMobile ? normalizeMobileView(mobileView) : calendarDefaultView;
  const mobileWeekdayShort = i18n.language === 'zh-CN' ? ZH_WEEKDAY_SHORT : EN_WEEKDAY_SHORT;

  const mobileViewOptions = useMemo(
    () => [
      { value: 'timeGridDay', label: t('calendar.day') },
      { value: 'timeGridThreeDay', label: i18n.language === 'zh-CN' ? '三日' : '3-day' },
      { value: 'dayGridMonth', label: t('calendar.month') },
    ],
    [i18n.language, t]
  );

  const currentMobileViewLabel = useMemo(
    () => mobileViewOptions.find((item) => item.value === mobileView)?.label || t('calendar.day'),
    [mobileView, mobileViewOptions, t]
  );

  const mobileMonthTitle = useMemo(() => {
    const value = dayjs(mobileCurrentDate);
    if (i18n.language === 'zh-CN') return value.format('YYYY年M月');
    return value.format('MMMM YYYY');
  }, [i18n.language, mobileCurrentDate]);

  const mobileDateStrip = useMemo(() => {
    const start = dayjs(mobileStripStartDate);
    return Array.from({ length: 7 }, (_, index) => start.add(index, 'day'));
  }, [mobileStripStartDate]);

  const todayDateString = useMemo(() => dayjs().tz(timezone).format('YYYY-MM-DD'), [timezone]);

  useEffect(() => {
    const syncCalendarDefaultView = () => {
      setCalendarDefaultView(readCalendarDefaultView());
    };
    window.addEventListener('user:profile-updated', syncCalendarDefaultView);
    window.addEventListener('storage', syncCalendarDefaultView);
    return () => {
      window.removeEventListener('user:profile-updated', syncCalendarDefaultView);
      window.removeEventListener('storage', syncCalendarDefaultView);
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

  useEffect(() => {
    if (!mobileViewMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!mobileViewMenuRef.current) return;
      if (!mobileViewMenuRef.current.contains(event.target)) {
        setMobileViewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [mobileViewMenuOpen]);

  useEffect(() => {
    if (!moreEventsOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMoreEventsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [moreEventsOpen]);

  useEffect(() => {
    const expectedStart = getWeekStripStart(mobileCurrentDate);
    if (expectedStart !== mobileStripStartDate && stripAnimationRef.current.phase === 'idle') {
      setMobileStripStartDate(expectedStart);
    }
  }, [mobileCurrentDate, mobileStripStartDate]);

  const currentCalendarQueryKey = useMemo(
    () => queryKeys.calendar.events(dateRange.start || '', dateRange.end || '', timezone),
    [dateRange.end, dateRange.start, timezone]
  );

  const toServerISO = useCallback((value) => {
    if (!value) return null;

    if (timezone === 'UTC') {
      return dayjs(value).utc().toISOString();
    }

    return dayjs.utc(value).tz(timezone, true).utc().toISOString();
  }, [timezone]);

  const toCalendarISO = useCallback((isoString) => {
    if (!isoString) return null;

    if (timezone === 'UTC') {
      return dayjs(isoString).utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
    }

    return dayjs(isoString).tz(timezone).format('YYYY-MM-DDTHH:mm:ss[Z]');
  }, [timezone]);

  const {
    data: events = [],
    isFetching: loading,
  } = useQuery({
    queryKey: currentCalendarQueryKey,
    enabled: Boolean(dateRange.start && dateRange.end),
    queryFn: async () => {
      const res = await calendarAPI.getEvents({
        start: toServerISO(dateRange.start),
        end: toServerISO(dateRange.end),
      });
      const list = Array.isArray(res.data) ? res.data : [];
      const mapped = list.map((event) => ({
        ...event,
        start: toCalendarISO(event.start),
        end: event.end ? toCalendarISO(event.end) : undefined,
      }));
      return annotateOverlapCount(mapped, Math.max(15, timeGranularity));
    },
  });

  const handleDatesSet = (dateInfo) => {
    setDateRange({
      start: dayjs(dateInfo.start).toISOString(),
      end: dayjs(dateInfo.end).toISOString(),
    });

    if (isCompactMobile) {
      const focusedDate = pendingFocusDateRef.current
        ? dayjs(pendingFocusDateRef.current).format('YYYY-MM-DD')
        : dayjs(calendarRef.current?.getApi()?.getDate() || dateInfo.start).format('YYYY-MM-DD');
      setMobileCurrentDate(focusedDate);
      pendingFocusDateRef.current = '';
      const normalizedView = normalizeMobileView(dateInfo.view.type);
      if (normalizedView !== mobileView) {
        setMobileView(normalizedView);
      }
    }
  };

  const handleDateClick = (info) => {
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

  const handleMobileViewChange = (nextView) => {
    const normalized = normalizeMobileView(nextView);
    setMobileViewMenuOpen(false);
    setMobileView(normalized);
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.changeView(normalized);
    api.gotoDate(mobileCurrentDate);
  };

  const handleGoToday = () => {
    const today = dayjs().tz(timezone).format('YYYY-MM-DD');
    pendingFocusDateRef.current = today;
    setMobileCurrentDate(today);
    setMobileStripStartDate(getWeekStripStart(today));
    setMobileViewMenuOpen(false);
    stripAnimationRef.current = { phase: 'idle', direction: 0, width: 0 };
    setStripTransitionMs(0);
    setStripTranslateX(0);

    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.changeView(mobileView);
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
      const nextStart = dayjs(mobileStripStartDate).add(animation.direction * 7, 'day').format('YYYY-MM-DD');
      const nextCurrent = dayjs(mobileCurrentDate).add(animation.direction * 7, 'day').format('YYYY-MM-DD');

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

  const handleEventClick = async (info) => {
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
    }

    try {
      const res = await tasksAPI.get(taskId);
      const taskData = res.data;
      setSelectedTask({
        id: taskId,
        instanceId,
        ...taskData,
      });
      setSelectedRange(null);
      setModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch task:', err);
      if (!cachedTask) {
        alert(t('calendar.loadTaskFailed'));
      }
    }
  };

  const openTaskFromCalendarEvent = useCallback(async (eventLike) => {
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
    }

    try {
      const res = await tasksAPI.get(taskId);
      const taskData = res.data;
      setSelectedTask({
        id: taskId,
        instanceId,
        ...taskData,
      });
      setSelectedRange(null);
      setModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch task:', err);
      if (!cachedTask) {
        alert(t('calendar.loadTaskFailed'));
      }
    }
  }, [queryClient, t]);

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
    const taskId = event.extendedProps.taskId;
    const instanceId = event.extendedProps.instanceId || event.id;
    const currentStatus = event.extendedProps.status || 'pending';
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const previousEvents = queryClient.getQueryData(currentCalendarQueryKey);
    queryClient.setQueryData(currentCalendarQueryKey, (prev) => {
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
      await tasksAPI.updateStatus(taskId, {
        status: nextStatus,
        instance_id: instanceId,
      });
    } catch (err) {
      queryClient.setQueryData(currentCalendarQueryKey, previousEvents);
      console.error('Failed to update task status:', err);
    } finally {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: currentCalendarQueryKey });
    }
  };

  const handleEventDrop = async (info) => {
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
    const optimisticStart = dayjs(info.event.start).utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
    const optimisticEnd = info.event.end ? dayjs(info.event.end).utc().format('YYYY-MM-DDTHH:mm:ss[Z]') : undefined;
    queryClient.setQueryData(currentCalendarQueryKey, (prev) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((item) => (item.id === info.event.id ? { ...item, start: optimisticStart, end: optimisticEnd } : item));
    });

    try {
      await tasksAPI.updateSchedule(taskId, {
        start_time: newStart,
        end_time: newEnd,
        all_day: info.event.allDay,
      });
    } catch (err) {
      queryClient.setQueryData(currentCalendarQueryKey, previousEvents);
      console.error('Failed to update schedule:', err);
      info.revert();
    } finally {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: currentCalendarQueryKey });
    }
  };

  const handleEventResize = async (info) => {
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
    const optimisticStart = dayjs(info.event.start).utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
    const optimisticEnd = info.event.end ? dayjs(info.event.end).utc().format('YYYY-MM-DDTHH:mm:ss[Z]') : undefined;
    queryClient.setQueryData(currentCalendarQueryKey, (prev) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((item) => (item.id === info.event.id ? { ...item, start: optimisticStart, end: optimisticEnd } : item));
    });

    try {
      await tasksAPI.updateSchedule(taskId, {
        start_time: newStart,
        end_time: newEnd,
        all_day: info.event.allDay,
      });
    } catch (err) {
      queryClient.setQueryData(currentCalendarQueryKey, previousEvents);
      console.error('Failed to resize event:', err);
      info.revert();
    } finally {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: currentCalendarQueryKey });
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
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    queryClient.invalidateQueries({ queryKey: currentCalendarQueryKey });
  };

  const renderEventContent = (arg) => {
    const completed = arg.event.extendedProps.status === 'completed';
    return (
      <div
        className={`flex min-w-0 items-center gap-1 py-0.5 ${isCompactMobile ? 'px-0.5 text-[10px]' : 'px-1 text-[11px]'}`}
        title={arg.event.title}
      >
        <button
          type="button"
          className={`shrink-0 leading-none ${isCompactMobile ? 'text-[10px]' : 'text-[11px]'} ${
            completed ? 'text-green-700' : 'text-gray-700'
          }`}
          title={completed ? t('task.markPending') : t('task.markComplete')}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleQuickComplete(arg.event);
          }}
        >
          {completed ? '✓' : '○'}
        </button>
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

  return (
    <div className="relative h-full flex flex-col bg-slate-100">
      {!isCompactMobile && (
        <div className="hidden border-b border-gray-200 bg-white p-4 md:block">
          <h2 className="text-xl font-semibold">{t('nav.calendar')}</h2>
          <p className="text-sm text-gray-500">
            {t('settings.timezone')}: {timezone === 'Asia/Shanghai' ? t('settings.timezoneCST') : timezone}
          </p>
        </div>
      )}

      {isCompactMobile && (
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between px-3 py-2">
            <h2 className="text-xl font-semibold text-slate-800">{mobileMonthTitle}</h2>
            <div className="relative flex items-center gap-1" ref={mobileViewMenuRef}>
              <button
                type="button"
                onClick={() => navigate('/tasks?view=search')}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                title={t('common.search')}
              >
                <IconSearch className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleGoToday}
                className="inline-flex items-center rounded-full border border-blue-600 bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                title={t('calendar.today')}
              >
                {t('calendar.today')}
              </button>
              <button
                type="button"
                onClick={() => setMobileViewMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
                title={t('settings.calendarDefaultView')}
              >
                <IconList className="h-4 w-4" />
                <span>{currentMobileViewLabel}</span>
              </button>
              {mobileViewMenuOpen && (
                <div className="absolute right-0 top-10 z-30 w-28 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  {mobileViewOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleMobileViewChange(option.value)}
                      className={`block w-full rounded-md px-2 py-1.5 text-left text-xs ${
                        mobileView === option.value
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="px-2 pb-2">
            <div
              ref={stripViewportRef}
              className="overflow-hidden rounded-xl"
              onPointerDown={handleStripPointerDown}
              onPointerMove={handleStripPointerMove}
              onPointerUp={handleStripPointerEnd}
              onPointerCancel={handleStripPointerEnd}
            >
              <div
                className="grid w-full grid-cols-7 gap-1"
                style={{
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
        </div>
      )}

      <div className={`relative min-h-0 flex-1 ${isCompactMobile ? 'px-1 pt-1 pb-16' : 'overflow-auto p-4'}`}>
        <div className="h-full overflow-hidden border border-slate-200 bg-white">
          <FullCalendar
            key={`${activeCalendarView}-${timezone}-${calendarLocale}-${isCompactMobile ? 'mobile' : 'desktop'}`}
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={activeCalendarView}
            initialDate={initialDate}
            locale={calendarLocale}
            timeZone="UTC"
            headerToolbar={
              isCompactMobile
                ? false
                : {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay',
                  }
            }
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
            dayMaxEvents={true}
            dayMaxEventRows={true}
            fixedWeekCount={false}
            weekends={true}
            events={events}
            eventContent={renderEventContent}
            dateClick={handleDateClick}
            select={handleSelect}
            eventClick={handleEventClick}
            moreLinkClick={handleMoreLinkClick}
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

      {moreEventsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setMoreEventsOpen(false)}>
          <div className="w-full max-w-md border border-slate-200 bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-800">
                {moreEventsDateLabel} · {t('task.taskCount', { count: moreEvents.length })}
              </h3>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-slate-100"
                onClick={() => setMoreEventsOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-2">
              {moreEvents.map((event) => {
                // Calendar events are already normalized to calendar timezone/UTC presentation.
                // Avoid converting timezone again, otherwise labels shift by offset.
                const startLabel = event.start ? dayjs(event.start).utc().format('HH:mm') : '--:--';
                const endLabel = event.end ? dayjs(event.end).utc().format('HH:mm') : '';
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="mb-1 block w-full border border-slate-200 px-2 py-1.5 text-left hover:bg-slate-50"
                    onClick={() => {
                      setMoreEventsOpen(false);
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
