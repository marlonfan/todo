const listeners = new Set();
const MAX_FAILURES = 20;

let failures = [];
let nextFailureID = 1;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTaskID(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function cloneFailure(item) {
  return { ...item };
}

function emit() {
  const snapshot = failures.map(cloneFailure);
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.error('sync failure listener failed:', error);
    }
  });
}

export function getSyncFailures() {
  return failures.map(cloneFailure);
}

export function pushSyncFailure(input = {}) {
  const taskID = normalizeTaskID(input.task_id ?? input.taskID);
  const normalized = {
    id: nextFailureID,
    task_id: taskID,
    task_title: normalizeText(input.task_title ?? input.taskTitle),
    message: normalizeText(input.message) || 'sync failed',
    occurred_at: new Date().toISOString(),
  };
  const existingIndex = taskID > 0
    ? failures.findIndex((item) => Number(item?.task_id || 0) === taskID)
    : -1;
  if (existingIndex >= 0) {
    normalized.id = failures[existingIndex].id;
    failures = [normalized, ...failures.filter((_, index) => index !== existingIndex)];
    emit();
    return normalized.id;
  }

  nextFailureID += 1;
  failures = [normalized, ...failures].slice(0, MAX_FAILURES);
  emit();
  return normalized.id;
}

export function removeSyncFailure(failureID) {
  const numericID = Number.parseInt(failureID, 10);
  if (!Number.isFinite(numericID) || numericID <= 0) return;
  const next = failures.filter((item) => Number(item?.id || 0) !== numericID);
  if (next.length === failures.length) return;
  failures = next;
  emit();
}

export function removeSyncFailureForTask(taskID) {
  const numericTaskID = normalizeTaskID(taskID);
  if (!numericTaskID) return;
  const next = failures.filter((item) => Number(item?.task_id || 0) !== numericTaskID);
  if (next.length === failures.length) return;
  failures = next;
  emit();
}

export function clearSyncFailures() {
  if (!failures.length) return;
  failures = [];
  emit();
}

export function subscribeSyncFailures(callback) {
  if (typeof callback !== 'function') return () => {};
  listeners.add(callback);
  callback(getSyncFailures());
  return () => listeners.delete(callback);
}
