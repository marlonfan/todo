import React, { useEffect, useMemo, useState } from 'react';
import { getDayDisplayInfo } from '../../utils/holidays';
import { getShowChineseHolidays, onUIPrefsChanged } from '../../utils/uiPrefs';
import { isReadOnlyCalendarEvent } from '../../utils/calendarEvents';
import CalendarEventButton from './CalendarEventButton';

export const MONTH_WEEK_HEIGHT = 164;
export const MONTH_HEADER_HEIGHT = 36;
const WEEK_DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

// Cached weeks stay mounted for native scrolling, but only visible weeks
// participate in Tab navigation. Dates and their events share one DOM order.
export default function CalendarMonthGrid({ scrollerRef, startWeek, weeksCount, eventEntries, todayDateKey, onCreateRange, onOpenEvent, onOpenMore }) {
  const [visibleWeeks, setVisibleWeeks] = useState({ first: -1, last: -1 });
  const [showHolidays, setShowHolidays] = useState(getShowChineseHolidays);
  useEffect(() => onUIPrefsChanged((event) => {
    if (event?.detail?.showChineseHolidays !== undefined) setShowHolidays(event.detail.showChineseHolidays);
  }), []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const first = Math.max(0, Math.floor(scroller.scrollTop / MONTH_WEEK_HEIGHT));
      const last = Math.min(weeksCount - 1, Math.ceil((scroller.scrollTop + scroller.clientHeight - MONTH_HEADER_HEIGHT) / MONTH_WEEK_HEIGHT) - 1);
      setVisibleWeeks((prev) => prev.first === first && prev.last === last ? prev : { first, last });
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    observer.observe(scroller);
    scroller.addEventListener('scroll', schedule, { passive: true });
    schedule();
    return () => {
      observer.disconnect();
      scroller.removeEventListener('scroll', schedule);
      window.cancelAnimationFrame(frame);
    };
  }, [scrollerRef, startWeek, weeksCount]);

  const byDate = useMemo(() => {
    const cells = new Map();
    eventEntries.forEach(({ key: eventKey, event, start, allDayDates }) => {
      if (!start.isValid()) return;
      (event?.allDay ? allDayDates : [start]).forEach((date) => {
        const key = date.format('YYYY-MM-DD');
        const list = cells.get(key) || [];
        list.push({ eventKey, event, start: date });
        cells.set(key, list);
      });
    });
    cells.forEach((list) => list.sort((a, b) => a.start.valueOf() - b.start.valueOf()));
    return cells;
  }, [eventEntries]);

  return (
    <>
      <div className="pointer-events-none sticky top-0 z-20 grid grid-cols-7 border-b border-[var(--calendar-grid-line)] bg-[var(--calendar-header-bg)]/95 text-xs font-semibold text-muted-foreground backdrop-blur" style={{ height: MONTH_HEADER_HEIGHT }}>
        {WEEK_DAY_LABELS.map((label) => <div key={label} className="flex items-center justify-center border-l border-[var(--calendar-grid-line-soft)]">周{label}</div>)}
      </div>
      <div className="relative" style={{ height: weeksCount * MONTH_WEEK_HEIGHT }}>
        {Array.from({ length: weeksCount }, (_, weekIndex) => {
          const weekStart = startWeek.add(weekIndex, 'week');
          const tabIndex = weekIndex >= visibleWeeks.first && weekIndex <= visibleWeeks.last ? 0 : -1;
          return (
            <div key={weekIndex} className="absolute left-0 right-0 grid grid-cols-7 border-t border-[var(--calendar-grid-line)]" style={{ top: weekIndex * MONTH_WEEK_HEIGHT, height: MONTH_WEEK_HEIGHT }}>
              {Array.from({ length: 7 }, (_, dayIndex) => {
                const day = weekStart.add(dayIndex, 'day');
                const date = day.format('YYYY-MM-DD');
                const isToday = date === todayDateKey;
                const info = getDayDisplayInfo(day.toDate(), showHolidays);
                const items = byDate.get(date) || [];
                return (
                  <div key={date} className="relative min-w-0 border-l border-[var(--calendar-grid-line-soft)]">
                    <button type="button" tabIndex={tabIndex} data-calendar-date={date}
                      className={`absolute inset-0 flex items-start border-0 p-0 text-left transition-colors hover:bg-muted/70 ${isToday ? 'bg-muted/80' : 'bg-transparent'}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (event.detail > 0) event.currentTarget.blur();
                        onCreateRange?.({ allDay: true, start: day.startOf('day').toISOString(), end: day.endOf('day').toISOString() });
                      }}>
                      <span className="pointer-events-none absolute left-1.5 right-1.5 top-1 flex items-start justify-between">
                        <span className="flex items-center gap-1">
                          <span className={`inline-flex items-center rounded-full text-xs font-semibold ${isToday ? 'bg-primary px-2 py-0.5 text-white shadow-sm' : 'px-0 text-foreground-strong'}`}>{day.format('M/D')}</span>
                          <span className="text-[10px] text-muted-foreground">{info.lunarDisplay}</span>
                        </span>
                        {showHolidays && info.primaryHoliday && <span className={`max-w-[50%] truncate text-[10px] font-medium leading-tight ${info.isHoliday ? 'text-[hsl(var(--accent-danger))]' : 'text-primary'}`}>{info.primaryHoliday}</span>}
                      </span>
                      {isToday && <span className="pointer-events-none absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary/80" aria-hidden="true" />}
                    </button>
                    {items.slice(0, 6).map((item, slot) => (
                      <CalendarEventButton key={item.eventKey} calendarEvent={item.event} onOpen={onOpenEvent} pointerHandledByCanvas={false} tabIndex={tabIndex}
                        data-event-key={item.eventKey} data-event-id={item.event.id}
                        className={`canvas-event absolute z-10 h-5 overflow-hidden px-1 text-left text-[10px] ${isReadOnlyCalendarEvent(item.event) ? 'calendar-event-readonly' : 'calendar-event-task'}`}
                        style={{ left: 2, right: 3, top: 28 + slot * 19 }}>
                        {item.event.title || 'Untitled'}
                      </CalendarEventButton>
                    ))}
                    {items.length > 6 && (
                      <button type="button" tabIndex={tabIndex} className="canvas-ui-action absolute z-10 inline-flex h-5 items-center whitespace-nowrap px-1 text-left text-[10px] font-semibold leading-5"
                        style={{ left: 2, right: 3, top: 28 + 6 * 19 }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (event.detail > 0) event.currentTarget.blur();
                          onOpenMore?.({ date: day.toISOString(), events: items.map((item) => item.event) });
                        }}>+{items.length - 6}</button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}
