import dayjs from 'dayjs';

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
  const byTaskID = new Map();
  const passthrough = [];
  const presentSet = taskStatusIndex?.present instanceof Set ? taskStatusIndex.present : null;
  const canPruneMissingTask = presentSet !== null;

  base.forEach((event) => {
    const taskID = Number(event?.extendedProps?.taskId || 0);
    const serverStatus = event?.extendedProps?.status || 'pending';
    const isReadOnly = !!event?.extendedProps?.readOnly;
    const eventSource = String(event?.extendedProps?.source || '');
    if (taskID && (serverStatus === 'cancelled' || taskStatusIndex.cancelled.has(taskID))) {
      return;
    }
    const isRecurring = !!event?.extendedProps?.isRecurring;
    const shouldKeepExternalReadOnly = isReadOnly || eventSource === 'caldav';
    if (taskID && !isRecurring && canPruneMissingTask && !shouldKeepExternalReadOnly && !presentSet.has(taskID)) {
      return;
    }
    if (!taskID || isRecurring) {
      passthrough.push(event);
      return;
    }
    byTaskID.set(taskID, event);
  });

  projected.forEach((event) => {
    const taskID = Number(event?.extendedProps?.taskId || 0);
    if (!taskID) return;
    byTaskID.set(taskID, {
      ...byTaskID.get(taskID),
      ...event,
      extendedProps: {
        ...(byTaskID.get(taskID)?.extendedProps || {}),
        ...(event.extendedProps || {}),
      },
    });
  });

  return [...passthrough, ...Array.from(byTaskID.values())];
}
