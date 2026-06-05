import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

export function parseCalendarDate(value, timezone) {
  const tz = timezone || dayjs.tz.guess();
  const raw = String(value || '').trim();
  if (!raw) {
    return dayjs().tz(tz).startOf('day');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return dayjs.tz(raw, tz).startOf('day');
  }
  const parsed = dayjs(raw);
  if (!parsed.isValid()) {
    return dayjs().tz(tz).startOf('day');
  }
  return parsed.tz(tz).startOf('day');
}

export function getCalendarDisplayEnd(start, spanDays) {
  const days = Math.max(1, Number.parseInt(spanDays, 10) || 1);
  return start.add(days - 1, 'day').endOf('day');
}

export function formatCalendarViewTitle(view, displayStart, displayEnd, timezone) {
  const tz = timezone || dayjs.tz.guess();
  const start = dayjs(displayStart).tz(tz);
  if (!start.isValid()) return '';

  const rawEnd = displayEnd ? dayjs(displayEnd).tz(tz) : start;
  const end = rawEnd.isValid() ? rawEnd : start;

  if (view === 'dayGridMonth') {
    const mid = start.add(end.diff(start, 'minute') / 2, 'minute');
    return mid.format('YYYY年M月');
  }

  if (view === 'timeGridWeek') {
    return `${start.format('YYYY/M/D')} - ${end.format('M/D')}`;
  }

  return start.format('YYYY/M/D');
}
