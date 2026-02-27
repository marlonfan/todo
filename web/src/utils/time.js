import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';

export const DEFAULT_TIMEZONE =
  (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
export const DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export const DATE_FORMAT = 'YYYY-MM-DD';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

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
  const parsed = dayjs.tz(
    normalized,
    ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD'],
    tz
  );

  if (!parsed.isValid()) return null;
  return parsed.toISOString();
}

export function fromISOString(isoString, format = DATE_TIME_FORMAT, timezoneName = null) {
  if (!isoString) return '-';
  const tz = timezoneName || getUserTimezone();
  return dayjs(isoString).tz(tz).format(format);
}

export function toInputFormat(isoString, timezoneName = null, allDay = false) {
  if (!isoString) return '';
  const tz = timezoneName || getUserTimezone();
  return dayjs(isoString).tz(tz).format(allDay ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm');
}

export function nowInTimezone(timezoneName = null) {
  const tz = timezoneName || getUserTimezone();
  return dayjs().tz(tz);
}

if (typeof window !== 'undefined') {
  dayjs.tz.setDefault(getUserTimezone());
}
