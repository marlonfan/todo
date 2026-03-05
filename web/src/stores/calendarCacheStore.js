import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const EMPTY_EVENTS_BY_DATE = Object.freeze({});

function normalizeTimezoneName(value) {
  const next = String(value || '').trim();
  return next || 'UTC';
}

function resolveInclusiveEndDay(start, end) {
  let endDay = end.startOf('day');
  if (end.isSame(endDay) && end.isAfter(start)) {
    endDay = endDay.subtract(1, 'day');
  }
  return endDay;
}

function getRangeDayKeys(startDate, endDate, timezoneName) {
  if (!startDate || !endDate) return [];
  const start = dayjs(startDate).tz(timezoneName);
  const end = dayjs(endDate).tz(timezoneName);
  if (!start.isValid() || !end.isValid()) return [];

  const startDay = start.startOf('day');
  const endDay = resolveInclusiveEndDay(start, end);
  if (endDay.isBefore(startDay, 'day')) {
    return [startDay.format('YYYY-MM-DD')];
  }

  const keys = [];
  let current = startDay;
  while (current.isBefore(endDay) || current.isSame(endDay, 'day')) {
    keys.push(current.format('YYYY-MM-DD'));
    current = current.add(1, 'day');
  }
  return keys;
}

function getTimezoneBucket(state, timezoneName) {
  return state.eventsByDateByTimezone?.[timezoneName] || EMPTY_EVENTS_BY_DATE;
}

function getOrCreateTimezoneBucket(state, timezoneName) {
  if (!state.eventsByDateByTimezone[timezoneName]) {
    state.eventsByDateByTimezone[timezoneName] = {};
  }
  return state.eventsByDateByTimezone[timezoneName];
}

/**
 * 全局日历缓存池
 * 结构: Record<Timezone, Record<YYYY-MM-DD, CalendarEvent[]>>
 *
 * 这是日历渲染的「唯一真实数据源 (Single Source of Truth)」
 */
