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

function hasPendingOutboxForTask(outboxOps, taskID) {
  const numericID = Number(taskID || 0);
  if (!numericID) return false;
  return (Array.isArray(outboxOps) ? outboxOps : []).some((op) => (
    op
    && op.entity_type === 'task'
    && Number(op.entity_id || 0) === numericID
  ));
}

export function mergeServerAndLocalTasks(serverTasks, localTasks, options = {}) {
  const pendingDeleteIDs = options.pendingDeleteIDs instanceof Set ? options.pendingDeleteIDs : new Set();
  const outboxOps = Array.isArray(options.outboxOps) ? options.outboxOps : [];
  const serverList = (Array.isArray(serverTasks) ? serverTasks : [])
    .filter((task) => !pendingDeleteIDs.has(Number(task?.id)));
  const localList = Array.isArray(localTasks) ? localTasks : [];

  const localByID = new Map();
  localList.forEach((task) => {
    if (!task) return;
    localByID.set(task.id, task);
  });

  const merged = serverList.map((task) => {
    const localTask = localByID.get(task.id);
    const hasQueuedMutation = hasPendingOutboxForTask(outboxOps, task.id);
    if (localTask && hasQueuedMutation && (localTask.sync_state === 'pending' || localTask.sync_state === 'syncing')) {
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
    if (pendingDeleteIDs.has(Number(task.id))) return;
    const state = String(task.sync_state || '');
    const isUnsyncedLocal = state === 'pending' || state === 'syncing' || state === 'error';
    if (isUnsyncedLocal && !serverIDSet.has(task.id) && hasPendingOutboxForTask(outboxOps, task.id)) {
      merged.push(task);
    }
  });

  return merged;
}
