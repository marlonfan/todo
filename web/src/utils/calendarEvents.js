import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * 将事件数组按天分解
 * @param {Array} events - 事件数组
 * @param {string} timezone - 时区
 * @returns {Object} - Record<YYYY-MM-DD, Event[]>
 */
export function decomposeEventsByDay(events, timezone) {
  const dayMap = {};

  events.forEach(event => {
    if (!event?.start) return;

    const eventStart = dayjs(event.start).tz(timezone);
    const eventEnd = event?.end ? dayjs(event.end).tz(timezone) : eventStart.add(1, 'hour');

    // 收集事件跨越的所有天
    let currentDay = eventStart.startOf('day');
    const endDay = eventEnd.startOf('day');

    do {
      const dayKey = currentDay.format('YYYY-MM-DD');
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = [];
      }
      // 只有事件开始的那天才加入完整事件
      if (currentDay.isSame(eventStart, 'day')) {
        dayMap[dayKey].push(event);
      }
      currentDay = currentDay.add(1, 'day');
    } while (currentDay.isBefore(endDay) || currentDay.isSame(endDay, 'day'));
  });

  return dayMap;
}

/**
 * 获取事件涉及的所有日期
 * @param {Object} event - 事件对象
 * @param {string} timezone - 时区
 * @returns {string[]} - 日期数组 [YYYY-MM-DD, ...]
 */
export function getEventDates(event, timezone) {
  if (!event?.start) return [];

  const dates = [];
  const eventStart = dayjs(event.start).tz(timezone);
  const eventEnd = event?.end ? dayjs(event.end).tz(timezone) : eventStart.add(1, 'hour');

  let currentDay = eventStart.startOf('day');
  const endDay = eventEnd.startOf('day');

  do {
    dates.push(currentDay.format('YYYY-MM-DD'));
    currentDay = currentDay.add(1, 'day');
  } while (currentDay.isBefore(endDay) || currentDay.isSame(endDay, 'day'));

  return dates;
}

/**
 * 过滤指定范围内的事件
 * @param {Array} events - 事件数组
 * @param {string} rangeStart - 范围开始 (ISO)
 * @param {string} rangeEnd - 范围结束 (ISO)
 * @param {number} defaultDurationMinutes - 默认时长（分钟）
 * @returns {Array} - 过滤后的事件数组
 */
export function filterEventsForRange(events, rangeStartISO, rangeEndISO, defaultDurationMinutes = 30) {
  const list = Array.isArray(events) ? events : [];
  if (!rangeStartISO || !rangeEndISO) return list;
  const rangeStart = dayjs(rangeStartISO);
  const rangeEnd = dayjs(rangeEndISO);
  if (!rangeStart.isValid() || !rangeEnd.isValid()) return list;

  return list.filter((event) => {
    const start = dayjs(event?.start);
    if (!start.isValid()) return false;
    const endRaw = event?.end ? dayjs(event.end) : start.add(defaultDurationMinutes, 'minute');
    const end = endRaw.isValid() && endRaw.isAfter(start) ? endRaw : start.add(defaultDurationMinutes, 'minute');
    return start.isBefore(rangeEnd) && end.isAfter(rangeStart);
  });
}
