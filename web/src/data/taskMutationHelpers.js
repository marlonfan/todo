export function isOccurrenceScopedPayload(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  return !!(body.instance_id || body.occurrence_date);
}

export function hasBaseTaskPatchPayload(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  if (!isOccurrenceScopedPayload(body)) return true;
  return [
    'title',
    'priority',
    'status',
    'start_time',
    'end_time',
    'start_time_local',
    'end_time_local',
    'all_day',
    'due_date',
    'recurrence_rule',
    'recurrence_end_date',
    'category_ids',
  ].some((field) => Object.prototype.hasOwnProperty.call(body, field));
}

export function normalizeOccurrenceDateText(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }
  const dateLike = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateLike) {
    return dateLike[1];
  }
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return '';
}

export function patchOccurrenceDescriptionInItems(items, taskID, scopedInstanceID, scopedDate, nextDescription) {
  if (!Array.isArray(items) || items.length === 0) return items;
  let changed = false;
  const next = items.map((item) => {
    const itemTaskID = Number(item?.task_id || item?.taskID || item?.source_task_id || item?.sourceTaskID || item?.id || 0);
    if (!itemTaskID || itemTaskID !== taskID) return item;
    const itemInstanceID = String(item?.instance_id || item?.instanceId || '').trim();
    const itemDate = normalizeOccurrenceDateText(
      item?.occurrence_date
      || item?.occurrenceDate
      || item?.original_date
      || item?.originalDate
      || item?.start_time
      || item?.startTime
      || '',
    );
    const scopedByInstance = !!(scopedInstanceID && itemInstanceID && scopedInstanceID === itemInstanceID);
    const scopedByDate = !!(scopedDate && itemDate && scopedDate === itemDate);
    if (!scopedByInstance && !scopedByDate) return item;
    if (String(item?.description || '') === nextDescription) return item;
    changed = true;
    return {
      ...item,
      description: nextDescription,
    };
  });
  return changed ? next : items;
}

export function patchOccurrenceScheduleInItems(items, taskID, scopedInstanceID, scopedDate, payload) {
  if (!Array.isArray(items) || items.length === 0) return items;
  const hasStart = Object.prototype.hasOwnProperty.call(payload, 'start_time');
  const hasEnd = Object.prototype.hasOwnProperty.call(payload, 'end_time');
  const hasAllDay = Object.prototype.hasOwnProperty.call(payload, 'all_day');
  if (!hasStart && !hasEnd && !hasAllDay) return items;

  let changed = false;
  const next = items.map((item) => {
    const itemTaskID = Number(item?.task_id || item?.taskID || item?.source_task_id || item?.sourceTaskID || item?.id || 0);
    if (!itemTaskID || itemTaskID !== taskID) return item;
    const itemInstanceID = String(item?.instance_id || item?.instanceId || '').trim();
    const itemDate = normalizeOccurrenceDateText(
      item?.occurrence_date
      || item?.occurrenceDate
      || item?.original_date
      || item?.originalDate
      || item?.start_time
      || item?.startTime
      || '',
    );
    const scopedByInstance = !!(scopedInstanceID && itemInstanceID && scopedInstanceID === itemInstanceID);
    const scopedByDate = !!(scopedDate && itemDate && scopedDate === itemDate);
    if (!scopedByInstance && !scopedByDate) return item;

    const patched = {
      ...item,
      ...(hasStart ? { start_time: payload.start_time, startTime: payload.start_time } : {}),
      ...(hasEnd ? { end_time: payload.end_time, endTime: payload.end_time } : {}),
      ...(hasAllDay ? { all_day: !!payload.all_day, allDay: !!payload.all_day } : {}),
    };
    if (
      patched.start_time === item?.start_time
      && patched.startTime === item?.startTime
      && patched.end_time === item?.end_time
      && patched.endTime === item?.endTime
      && patched.all_day === item?.all_day
      && patched.allDay === item?.allDay
    ) {
      return item;
    }
    changed = true;
    return patched;
  });
  return changed ? next : items;
}
