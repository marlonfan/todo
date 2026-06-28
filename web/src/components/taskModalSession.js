export function getTaskMutationID(task) {
  const candidates = [
    task?.source_task_id,
    task?.sourceTaskID,
    task?.task_id,
    task?.taskID,
    task?.id,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate || 0);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

export function getTaskInstanceID(task) {
  const value = String(task?.instanceId || task?.instance_id || '').trim();
  return /^\d+_\d{8}$/.test(value) ? value : '';
}

export function normalizeTaskModalOccurrenceKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return raw;
}

export function getTaskModalSessionKey(task, initialRange) {
  if (!task) {
    return [
      'new',
      String(initialRange?.start || ''),
      String(initialRange?.end || ''),
      initialRange?.allDay ? 'all-day' : 'timed',
    ].join('|');
  }

  const occurrenceKey = getTaskInstanceID(task)
    || normalizeTaskModalOccurrenceKey(task?.occurrenceDate || task?.occurrence_date)
    || normalizeTaskModalOccurrenceKey(task?.occurrenceStart || task?.occurrence_start);
  const taskID = getTaskMutationID(task) || String(task?.id || '');
  return ['task', taskID, occurrenceKey].join('|');
}
