import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

function normalizeTimezoneName(value) {
  const next = String(value || '').trim();
  return next || 'UTC';
}

function getEventRange(event, timezoneName, defaultDurationMinutes = 60) {
  if (!event?.start) return null;
  const start = dayjs(event.start).tz(timezoneName);
  if (!start.isValid()) return null;

  const endRaw = event?.end ? dayjs(event.end).tz(timezoneName) : start.add(defaultDurationMinutes, 'minute');
  const end = endRaw.isValid() && endRaw.isAfter(start)
    ? endRaw
    : start.add(defaultDurationMinutes, 'minute');

  return { start, end };
}

function resolveInclusiveEndDay(start, end) {
  let endDay = end.startOf('day');
  // Treat exact midnight as exclusive end.
  if (end.isSame(endDay) && end.isAfter(start)) {
    endDay = endDay.subtract(1, 'day');
  }
  return endDay;
}

export function isReadOnlyCalendarEvent(event) {
  const ext = event?.extendedProps || {};
  const source = String(ext.source || '').trim().toLowerCase();
  const provider = String(ext.provider || '').trim().toLowerCase();
  const readOnly = !!ext.readOnly || event?.editable === false;
  return readOnly || source === 'caldav' || provider === 'caldav' || provider === 'feishu';
}

function shouldCreateDailySegments(event) {
  // Editable task events keep single instance to avoid breaking move/resize flows.
  return isReadOnlyCalendarEvent(event);
}

function buildSegmentEvent(event, dayKey, dayStart, dayEnd, eventStart, eventEnd) {
  const segmentStart = eventStart.isAfter(dayStart) ? eventStart : dayStart;
  const segmentEnd = eventEnd.isBefore(dayEnd) ? eventEnd : dayEnd;
  const baseId = String(event?.id || 'event');
  return {
    ...event,
    id: `${baseId}::${dayKey}`,
    start: segmentStart.toISOString(),
    end: segmentEnd.toISOString(),
    extendedProps: {
      ...(event?.extendedProps || {}),
      originalEventId: baseId,
      segmentDate: dayKey,
    },
  };
}

export function buildEventsSignature(events) {
  const list = Array.isArray(events) ? events : [];
  const lines = list.map((event) => {
    const ext = event?.extendedProps || {};
    return [
      String(event?.id || ''),
      String(event?.start || ''),
      String(event?.end || ''),
      String(event?.title || ''),
      String(ext?.status || ''),
      String(ext?.taskId || ''),
      String(ext?.readOnly || ''),
      String(ext?.source || ''),
    ].join('|');
  });
  lines.sort();
  return `${lines.length}:${lines.join('||')}`;
}

/**
 * 将事件数组按天分解
 * @param {Array} events - 事件数组
 * @param {string} timezone - 时区
 * @returns {Object} - Record<YYYY-MM-DD, Event[]>
 */
export function decomposeEventsByDay(events, timezone) {
  const timezoneName = normalizeTimezoneName(timezone);
  const dayMap = {};
  const list = Array.isArray(events) ? events : [];

  list.forEach((event) => {
    const range = getEventRange(event, timezoneName);
    if (!range) return;

    const eventStart = range.start;
    const eventEnd = range.end;
    let currentDay = eventStart.startOf('day');
    const endDay = resolveInclusiveEndDay(eventStart, eventEnd);
    const multiDay = endDay.isAfter(currentDay, 'day');
    const shouldSegment = multiDay && shouldCreateDailySegments(event);

    if (endDay.isBefore(currentDay, 'day')) {
      return;
    }

    do {
      const dayKey = currentDay.format('YYYY-MM-DD');
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = [];
      }

      if (shouldSegment) {
        const dayStart = currentDay.startOf('day');
        const dayEnd = currentDay.endOf('day');
        dayMap[dayKey].push(
          buildSegmentEvent(event, dayKey, dayStart, dayEnd, eventStart, eventEnd)
        );
      } else if (currentDay.isSame(eventStart, 'day')) {
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
  const timezoneName = normalizeTimezoneName(timezone);
  const range = getEventRange(event, timezoneName);
  if (!range) return [];
  const dates = [];
  const eventStart = range.start;
  const eventEnd = range.end;

  let currentDay = eventStart.startOf('day');
  const endDay = resolveInclusiveEndDay(eventStart, eventEnd);

  if (endDay.isBefore(currentDay, 'day')) {
    return [currentDay.format('YYYY-MM-DD')];
  }

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
