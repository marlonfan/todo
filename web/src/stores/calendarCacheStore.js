import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/**
 * 全局日历缓存池
 * 结构: Record<YYYY-MM-DD, CalendarEvent[]>
 *
 * 这是日历渲染的「唯一真实数据源 (Single Source of Truth)」
 */
const useCalendarCacheStore = create(
  immer((set, get) => ({
    // Record<DateString, CalendarEvent[]>
    eventsByDate: {},

    // 元数据
    metadata: {
      lastSyncAt: null,
      syncInProgress: false,
      loadedRanges: [], // Array of { start, end, timezone }
    },

    // Actions

    /**
     * 智能合并：只有当某一天的数据确实发生变更时，才更新引用
     * @param {Object} newEventsByDate - Record<DateString, CalendarEvent[]>
     * @returns {Set<string>} - 发生变更的日期集合
     */
    mergeEvents: (newEventsByDate) => {
      const changedDates = new Set();

      set((state) => {
        for (const dateString of Object.keys(newEventsByDate)) {
          const newEvents = newEventsByDate[dateString];
          const existingEvents = state.eventsByDate[dateString];

          // 深度对比：检查事件数组是否真的发生了变化
          if (!eventsAreEqual(existingEvents, newEvents)) {
            state.eventsByDate[dateString] = newEvents;
            changedDates.add(dateString);
          }
        }
      });

      return changedDates;
    },

    /**
     * 获取指定日期的事件
     * @param {string} dateString
     * @returns {CalendarEvent[]}
     */
    getEventsForDate: (dateString) => {
      return get().eventsByDate[dateString] || [];
    },

    /**
     * 获取指定日期范围内的事件
     * @param {string} startDate
     * @param {string} endDate
     * @returns {CalendarEvent[]}
     */
    getEventsForRange: (startDate, endDate) => {
      const events = [];
      const { eventsByDate } = get();

      let currentDate = new Date(startDate);
      const end = new Date(endDate);

      while (currentDate <= end) {
        const dateString = currentDate.toISOString().split('T')[0];
        const dayEvents = eventsByDate[dateString];
        if (dayEvents && dayEvents.length > 0) {
          events.push(...dayEvents);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return events;
    },

    /**
     * 检查哪些日期在缓存中缺失
     * @param {string} startDate
     * @param {string} endDate
     * @returns {string[]} - 缺失的日期数组
     */
    getMissingDates: (startDate, endDate) => {
      const { eventsByDate } = get();
      const missing = [];

      let currentDate = new Date(startDate);
      const end = new Date(endDate);

      while (currentDate <= end) {
        const dateString = currentDate.toISOString().split('T')[0];
        if (!eventsByDate[dateString]) {
          missing.push(dateString);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return missing;
    },

    /**
     * 检查整个范围是否都已缓存
     * @param {string} startDate
     * @param {string} endDate
     * @returns {boolean}
     */
    isRangeFullyCached: (startDate, endDate) => {
      return get().getMissingDates(startDate, endDate).length === 0;
    },

    /**
     * 清除指定日期的缓存（用于数据更新时）
     * @param {string[]} dateStrings
     */
    invalidateDates: (dateStrings) => {
      set((state) => {
        for (const dateString of dateStrings) {
          delete state.eventsByDate[dateString];
        }
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
        state.metadata.loadedRanges.push({ start, end, timezone, at: Date.now() });
        if (state.metadata.loadedRanges.length > 300) {
          state.metadata.loadedRanges = state.metadata.loadedRanges.slice(-300);
        }
      });
    },

    /**
     * 清空所有缓存
     */
    clear: () => {
      set((state) => {
        state.eventsByDate = {};
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
  // 如果一个是 undefined/null，另一个不是
  if (!eventsA !== !eventsB) return false;
  if (!eventsA && !eventsB) return true;

  // 长度不同
  if (eventsA.length !== eventsB.length) return false;

  // 按 ID 排序后对比
  const sortedA = [...eventsA].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  const sortedB = [...eventsB].sort((a, b) => (a.id || '').localeCompare(b.id || ''));

  for (let i = 0; i < sortedA.length; i++) {
    const eventA = sortedA[i];
    const eventB = sortedB[i];

    // ID 不同
    if (eventA.id !== eventB.id) return false;

    // 对比关键字段（根据实际需求调整）
    if (eventA.start !== eventB.start) return false;
    if (eventA.end !== eventB.end) return false;
    if (eventA.title !== eventB.title) return false;

    // 扩展属性对比
    const propsA = eventA.extendedProps || {};
    const propsB = eventB.extendedProps || {};
    if (propsA.status !== propsB.status) return false;
    if (propsA.taskId !== propsB.taskId) return false;
  }

  return true;
}

export default useCalendarCacheStore;
