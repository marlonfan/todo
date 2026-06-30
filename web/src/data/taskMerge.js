function nowISO() {
  return new Date().toISOString();
}

export function getTaskTimestamp(task) {
  const value = task?.client_updated_at || task?.updated_at || task?.created_at || '';
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : 0;
}

export function normalizeServerTask(task) {
  const revision = Number(task?.revision || 1);
  return {
    ...task,
    revision,
    sync_state: 'synced',
    client_updated_at: task?.updated_at || nowISO(),
    last_error: '',
  };
}

export function collectPendingDeleteTaskIDs(outboxOps) {
  const list = Array.isArray(outboxOps) ? outboxOps : [];
  const pending = new Set();
  list.forEach((op) => {
    if (!op || op.entity_type !== 'task' || op.op_type !== 'delete') return;
    const id = Number(op.entity_id);
    if (Number.isFinite(id) && id > 0) {
      pending.add(id);
    }
  });
  return pending;
}

function isUnsyncedTaskState(state) {
  return state === 'pending' || state === 'syncing' || state === 'staged' || state === 'error';
}

function hasPendingOutboxForTask(outboxOps, taskID) {
  const numericID = Number(taskID || 0);
  if (!numericID) return false;
  return (Array.isArray(outboxOps) ? outboxOps : []).some((op) => (
    op
    && op.entity_type === 'task'
    && Number(op.entity_id || 0) === numericID
  ));
}

function shouldKeepLocalTask(localTask, incomingTask, outboxOps, options = {}) {
  if (!localTask || !incomingTask) return false;
  const state = String(localTask.sync_state || '');
  const localTs = getTaskTimestamp(localTask);
  const incomingTs = getTaskTimestamp(incomingTask);
  if (!isUnsyncedTaskState(state)) {
    return localTs > incomingTs;
  }

  const preserveLocalChangedAfter = Number(options.preserveLocalChangedAfter || 0);
  if (preserveLocalChangedAfter > 0 && localTs > preserveLocalChangedAfter) {
    return true;
  }

  const hasQueuedMutation = hasPendingOutboxForTask(outboxOps, incomingTask.id);
  if (hasQueuedMutation && (state === 'pending' || state === 'syncing')) {
    return true;
  }
  if ((state === 'staged' || state === 'error') && localTs > incomingTs) {
    return true;
  }
  return false;
}

function shouldKeepMissingLocalTask(localTask, incomingIDSet, outboxOps, options = {}) {
  if (!localTask || incomingIDSet.has(localTask.id)) return false;
  const state = String(localTask.sync_state || '');
  if (!isUnsyncedTaskState(state)) return false;
  if (hasPendingOutboxForTask(outboxOps, localTask.id)) return true;
  if (Number(localTask.id) < 0) return true;
  const preserveLocalChangedAfter = Number(options.preserveLocalChangedAfter || 0);
  return preserveLocalChangedAfter > 0 && getTaskTimestamp(localTask) > preserveLocalChangedAfter;
}

export function mergeIncomingTasksWithLocal(incomingTasks, localTasks, options = {}) {
  const pendingDeleteIDs = options.pendingDeleteIDs instanceof Set ? options.pendingDeleteIDs : new Set();
  const outboxOps = Array.isArray(options.outboxOps) ? options.outboxOps : [];
  const preserveLocalChangedAfter = Number(options.preserveLocalChangedAfter || 0);
  const incomingList = (Array.isArray(incomingTasks) ? incomingTasks : [])
    .filter((task) => !pendingDeleteIDs.has(Number(task?.id)));
  const localList = Array.isArray(localTasks) ? localTasks : [];
  if (preserveLocalChangedAfter > 0) {
    const hasNewerLocalEdit = localList.some((task) => {
      const state = String(task?.sync_state || '');
      return isUnsyncedTaskState(state) && getTaskTimestamp(task) > preserveLocalChangedAfter;
    });
    if (!hasNewerLocalEdit && outboxOps.length === 0 && pendingDeleteIDs.size === 0) {
      return incomingList;
    }
  }

  const localByID = new Map();
  localList.forEach((task) => {
    if (!task) return;
    localByID.set(task.id, task);
  });

  const merged = incomingList.map((incomingTask) => {
    const localTask = localByID.get(incomingTask.id);
    if (shouldKeepLocalTask(localTask, incomingTask, outboxOps, options)) {
      return {
        ...localTask,
        updated_at: incomingTask.updated_at || localTask.updated_at,
      };
    }
    return incomingTask;
  });

  const incomingIDSet = new Set(incomingList.map((task) => task.id));
  localList.forEach((task) => {
    if (!task) return;
    if (pendingDeleteIDs.has(Number(task.id))) return;
    if (shouldKeepMissingLocalTask(task, incomingIDSet, outboxOps, options)) {
      merged.push(task);
    }
  });

  return merged;
}

export function mergeServerAndLocalTasks(serverTasks, localTasks, options = {}) {
  const pendingDeleteIDs = options.pendingDeleteIDs instanceof Set ? options.pendingDeleteIDs : new Set();
  const outboxOps = Array.isArray(options.outboxOps) ? options.outboxOps : [];
  const serverList = (Array.isArray(serverTasks) ? serverTasks : [])
    .filter((task) => !pendingDeleteIDs.has(Number(task?.id)));
  const localList = Array.isArray(localTasks) ? localTasks : [];
  return mergeIncomingTasksWithLocal(
    serverList.map((task) => normalizeServerTask(task)),
    localList,
    { ...options, pendingDeleteIDs, outboxOps }
  );
}
