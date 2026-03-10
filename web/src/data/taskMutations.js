import { queryKeys } from '../query/keys';
import {
  invalidateCalendarRangesByTask,
  removeOutboxByEntity,
  removeTask,
  upsertTask,
} from './localStore';
import { enqueueTaskOperation } from './syncEngine';
import useCalendarCacheStore from '../stores/calendarCacheStore';

function nowISO() {
  return new Date().toISOString();
}

function normalizeSubmitMeta(meta = {}) {
  const rawTime = typeof meta?.submittedAt === 'string' ? meta.submittedAt.trim() : '';
  const parsed = rawTime ? Date.parse(rawTime) : NaN;
  const clientSubmittedAt = Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
  const submitSource = typeof meta?.submitSource === 'string' ? meta.submitSource.trim() : '';
  return {
    client_submitted_at: clientSubmittedAt || undefined,
    submit_source: submitSource || undefined,
  };
}

function createOpID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function createTempTaskID() {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return -Number(buf[0] || Date.now());
  }
  return -(Date.now() + Math.floor(Math.random() * 1000));
}

function setTasksCache(queryClient, updater) {
  queryClient.setQueryData(queryKeys.tasks.all, (prev) => {
    const base = Array.isArray(prev) ? prev : [];
    const next = typeof updater === 'function' ? updater(base) : updater;
    return Array.isArray(next) ? next : base;
  });
}

function runMutationSideEffects(label, work) {
  void (async () => {
    try {
      await work();
    } catch (error) {
      console.error(`[taskMutations] ${label} failed:`, error);
    }
  })();
}

async function invalidateCalendarCaches(queryClient, taskID = null, options = {}) {
  const { revalidateQuery = false } = options;
  if (taskID) {
    await invalidateCalendarRangesByTask(taskID);
  }
  if (revalidateQuery) {
    await queryClient.invalidateQueries({ queryKey: ['calendar'] });
  }
}

async function invalidateTaskOccurrenceQueries(queryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.nextOccurrences() }),
    queryClient.invalidateQueries({ queryKey: ['tasks', 'occurrences'] }),
  ]);
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

function isOccurrenceScopedPayload(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  return !!(body.instance_id || body.occurrence_date);
}

function patchRecurringOccurrenceCalendarStatus(taskID, payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const status = String(body.status || '').trim();
  if (!status) return;
  useCalendarCacheStore.getState().patchTaskOccurrenceStatus({
    taskID,
    status,
    instanceID: String(body.instance_id || '').trim(),
    occurrenceDate: String(body.occurrence_date || '').trim(),
  });
}

function normalizeOccurrenceDateText(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }
  const dateLike = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateLike) {
    return dateLike[1];
  }
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return '';
}

function patchOccurrenceDescriptionInItems(items, taskID, scopedInstanceID, scopedDate, nextDescription) {
  if (!Array.isArray(items) || items.length === 0) return items;
  let changed = false;
  const next = items.map((item) => {
    const itemTaskID = Number(item?.task_id || item?.taskID || item?.source_task_id || item?.sourceTaskID || item?.id || 0);
    if (!itemTaskID || itemTaskID !== taskID) return item;
    const itemInstanceID = String(item?.instance_id || item?.instanceId || '').trim();
    const itemDate = normalizeOccurrenceDateText(
      item?.occurrence_date
      || item?.occurrenceDate
      || item?.original_date
      || item?.originalDate
      || item?.start_time
      || item?.startTime
      || '',
    );
    const scopedByInstance = !!(scopedInstanceID && itemInstanceID && scopedInstanceID === itemInstanceID);
    const scopedByDate = !!(scopedDate && itemDate && scopedDate === itemDate);
    if (!scopedByInstance && !scopedByDate) return item;
    if (String(item?.description || '') === nextDescription) return item;
    changed = true;
    return {
      ...item,
      description: nextDescription,
    };
  });
  return changed ? next : items;
}

