import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

export function toServerRangeBoundary(value, timezone) {
  if (!value) return null;
  if (timezone === 'UTC') {
    return dayjs(value).utc().toISOString();
  }
  return dayjs.utc(value).tz(timezone, true).utc().toISOString();
}
