import { categoriesAPI, tasksAPI } from '../api/client';
import { queryKeys } from '../query/keys';
import {
  enqueueOutbox,
  getDueOutbox,
  getMeta,
  readCategories,
  readTasks,
  remapOutboxEntityID,
  removeOutbox,
  replaceCategories,
  replaceTaskID,
  setMeta,
  upsertTask,
  upsertTasks,
  updateOutbox,
} from './localStore';

const SYNC_INTERVAL_MS = 15 * 1000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

let queryClientRef = null;
let initialized = false;
let running = false;
let rerunRequested = false;
let intervalID = null;

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
  return {
    ...task,
    sync_state: 'synced',
    client_updated_at: task?.updated_at || nowISO(),
    last_error: '',
  };
}

function mergeServerAndLocalTasks(serverTasks, localTasks) {
  const serverList = Array.isArray(serverTasks) ? serverTasks : [];
  const localList = Array.isArray(localTasks) ? localTasks : [];

  const unsyncedByID = new Map();
  localList.forEach((task) => {
    if (!task) return;
    if (Number(task.id) < 0 || task.sync_state === 'pending' || task.sync_state === 'syncing' || task.sync_state === 'error') {
      unsyncedByID.set(task.id, task);
    }
  });

  const merged = serverList.map((task) => {
    const localUnsynced = unsyncedByID.get(task.id);
    if (localUnsynced) {
      return {
        ...localUnsynced,
        updated_at: task.updated_at,
      };
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
  switch (op.op_type) {
    case 'create': {
      const res = await tasksAPI.create(op.payload);
      if (res?.data?.id) {
        await applyServerTask(res.data, op.entity_id);
      }
      return;
    }
    case 'update': {
      const res = await tasksAPI.update(op.entity_id, op.payload);
      if (res?.data?.id) {
        await applyServerTask(res.data);
      } else {
        await patchTaskSyncState(op.entity_id, { sync_state: 'synced', last_error: '' });
      }
      return;
    }
    case 'status': {
      await tasksAPI.updateStatus(op.entity_id, op.payload);
      await patchTaskSyncState(op.entity_id, { sync_state: 'synced', last_error: '' });
      return;
    }
    case 'schedule': {
      await tasksAPI.updateSchedule(op.entity_id, op.payload);
      await patchTaskSyncState(op.entity_id, { sync_state: 'synced', last_error: '' });
      return;
    }
    default:
      throw new Error(`unsupported op_type: ${op.op_type}`);
  }
}

async function handleOutboxFailure(op, error) {
  const status = error?.response?.status;
  const message = getErrorMessage(error);

  if (status && status >= 400 && status < 500 && status !== 429) {
    await removeOutbox(op.op_id);
    await patchTaskSyncState(op.entity_id, { sync_state: 'error', last_error: message });
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

async function runSyncCycle() {
  if (!queryClientRef || running) {
    rerunRequested = true;
    return;
  }
  if (!hasToken()) return;

  running = true;
  try {
    await processOutbox();
    await pullServerData();
    if (queryClientRef) {
      queryClientRef.setQueryData(queryKeys.sync.lastPull, nowISO());
    }
  } catch (error) {
    // Keep silent for background sync; UI uses sync_state markers.
    console.error('Background sync failed:', error);
  } finally {
    running = false;
    if (rerunRequested) {
      rerunRequested = false;
      setTimeout(() => {
        runSyncCycle();
      }, 0);
    }
  }
}

export function scheduleSync() {
  runSyncCycle();
}

export async function enqueueTaskOperation(op) {
  const now = Date.now();
  await enqueueOutbox({
    ...op,
    retry_count: Number(op.retry_count || 0),
    next_retry_at: Number(op.next_retry_at || now),
    created_at: Number(op.created_at || now),
  });
  scheduleSync();
}

export function initializeSyncEngine(queryClient) {
  if (initialized) return;
  initialized = true;
  queryClientRef = queryClient;

  hydrateFromLocal().finally(() => {
    runSyncCycle();
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
