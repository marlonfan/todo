import React, { memo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useEventsForDate } from '../hooks/useCalendarFetch';

/**
 * 日历「天」单元格组件 - 细粒度订阅
 *
 * 关键特性：
 * 1. 通过 selector 只订阅自己日期的数据
 * 2. 使用 React.memo 防止不必要的重渲染
 * 3. 只有当该日期的事件引用发生变化时才重新渲染
 *
 * @param {Object} props
 * @param {string} props.date - YYYY-MM-DD 格式的日期字符串
 * @param {Function} props.renderDay - 渲染函数：(events, date) => ReactNode
 * @param {Function} props.renderEmpty - 空状态渲染函数：(date) => ReactNode
 */
const CalendarDayCell = memo(({ date, renderDay, renderEmpty }) => {
  // 精准订阅：只有当该日期的 events 引用变化时，组件才会重新渲染
  const events = useEventsForDate(date);

  console.log(`[CalendarDayCell] Rendering ${date} with ${events.length} events`);

  // 使用传入的渲染函数
  if (events.length === 0) {
    return renderEmpty ? renderEmpty(date) : null;
  }

  return renderDay ? renderDay(events, date) : null;
}, (prevProps, nextProps) => {
  // 自定义对比函数：只有当 date 变化时才允许重新渲染
  // 事件变化由 Zustand selector 处理
  if (prevProps.date !== nextProps.date) return false;
  if (prevProps.renderDay !== nextProps.renderDay) return false;
  if (prevProps.renderEmpty !== nextProps.renderEmpty) return false;
  return true;
});

CalendarDayCell.displayName = 'CalendarDayCell';

CalendarDayCell.propTypes = {
  date: PropTypes.string.isRequired,
  renderDay: PropTypes.func,
  renderEmpty: PropTypes.func,
};

export default CalendarDayCell;

/**
 * 使用示例：
 *
 * <CalendarDayCell
 *   date="2026-03-05"
 *   renderDay={(events, date) => (
 *     <div>
 *       {events.map(event => (
 *         <div key={event.id}>{event.title}</div>
 *       ))}
 *     </div>
 *   )}
 *   renderEmpty={(date) => <div className="empty">No events</div>}
 * />
 */