function patchRecurringOccurrenceDescription(queryClient, taskID, payload) {
  if (!queryClient || !payload || typeof payload !== 'object') return;
  if (!Object.prototype.hasOwnProperty.call(payload, 'description')) return;
  const nextDescription = String(payload?.description || '');
  const scopedInstanceID = String(payload?.instance_id || '').trim();
  const scopedDate = normalizeOccurrenceDateText(payload?.occurrence_date || '');
  if (!scopedInstanceID && !scopedDate) return;

  queryClient.setQueryData(queryKeys.tasks.nextOccurrences(), (prev) => (
    patchOccurrenceDescriptionInItems(prev, Number(taskID) || 0, scopedInstanceID, scopedDate, nextDescription)
  ));

  const occurrenceQueries = queryClient.getQueriesData({ queryKey: ['tasks', 'occurrences'] });
  occurrenceQueries.forEach(([queryKey, value]) => {
    if (Array.isArray(value)) {
      const nextItems = patchOccurrenceDescriptionInItems(
        value,
        Number(taskID) || 0,
        scopedInstanceID,
        scopedDate,
        nextDescription,
      );
      if (nextItems !== value) {
        queryClient.setQueryData(queryKey, nextItems);
      }
      return;
    }
    if (!value || typeof value !== 'object' || !Array.isArray(value.items)) return;
    const nextItems = patchOccurrenceDescriptionInItems(
      value.items,
      Number(taskID) || 0,
      scopedInstanceID,
      scopedDate,
      nextDescription,
    );
    if (nextItems !== value.items) {
      queryClient.setQueryData(queryKey, {
        ...value,
        items: nextItems,
      });
    }
  });
}

function applyTaskPatch(currentTask, payload, queryClient, options = {}) {
  if (!currentTask) return currentTask;
  const { incrementRevision = true } = options;
  const currentRevision = Number(currentTask.revision || 1);
  const occurrenceScoped = isOccurrenceScopedPayload(payload);
  const patch = {
    ...currentTask,
    title: typeof payload.title === 'string' ? payload.title : currentTask.title,
    description: occurrenceScoped
      ? currentTask.description
      : (typeof payload.description === 'string' ? payload.description : currentTask.description),
    priority: typeof payload.priority !== 'undefined' ? Number.parseInt(payload.priority, 10) || 0 : currentTask.priority,
    status: payload.status || currentTask.status,
    all_day: typeof payload.all_day === 'boolean' ? payload.all_day : currentTask.all_day,
    start_time: typeof payload.start_time !== 'undefined' ? payload.start_time : currentTask.start_time,
    end_time: typeof payload.end_time !== 'undefined' ? payload.end_time : currentTask.end_time,
    due_date: typeof payload.due_date !== 'undefined' ? payload.due_date : currentTask.due_date,
    recurrence_rule: typeof payload.recurrence_rule !== 'undefined' ? payload.recurrence_rule : currentTask.recurrence_rule,
    recurrence_end_date: typeof payload.recurrence_end_date !== 'undefined'
      ? payload.recurrence_end_date
      : currentTask.recurrence_end_date,
    revision: incrementRevision ? (currentRevision + 1) : currentRevision,
    sync_state: 'pending',
    last_error: '',
    client_updated_at: nowISO(),
  };

  if (Array.isArray(payload.category_ids)) {
    patch.categories = resolveCategoriesFromIDs(queryClient, payload.category_ids);
  }

  return patch;
}

export async function createTaskLocal(queryClient, payload, options = {}) {
  const submitMeta = normalizeSubmitMeta(options?.submitMeta);
  const tempTaskID = createTempTaskID();
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
    recurrence_end_date: typeof payload?.recurrence_end_date !== 'undefined'
      ? payload.recurrence_end_date
      : null,
    revision: 1,
    categories: resolveCategoriesFromIDs(queryClient, payload?.category_ids || []),
    sync_state: 'pending',
    last_error: '',
    client_updated_at: nowISO(),
  };

  setTasksCache(queryClient, (prev) => [optimisticTask, ...prev]);
  runMutationSideEffects('createTaskLocal', async () => {
    await upsertTask(optimisticTask);
      await enqueueTaskOperation({
        op_id: createOpID(),
        entity_type: 'task',
        entity_id: tempTaskID,
        op_type: 'create',
        payload,
        ...submitMeta,
      });
    await invalidateCalendarCaches(queryClient, null, { revalidateQuery: true });
  });

  return optimisticTask;
}

