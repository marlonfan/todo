import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

function isTaskInRange(task, rangeStartISO, rangeEndISO) {
  if (!task || !rangeStartISO || !rangeEndISO) return false;
  const rangeStart = dayjs(rangeStartISO);
  const rangeEnd = dayjs(rangeEndISO);
  if (!rangeStart.isValid() || !rangeEnd.isValid()) return false;

  const startCandidate = task.start_time || task.startTime || task.due_date || task.dueDate;
  if (!startCandidate) return false;
  const taskStart = dayjs(startCandidate);
  if (!taskStart.isValid()) return false;

  const endCandidate = task.end_time || task.endTime;
  const taskEndRaw = endCandidate ? dayjs(endCandidate) : taskStart;
  const taskEnd = taskEndRaw.isValid() && taskEndRaw.isAfter(taskStart)
    ? taskEndRaw
    : taskStart.add(30, 'minute');

  return taskStart.isBefore(rangeEnd) && taskEnd.isAfter(rangeStart);
}

export function buildProjectedEventsFromTasks(tasks, options) {
  const {
    rangeStart,
    rangeEnd,
    timezone,
    toCalendarISO,
  } = options;
  const list = Array.isArray(tasks) ? tasks : [];

  return list
    .filter((task) => (task?.status || 'pending') !== 'cancelled')
    .filter((task) => !(task?.read_only || String(task?.source || '') === 'caldav'))
    .filter((task) => isTaskInRange(task, rangeStart, rangeEnd))
    .map((task) => {
      const rawStart = task.start_time || task.startTime || task.due_date || task.dueDate;
      const rawEnd = task.end_time || task.endTime || null;
      const allDay = !!(task.all_day || task.allDay);

      const start = rawStart ? toCalendarISO(rawStart) : null;
      const end = rawEnd ? toCalendarISO(rawEnd) : undefined;

      return {
        id: `task-${task.id}`,
        title: task.title || '',
        start: start || dayjs().tz(timezone).format('YYYY-MM-DDTHH:mm:ss[Z]'),
        end,
        allDay,
        editable: !task.read_only,
        extendedProps: {
          taskId: Number(task.id),
          status: task.status || 'pending',
          priority: Number.parseInt(task.priority, 10) || 0,
          isRecurring: false,
          syncState: task.sync_state || 'synced',
          readOnly: !!task.read_only,
          source: task.source || 'local_projection',
          externalId: task.external_ref || '',
        },
      };
    });
}

export function buildTaskStatusIndex(tasks) {
  const source = Array.isArray(tasks) ? tasks : [];
  const cancelled = new Set();
  const present = new Set();
  source.forEach((task) => {
    const taskID = Number(task?.id || 0);
    if (!taskID) return;
    present.add(taskID);
    if ((task.status || 'pending') === 'cancelled') {
      cancelled.add(taskID);
    }
  });
  return { cancelled, present };
}

export function mergeCalendarEvents(serverEvents, projectedEvents, taskStatusIndex = { cancelled: new Set(), present: null }) {
  const base = Array.isArray(serverEvents) ? serverEvents : [];
  const projected = Array.isArray(projectedEvents) ? projectedEvents : [];
  const projectedByTaskID = new Map();
  const consumedTaskIDs = new Set();
  const merged = [];

  projected.forEach((event) => {
    const taskID = Number(event?.extendedProps?.taskId || 0);
    if (!taskID) return;
    projectedByTaskID.set(taskID, event);
  });

  base.forEach((event) => {
    const taskID = Number(event?.extendedProps?.taskId || 0);
    const serverStatus = event?.extendedProps?.status || 'pending';
    if (taskID && serverStatus === 'cancelled') {
      return;
    }
    const isRecurring = !!event?.extendedProps?.isRecurring;
    if (!taskID || isRecurring) {
      merged.push(event);
      return;
    }

    const projectedEvent = projectedByTaskID.get(taskID);
    const eventSource = String(event?.extendedProps?.source || '');
    const isReadOnly = !!event?.extendedProps?.readOnly || eventSource === 'caldav';
    if (!projectedEvent) {
      merged.push(event);
      return;
    }
    if (isReadOnly) {
      consumedTaskIDs.add(taskID);
      merged.push(event);
      return;
    }
    if (consumedTaskIDs.has(taskID)) {
      merged.push(event);
      return;
    }

    consumedTaskIDs.add(taskID);
    merged.push({
      ...event,
      ...projectedEvent,
      id: event?.id || projectedEvent?.id,
      extendedProps: {
        ...(event?.extendedProps || {}),
        ...(projectedEvent?.extendedProps || {}),
      },
    });
  });

  projectedByTaskID.forEach((event, taskID) => {
    if (consumedTaskIDs.has(taskID)) return;
    merged.push(event);
  });

  return merged;
}
