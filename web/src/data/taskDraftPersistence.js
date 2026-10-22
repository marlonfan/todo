// Drafts remain recoverable until their outbox entry is durably written. The
// synchronous journal also covers IndexedDB quota/transaction failures.
export const TASK_DRAFT_RECOVERY_PREFIX = 'todo:task-draft-recovery:v1:';

function entryKey(taskID, payload) {
  return JSON.stringify([Number(taskID), payload?.instance_id || '', payload?.occurrence_date || '']);
}

export function createTaskDraftPersistence({ write, storage, storageKey }) {
  const entries = new Map();
  const remappedIDs = new Map();
  const listeners = new Set();
  let snapshot = [];
  let queue = Promise.resolve();
  let closed = false;

  function publish() {
    snapshot = Array.from(entries.values());
    listeners.forEach((listener) => listener());
  }

  function checkpoint() {
    try {
      if (!storage || !storageKey) return false;
      if (entries.size) {
        storage.setItem(storageKey, JSON.stringify(Array.from(entries.values())));
      } else {
        storage.removeItem(storageKey);
      }
      return true;
    } catch {
      // Keep the in-memory copy and the unload guard when both stores fail.
      return false;
    }
  }

  try {
    const saved = storageKey && storage?.getItem(storageKey);
    const restored = saved ? JSON.parse(saved) : [];
    if (Array.isArray(restored)) {
      restored.forEach((item) => {
        if (!Number.isFinite(item?.taskID) || !item.taskID || !item.payload || typeof item.payload !== 'object') return;
        const key = entryKey(item.taskID, item.payload);
        entries.set(key, { ...item, key, status: 'recovered', backupSaved: true });
      });
    }
  } catch {
    // A corrupt/unavailable backup must not prevent opening the task page.
  }
  publish();

  function save(taskID, payload, options = {}) {
    if (closed) return Promise.resolve();
    const remappedID = remappedIDs.get(Number(taskID));
    if (remappedID) {
      taskID = remappedID;
      options = { ...options, taskCreation: false };
    }
    // Capture the payload before later edits can change it. Each occurrence has
    // its own recovery entry; saving one must not erase another occurrence.
    const entry = {
      key: entryKey(taskID, payload), taskID: Number(taskID),
      payload: JSON.parse(JSON.stringify(payload)),
      options: { ...options, awaitPersist: true },
      status: 'saving', backupSaved: false,
    };
    entries.set(entry.key, entry);
    entry.backupSaved = checkpoint();
    publish();

    const work = async () => {
      if (closed) return undefined;
      try {
        const result = await write(entry.taskID, entry.payload, entry.options);
        if (entries.get(entry.key) === entry) {
          if (entry.options.localOnly) {
            entries.set(entry.key, { ...entry, status: 'staged' });
          } else {
            entries.delete(entry.key);
          }
          checkpoint();
          publish();
        }
        return result;
      } catch (error) {
        if (entries.get(entry.key) === entry) {
          entries.set(entry.key, { ...entry, status: 'failed' });
          checkpoint();
          publish();
        }
        throw error;
      }
    };
    const pending = queue.then(work, work);
    queue = pending.catch(() => {});
    return pending;
  }

  function retry() {
    return Promise.allSettled(Array.from(entries.values()).map((entry) => save(
      entry.taskID, entry.payload, {
        ...entry.options, localOnly: false, scheduleSync: true,
        submitMeta: { submittedAt: new Date().toISOString(), submitSource: 'draft_recovery' },
      },
    )));
  }

  function remapTaskID(fromID, toID) {
    remappedIDs.set(Number(fromID), Number(toID));
    Array.from(entries.values()).forEach((entry) => {
      if (entry.taskID !== Number(fromID)) return;
      entries.delete(entry.key);
      entry.taskID = Number(toID);
      entry.key = entryKey(toID, entry.payload);
      entry.options = { ...entry.options, taskCreation: false };
      if (!entries.has(entry.key)) entries.set(entry.key, entry);
    });
    checkpoint();
    publish();
  }

  return {
    save, retry, remapTaskID,
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    async close() {
      closed = true;
      await queue;
      entries.clear();
      remappedIDs.clear();
      checkpoint();
      publish();
    },
  };
}

// One journal per authenticated session, shared when the task page remounts.
const sessions = new Map();
export function getTaskDraftPersistence(accountID, dependencies) {
  const key = String(accountID || '');
  if (!sessions.has(key)) {
    sessions.set(key, createTaskDraftPersistence({
      ...dependencies, storageKey: key ? `${TASK_DRAFT_RECOVERY_PREFIX}${key}` : null,
    }));
  }
  return sessions.get(key);
}

export async function clearTaskDraftRecovery() {
  await Promise.all(Array.from(sessions.values(), (session) => session.close()));
  sessions.clear();
  try {
    const storage = globalThis.localStorage;
    const keys = Array.from({ length: storage?.length || 0 }, (_, i) => storage.key(i));
    keys.filter((key) => key?.startsWith(TASK_DRAFT_RECOVERY_PREFIX))
      .forEach((key) => storage.removeItem(key));
  } catch { /* Storage may be disabled. In-memory copies are still cleared. */ }
}
