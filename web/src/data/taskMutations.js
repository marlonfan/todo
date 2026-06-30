import { queryKeys } from '../query/keys';
import {
  invalidateCalendarRangesByTask,
  removeOutboxByEntity,
  removeTask,
  upsertTask,
} from './localStore';
import { enqueueTaskOperation } from './syncEngine';
import { scheduleLocalNotificationRefresh } from '../platform/localNotifications';
import {
  hasBaseTaskPatchPayload,
  isOccurrenceScopedPayload,
  normalizeOccurrenceDateText,
  patchOccurrenceDescriptionInItems,
  patchOccurrenceScheduleInItems,
} from './taskMutationHelpers.js';
import useCalendarCacheStore from '../stores/calendarCacheStore';

function nowISO() {
  return new Date().toISOString();
}

function deriveStatusTimestamps(currentStatus, nextStatus, currentCompletedAt, currentDeletedAt, nowValue) {
  const status = String(nextStatus || currentStatus || 'pending');
  if (status === String(currentStatus || 'pending')) {
    return {
      completed_at: currentCompletedAt ?? null,
      deleted_at: currentDeletedAt ?? null,
    };
  }
  if (status === 'completed') {
    return {
      completed_at: nowValue,
      deleted_at: null,
    };
  }
  if (status === 'cancelled') {
    return {
      completed_at: null,
      deleted_at: nowValue,
    };
  }
  if (status === 'skipped') {
    return {
      completed_at: null,
      deleted_at: null,
    };
  }
  return {
    completed_at: null,
    deleted_at: null,
  };
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

export function setTasksCache(queryClient, updater) {
  queryClient.setQueryData(queryKeys.tasks.all, (prev) => {
    const base = Array.isArray(prev) ? prev : [];
    const next = typeof updater === 'function' ? updater(base) : updater;
    return Array.isArray(next) ? next : base;
  });
}

function runMutationSideEffects(label, work, rollback, options = {}) {
  const rethrow = !!options?.rethrow;
  return (async () => {
    try {
      await work();
    } catch (error) {
      console.error(`[taskMutations] ${label} failed:`, error);
      if (rollback) {
        try { rollback(); } catch (e) { console.error(`[taskMutations] rollback failed:`, e); }
      }
      if (rethrow) {
        throw error;
      }
    }
  })();
}

const CALENDAR_AFFECTING_FIELDS = new Set([
  'start_time',
  'end_time',
  'all_day',
  'due_date',
  'recurrence_rule',
  'recurrence_end_date',
  'status',
]);

function shouldInvalidateCalendar(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return Object.keys(payload).some((key) => CALENDAR_AFFECTING_FIELDS.has(key));
}

async function invalidateCalendarCaches(queryClient, taskID = null, options = {}) {
  const { revalidateQuery = false, skipRangeInvalidate = false } = options;
  if (taskID && !skipRangeInvalidate) {
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

function scheduleLocalReminderRefresh(reason) {
  scheduleLocalNotificationRefresh({ reason, immediate: true });
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

function patchOccurrenceStatusInItems(items, taskID, scopedInstanceID, scopedDate, nextStatus) {
  if (!Array.isArray(items) || items.length === 0) return items;
  const nowValue = nowISO();
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
    if (String(item?.status || '') === nextStatus) return item;
    const timestamps = deriveStatusTimestamps(
      item?.status || 'pending',
      nextStatus,
      item?.completed_at || item?.completedAt || null,
      item?.deleted_at || item?.deletedAt || null,
      nowValue,
    );
    changed = true;
    return {
      ...item,
      status: nextStatus,
      completed_at: timestamps.completed_at,
      deleted_at: timestamps.deleted_at,
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

function patchRecurringOccurrenceSchedule(queryClient, taskID, payload) {
  if (!queryClient || !payload || typeof payload !== 'object') return;
  const scopedInstanceID = String(payload?.instance_id || '').trim();
  const scopedDate = normalizeOccurrenceDateText(payload?.occurrence_date || '');
  if (!scopedInstanceID && !scopedDate) return;

  queryClient.setQueryData(queryKeys.tasks.nextOccurrences(), (prev) => (
    patchOccurrenceScheduleInItems(prev, Number(taskID) || 0, scopedInstanceID, scopedDate, payload)
  ));

  const occurrenceQueries = queryClient.getQueriesData({ queryKey: ['tasks', 'occurrences'] });
  occurrenceQueries.forEach(([queryKey, value]) => {
    if (Array.isArray(value)) {
      const nextItems = patchOccurrenceScheduleInItems(
        value,
        Number(taskID) || 0,
        scopedInstanceID,
        scopedDate,
        payload,
      );
      if (nextItems !== value) {
        queryClient.setQueryData(queryKey, nextItems);
      }
      return;
    }
    if (!value || typeof value !== 'object' || !Array.isArray(value.items)) return;
    const nextItems = patchOccurrenceScheduleInItems(
      value.items,
      Number(taskID) || 0,
      scopedInstanceID,
      scopedDate,
      payload,
    );
    if (nextItems !== value.items) {
      queryClient.setQueryData(queryKey, {
        ...value,
        items: nextItems,
      });
    }
  });
}

function patchRecurringOccurrenceStatus(queryClient, taskID, payload) {
  if (!queryClient || !payload || typeof payload !== 'object') return;
  const nextStatus = String(payload?.status || '').trim();
  if (!nextStatus) return;
  const scopedInstanceID = String(payload?.instance_id || '').trim();
  const scopedDate = normalizeOccurrenceDateText(payload?.occurrence_date || '');
  if (!scopedInstanceID && !scopedDate) return;

  queryClient.setQueryData(queryKeys.tasks.nextOccurrences(), (prev) => (
    patchOccurrenceStatusInItems(prev, Number(taskID) || 0, scopedInstanceID, scopedDate, nextStatus)
  ));

  const occurrenceQueries = queryClient.getQueriesData({ queryKey: ['tasks', 'occurrences'] });
  occurrenceQueries.forEach(([queryKey, value]) => {
    if (Array.isArray(value)) {
      const nextItems = patchOccurrenceStatusInItems(
        value,
        Number(taskID) || 0,
        scopedInstanceID,
        scopedDate,
        nextStatus,
      );
      if (nextItems !== value) {
        queryClient.setQueryData(queryKey, nextItems);
      }
      return;
    }
    if (!value || typeof value !== 'object' || !Array.isArray(value.items)) return;
    const nextItems = patchOccurrenceStatusInItems(
      value.items,
      Number(taskID) || 0,
      scopedInstanceID,
      scopedDate,
      nextStatus,
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
  const { incrementRevision = true, syncState = 'pending' } = options;
  const currentRevision = Number(currentTask.revision || 1);
  const occurrenceScoped = isOccurrenceScopedPayload(payload);
  const nextStatus = payload.status || currentTask.status;
  const nowValue = nowISO();
  const timestamps = deriveStatusTimestamps(
    currentTask.status || 'pending',
    nextStatus,
    currentTask.completed_at ?? null,
    currentTask.deleted_at ?? null,
    nowValue,
  );
  const patch = {
    ...currentTask,
    title: typeof payload.title === 'string' ? payload.title : currentTask.title,
    description: occurrenceScoped
      ? currentTask.description
      : (typeof payload.description === 'string' ? payload.description : currentTask.description),
    priority: typeof payload.priority !== 'undefined' ? Number.parseInt(payload.priority, 10) || 0 : currentTask.priority,
    status: nextStatus,
    completed_at: timestamps.completed_at,
    deleted_at: timestamps.deleted_at,
    all_day: typeof payload.all_day === 'boolean' ? payload.all_day : currentTask.all_day,
    start_time: typeof payload.start_time !== 'undefined' ? payload.start_time : currentTask.start_time,
    end_time: typeof payload.end_time !== 'undefined' ? payload.end_time : currentTask.end_time,
    due_date: typeof payload.due_date !== 'undefined' ? payload.due_date : currentTask.due_date,
    recurrence_rule: typeof payload.recurrence_rule !== 'undefined' ? payload.recurrence_rule : currentTask.recurrence_rule,
    recurrence_end_date: typeof payload.recurrence_end_date !== 'undefined'
      ? payload.recurrence_end_date
      : currentTask.recurrence_end_date,
    revision: incrementRevision ? (currentRevision + 1) : currentRevision,
    sync_state: syncState,
    last_error: '',
    client_updated_at: nowValue,
  };

  if (Array.isArray(payload.category_ids)) {
    patch.categories = resolveCategoriesFromIDs(queryClient, payload.category_ids);
  }

  return patch;
}

export async function createTaskLocal(queryClient, payload, options = {}) {
  const submitMeta = normalizeSubmitMeta(options?.submitMeta);
  const tempTaskID = createTempTaskID();
  const nowValue = nowISO();
  const nextStatus = payload?.status || 'pending';
  const timestamps = deriveStatusTimestamps('pending', nextStatus, null, null, nowValue);
  const optimisticTask = {
    id: tempTaskID,
    title: String(payload?.title || '').trim(),
    description: payload?.description || '',
    priority: Number.parseInt(payload?.priority, 10) || 0,
    status: nextStatus,
    completed_at: timestamps.completed_at,
    deleted_at: timestamps.deleted_at,
    start_time: payload?.start_time || null,
    end_time: payload?.end_time || null,
    due_date: payload?.due_date || null,
    all_day: !!payload?.all_day,
    recurrence_rule: payload?.recurrence_rule || null,
    recurrence_end_date: typeof payload?.recurrence_end_date !== 'undefined'
      ? payload.recurrence_end_date
      : null,
    created_at: nowValue,
    revision: 1,
    categories: resolveCategoriesFromIDs(queryClient, payload?.category_ids || []),
    sync_state: 'pending',
    last_error: '',
    client_updated_at: nowValue,
  };

  const snapshot = queryClient.getQueryData(queryKeys.tasks.all);
  setTasksCache(queryClient, (prev) => [optimisticTask, ...prev]);
  scheduleLocalReminderRefresh('task-created-local');
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
  }, () => setTasksCache(queryClient, Array.isArray(snapshot) ? snapshot : []));

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
  const shouldPatchBaseTask = hasBaseTaskPatchPayload(payload);
  if (occurrenceScoped) {
    patchRecurringOccurrenceDescription(queryClient, taskID, payload);
    patchRecurringOccurrenceSchedule(queryClient, taskID, payload);
    patchRecurringOccurrenceStatus(queryClient, taskID, payload);
  }
  const snapshot = !skipOptimistic && shouldPatchBaseTask ? queryClient.getQueryData(queryKeys.tasks.all) : null;
  let nextTask = null;
  let baseRevision = 0;
  if (!skipOptimistic && shouldPatchBaseTask) {
    setTasksCache(queryClient, (prev) => prev.map((task) => {
      if (!task || typeof task !== 'object') return task;
      if (Number(task.id) !== Number(taskID)) return task;
      baseRevision = Number(task.revision || 1);
      nextTask = applyTaskPatch(task, payload, queryClient, {
        incrementRevision: !localOnly,
        syncState: localOnly ? 'staged' : 'pending',
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
    scheduleLocalReminderRefresh('task-updated-local');
    const persistWork = async () => {
      if (!skipOptimistic && shouldPatchBaseTask) {
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
      const needsCalendarInvalidate = shouldInvalidateCalendar(payload);
      await invalidateCalendarCaches(queryClient, taskID, {
        revalidateQuery: !localOnly && (needsCalendarInvalidate || occurrenceScoped),
        skipRangeInvalidate: !needsCalendarInvalidate,
      });
      if (typeof payload.recurrence_rule !== 'undefined') {
        await invalidateTaskOccurrenceQueries(queryClient);
      }
    };
    const rollback = snapshot ? () => setTasksCache(queryClient, snapshot) : undefined;
    if (awaitPersist) {
      await runMutationSideEffects('updateTaskLocal', persistWork, rollback, { rethrow: true });
    } else {
      void runMutationSideEffects('updateTaskLocal', persistWork, rollback);
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
    const needsCalendarInvalidate = shouldInvalidateCalendar(payload);
    await invalidateCalendarCaches(queryClient, taskID, {
      revalidateQuery: !localOnly && needsCalendarInvalidate,
      skipRangeInvalidate: !needsCalendarInvalidate,
    });
    if (typeof payload.recurrence_rule !== 'undefined') {
      await invalidateTaskOccurrenceQueries(queryClient);
    }
  };
  if (awaitPersist) {
    await runMutationSideEffects('updateTaskLocalNoTask', persistNoTaskWork, undefined, { rethrow: true });
  } else {
    void runMutationSideEffects('updateTaskLocalNoTask', persistNoTaskWork);
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
  const snapshot = shouldPatchBaseTask ? queryClient.getQueryData(queryKeys.tasks.all) : null;
  let nextTask = null;
  let baseRevision = 0;

  if (shouldPatchBaseTask) {
    setTasksCache(queryClient, (prev) => prev.map((task) => {
      if (!task || typeof task !== 'object') return task;
      if (Number(task.id) !== Number(taskID)) return task;
      const nextStatus = payload.status || task.status;
      const nowValue = nowISO();
      const timestamps = deriveStatusTimestamps(
        task.status || 'pending',
        nextStatus,
        task.completed_at ?? null,
        task.deleted_at ?? null,
        nowValue,
      );
      nextTask = {
        ...task,
        status: nextStatus,
        completed_at: timestamps.completed_at,
        deleted_at: timestamps.deleted_at,
        revision: Number(task.revision || 1) + 1,
        sync_state: 'pending',
        last_error: '',
        client_updated_at: nowValue,
      };
      return nextTask;
    }));
    if (nextTask) {
      baseRevision = Number((nextTask.revision || 1) - 1);
    }
  }

  const persistWork = async () => {
    if (nextTask) {
      await upsertTask(nextTask);
    }
    if (occurrenceScoped) {
      patchRecurringOccurrenceCalendarStatus(taskID, payload);
      patchRecurringOccurrenceStatus(queryClient, taskID, payload);
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
    if (!occurrenceScoped) {
      await invalidateTaskOccurrenceQueries(queryClient);
    }
  };
  scheduleLocalReminderRefresh('task-status-local');
  const rollback = snapshot ? () => setTasksCache(queryClient, snapshot) : undefined;
  if (awaitPersist) {
    await persistWork();
  } else {
    runMutationSideEffects('updateTaskStatusLocal', persistWork, rollback);
  }

  return nextTask;
}

export async function updateTaskScheduleLocal(queryClient, taskID, payload, options = {}) {
  const submitMeta = normalizeSubmitMeta(options?.submitMeta || {});
  const snapshot = queryClient.getQueryData(queryKeys.tasks.all);
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
  scheduleLocalReminderRefresh('task-schedule-local');

  runMutationSideEffects('updateTaskScheduleLocal', async () => {
    if (nextTask) {
      await upsertTask(nextTask);
    }
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
  }, snapshot ? () => setTasksCache(queryClient, snapshot) : undefined);

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
  scheduleLocalReminderRefresh('task-deleted-local');
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
  }, () => setTasksCache(queryClient, Array.isArray(currentList) ? currentList : []));
}
