import {
  isOccurrenceScopedPayload,
  sanitizeConflictPayload,
} from './syncPayload.js';

const CONFLICT_EXCLUDED_FIELDS = new Set([
  'client_timezone',
  'start_time_local',
  'end_time_local',
  'instance_id',
  'occurrence_date',
]);

function stableSerialize(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function readLatestTaskField(latestTask, field) {
  const latest = latestTask && typeof latestTask === 'object' ? latestTask : {};
  if (field === 'category_ids') {
    if (Array.isArray(latest.category_ids)) return latest.category_ids;
    if (Array.isArray(latest.categories)) return latest.categories.map((item) => item?.id);
    return [];
  }
  if (field === 'start_time') return latest.start_time ?? latest.startTime ?? null;
  if (field === 'end_time') return latest.end_time ?? latest.endTime ?? null;
  if (field === 'due_date') return latest.due_date ?? latest.dueDate ?? null;
  if (field === 'all_day') return typeof latest.all_day === 'boolean' ? latest.all_day : !!latest.allDay;
  if (field === 'recurrence_rule') return latest.recurrence_rule ?? latest.recurrenceRule ?? null;
  if (field === 'recurrence_end_date') return latest.recurrence_end_date ?? latest.recurrenceEndDate ?? null;
  return latest[field];
}

function normalizeComparableValue(field, value) {
  if (field === 'priority') return Number.parseInt(value, 10) || 0;
  if (field === 'all_day') return !!value;
  if (field === 'category_ids') {
    if (!Array.isArray(value)) return [];
    return value
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => Number.isFinite(id))
      .sort((a, b) => a - b);
  }
  if (field === 'start_time' || field === 'end_time' || field === 'due_date' || field === 'recurrence_end_date') {
    return value || null;
  }
  if (field === 'recurrence_rule') return value || null;
  return value;
}

export function isPayloadAlreadyAppliedOnLatest(op, latestTask) {
  if (!op || !latestTask || typeof latestTask !== 'object') return false;
  if (op.op_type === 'delete') return false;
  const payload = sanitizeConflictPayload(op.payload);
  const keys = Object.keys(payload || {}).filter((field) => !CONFLICT_EXCLUDED_FIELDS.has(field));
  if (keys.length === 0) return false;
  if (isOccurrenceScopedPayload(payload)) return false;
  return keys.every((field) => {
    const local = normalizeComparableValue(field, payload[field]);
    const latest = normalizeComparableValue(field, readLatestTaskField(latestTask, field));
    return stableSerialize(local) === stableSerialize(latest);
  });
}
