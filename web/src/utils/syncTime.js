import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

export function toServerRangeBoundary(value, timezone) {
  if (!value) return null;
  if (!timezone || timezone === 'UTC') {
    return dayjs(value).utc().toISOString();
  }

  // Calendar is rendered in UTC with timezone-projected wall-clock values.
  // Convert that wall-clock value back into a real UTC timestamp for API calls.
  const wallClock = dayjs(value).utc().format('YYYY-MM-DDTHH:mm:ss.SSS');
  return dayjs.tz(wallClock, 'YYYY-MM-DDTHH:mm:ss.SSS', timezone).utc().toISOString();
}
