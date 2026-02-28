import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { calendarAPI, tasksAPI } from '../api/client';
import TaskModal from './TaskModal';
import dayjs from 'dayjs';
import { getUserTimeGranularity, getUserTimezone } from '../utils/time';
import { queryKeys } from '../query/keys';

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

function CalendarView() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const calendarRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [calendarDefaultView, setCalendarDefaultView] = useState(readCalendarDefaultView);
  const timezone = getUserTimezone();
  const timeGranularity = getUserTimeGranularity();
  const calendarLocale = i18n.language === 'zh-CN' ? 'zh-cn' : 'en';
  const slotDuration = timeGranularity === 60 ? '01:00:00' : `00:${String(timeGranularity).padStart(2, '0')}:00`;
  const initialDate = useMemo(() => dayjs().tz(timezone).format('YYYY-MM-DD'), [timezone]);
  const initialScrollTime = useMemo(() => {
    const now = dayjs().tz(timezone);
    const centeredHour = Math.max(0, now.hour() - 2);
    const roundedMinute = Math.floor(now.minute() / timeGranularity) * timeGranularity;
    return `${String(centeredHour).padStart(2, '0')}:${String(roundedMinute).padStart(2, '0')}:00`;
  }, [timeGranularity, timezone]);

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

  const currentCalendarQueryKey = useMemo(
    () => queryKeys.calendar.events(dateRange.start || '', dateRange.end || '', timezone),
    [dateRange.end, dateRange.start, timezone]
  );

  const toServerISO = useCallback((value) => {
    if (!value) return null;

    if (timezone === 'UTC') {
      return dayjs(value).utc().toISOString();
    }

    // The calendar runs in UTC with "pinned" wall-clock values.
    // Parse as UTC first, then reinterpret that wall-clock in user's timezone.
    return dayjs.utc(value).tz(timezone, true).utc().toISOString();
  }, [timezone]);

  const toCalendarISO = useCallback((isoString) => {
    if (!isoString) return null;

    if (timezone === 'UTC') {
      return dayjs(isoString).utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
    }

    // Convert server UTC -> user's wall clock time, then pin to UTC calendar for consistent rendering.
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
      return list.map((event) => ({
        ...event,
        start: toCalendarISO(event.start),
        end: event.end ? toCalendarISO(event.end) : undefined,
      }));
    },
  });

  const handleDatesSet = (dateInfo) => {
    setDateRange({
      start: dayjs(dateInfo.start).toISOString(),
      end: dayjs(dateInfo.end).toISOString(),
    });
  };

  const handleDateClick = (info) => {
    const start = dayjs(info.date).utc();
    let end = null;
    if (info.allDay) {
      end = start.endOf('day');
    } else {
      end = start.add(timeGranularity, 'minute');
    }

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
      // FullCalendar all-day selection is [start, end), so convert to inclusive end date for form.
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

    // Fix 5: 重复任务拖拽提示
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

    // Fix 5: 重复任务缩放提示
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
    const timeText = arg.timeText ? `${arg.timeText} ` : '';
    return (
      <div className="flex min-w-0 items-center gap-1 px-1">
        <button
          type="button"
          className={`shrink-0 text-xs leading-none ${completed ? 'text-green-700' : 'text-gray-700'}`}
          title={completed ? t('task.markPending') : t('task.markComplete')}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleQuickComplete(arg.event);
          }}
        >
          {completed ? '✓' : '○'}
        </button>
        <span className={`min-w-0 flex-1 truncate ${completed ? 'line-through opacity-80' : ''}`}>
          {timeText}
          {arg.event.title}
        </span>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="hidden border-b border-gray-200 bg-white p-4 md:block">
        <h2 className="text-xl font-semibold">{t('nav.calendar')}</h2>
        <p className="text-sm text-gray-500">
          {t('settings.timezone')}: {timezone === 'Asia/Shanghai' ? t('settings.timezoneCST') : timezone}
        </p>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <FullCalendar
          key={`${calendarDefaultView}-${timezone}-${calendarLocale}`}
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={calendarDefaultView}
          initialDate={initialDate}
          locale={calendarLocale}
          timeZone="UTC"
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
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          events={events}
          eventContent={renderEventContent}
          dateClick={handleDateClick}
          select={handleSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          datesSet={handleDatesSet}
          height="100%"
          nowIndicator={true}
          scrollTime={initialScrollTime}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }}
          slotDuration={slotDuration}
          snapDuration={slotDuration}
          displayEventEnd={true}
        />
      </div>

      {loading && events.length === 0 && (
        <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-40">
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
    </div>
  );
}

export default CalendarView;