const useCalendarCacheStore = create(
  immer((set, get) => ({
    // Record<Timezone, Record<DateString, CalendarEvent[]>>
    eventsByDateByTimezone: {},

    // 元数据
    metadata: {
      lastSyncAt: null,
      syncInProgress: false,
      loadedRanges: [], // Array of { start, end, timezone }
    },

    // Actions

    /**
     * 获取指定时区的事件映射
     */
    getEventsMapForTimezone: (timezone) => {
      const timezoneName = normalizeTimezoneName(timezone);
      return getTimezoneBucket(get(), timezoneName);
    },

    /**
     * 智能合并：只有当某一天的数据确实发生变更时，才更新引用
     * @param {Object} newEventsByDate - Record<DateString, CalendarEvent[]>
     * @param {string} timezone
     * @returns {Set<string>} - 发生变更的日期集合
     */
    mergeEvents: (newEventsByDate, timezone = 'UTC') => {
      const changedDates = new Set();
      const timezoneName = normalizeTimezoneName(timezone);
      const source = newEventsByDate && typeof newEventsByDate === 'object' ? newEventsByDate : {};

      set((state) => {
        const bucket = getOrCreateTimezoneBucket(state, timezoneName);
        for (const dateString of Object.keys(source)) {
          const nextEvents = Array.isArray(source[dateString]) ? source[dateString] : [];
          const existingEvents = bucket[dateString];

          if (!eventsAreEqual(existingEvents, nextEvents)) {
            bucket[dateString] = nextEvents;
            changedDates.add(dateString);
          }
        }
      });

      return changedDates;
    },

    /**
     * 用服务端返回结果替换指定范围内的缓存。
     * 范围内没返回事件的日期会被写入空数组，防止脏数据残留。
     * @param {string} startDate
     * @param {string} endDate
     * @param {string} timezone
     * @param {Object} newEventsByDate
     * @returns {Set<string>}
     */
    replaceRangeEvents: (startDate, endDate, timezone = 'UTC', newEventsByDate = {}) => {
      const changedDates = new Set();
      const timezoneName = normalizeTimezoneName(timezone);
      const dayKeys = getRangeDayKeys(startDate, endDate, timezoneName);
      if (dayKeys.length === 0) return changedDates;
      const source = newEventsByDate && typeof newEventsByDate === 'object' ? newEventsByDate : {};

      set((state) => {
        const bucket = getOrCreateTimezoneBucket(state, timezoneName);
        dayKeys.forEach((dayKey) => {
          const nextEvents = Array.isArray(source[dayKey]) ? source[dayKey] : [];
          const existingEvents = bucket[dayKey];
          if (!eventsAreEqual(existingEvents, nextEvents)) {
            bucket[dayKey] = nextEvents;
            changedDates.add(dayKey);
          }
        });
      });

      return changedDates;
    },

    /**
     * 批量替换多个已拉取分段，避免在大范围增量拉取时触发过多连续更新。
     * @param {Array<{start:string,end:string,timezone:string,eventsByDate:Object}>} segments
     * @returns {Set<string>}
     */
    replaceFetchedSegments: (segments = []) => {
      const changedDates = new Set();
      const list = Array.isArray(segments) ? segments : [];
      if (list.length === 0) return changedDates;

      set((state) => {
        if (!Array.isArray(state.metadata.loadedRanges)) {
          state.metadata.loadedRanges = [];
        }
        list.forEach((segment) => {
          const startDate = String(segment?.start || '');
          const endDate = String(segment?.end || '');
          const timezoneName = normalizeTimezoneName(segment?.timezone);
          if (!startDate || !endDate) return;
          const dayKeys = getRangeDayKeys(startDate, endDate, timezoneName);
          if (dayKeys.length === 0) return;
          const source = segment?.eventsByDate && typeof segment.eventsByDate === 'object'
            ? segment.eventsByDate
            : {};
          const bucket = getOrCreateTimezoneBucket(state, timezoneName);
          dayKeys.forEach((dayKey) => {
            const nextEvents = Array.isArray(source[dayKey]) ? source[dayKey] : [];
            const existingEvents = bucket[dayKey];
            if (!eventsAreEqual(existingEvents, nextEvents)) {
              bucket[dayKey] = nextEvents;
              changedDates.add(`${timezoneName}|${dayKey}`);
            }
          });
          state.metadata.loadedRanges.push({ start: startDate, end: endDate, timezone: timezoneName, at: Date.now() });
        });
        if (state.metadata.loadedRanges.length > 300) {
          state.metadata.loadedRanges = state.metadata.loadedRanges.slice(-300);
        }
      });

      return changedDates;
    },

    /**
     * 获取指定日期的事件
     * @param {string} dateString
     * @param {string} timezone
     * @returns {CalendarEvent[]}
     */
    getEventsForDate: (dateString, timezone = 'UTC') => {
      const timezoneName = normalizeTimezoneName(timezone);
      const bucket = getTimezoneBucket(get(), timezoneName);
      return bucket[dateString] || [];
    },

    /**
     * 获取指定日期范围内的事件
     * @param {string} startDate
     * @param {string} endDate
     * @param {string} timezone
     * @returns {CalendarEvent[]}
     */
    getEventsForRange: (startDate, endDate, timezone = 'UTC') => {
      const timezoneName = normalizeTimezoneName(timezone);
      const bucket = getTimezoneBucket(get(), timezoneName);
      const dayKeys = getRangeDayKeys(startDate, endDate, timezoneName);
      const events = [];
      dayKeys.forEach((dateString) => {
        const dayEvents = bucket[dateString];
        if (Array.isArray(dayEvents) && dayEvents.length > 0) {
          events.push(...dayEvents);
        }
      });
      return events;
    },

    /**
     * 检查哪些日期在缓存中缺失
     * @param {string} startDate
     * @param {string} endDate
     * @param {string} timezone
     * @returns {string[]} - 缺失的日期数组
     */
    getMissingDates: (startDate, endDate, timezone = 'UTC') => {
      const timezoneName = normalizeTimezoneName(timezone);
      const bucket = getTimezoneBucket(get(), timezoneName);
      const dayKeys = getRangeDayKeys(startDate, endDate, timezoneName);
      const missing = [];
      dayKeys.forEach((dateString) => {
        if (!Object.prototype.hasOwnProperty.call(bucket, dateString)) {
          missing.push(dateString);
        }
      });
      return missing;
    },

    /**
     * 检查整个范围是否都已缓存
     * @param {string} startDate
     * @param {string} endDate
     * @param {string} timezone
     * @returns {boolean}
     */
    isRangeFullyCached: (startDate, endDate, timezone = 'UTC') => {
      return get().getMissingDates(startDate, endDate, timezone).length === 0;
    },

    /**
     * 清除指定日期的缓存（用于数据更新时）
     * @param {string[]} dateStrings
     * @param {string} timezone
     */
    invalidateDates: (dateStrings, timezone = 'UTC') => {
      const timezoneName = normalizeTimezoneName(timezone);
      const list = Array.isArray(dateStrings) ? dateStrings : [];
      if (list.length === 0) return;

      set((state) => {
        const bucket = getOrCreateTimezoneBucket(state, timezoneName);
        list.forEach((dateString) => {
          delete bucket[dateString];
        });
      });
    },

    /**
     * 记录已加载的范围
     * @param {string} start
     * @param {string} end
     * @param {string} timezone
     */
    addLoadedRange: (start, end, timezone) => {
      set((state) => {
        if (!Array.isArray(state.metadata.loadedRanges)) {
          state.metadata.loadedRanges = [];
        }
        state.metadata.loadedRanges.push({ start, end, timezone: normalizeTimezoneName(timezone), at: Date.now() });
        if (state.metadata.loadedRanges.length > 300) {
          state.metadata.loadedRanges = state.metadata.loadedRanges.slice(-300);
        }
      });
    },

    /**
     * 清空缓存
     * @param {string} timezone - 可选，传入则仅清除该时区
     */
    clear: (timezone = '') => {
      const timezoneName = String(timezone || '').trim();
      set((state) => {
        if (timezoneName) {
          delete state.eventsByDateByTimezone[timezoneName];
          state.metadata.loadedRanges = (state.metadata.loadedRanges || []).filter(
            (range) => String(range?.timezone || '') !== timezoneName
          );
          return;
        }

        state.eventsByDateByTimezone = {};
        state.metadata.lastSyncAt = null;
        state.metadata.loadedRanges = [];
      });
    },
  }))
);

