export function nowISO() {
  return new Date().toISOString();
}

export function isOccurrenceScopedPayload(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  return !!(
    String(body.instance_id || '').trim()
    || String(body.occurrence_date || '').trim()
  );
}

export function sanitizeConflictPayload(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const sanitized = { ...payload };
  delete sanitized.client_timezone;
  delete sanitized.start_time_local;
  delete sanitized.end_time_local;
  return sanitized;
}

export function normalizeClientSubmittedAt(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return '';
  return new Date(parsed).toISOString();
}