export async function updateTaskLocal(queryClient, taskID, payload, options = {}) {
  const {
    scheduleSync: shouldScheduleSync = true,
    localOnly = false,
    skipOptimistic = false,
    submitMeta: submitMetaInput = null,
    awaitPersist = false,
  } = options;
  const submitMeta = normalizeSubmitMeta(submitMetaInput || {});
  const occurrenceScoped = isOccurrenceScopedPayload(payload);
  if (occurrenceScoped) {
    patchRecurringOccurrenceDescription(queryClient, taskID, payload);
  }
  let nextTask = null;
  let baseRevision = 0;
  if (!skipOptimistic) {
    setTasksCache(queryClient, (prev) => prev.map((task) => {
      if (!task || typeof task !== 'object') return task;
      if (Number(task.id) !== Number(taskID)) return task;
      baseRevision = Number(task.revision || 1);
      nextTask = applyTaskPatch(task, payload, queryClient, {
        incrementRevision: !localOnly,
      });
      return nextTask;
    }));
  } else {
    const currentList = queryClient.getQueryData(queryKeys.tasks.all);
    const currentTask = Array.isArray(currentList)
      ? currentList.find((task) => Number(task?.id) === Number(taskID))
      : null;
    baseRevision = Number(currentTask?.revision || 1);
    nextTask = currentTask || null;
  }

  if (nextTask) {
    const persistWork = async () => {
      if (!skipOptimistic) {
        await upsertTask(nextTask);
      }
      if (!localOnly) {
        await enqueueTaskOperation({
          op_id: createOpID(),
          entity_type: 'task',
          entity_id: taskID,
          op_type: 'update',
          payload,
          if_match_revision: baseRevision || undefined,
          ...submitMeta,
        }, { schedule: shouldScheduleSync });
      }
      await invalidateCalendarCaches(queryClient, taskID, { revalidateQuery: !localOnly });
    };
    if (awaitPersist) {
      await persistWork();
    } else {
      runMutationSideEffects('updateTaskLocal', persistWork);
    }
    return nextTask;
  }

  const persistNoTaskWork = async () => {
    if (!localOnly) {
      await enqueueTaskOperation({
        op_id: createOpID(),
        entity_type: 'task',
        entity_id: taskID,
        op_type: 'update',
        payload,
        if_match_revision: baseRevision || undefined,
        ...submitMeta,
      }, { schedule: shouldScheduleSync });
    }
    await invalidateCalendarCaches(queryClient, taskID, { revalidateQuery: !localOnly });
  };
  if (awaitPersist) {
    await persistNoTaskWork();
  } else {
    runMutationSideEffects('updateTaskLocalNoTask', persistNoTaskWork);
  }

  return nextTask;
}

