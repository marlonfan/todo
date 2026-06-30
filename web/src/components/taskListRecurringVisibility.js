const UNSYNCED_TASK_STATES = new Set(['pending', 'syncing', 'staged', 'error']);

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function isTaskUnsyncedLocally(task) {
  const syncState = normalizeText(task?.sync_state || task?.syncState);
  if (!syncState) return false;
  return UNSYNCED_TASK_STATES.has(syncState);
}

export function shouldHideRecurringSeriesAnchorInPending(options = {}) {
  const task = options?.task || null;
  const hasNextPending = !!options?.hasNextPending;
  const nextOccurrencesFetched = !!options?.nextOccurrencesFetched;

  if (hasNextPending) return false;
  if (!nextOccurrencesFetched) return false;
  if (normalizeText(task?.status) !== 'pending') return false;
  if (isTaskUnsyncedLocally(task)) return false;
  return true;
}
