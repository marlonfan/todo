const listeners = new Set();
const MAX_CONFLICTS = 20;

let conflicts = [];
let nextConflictID = 1;

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeTaskID(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

function normalizeOccurredAt(value) {
  const parsed = typeof value === 'string' ? Date.parse(value.trim()) : NaN;
  if (!Number.isFinite(parsed)) return new Date().toISOString();
  return new Date(parsed).toISOString();
}

function cloneConflict(item) {
  return {
    ...deepClone(item),
    count: Number(item?.count || 1) || 1,
  };
}

function deepClone(value) {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function emit() {
  const snapshot = conflicts.map((item) => cloneConflict(item));
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.error('sync conflict listener failed:', error);
    }
  });
}

export function getSyncConflicts() {
  return conflicts.map((item) => cloneConflict(item));
}

export function pushSyncConflict(input = {}) {
  const taskID = normalizeTaskID(input.task_id ?? input.taskID);
  const normalized = {
    id: nextConflictID,
    task_id: taskID,
    task_title: normalizeText(input.task_title ?? input.taskTitle),
    op_type: normalizeText(input.op_type ?? input.opType),
    message: normalizeText(input.message),
    latest_revision: Number.parseInt(input.latest_revision ?? input.latestRevision, 10) || 0,
    submit_source: normalizeText(input.submit_source ?? input.submitSource),
    occurred_at: normalizeOccurredAt(input.occurred_at ?? input.occurredAt),
    local_payload: deepClone(input.local_payload ?? input.localPayload ?? {}),
    latest_task: deepClone(input.latest_task ?? input.latestTask ?? null),
    count: 1,
  };

  if (taskID > 0) {
    const existingIndex = conflicts.findIndex((item) => Number(item?.task_id || 0) === taskID);
    if (existingIndex >= 0) {
      const current = conflicts[existingIndex];
      normalized.id = current.id;
      normalized.count = Number(current?.count || 1) + 1;
      conflicts = [
        normalized,
        ...conflicts.filter((_, index) => index !== existingIndex),
      ];
      emit();
      return normalized.id;
    }
  }

  nextConflictID += 1;
  conflicts = [normalized, ...conflicts].slice(0, MAX_CONFLICTS);
  emit();
  return normalized.id;
}

export function removeSyncConflict(conflictID) {
  const numericID = Number.parseInt(conflictID, 10);
  if (!Number.isFinite(numericID) || numericID <= 0) return;
  const next = conflicts.filter((item) => Number(item?.id || 0) !== numericID);
  if (next.length === conflicts.length) return;
  conflicts = next;
  emit();
}

export function clearSyncConflicts() {
  if (!conflicts.length) return;
  conflicts = [];
  emit();
}

export function subscribeSyncConflicts(callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }
  listeners.add(callback);
  callback(getSyncConflicts());
  return () => {
    listeners.delete(callback);
  };
}
