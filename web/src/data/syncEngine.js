import { categoriesAPI, tasksAPI } from '../api/client';
import { queryKeys } from '../query/keys';
import {
  clearAllLocalData,
  enqueueOutbox,
  getDueOutbox,
  getMeta,
  invalidateCalendarRangesByTask,
  readCategories,
  readOutbox,
  readTasks,
  remapOutboxEntityID,
  removeOutbox,
  removeTask,
  removeTaskActivitiesByTask,
  replaceCategories,
  replaceTaskID,
  setMeta,
  upsertTask,
  upsertTasks,
  updateOutbox,
} from './localStore';
import { getCoalescePlan } from './outboxCoalesce';
import { collectPendingDeleteTaskIDs, getTaskTimestamp, normalizeServerTask } from './taskMerge';
import { pushSyncConflict } from '../state/syncConflictCenter';
import { logTimeDebug } from '../utils/time';

const DEFAULT_SYNC_INTERVAL_SECONDS = 120;
const MIN_SYNC_INTERVAL_SECONDS = 15;
const MAX_SYNC_INTERVAL_SECONDS = 1800;
const SYNC_INTERVAL_STORAGE_KEY = 'sync_interval_seconds';
const TASK_SYNC_CURSOR_KEY = 'tasks_sync_cursor';
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

let queryClientRef = null;
let initialized = false;
let running = false;
let rerunRequested = false;
let intervalID = null;
const syncFinishedListeners = new Set();

function clampSyncIntervalSeconds(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SYNC_INTERVAL_SECONDS;
  if (parsed === 0) return 0;
  return Math.min(MAX_SYNC_INTERVAL_SECONDS, Math.max(MIN_SYNC_INTERVAL_SECONDS, parsed));
}

function readSyncIntervalSecondsFromStorage() {
  if (typeof window === 'undefined') return DEFAULT_SYNC_INTERVAL_SECONDS;
  try {
    const raw = localStorage.getItem(SYNC_INTERVAL_STORAGE_KEY);
    if (!raw) return DEFAULT_SYNC_INTERVAL_SECONDS;
    return clampSyncIntervalSeconds(raw);
  } catch {
    return DEFAULT_SYNC_INTERVAL_SECONDS;
  }
}

function getSyncIntervalMs() {
  const seconds = readSyncIntervalSecondsFromStorage();
  if (seconds <= 0) return 0;
  return seconds * 1000;
}

function isAutoSyncEnabled() {
  return getSyncIntervalMs() > 0;
}

function resetSyncIntervalTimer() {
  if (typeof window === 'undefined') return;
  if (intervalID) {
    window.clearInterval(intervalID);
    intervalID = null;
  }
  const intervalMs = getSyncIntervalMs();
  if (intervalMs <= 0) return;
  intervalID = window.setInterval(() => {
    scheduleSync();
  }, intervalMs);
}

function emitSyncTrace(type, detail = {}) {
  if (typeof window === 'undefined') return;
  if (!window.__TODO_SYNC_DEBUG__) return;
  window.dispatchEvent(new CustomEvent('sync:trace', {
    detail: {
      type,
      at: new Date().toISOString(),
      ...detail,
    },
  }));
}

