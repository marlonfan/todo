import React, { useState, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useTranslation } from 'react-i18next';
import { calendarAPI, tasksAPI } from '../api/client';
import TaskModal from './TaskModal';
import dayjs from 'dayjs';
import { getUserTimeGranularity, getUserTimezone } from '../utils/time';

function CalendarView() {
  const { t, i18n } = useTranslation();
  const calendarRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const timezone = getUserTimezone();
  const timeGranularity = getUserTimeGranularity();
  const calendarLocale = i18n.language === 'zh-CN' ? 'zh-cn' : 'en';
  const slotDuration = timeGranularity === 60 ? '01:00:00' : `00:${String(timeGranularity).padStart(2, '0')}:00`;

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

  const fetchEvents = useCallback(async (start, end) => {
    setLoading(true);
    try {
      const res = await calendarAPI.getEvents({
        start: toServerISO(start),
        end: toServerISO(end),
      });
      setEvents((res.data || []).map((event) => ({
        ...event,
        start: toCalendarISO(event.start),
        end: event.end ? toCalendarISO(event.end) : undefined,
      })));
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, [toCalendarISO, toServerISO]);

  const handleDatesSet = (dateInfo) => {
    const start = dayjs(dateInfo.start);
    const end = dayjs(dateInfo.end);
    setDateRange({ start, end });
    fetchEvents(start, end);
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
    
    try {
      const res = await tasksAPI.get(taskId);
      const taskData = res.data;
      
      setSelectedTask({
        id: taskId,
        instanceId: info.event.id,
        ...taskData,
      });
      setSelectedRange(null);
      setModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch task:', err);
      alert(t('calendar.loadTaskFailed'));
    }
  };

  const handleQuickComplete = async (event) => {
    const taskId = event.extendedProps.taskId;
    const instanceId = event.extendedProps.instanceId || event.id;
    const currentStatus = event.extendedProps.status || 'pending';
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';

    try {
      await tasksAPI.updateStatus(taskId, {
        status: nextStatus,
        instance_id: instanceId,
      });
      if (dateRange.start && dateRange.end) {
        fetchEvents(dateRange.start, dateRange.end);
      }
    } catch (err) {
      console.error('Failed to update task status:', err);
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

    try {
      await tasksAPI.updateSchedule(taskId, {
        start_time: newStart,
        end_time: newEnd,
        all_day: info.event.allDay,
      });
    } catch (err) {
      console.error('Failed to update schedule:', err);
      info.revert();
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

    try {
      await tasksAPI.updateSchedule(taskId, {
        start_time: newStart,
        end_time: newEnd,
        all_day: info.event.allDay,
      });
    } catch (err) {
      console.error('Failed to resize event:', err);
      info.revert();
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedTask(null);
    setSelectedRange(null);
  };

  const handleTaskSaved = () => {
    handleModalClose();
    if (dateRange.start && dateRange.end) {
      fetchEvents(dateRange.start, dateRange.end);
    }
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
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-xl font-semibold">{t('nav.calendar')}</h2>
        <p className="text-sm text-gray-500">
          {t('settings.timezone')}: {timezone === 'Asia/Shanghai' ? t('settings.timezoneCST') : timezone}
        </p>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
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

      {loading && (
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