export async function updateTaskStatusLocal(queryClient, taskID, statusInput, options = {}) {
  const submitMeta = normalizeSubmitMeta(options?.submitMeta || {});
  const awaitPersist = !!options?.awaitPersist;
  const payload = typeof statusInput === 'string'
    ? { status: statusInput }
    : (statusInput || {});
  const occurrenceScoped = isOccurrenceScopedPayload(payload);

  const shouldPatchBaseTask = !payload.instance_id && !payload.occurrence_date;
  const shouldRevalidateCalendarQuery = typeof options?.revalidateCalendarQuery === 'boolean'
    ? options.revalidateCalendarQuery
    : shouldPatchBaseTask;
  let nextTask = null;
  let baseRevision = 0;

  if (shouldPatchBaseTask) {
    setTasksCache(queryClient, (prev) => prev.map((task) => {
      if (!task || typeof task !== 'object') return task;
      if (Number(task.id) !== Number(taskID)) return task;
      nextTask = {
        ...task,
        status: payload.status || task.status,
        revision: Number(task.revision || 1) + 1,
        sync_state: 'pending',
        last_error: '',
        client_updated_at: nowISO(),
      };
      return nextTask;
    }));
    if (nextTask) {
      baseRevision = Number((nextTask.revision || 1) - 1);
    }

    if (nextTask) {
      runMutationSideEffects('updateTaskStatusLocalBasePatch', async () => {
        await upsertTask(nextTask);
      });
    }
  }

  const persistWork = async () => {
    if (occurrenceScoped) {
      patchRecurringOccurrenceCalendarStatus(taskID, payload);
    }
    await enqueueTaskOperation({
      op_id: createOpID(),
      entity_type: 'task',
      entity_id: taskID,
      op_type: 'status',
      payload,
      if_match_revision: shouldPatchBaseTask ? (baseRevision || undefined) : undefined,
      ...submitMeta,
    });
    await invalidateCalendarCaches(queryClient, taskID, { revalidateQuery: shouldRevalidateCalendarQuery });
    await invalidateTaskOccurrenceQueries(queryClient);
  };
  if (awaitPersist) {
    await persistWork();
  } else {
    runMutationSideEffects('updateTaskStatusLocal', persistWork);
  }

  return nextTask;
}

export async function updateTaskScheduleLocal(queryClient, taskID, payload, options = {}) {
  const submitMeta = normalizeSubmitMeta(options?.submitMeta || {});
  let nextTask = null;
  let baseRevision = 0;

  setTasksCache(queryClient, (prev) => prev.map((task) => {
    if (!task || typeof task !== 'object') return task;
    if (Number(task.id) !== Number(taskID)) return task;
    baseRevision = Number(task.revision || 1);
    nextTask = {
      ...task,
      start_time: typeof payload.start_time !== 'undefined' ? payload.start_time : task.start_time,
      end_time: typeof payload.end_time !== 'undefined' ? payload.end_time : task.end_time,
      all_day: typeof payload.all_day === 'boolean' ? payload.all_day : task.all_day,
      revision: Number(task.revision || 1) + 1,
      sync_state: 'pending',
      last_error: '',
      client_updated_at: nowISO(),
    };
    return nextTask;
  }));

  if (nextTask) {
    runMutationSideEffects('updateTaskScheduleLocalBasePatch', async () => {
      await upsertTask(nextTask);
    });
  }

  runMutationSideEffects('updateTaskScheduleLocal', async () => {
    await enqueueTaskOperation({
      op_id: createOpID(),
      entity_type: 'task',
      entity_id: taskID,
      op_type: 'schedule',
      payload,
      if_match_revision: baseRevision || undefined,
      ...submitMeta,
    });
    await invalidateCalendarCaches(queryClient, taskID, { revalidateQuery: true });
  });

  return nextTask;
}

export async function moveTaskToCategoryLocal(queryClient, taskID, categoryID) {
  return updateTaskLocal(queryClient, taskID, { category_ids: [categoryID] });
}

export async function cancelTaskLocal(queryClient, taskID) {
  return updateTaskStatusLocal(queryClient, taskID, { status: 'cancelled' });
}

export async function deleteTaskLocal(queryClient, taskID) {
  const numericID = Number(taskID);
  if (!numericID) return;
  const currentList = queryClient.getQueryData(queryKeys.tasks.all);
  const currentTask = Array.isArray(currentList)
    ? currentList.find((task) => Number(task?.id) === numericID)
    : null;
  const baseRevision = Number(currentTask?.revision || 0);

  setTasksCache(queryClient, (prev) => prev.filter((task) => Number(task?.id) !== numericID));
  runMutationSideEffects('deleteTaskLocal', async () => {
    await removeTask(numericID);

    if (numericID < 0) {
      await removeOutboxByEntity('task', numericID);
    } else {
      await enqueueTaskOperation({
        op_id: createOpID(),
        entity_type: 'task',
        entity_id: numericID,
        op_type: 'delete',
        payload: {},
        if_match_revision: baseRevision || undefined,
      });
    }

    await invalidateCalendarCaches(queryClient, numericID, { revalidateQuery: true });
  });
}