/**
 * 深度对比两个事件数组是否相等
 * 用于判断是否需要更新引用
 */
function eventsAreEqual(eventsA, eventsB) {
  if ((!eventsA && eventsB) || (eventsA && !eventsB)) return false;
  if (!eventsA && !eventsB) return true;

  if (eventsA.length !== eventsB.length) return false;

  const sortedA = [...eventsA].sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')));
  const sortedB = [...eventsB].sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')));

  for (let i = 0; i < sortedA.length; i += 1) {
    const eventA = sortedA[i];
    const eventB = sortedB[i];

    if (eventA?.id !== eventB?.id) return false;
    if (eventA?.start !== eventB?.start) return false;
    if (eventA?.end !== eventB?.end) return false;
    if (eventA?.title !== eventB?.title) return false;
    if (!!eventA?.allDay !== !!eventB?.allDay) return false;

    const propsA = eventA?.extendedProps || {};
    const propsB = eventB?.extendedProps || {};
    if (propsA?.status !== propsB?.status) return false;
    if (propsA?.taskId !== propsB?.taskId) return false;
    if (!!propsA?.readOnly !== !!propsB?.readOnly) return false;
    if (String(propsA?.source || '') !== String(propsB?.source || '')) return false;
  }

  return true;
}

export default useCalendarCacheStore;
