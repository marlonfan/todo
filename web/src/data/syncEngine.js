import { categoriesAPI, tasksAPI } from '../api/client';
import { queryKeys } from '../query/keys';
import {
  clearAllLocalData,
  enqueueOutbox,
  getDueOutbox,
  getMeta,
  readCategories,
  readOutbox,
  readTasks,
  remapOutboxEntityID,
  removeOutbox,
  removeTask,
  replaceCategories,
  replaceTaskID,
  setMeta,
  upsertTask,
  upsertTasks,
  updateOutbox,
} from './localStore';
import { getCoalescePlan } from './outboxCoalesce';

const SYNC_INTERVAL_MS = 15 * 1000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

let queryClientRef = null;
let initialized = false;
let running = false;
let rerunRequested = false;
let intervalID = null;
const syncFinishedListeners = new Set();

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

function hasToken() {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('token'));
}

function nowISO() {
  return new Date().toISOString();
}

function getTaskTimestamp(task) {
  const value = task?.client_updated_at || task?.updated_at || task?.created_at || '';
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : 0;
}

function normalizeServerTask(task) {
  const revision = Number(task?.revision || 1);
  return {
    ...task,
    revision,
    sync_state: 'synced',
    client_updated_at: task?.updated_at || nowISO(),
    last_error: '',
  };
}

function mergeServerAndLocalTasks(serverTasks, localTasks) {
  const serverList = Array.isArray(serverTasks) ? serverTasks : [];
  const localList = Array.isArray(localTasks) ? localTasks : [];

  const localByID = new Map();
  localList.forEach((task) => {
    if (!task) return;
    localByID.set(task.id, task);
  });

  const merged = serverList.map((task) => {
    const localTask = localByID.get(task.id);
    if (localTask && (localTask.sync_state === 'pending' || localTask.sync_state === 'syncing')) {
      return {
        ...localTask,
        updated_at: task.updated_at,
      };
    }
    if (localTask && localTask.sync_state === 'error') {
      const localTs = getTaskTimestamp(localTask);
      const serverTs = getTaskTimestamp(task);
      if (localTs > serverTs) {
        return {
          ...localTask,
          updated_at: task.updated_at,
        };
      }
    }
    return normalizeServerTask(task);
  });

  const serverIDSet = new Set(serverList.map((task) => task.id));
  localList.forEach((task) => {
    if (!task) return;
    if (Number(task.id) < 0 || !serverIDSet.has(task.id)) {
      merged.push(task);
    }
  });

  merged.sort((a, b) => getTaskTimestamp(b) - getTaskTimestamp(a));
  return merged;
}

async function patchTaskSyncState(taskID, patch) {
  if (!queryClientRef || !taskID) return;
  let nextTask = null;

  queryClientRef.setQueryData(queryKeys.tasks.all, (prev) => {
    if (!Array.isArray(prev)) return prev;
    return prev.map((task) => {
      if (task.id !== taskID) return task;
      nextTask = {
        ...task,
        ...patch,
        client_updated_at: nowISO(),
      };
      return nextTask;
    });
  });

  if (nextTask) {
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

async function executeOutboxOperation(op) {
  emitSyncTrace('outbox_executing', {
    op_id: op.op_id,
    op_type: op.op_type,
    entity_id: op.entity_id,
  });
  switch (op.op_type) {
    case 'create': {
      const res = await tasksAPI.create(op.payload);
      if (res?.data?.id) {
        await applyServerTask(res.data, op.entity_id);
      }
      return;
    }
    case 'update': {
      const res = await tasksAPI.update(op.entity_id, op.payload, {
        ifMatchRevision: op.if_match_revision,
      });
      if (res?.data?.id) {
        await applyServerTask(res.data);
      } else {
        await patchTaskSyncState(op.entity_id, { sync_state: 'synced', last_error: '' });
      }
      return;
    }
    case 'status': {
      const res = await tasksAPI.updateStatus(op.entity_id, op.payload, {
        ifMatchRevision: op.if_match_revision,
      });
      if (res?.data?.id) {
        await applyServerTask(res.data);
      } else {
        await patchTaskSyncState(op.entity_id, { sync_state: 'synced', last_error: '' });
      }
      return;
    }
    case 'schedule': {
      const res = await tasksAPI.updateSchedule(op.entity_id, op.payload, {
        ifMatchRevision: op.if_match_revision,
      });
      if (res?.data?.id) {
        await applyServerTask(res.data);
      } else {
        await patchTaskSyncState(op.entity_id, { sync_state: 'synced', last_error: '' });
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
      return;
    }
    default:
      throw new Error(`unsupported op_type: ${op.op_type}`);
  }
}

async function handleOutboxFailure(op, error) {
  const status = error?.response?.status;
  const message = getErrorMessage(error);

  if (status === 409) {
    await removeOutbox(op.op_id);
    const latest = error?.response?.data?.latest;
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
    const dueOps = await getDueOutbox(Date.now(), 30);
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

  const [tasksRes, categoriesRes] = await Promise.all([
    tasksAPI.list(),
    categoriesAPI.list(),
  ]);

  const serverTasks = Array.isArray(tasksRes?.data) ? tasksRes.data : [];
  const categories = Array.isArray(categoriesRes?.data) ? categoriesRes.data : [];
  const localTasks = queryClientRef.getQueryData(queryKeys.tasks.all) || await readTasks();
  const mergedTasks = mergeServerAndLocalTasks(serverTasks, localTasks);

  queryClientRef.setQueryData(queryKeys.tasks.all, mergedTasks);
  queryClientRef.setQueryData(queryKeys.categories.all, categories);

  await Promise.all([
    upsertTasks(mergedTasks),
    replaceCategories(categories),
    setMeta('last_pull_at', nowISO()),
  ]);
  emitSyncTrace('pull_merged', {
    server_tasks: serverTasks.length,
    merged_tasks: mergedTasks.length,
    categories: categories.length,
  });
}

async function hydrateFromLocal() {
  if (!queryClientRef) return;
  const [tasks, categories, lastPullAt] = await Promise.all([
    readTasks(),
    readCategories(),
    getMeta('last_pull_at', ''),
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

export async function enqueueTaskOperation(op) {
  const now = Date.now();
  const normalized = {
    ...op,
    retry_count: Number(op.retry_count || 0),
    next_retry_at: Number(op.next_retry_at || now),
    created_at: Number(op.created_at || now),
    if_match_revision: Number(op.if_match_revision || 0) || undefined,
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
    scheduleSync();
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
    scheduleSync();
    return;
  }

  const finalOp = plan.normalized || normalized;
  await enqueueOutbox(finalOp);
  emitSyncTrace('mutation_enqueued', {
    op_id: finalOp.op_id,
    op_type: finalOp.op_type,
    entity_id: finalOp.entity_id,
  });
  scheduleSync();
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

  await clearAllLocalData();

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
    const onOnline = () => scheduleSync();
    const onVisible = () => {
      if (!document.hidden) scheduleSync();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);

    intervalID = window.setInterval(() => {
      scheduleSync();
    }, SYNC_INTERVAL_MS);
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

export function onSyncCycleFinished(callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }
  syncFinishedListeners.add(callback);
  return () => {
    syncFinishedListeners.delete(callback);
  };
}
