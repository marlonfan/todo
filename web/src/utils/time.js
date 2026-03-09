import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';

export const DEFAULT_TIMEZONE =
  (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
export const DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export const DATE_FORMAT = 'YYYY-MM-DD';
export const ALLOWED_TIME_GRANULARITIES = [5, 10, 15, 30, 60];
export const DEFAULT_TIME_GRANULARITY = 15;

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const LOCAL_PARSE_LAYOUTS = [
  'YYYY-MM-DD HH:mm:ss',
  'YYYY-MM-DD HH:mm',
  'YYYY-MM-DD',
];

function isTimeDebugEnabled() {
  if (typeof window === 'undefined') return false;
  if (window.__TODO_TIME_DEBUG__ === true) return true;
  try {
    return localStorage.getItem('todo_time_debug') === '1';
  } catch {
    return false;
  }
}

function readTimezoneSnapshot() {
  if (typeof window === 'undefined') {
    return {
      default_timezone: DEFAULT_TIMEZONE,
      stored_timezone: '',
      stored_source: '',
      stored_version: '',
      user_timezone: '',
    };
  }

  let userTimezone = '';
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    userTimezone = typeof user?.timezone === 'string' ? user.timezone : '';
  } catch {
    userTimezone = '';
  }

  return {
    default_timezone: DEFAULT_TIMEZONE,
    stored_timezone: localStorage.getItem('user_timezone') || '',
    stored_source: localStorage.getItem('user_timezone_source') || '',
    stored_version: localStorage.getItem('user_timezone_version') || '',
    user_timezone: userTimezone,
  };
}

export function getTimezoneDebugInfo() {
  const snapshot = readTimezoneSnapshot();
  return {
    ...snapshot,
    resolved_timezone: getUserTimezone(),
  };
}

export function logTimeDebug(scope, payload = {}) {
  if (!isTimeDebugEnabled()) return;
  const snapshot = readTimezoneSnapshot();
  let resolvedTimezone = '';
  try {
    resolvedTimezone = getUserTimezone();
  } catch (error) {
    resolvedTimezone = '';
    console.warn('[time-debug] failed to resolve timezone', error);
  }
  console.info('[time-debug]', {
    scope,
    ...snapshot,
    resolved_timezone: resolvedTimezone,
    ...payload,
  });
}

function parseStoredUser() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

export function getUserTimezone() {
  if (typeof window === 'undefined') {
    return DEFAULT_TIMEZONE;
  }

  const storedTimezone = localStorage.getItem('user_timezone');
  if (storedTimezone) {
    const source = localStorage.getItem('user_timezone_source');
    const version = localStorage.getItem('user_timezone_version');
    const isLegacySource = !source || source === 'manual' || version !== '2';
    // Legacy cleanup: previous versions could accidentally persist UTC globally.
    if (isLegacySource && storedTimezone === 'UTC' && DEFAULT_TIMEZONE !== 'UTC') {
      localStorage.removeItem('user_timezone');
      localStorage.removeItem('user_timezone_source');
      localStorage.removeItem('user_timezone_version');
    } else {
      return storedTimezone;
    }
  }

  const user = parseStoredUser();
  if (user.timezone && user.timezone !== 'UTC') {
    return user.timezone;
  }

  return DEFAULT_TIMEZONE;
}

export function normalizeTimeGranularity(value, fallback = DEFAULT_TIME_GRANULARITY) {
  const parsed = Number.parseInt(value, 10);
  if (ALLOWED_TIME_GRANULARITIES.includes(parsed)) {
    return parsed;
  }
  return fallback;
}

export function getUserTimeGranularity() {
  const user = parseStoredUser();
  return normalizeTimeGranularity(user.default_time_granularity, DEFAULT_TIME_GRANULARITY);
}

export function getTimeInputStepSeconds() {
  return getUserTimeGranularity() * 60;
}

export function setUserTimezone(tz, persist = true, source = 'session') {
  if (!tz) return;
  dayjs.tz.setDefault(tz);

  if (typeof window === 'undefined' || !persist) return;

  localStorage.setItem('user_timezone', tz);
  localStorage.setItem('user_timezone_source', source);
  localStorage.setItem('user_timezone_version', '2');

  const user = parseStoredUser();
  if (Object.keys(user).length > 0) {
    localStorage.setItem('user', JSON.stringify({ ...user, timezone: tz }));
  }
}

export function formatDateTime(date, format = DATE_TIME_FORMAT, timezoneName = null) {
  if (!date) return '-';
  const tz = timezoneName || getUserTimezone();
  return dayjs(date).tz(tz).format(format);
}

export function formatDate(date, timezoneName = null) {
  return formatDateTime(date, DATE_FORMAT, timezoneName);
}

export function getNowForInput(timezoneName = null) {
  const tz = timezoneName || getUserTimezone();
  return dayjs().tz(tz).format('YYYY-MM-DDTHH:mm');
}

export function toISOString(localDate, timezoneName = null) {
  if (!localDate) return null;

  const tz = timezoneName || getUserTimezone();
  const normalized = String(localDate).trim().replace('T', ' ');
  let parsed = null;
  let matchedLayout = '';

  for (const layout of LOCAL_PARSE_LAYOUTS) {
    try {
      const candidate = dayjs.tz(normalized, layout, tz);
      if (candidate.isValid()) {
        parsed = candidate;
        matchedLayout = layout;
        break;
      }
    } catch (error) {
      logTimeDebug('toISOString.parse_error', {
        input: String(localDate),
        normalized,
        timezone: tz,
        parse_format: layout,
        error: error?.message || String(error),
      });
    }
  }

  if (!parsed || !parsed.isValid()) {
    logTimeDebug('toISOString.invalid', {
      input: String(localDate),
      normalized,
      timezone: tz,
      parse_formats: LOCAL_PARSE_LAYOUTS,
    });
    return null;
  }

  const iso = parsed.toISOString();
  logTimeDebug('toISOString.converted', {
    input: String(localDate),
    normalized,
    timezone: tz,
    parse_format: matchedLayout,
    output: iso,
  });
  return iso;
}

export function fromISOString(isoString, format = DATE_TIME_FORMAT, timezoneName = null) {
  if (!isoString) return '-';
  const tz = timezoneName || getUserTimezone();
  return dayjs(isoString).tz(tz).format(format);
}

export function toInputFormat(isoString, timezoneName = null, allDay = false) {
  if (!isoString) return '';
  const tz = timezoneName || getUserTimezone();
  const parsed = dayjs(isoString);
  if (!parsed.isValid()) {
    logTimeDebug('toInputFormat.invalid', {
      input: String(isoString),
      timezone: tz,
      all_day: !!allDay,
    });
    return '';
  }
  const localized = parsed.tz(tz);
  if (!localized.isValid()) {
    logTimeDebug('toInputFormat.invalid_localized', {
      input: String(isoString),
      timezone: tz,
      all_day: !!allDay,
    });
    return '';
  }
  return localized.format(allDay ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm');
}

export function nowInTimezone(timezoneName = null) {
  const tz = timezoneName || getUserTimezone();
  return dayjs().tz(tz);
}

if (typeof window !== 'undefined') {
  dayjs.tz.setDefault(getUserTimezone());
}