function emitSyncCycleFinished(summary = {}) {
  syncFinishedListeners.forEach((listener) => {
    try {
      listener(summary);
    } catch (error) {
      console.error('sync cycle listener failed:', error);
    }
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function safeLocalCall(fn, fallback, label) {
  try {
    return await fn();
  } catch (error) {
    console.error(`Local store operation failed (${label}):`, error);
    return fallback;
  }
}

function hasToken() {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('token'));
}

function nowISO() {
  return new Date().toISOString();
}

function sanitizeConflictPayload(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const sanitized = { ...payload };
  delete sanitized.client_timezone;
  delete sanitized.start_time_local;
  delete sanitized.end_time_local;
  return sanitized;
}

function normalizeClientSubmittedAt(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return '';
  return new Date(parsed).toISOString();
}

async function patchTaskSyncState(taskID, patch) {
  if (!queryClientRef || !taskID) return;
  let nextTask = null;
  let changed = false;

  queryClientRef.setQueryData(queryKeys.tasks.all, (prev) => {
    if (!Array.isArray(prev)) return prev;
    return prev.map((task) => {
      if (task.id !== taskID) return task;
      const hasDiff = Object.keys(patch || {}).some((key) => task?.[key] !== patch?.[key]);
      if (!hasDiff) {
        nextTask = task;
        return task;
      }
      changed = true;
      nextTask = {
        ...task,
        ...patch,
      };
      return nextTask;
    });
  });

  if (changed && nextTask) {
    await upsertTask(nextTask);
  }
}

async function applyServerTask(task, replaceTempID = null) {
  if (!queryClientRef || !task?.id) return;
  const normalizedTask = normalizeServerTask(task);

  queryClientRef.setQueryData(queryKeys.tasks.all, (prev) => {
    const base = Array.isArray(prev) ? prev : [];
    const list = replaceTempID !== null ? base.filter((item) => item.id !== replaceTempID) : base;
    const exists = list.some((item) => item.id === normalizedTask.id);
    if (exists) {
      return list.map((item) => (item.id === normalizedTask.id ? normalizedTask : item));
    }
    return [normalizedTask, ...list];
  });

  if (replaceTempID !== null) {
    await replaceTaskID(replaceTempID, normalizedTask);
    await remapOutboxEntityID(replaceTempID, normalizedTask.id);
    return;
  }
  await upsertTask(normalizedTask);
}

function getErrorMessage(error) {
  if (error?.response?.data?.error) return String(error.response.data.error);
  if (error?.message) return String(error.message);
  return 'sync failed';
}

function isOccurrenceScopedPayload(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  return !!(String(body.instance_id || '').trim() || String(body.occurrence_date || '').trim());
}

function shouldRefreshRecurringViewsForUpdatePayload(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  if (isOccurrenceScopedPayload(body)) return true;
  const recurringViewKeys = [
    'status',
    'start_time',
    'end_time',
    'due_date',
    'all_day',
    'recurrence_rule',
    'recurrence_end_date',
  ];
  return recurringViewKeys.some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

async function refreshOccurrenceScopedViews(taskID) {
  const numericTaskID = Number(taskID || 0);
  if (numericTaskID > 0) {
    await invalidateCalendarRangesByTask(numericTaskID);
  }
  if (!queryClientRef) return;
  await Promise.all([
    queryClientRef.invalidateQueries({ queryKey: ['calendar'] }),
    queryClientRef.invalidateQueries({ queryKey: queryKeys.tasks.nextOccurrences() }),
    queryClientRef.invalidateQueries({ queryKey: ['tasks', 'occurrences'] }),
  ]);
}

function isTaskMissingFailure(status, message) {
  if (status === 404) return true;
  const normalized = String(message || '').trim().toLowerCase();
  return status === 400 && normalized.includes('task not found');
}

async function executeOutboxOperation(op) {
  emitSyncTrace('outbox_executing', {
    op_id: op.op_id,
    op_type: op.op_type,
    entity_id: op.entity_id,
  });
  switch (op.op_type) {
    case 'create': {
      const res = await tasksAPI.create(op.payload, {
        clientSubmittedAt: op.client_submitted_at,
        submitSource: op.submit_source,
      });
      if (res?.data?.id) {
        await applyServerTask(res.data, op.entity_id);
      }
      return;
    }
    case 'update': {
      logTimeDebug('syncEngine.outbox.update.request', {
        entity_id: Number(op.entity_id || 0),
        if_match_revision: Number(op.if_match_revision || 0) || undefined,
        payload: op.payload || {},
      });
      const res = await tasksAPI.update(op.entity_id, op.payload, {
        ifMatchRevision: op.if_match_revision,
        clientSubmittedAt: op.client_submitted_at,
        submitSource: op.submit_source,
      });
      if (res?.data?.id) {
        await applyServerTask(res.data);
      } else {
        await patchTaskSyncState(op.entity_id, { sync_state: 'synced', last_error: '' });
      }
      if (shouldRefreshRecurringViewsForUpdatePayload(op?.payload)) {
        await refreshOccurrenceScopedViews(op?.entity_id);
      }
      return;
    }
    case 'status': {
      const res = await tasksAPI.updateStatus(op.entity_id, op.payload, {
        ifMatchRevision: op.if_match_revision,
        clientSubmittedAt: op.client_submitted_at,
        submitSource: op.submit_source,
      });
      if (res?.data?.id) {
        await applyServerTask(res.data);
      } else {
        await patchTaskSyncState(op.entity_id, { sync_state: 'synced', last_error: '' });
      }
      if (isOccurrenceScopedPayload(op?.payload)) {
        await refreshOccurrenceScopedViews(op?.entity_id);
      }
      return;
    }
    case 'schedule': {
      const res = await tasksAPI.updateSchedule(op.entity_id, op.payload, {
        ifMatchRevision: op.if_match_revision,
        clientSubmittedAt: op.client_submitted_at,
        submitSource: op.submit_source,
      });
      if (res?.data?.id) {
        await applyServerTask(res.data);
      } else {
        await patchTaskSyncState(op.entity_id, { sync_state: 'synced', last_error: '' });
      }
      if (isOccurrenceScopedPayload(op?.payload)) {
        await refreshOccurrenceScopedViews(op?.entity_id);
      }
      return;
    }
    case 'delete': {
      await tasksAPI.delete(op.entity_id, {
        ifMatchRevision: op.if_match_revision,
      });
      queryClientRef?.setQueryData(queryKeys.tasks.all, (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.filter((task) => task.id !== op.entity_id);
      });
      await removeTask(op.entity_id);
      await removeTaskActivitiesByTask(op.entity_id);
      return;
    }
    default:
      throw new Error(`unsupported op_type: ${op.op_type}`);
  }
}

async function handleOutboxFailure(op, error) {
  const status = error?.response?.status;
  const message = getErrorMessage(error);
  logTimeDebug('syncEngine.outbox.failure', {
    entity_id: Number(op?.entity_id || 0),
    op_type: String(op?.op_type || ''),
    status: Number(status || 0) || undefined,
    message,
    if_match_revision: Number(op?.if_match_revision || 0) || undefined,
    payload: op?.payload || {},
  });

  if (status === 409) {
    await removeOutbox(op.op_id);
    const latest = error?.response?.data?.latest;
    pushSyncConflict({
      task_id: latest?.id || op.entity_id,
      task_title: latest?.title || '',
      op_type: op.op_type,
      message,
      latest_revision: latest?.revision,
      submit_source: op.submit_source || '',
      occurred_at: nowISO(),
      local_payload: sanitizeConflictPayload(op.payload),
      latest_task: latest || null,
    });
    if (latest?.id) {
      await applyServerTask(latest);
    } else if (op.op_type !== 'delete') {
      await patchTaskSyncState(op.entity_id, { sync_state: 'error', last_error: message });
    }
    emitSyncTrace('outbox_conflict', {
      op_id: op.op_id,
      op_type: op.op_type,
      entity_id: op.entity_id,
      message,
    });
    return;
  }

  if (isTaskMissingFailure(status, message) && Number(op?.entity_id || 0) > 0) {
    await removeOutbox(op.op_id);
    queryClientRef?.setQueryData(queryKeys.tasks.all, (prev) => {
      if (!Array.isArray(prev)) return prev;
      return prev.filter((task) => Number(task?.id) !== Number(op.entity_id));
    });
    await removeTask(op.entity_id);
    await removeTaskActivitiesByTask(op.entity_id);
    emitSyncTrace('outbox_task_missing_removed', {
      op_id: op.op_id,
      op_type: op.op_type,
      entity_id: op.entity_id,
      status,
      message,
    });
    return;
  }

  if (status && status >= 400 && status < 500 && status !== 429) {
    await removeOutbox(op.op_id);
    await patchTaskSyncState(op.entity_id, { sync_state: 'error', last_error: message });
    emitSyncTrace('outbox_failed_non_retryable', {
      op_id: op.op_id,
      op_type: op.op_type,
      entity_id: op.entity_id,
      status,
      message,
    });
    return;
  }

  const retryCount = Number(op.retry_count || 0) + 1;
  const delay = Math.min(MAX_RETRY_DELAY_MS, 1000 * (2 ** retryCount));
  await updateOutbox(op.op_id, {
    retry_count: retryCount,
    next_retry_at: Date.now() + delay,
    last_error: message,
  });
  await patchTaskSyncState(op.entity_id, { sync_state: 'error', last_error: message });
  emitSyncTrace('outbox_failed_retryable', {
    op_id: op.op_id,
    op_type: op.op_type,
    entity_id: op.entity_id,
    status,
    message,
    retry_count: retryCount,
  });
}

async function processOutbox() {
  let loopCount = 0;
  while (loopCount < 200) {
    loopCount += 1;
    const dueOps = await safeLocalCall(() => getDueOutbox(Date.now(), 30), [], 'getDueOutbox');
    if (!dueOps.length) break;

    for (const op of dueOps) {
      if (Number(op.entity_id) < 0 && op.op_type !== 'create') {
        await removeOutbox(op.op_id);
        continue;
      }

      await patchTaskSyncState(op.entity_id, { sync_state: 'syncing', last_error: '' });

      try {
        await executeOutboxOperation(op);
        await removeOutbox(op.op_id);
        emitSyncTrace('outbox_applied', {
          op_id: op.op_id,
          op_type: op.op_type,
          entity_id: op.entity_id,
        });
      } catch (error) {
        const status = error?.response?.status;
        await handleOutboxFailure(op, error);
        if (!status || status >= 500) {
          return;
        }
      }
    }
  }
}

async function pullServerData() {
  if (!queryClientRef || !hasToken()) return;

  const [categoriesRes, outboxOps, lastCursor] = await Promise.all([
    categoriesAPI.list(),
    safeLocalCall(() => readOutbox(), [], 'readOutbox'),
    safeLocalCall(() => getMeta(TASK_SYNC_CURSOR_KEY, ''), '', `getMeta:${TASK_SYNC_CURSOR_KEY}`),
  ]);
  let nextCursor = String(lastCursor || '');
  const categories = Array.isArray(categoriesRes?.data) ? categoriesRes.data : [];
  const pendingDeleteIDs = collectPendingDeleteTaskIDs(outboxOps);

  const syncLimit = 1000;
  let rounds = 0;
  let hasMore = true;
  let mergedTasks = queryClientRef.getQueryData(queryKeys.tasks.all);
  if (!Array.isArray(mergedTasks)) {
    mergedTasks = await safeLocalCall(() => readTasks(), [], 'readTasks');
  }
  while (hasMore && rounds < 6) {
    rounds += 1;
    const syncRes = await tasksAPI.sync({
      since: nextCursor || undefined,
      limit: syncLimit,
    });
    const payload = syncRes?.data || {};
    const changed = Array.isArray(payload.tasks) ? payload.tasks : [];
    const deleted = Array.isArray(payload.deleted) ? payload.deleted : [];
    const deletedIDs = new Set(
      deleted
        .map((item) => Number(item?.task_id))
        .filter((id) => Number.isFinite(id) && id > 0 && !pendingDeleteIDs.has(id))
    );

    const byID = new Map();
    (Array.isArray(mergedTasks) ? mergedTasks : []).forEach((task) => {
      if (!task?.id) return;
      if (deletedIDs.has(Number(task.id))) return;
      byID.set(task.id, task);
    });

    changed.forEach((task) => {
      const taskID = Number(task?.id || 0);
      if (!taskID || pendingDeleteIDs.has(taskID)) return;
      const normalized = normalizeServerTask(task);
      const local = byID.get(taskID);
      if (!local) {
        byID.set(taskID, normalized);
        return;
      }
      const state = String(local.sync_state || '');
      const localTs = getTaskTimestamp(local);
      const serverTs = getTaskTimestamp(task);
      if (state === 'pending' || state === 'syncing' || (state === 'error' && localTs > serverTs)) {
        byID.set(taskID, {
          ...local,
          updated_at: task?.updated_at || local.updated_at,
        });
        return;
      }
      byID.set(taskID, normalized);
    });

    // Keep list order stable to avoid UI flicker while background sync updates sync_state.
    mergedTasks = Array.from(byID.values());
    nextCursor = String(payload.next_since || nextCursor || '');
    hasMore = Boolean(payload.has_more);
  }

  queryClientRef.setQueryData(queryKeys.tasks.all, (prev) => {
    if (!Array.isArray(prev)) return mergedTasks;
    if (prev.length !== mergedTasks.length) return mergedTasks;
    for (let i = 0; i < prev.length; i += 1) {
      if (prev[i] !== mergedTasks[i]) return mergedTasks;
    }
    return prev;
  });
  queryClientRef.setQueryData(queryKeys.categories.all, categories);

  await Promise.all([
    safeLocalCall(() => upsertTasks(mergedTasks), null, 'upsertTasks'),
    safeLocalCall(() => replaceCategories(categories), null, 'replaceCategories'),
    safeLocalCall(() => setMeta('last_pull_at', nowISO()), null, 'setMeta:last_pull_at'),
    safeLocalCall(() => setMeta(TASK_SYNC_CURSOR_KEY, nextCursor || nowISO()), null, `setMeta:${TASK_SYNC_CURSOR_KEY}`),
  ]);
  emitSyncTrace('pull_merged', {
    rounds,
    merged_tasks: mergedTasks.length,
    categories: categories.length,
    has_more: hasMore,
  });
}

async function hydrateFromLocal() {
  if (!queryClientRef) return;
  const [tasks, categories, lastPullAt] = await Promise.all([
    safeLocalCall(() => readTasks(), [], 'readTasks'),
    safeLocalCall(() => readCategories(), [], 'readCategories'),
    safeLocalCall(() => getMeta('last_pull_at', ''), '', 'getMeta:last_pull_at'),
  ]);

  if (Array.isArray(tasks) && tasks.length > 0) {
    queryClientRef.setQueryData(queryKeys.tasks.all, tasks);
  }
  if (Array.isArray(categories) && categories.length > 0) {
    queryClientRef.setQueryData(queryKeys.categories.all, categories);
  }
  if (lastPullAt) {
    queryClientRef.setQueryData(queryKeys.sync.lastPull, lastPullAt);
  }
}

async function waitForIdle(timeoutMs = 15000) {
  const start = Date.now();
  while (running) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('sync engine busy timeout');
    }
    await wait(80);
  }
}

async function runSyncCycle(options = {}) {
  const { silent = true } = options;

  if (!queryClientRef) {
    if (!silent) {
      throw new Error('sync engine is not initialized');
    }
    return;
  }
  if (running) {
    rerunRequested = true;
    return;
  }
  if (!hasToken()) {
    if (!silent) {
      throw new Error('missing auth token');
    }
    return;
  }

  running = true;
  let syncError = null;
  try {
    await processOutbox();
    await pullServerData();
    if (queryClientRef) {
      queryClientRef.setQueryData(queryKeys.sync.lastPull, nowISO());
    }
  } catch (error) {
    syncError = error;
    if (silent) {
      // Keep silent for background sync; UI uses sync_state markers.
      console.error('Background sync failed:', error);
      return;
    }
    throw error;
  } finally {
    running = false;
    emitSyncCycleFinished({
      ok: !syncError,
      error: syncError ? getErrorMessage(syncError) : '',
      at: nowISO(),
    });
    if (rerunRequested) {
      rerunRequested = false;
      setTimeout(() => {
        runSyncCycle();
      }, 0);
    }
  }
}

export function scheduleSync() {
  runSyncCycle({ silent: true });
}

export async function enqueueTaskOperation(op, options = {}) {
  const { schedule = true } = options;
  const now = Date.now();
  const normalized = {
    ...op,
    retry_count: Number(op.retry_count || 0),
    next_retry_at: Number(op.next_retry_at || now),
    created_at: Number(op.created_at || now),
    if_match_revision: Number(op.if_match_revision || 0) || undefined,
    client_submitted_at: normalizeClientSubmittedAt(op.client_submitted_at || ''),
    submit_source: typeof op.submit_source === 'string' ? op.submit_source.trim() : '',
  };
  const all = await readOutbox();
  const plan = getCoalescePlan(all, normalized);

  if (plan.mode === 'merge_into_create' && plan.updateCreate) {
    await updateOutbox(plan.updateCreate.op_id, {
      payload: plan.updateCreate.payload,
      next_retry_at: now,
    });
    emitSyncTrace('mutation_coalesced_into_create', {
      entity_id: normalized.entity_id,
      op_type: normalized.op_type,
    });
    if (schedule) {
      scheduleSync();
    }
    return;
  }

  if (plan.mode === 'replace_coalescible' || plan.mode === 'replace_with_delete' || plan.mode === 'drop_entity_ops') {
    await Promise.all(plan.removeOpIDs.map((opID) => removeOutbox(opID)));
    emitSyncTrace('mutation_coalesced', {
      entity_id: normalized.entity_id,
      removed_ops: plan.removeOpIDs.length,
      mode: plan.mode,
    });
  }
  if (plan.mode === 'drop_entity_ops' && !plan.normalized) {
    if (schedule) {
      scheduleSync();
    }
    return;
  }

  const finalOp = plan.normalized || normalized;
  await enqueueOutbox(finalOp);
  emitSyncTrace('mutation_enqueued', {
    op_id: finalOp.op_id,
    op_type: finalOp.op_type,
    entity_id: finalOp.entity_id,
  });
  if (schedule) {
    scheduleSync();
  }
}

export async function forceManualSync() {
  if (running) {
    rerunRequested = true;
    await waitForIdle();
  }
  await runSyncCycle({ silent: false });
}

export async function rebuildLocalDataAndSync() {
  if (running) {
    rerunRequested = true;
    await waitForIdle();
  }

  await safeLocalCall(() => clearAllLocalData(), null, 'clearAllLocalData');

  if (queryClientRef) {
    queryClientRef.setQueryData(queryKeys.tasks.all, []);
    queryClientRef.setQueryData(queryKeys.categories.all, []);
    queryClientRef.setQueryData(queryKeys.sync.lastPull, '');
    queryClientRef.removeQueries({ queryKey: ['calendar'] });
  }

  await runSyncCycle({ silent: false });
}

export function initializeSyncEngine(queryClient) {
  if (initialized) return;
  initialized = true;
  queryClientRef = queryClient;

  hydrateFromLocal().finally(() => {
    runSyncCycle({ silent: true });
  });

  if (typeof window !== 'undefined') {
    const onOnline = () => {
      if (!isAutoSyncEnabled()) return;
      scheduleSync();
    };
    const onVisible = () => {
      if (document.hidden || !isAutoSyncEnabled()) return;
      scheduleSync();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);

    resetSyncIntervalTimer();
  }
}

export function stopSyncEngine() {
  if (intervalID && typeof window !== 'undefined') {
    window.clearInterval(intervalID);
  }
  intervalID = null;
  initialized = false;
  running = false;
  rerunRequested = false;
  queryClientRef = null;
}

export function getConfiguredSyncIntervalSeconds() {
  return readSyncIntervalSecondsFromStorage();
}

export function setConfiguredSyncIntervalSeconds(seconds) {
  const normalized = clampSyncIntervalSeconds(seconds);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SYNC_INTERVAL_STORAGE_KEY, String(normalized));
    } catch {
      // ignore storage write error
    }
    if (initialized) {
      resetSyncIntervalTimer();
    }
  }
  return normalized;
}

export function onSyncCycleFinished(callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }
  syncFinishedListeners.add(callback);
  return () => {
    syncFinishedListeners.delete(callback);
  };
}
