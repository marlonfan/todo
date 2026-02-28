import { queryKeys } from '../query/keys';
import { upsertTask } from './localStore';
import { enqueueTaskOperation } from './syncEngine';

function nowISO() {
  return new Date().toISOString();
}

function createOpID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function setTasksCache(queryClient, updater) {
  queryClient.setQueryData(queryKeys.tasks.all, (prev) => {
    const base = Array.isArray(prev) ? prev : [];
    const next = typeof updater === 'function' ? updater(base) : updater;
    return Array.isArray(next) ? next : base;
  });
}

function getCachedCategories(queryClient) {
  const value = queryClient.getQueryData(queryKeys.categories.all);
  return Array.isArray(value) ? value : [];
}

function resolveCategoriesFromIDs(queryClient, categoryIDs) {
  const ids = Array.isArray(categoryIDs) ? categoryIDs.map((id) => Number(id)) : [];
  if (!ids.length) return [];
  const categories = getCachedCategories(queryClient);
  return categories.filter((item) => ids.includes(Number(item.id)));
}

function applyTaskPatch(currentTask, payload, queryClient) {
  if (!currentTask) return currentTask;
  const patch = {
    ...currentTask,
    title: typeof payload.title === 'string' ? payload.title : currentTask.title,
    description: typeof payload.description === 'string' ? payload.description : currentTask.description,
    priority: typeof payload.priority !== 'undefined' ? Number.parseInt(payload.priority, 10) || 0 : currentTask.priority,
    status: payload.status || currentTask.status,
    all_day: typeof payload.all_day === 'boolean' ? payload.all_day : currentTask.all_day,
    start_time: typeof payload.start_time !== 'undefined' ? payload.start_time : currentTask.start_time,
    end_time: typeof payload.end_time !== 'undefined' ? payload.end_time : currentTask.end_time,
    due_date: typeof payload.due_date !== 'undefined' ? payload.due_date : currentTask.due_date,
    recurrence_rule: typeof payload.recurrence_rule !== 'undefined' ? payload.recurrence_rule : currentTask.recurrence_rule,
    sync_state: 'pending',
    last_error: '',
    client_updated_at: nowISO(),
  };

  if (Array.isArray(payload.category_ids)) {
    patch.categories = resolveCategoriesFromIDs(queryClient, payload.category_ids);
  }

  return patch;
}

export async function createTaskLocal(queryClient, payload) {
  const tempTaskID = -Date.now();
  const optimisticTask = {
    id: tempTaskID,
    title: String(payload?.title || '').trim(),
    description: payload?.description || '',
    priority: Number.parseInt(payload?.priority, 10) || 0,
    status: payload?.status || 'pending',
    start_time: payload?.start_time || null,
    end_time: payload?.end_time || null,
    due_date: payload?.due_date || null,
    all_day: !!payload?.all_day,
    recurrence_rule: payload?.recurrence_rule || null,
    categories: resolveCategoriesFromIDs(queryClient, payload?.category_ids || []),
    sync_state: 'pending',
    last_error: '',
    client_updated_at: nowISO(),
  };

  setTasksCache(queryClient, (prev) => [optimisticTask, ...prev]);
  await upsertTask(optimisticTask);

  await enqueueTaskOperation({
    op_id: createOpID(),
    entity_type: 'task',
    entity_id: tempTaskID,
    op_type: 'create',
    payload,
  });

  return optimisticTask;
}

export async function updateTaskLocal(queryClient, taskID, payload) {
  let nextTask = null;
  setTasksCache(queryClient, (prev) => prev.map((task) => {
    if (task.id !== taskID) return task;
    nextTask = applyTaskPatch(task, payload, queryClient);
    return nextTask;
  }));

  if (nextTask) {
    await upsertTask(nextTask);
  }

  await enqueueTaskOperation({
    op_id: createOpID(),
    entity_type: 'task',
    entity_id: taskID,
    op_type: 'update',
    payload,
  });

  return nextTask;
}

export async function updateTaskStatusLocal(queryClient, taskID, statusInput) {
  const payload = typeof statusInput === 'string'
    ? { status: statusInput }
    : (statusInput || {});

  const shouldPatchBaseTask = !payload.instance_id && !payload.occurrence_date;
  let nextTask = null;

  if (shouldPatchBaseTask) {
    setTasksCache(queryClient, (prev) => prev.map((task) => {
      if (task.id !== taskID) return task;
      nextTask = {
        ...task,
        status: payload.status || task.status,
        sync_state: 'pending',
        last_error: '',
        client_updated_at: nowISO(),
      };
      return nextTask;
    }));

    if (nextTask) {
      await upsertTask(nextTask);
    }
  }

  await enqueueTaskOperation({
    op_id: createOpID(),
    entity_type: 'task',
    entity_id: taskID,
    op_type: 'status',
    payload,
  });

  return nextTask;
}

export async function updateTaskScheduleLocal(queryClient, taskID, payload) {
  let nextTask = null;

  setTasksCache(queryClient, (prev) => prev.map((task) => {
    if (task.id !== taskID) return task;
    nextTask = {
      ...task,
      start_time: typeof payload.start_time !== 'undefined' ? payload.start_time : task.start_time,
      end_time: typeof payload.end_time !== 'undefined' ? payload.end_time : task.end_time,
      all_day: typeof payload.all_day === 'boolean' ? payload.all_day : task.all_day,
      sync_state: 'pending',
      last_error: '',
      client_updated_at: nowISO(),
    };
    return nextTask;
  }));

  if (nextTask) {
    await upsertTask(nextTask);
  }

  await enqueueTaskOperation({
    op_id: createOpID(),
    entity_type: 'task',
    entity_id: taskID,
    op_type: 'schedule',
    payload,
  });

  return nextTask;
}

export async function moveTaskToCategoryLocal(queryClient, taskID, categoryID) {
  return updateTaskLocal(queryClient, taskID, { category_ids: [categoryID] });
}

export async function cancelTaskLocal(queryClient, taskID) {
  return updateTaskStatusLocal(queryClient, taskID, { status: 'cancelled' });
}
