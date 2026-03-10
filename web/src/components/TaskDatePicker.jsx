import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { enUS, zhCN } from 'date-fns/locale';
import { Solar } from 'lunar-javascript';
import { IconClock } from './icons/TaskIcons';
import {
  coerceLunarSelection,
  getLunarDayCount,
  getLunarMonthOptions,
  lunarSelectionFromLocalInput,
  LUNAR_TIMEZONE,
  solarDateFromLunarSelection,
} from '../utils/lunar';

registerLocale('en-US', enUS);
registerLocale('en', enUS);
registerLocale('zh-CN', zhCN);
registerLocale('zh', zhCN);

const HALF_HOUR_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, '0');
  const minute = index % 2 === 0 ? '00' : '30';
  return `${hour}:${minute}`;
});
const LUNAR_DAY_LABELS = [
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十',
];
const WEEKDAY_LABELS_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatLunarDayLabel(dayValue) {
  const day = Number.parseInt(dayValue, 10);
  if (!Number.isFinite(day) || day < 1 || day > 30) return '';
  return LUNAR_DAY_LABELS[day - 1] || String(day);
}

function sameLunarMonth(left, right) {
  return (
    Number.parseInt(left?.year, 10) === Number.parseInt(right?.year, 10)
    && Number.parseInt(left?.month, 10) === Number.parseInt(right?.month, 10)
    && !!left?.isLeapMonth === !!right?.isLeapMonth
  );
}

function sameLunarDay(left, right) {
  return sameLunarMonth(left, right) && Number.parseInt(left?.day, 10) === Number.parseInt(right?.day, 10);
}

function shiftLunarMonth(selection, offset) {
  const steps = Math.abs(Number.parseInt(offset, 10) || 0);
  if (steps === 0) {
    return {
      year: Number.parseInt(selection?.year, 10) || dayjs().tz(LUNAR_TIMEZONE).year(),
      month: Number.parseInt(selection?.month, 10) || 1,
      isLeapMonth: !!selection?.isLeapMonth,
    };
  }
  const direction = offset > 0 ? 1 : -1;
  let cursor = {
    year: Number.parseInt(selection?.year, 10) || dayjs().tz(LUNAR_TIMEZONE).year(),
    month: Number.parseInt(selection?.month, 10) || 1,
    isLeapMonth: !!selection?.isLeapMonth,
  };
  for (let index = 0; index < steps; index += 1) {
    const options = getLunarMonthOptions(cursor.year);
    if (options.length === 0) break;
    let optionIndex = options.findIndex(
      (option) => option.month === cursor.month && option.isLeapMonth === cursor.isLeapMonth,
    );
    if (optionIndex < 0) {
      optionIndex = options.findIndex((option) => option.month === cursor.month && !option.isLeapMonth);
      if (optionIndex < 0) optionIndex = 0;
    }
    const nextIndex = optionIndex + direction;
    if (nextIndex >= 0 && nextIndex < options.length) {
      const nextOption = options[nextIndex];
      cursor = {
        year: cursor.year,
        month: nextOption.month,
        isLeapMonth: nextOption.isLeapMonth,
      };
      continue;
    }
    const nextYear = cursor.year + direction;
    const nextOptions = getLunarMonthOptions(nextYear);
    if (nextOptions.length === 0) break;
    const edge = direction > 0 ? nextOptions[0] : nextOptions[nextOptions.length - 1];
    cursor = {
      year: nextYear,
      month: edge.month,
      isLeapMonth: edge.isLeapMonth,
    };
  }
  return cursor;
}

function parseSolarDayNumber(solarDateValue) {
  const parsed = dayjs.tz(String(solarDateValue || ''), 'YYYY-MM-DD', LUNAR_TIMEZONE);
  if (!parsed.isValid()) return '';
  return String(parsed.date());
}

function normalizeHalfHourValue(value, fallback = '09:00') {
  const raw = String(value || '').trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) return fallback;
  const [hourToken, minuteToken] = raw.split(':');
  let hour = Number.parseInt(hourToken, 10);
  let minute = Number.parseInt(minuteToken, 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback;
  if (minute < 15) {
    minute = 0;
  } else if (minute < 45) {
    minute = 30;
  } else {
    minute = 0;
    hour = (hour + 1) % 24;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getNearestHalfHourOption() {
  const now = dayjs();
  return normalizeHalfHourValue(now.format('HH:mm'), '09:00');
}

function HalfHourTimeSelect({ value = '', onChange }) {
  const normalized = useMemo(() => normalizeHalfHourValue(value), [value]);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);

  const refreshMenuPosition = useMemo(() => () => {
    if (typeof window === 'undefined') return;
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 0;
    const viewportWidth = window.innerWidth || 0;
    const spaceBelow = Math.max(0, viewportHeight - rect.bottom - 8);
    const spaceAbove = Math.max(0, rect.top - 8);
    const preferUpward = spaceBelow < 200 && spaceAbove > spaceBelow;
    const availableHeight = preferUpward ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(110, Math.min(260, availableHeight));
    const width = Math.max(120, rect.width);
    let left = rect.left;
    if (left + width > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - width - 8);
    }
    const top = preferUpward
      ? Math.max(8, rect.top - maxHeight - 4)
      : Math.max(8, rect.bottom + 4);
    setMenuStyle({
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      width: `${Math.round(width)}px`,
      maxHeight: `${Math.round(maxHeight)}px`,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      const target = event.target;
      const inTrigger = !!(rootRef.current && rootRef.current.contains(target));
      const inMenu = !!(menuRef.current && menuRef.current.contains(target));
      if (!inTrigger && !inMenu) {
        setOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    refreshMenuPosition();
    const handleViewportChange = () => {
      refreshMenuPosition();
    };
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, refreshMenuPosition]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const active = menuRef.current.querySelector(`[data-time-option="${normalized}"]`);
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [normalized, open]);

  const handleSelect = (nextValue) => {
    onChange?.(nextValue);
    setOpen(false);
  };

  return (
    <div className="task-time-selectbox" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="task-time-selectbox-trigger"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="task-time-selectbox-value">
          <IconClock className="task-time-selectbox-icon h-4 w-4" />
          <span>{normalized}</span>
        </span>
        <span className={`task-time-selectbox-chevron${open ? ' task-time-selectbox-chevron--open' : ''}`}>▾</span>
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="task-time-selectbox-menu task-time-selectbox-menu--floating"
          role="listbox"
          ref={menuRef}
          style={menuStyle || undefined}
        >
          {HALF_HOUR_TIME_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              data-time-option={option}
              aria-selected={normalized === option}
              className={`task-time-selectbox-option${normalized === option ? ' task-time-selectbox-option--active' : ''}`}
              onClick={() => handleSelect(option)}
            >
              {option}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

function parsePickerValue(value, allDay) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^invalid date$/i.test(raw)) return null;
  const normalized = allDay ? raw.split('T')[0] : raw;
  const parsed = dayjs(normalized);
  if (!parsed.isValid()) return null;
  return parsed.toDate();
}

function extractTimePart(value, fallback = '09:00') {
  const raw = String(value || '').trim();
  const match = raw.match(/T(\d{2}:\d{2})/);
  if (match && match[1]) return match[1];
  return fallback;
}

function buildLunarText(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  try {
    const lunar = Solar.fromYmd(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
    ).getLunar();
    if (!lunar) return '';
    const day = Number(lunar.getDay?.() || 0);
    const dayText = String(lunar.getDayInChinese?.() || '');
    const monthText = String(lunar.getMonthInChinese?.() || '');
    if (day === 1 && monthText) {
      return `${monthText}月`;
    }
    return dayText || '';
  } catch {
    return '';
  }
}

function formatSolarToolbarTitle(date, localeName) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  try {
    if (String(localeName || '').toLowerCase().startsWith('zh')) {
      return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(date);
    }
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long' }).format(date);
  } catch {
    return dayjs(date).format('YYYY-MM');
  }
}

function TaskDatePicker({
  value = '',
  allDay = false,
  onChange,
  stepMinutes = 30,
  className = 'form-input',
  placeholder = '',
  inline = false,
  lunarOverlay = false,
  lunarMode = false,
  onDateSelected,
}) {
  const { i18n, t } = useTranslation();
  const selected = useMemo(() => parsePickerValue(value, allDay), [allDay, value]);
  const timeIntervals = Math.max(1, Number.parseInt(stepMinutes, 10) || 30);
  const localeName = useMemo(() => {
    const language = String(i18n?.language || '').toLowerCase();
    if (language.startsWith('zh')) return 'zh-CN';
    return 'en-US';
  }, [i18n?.language]);
  const useInlineTimeInput = inline && !allDay;
  const fallbackTimeOption = getNearestHalfHourOption();
  const resolvedTimeValue = useMemo(
    () => normalizeHalfHourValue(extractTimePart(value, fallbackTimeOption), fallbackTimeOption),
    [fallbackTimeOption, value],
  );
  const calendarClassName = inline
    ? `task-datepicker-inline ${allDay ? 'task-datepicker-inline--all-day' : 'task-datepicker-inline--datetime'}`
    : 'task-datepicker-popup';
  const fallbackLunarSelection = useMemo(() => {
    const now = dayjs().tz(LUNAR_TIMEZONE);
    const fallback = {
      year: now.year(),
      month: 1,
      day: 1,
      isLeapMonth: false,
    };
    const todayLunar = lunarSelectionFromLocalInput(now.format('YYYY-MM-DDTHH:mm'), false, LUNAR_TIMEZONE);
    if (todayLunar) {
      return coerceLunarSelection(todayLunar, todayLunar.year);
    }
    return fallback;
  }, []);
  const currentLunarSelection = useMemo(() => {
    const inputValue = String(value || '').trim();
    const parsed = lunarSelectionFromLocalInput(
      inputValue || dayjs().tz(LUNAR_TIMEZONE).format(allDay ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm'),
      allDay,
      LUNAR_TIMEZONE,
    );
    return coerceLunarSelection(parsed || fallbackLunarSelection, parsed?.year || fallbackLunarSelection.year);
  }, [allDay, fallbackLunarSelection, value]);
  const [visibleLunarMonth, setVisibleLunarMonth] = useState(() => ({
    year: currentLunarSelection.year,
    month: currentLunarSelection.month,
    isLeapMonth: currentLunarSelection.isLeapMonth,
  }));
  useEffect(() => {
    if (!lunarMode) return;
    const nextMonth = {
      year: currentLunarSelection.year,
      month: currentLunarSelection.month,
      isLeapMonth: currentLunarSelection.isLeapMonth,
    };
    setVisibleLunarMonth((prev) => (sameLunarMonth(prev, nextMonth) ? prev : nextMonth));
  }, [
    currentLunarSelection.isLeapMonth,
    currentLunarSelection.month,
    currentLunarSelection.year,
    lunarMode,
  ]);
  const weekLabels = useMemo(
    () => (localeName.startsWith('zh') ? WEEKDAY_LABELS_ZH : WEEKDAY_LABELS_EN),
    [localeName],
  );
  const visibleMonthOptions = useMemo(
    () => getLunarMonthOptions(visibleLunarMonth.year),
    [visibleLunarMonth.year],
  );
  const activeVisibleLunarMonth = useMemo(() => {
    if (visibleMonthOptions.length === 0) {
      return {
        year: visibleLunarMonth.year,
        month: 1,
        isLeapMonth: false,
      };
    }
    const exact = visibleMonthOptions.find(
      (option) => option.month === visibleLunarMonth.month && option.isLeapMonth === visibleLunarMonth.isLeapMonth,
    );
    if (exact) {
      return {
        year: visibleLunarMonth.year,
        month: exact.month,
        isLeapMonth: exact.isLeapMonth,
      };
    }
    const fallback = visibleMonthOptions.find((option) => option.month === visibleLunarMonth.month && !option.isLeapMonth)
      || visibleMonthOptions[0];
    return {
      year: visibleLunarMonth.year,
      month: fallback.month,
      isLeapMonth: fallback.isLeapMonth,
    };
  }, [visibleLunarMonth.isLeapMonth, visibleLunarMonth.month, visibleLunarMonth.year, visibleMonthOptions]);
  const lunarMonthCells = useMemo(() => {
    if (!lunarMode) return [];
    const monthSelection = {
      year: activeVisibleLunarMonth.year,
      month: activeVisibleLunarMonth.month,
      isLeapMonth: activeVisibleLunarMonth.isLeapMonth,
    };
    const monthDayCount = getLunarDayCount(
      monthSelection.year,
      monthSelection.month,
      monthSelection.isLeapMonth,
    );
    const firstDaySolar = solarDateFromLunarSelection({ ...monthSelection, day: 1 });
    const firstDayParsed = dayjs.tz(String(firstDaySolar || ''), 'YYYY-MM-DD', LUNAR_TIMEZONE);
    const firstWeekday = firstDayParsed.isValid() ? firstDayParsed.day() : 0;
    const previousMonth = shiftLunarMonth(monthSelection, -1);
    const nextMonth = shiftLunarMonth(monthSelection, 1);
    const previousMonthDayCount = getLunarDayCount(
      previousMonth.year,
      previousMonth.month,
      previousMonth.isLeapMonth,
    );
    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      let lunarCell;
      let inCurrentMonth = true;
      if (index < firstWeekday) {
        inCurrentMonth = false;
        lunarCell = {
          year: previousMonth.year,
          month: previousMonth.month,
          isLeapMonth: previousMonth.isLeapMonth,
          day: previousMonthDayCount - firstWeekday + index + 1,
        };
      } else if (index < firstWeekday + monthDayCount) {
        lunarCell = {
          year: monthSelection.year,
          month: monthSelection.month,
          isLeapMonth: monthSelection.isLeapMonth,
          day: index - firstWeekday + 1,
        };
      } else {
        inCurrentMonth = false;
        lunarCell = {
          year: nextMonth.year,
          month: nextMonth.month,
          isLeapMonth: nextMonth.isLeapMonth,
          day: index - firstWeekday - monthDayCount + 1,
        };
      }
      const solarDate = solarDateFromLunarSelection(lunarCell);
      const solarDay = parseSolarDayNumber(solarDate);
      cells.push({
        ...lunarCell,
        key: `${lunarCell.year}:${lunarCell.month}:${lunarCell.isLeapMonth ? 1 : 0}:${lunarCell.day}`,
        solarDate,
        solarDay,
        lunarDayLabel: formatLunarDayLabel(lunarCell.day),
        inCurrentMonth,
      });
    }
    return cells;
  }, [
    activeVisibleLunarMonth.isLeapMonth,
    activeVisibleLunarMonth.month,
    activeVisibleLunarMonth.year,
    lunarMode,
  ]);
  const lunarToolbarTitle = useMemo(() => {
    const leapPrefix = activeVisibleLunarMonth.isLeapMonth ? t('task.lunarLeapPrefix') : '';
    if (localeName.startsWith('zh')) {
      return `${activeVisibleLunarMonth.year}年 ${leapPrefix}${activeVisibleLunarMonth.month}月`;
    }
    const monthLabel = `${leapPrefix}${activeVisibleLunarMonth.month}`;
    return `${activeVisibleLunarMonth.year} Lunar ${monthLabel}`;
  }, [activeVisibleLunarMonth.isLeapMonth, activeVisibleLunarMonth.month, activeVisibleLunarMonth.year, localeName, t]);

  const applyLunarSelection = (selection) => {
    const normalized = coerceLunarSelection(selection, selection?.year || currentLunarSelection.year);
    const solarDate = solarDateFromLunarSelection(normalized);
    if (!solarDate) return;
    const nextValue = allDay
      ? solarDate
      : `${solarDate}T${resolvedTimeValue}`;
    onDateSelected?.(parsePickerValue(nextValue, allDay));
    onChange?.(nextValue);
  };
  const handleSolarDateChange = (nextValue) => {
    onDateSelected?.(nextValue || null);
    if (!nextValue) {
      onChange?.('');
      return;
    }
    const nextDate = dayjs(nextValue);
    if (!nextDate.isValid()) {
      onChange?.('');
      return;
    }
    if (!allDay && !inline) {
      onChange?.(nextDate.format('YYYY-MM-DDTHH:mm'));
      return;
    }
    const dayPart = nextDate.format('YYYY-MM-DD');
    const nextValueText = allDay
      ? dayPart
      : `${dayPart}T${resolvedTimeValue}`;
    onChange?.(nextValueText);
  };
  const handleSolarTimeChange = (nextTime) => {
    const nextTimeValue = normalizeHalfHourValue(nextTime);
    const selectedDay = selected && dayjs(selected).isValid()
      ? dayjs(selected).format('YYYY-MM-DD')
      : String(value || '').trim().split('T')[0];
    const dayPart = selectedDay || dayjs().format('YYYY-MM-DD');
    const nextValueText = `${dayPart}T${nextTimeValue}`;
    onDateSelected?.(parsePickerValue(nextValueText, false));
    onChange?.(nextValueText);
  };
  const handleLunarMonthShift = (offset) => {
    setVisibleLunarMonth((prev) => shiftLunarMonth(prev, offset));
  };
  const handleLunarDaySelect = (cell) => {
    if (!cell) return;
    setVisibleLunarMonth({
      year: cell.year,
      month: cell.month,
      isLeapMonth: cell.isLeapMonth,
    });
    applyLunarSelection({
      year: cell.year,
      month: cell.month,
      day: cell.day,
      isLeapMonth: cell.isLeapMonth,
    });
  };
  const handleLunarTimeChange = (nextTime) => {
    const nextTimeValue = normalizeHalfHourValue(nextTime);
    const currentDate = String(value || '').trim().split('T')[0]
      || solarDateFromLunarSelection(currentLunarSelection)
      || dayjs().tz(LUNAR_TIMEZONE).format('YYYY-MM-DD');
    const nextValue = `${currentDate}T${nextTimeValue}`;
    onDateSelected?.(parsePickerValue(nextValue, false));
    onChange?.(nextValue);
  };
  const rootClassName = lunarMode
    ? `${calendarClassName} task-datepicker-lunar-mode`
    : '';

  return (
    <div className={rootClassName}>
      {lunarMode && (
        <div className="task-lunar-toolbar">
          <button
            type="button"
            className="task-lunar-toolbar-btn"
            onClick={() => handleLunarMonthShift(-1)}
            aria-label={localeName.startsWith('zh') ? '上个月' : 'Previous month'}
          >
            ‹
          </button>
          <span className="task-lunar-toolbar-title">{lunarToolbarTitle}</span>
          <button
            type="button"
            className="task-lunar-toolbar-btn"
            onClick={() => handleLunarMonthShift(1)}
            aria-label={localeName.startsWith('zh') ? '下个月' : 'Next month'}
          >
            ›
          </button>
        </div>
      )}
      {lunarMode ? (
        <div className={`task-lunar-panel ${inline ? 'task-lunar-panel--inline' : ''}`}>
          <div className="task-lunar-weekdays">
            {weekLabels.map((label, index) => (
              <div key={`${label}-${index}`} className="task-lunar-weekday">{label}</div>
            ))}
          </div>
          <div className="task-lunar-grid">
            {lunarMonthCells.map((cell) => {
              const selectedDay = sameLunarDay(cell, currentLunarSelection);
              return (
                <button
                  key={cell.key}
                  type="button"
                  className={`task-lunar-day${cell.inCurrentMonth ? '' : ' task-lunar-day--outside'}${selectedDay ? ' task-lunar-day--selected' : ''}`}
                  onClick={() => handleLunarDaySelect(cell)}
                >
                  <span className="task-lunar-day-solar">{cell.solarDay}</span>
                  <span className="task-lunar-day-lunar">{cell.lunarDayLabel}</span>
                </button>
              );
            })}
          </div>
          {!allDay && (
            <div className="task-lunar-time-row">
              <HalfHourTimeSelect
                value={resolvedTimeValue}
                onChange={handleLunarTimeChange}
              />
            </div>
          )}
        </div>
      ) : (
        <div className={inline ? 'task-solar-panel' : ''}>
          <DatePicker
            selected={selected}
            onChange={handleSolarDateChange}
            locale={localeName}
            showTimeSelect={!allDay && !useInlineTimeInput}
            showTimeInput={!allDay && !inline}
            timeIntervals={timeIntervals}
            timeCaption=""
            timeInputLabel=""
            customTimeInput={!allDay && !inline ? <HalfHourTimeSelect /> : null}
            timeFormat="HH:mm"
            dateFormat={allDay || inline ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm'}
            shouldCloseOnSelect={allDay}
            isClearable
            placeholderText={placeholder}
            className={className}
            wrapperClassName="w-full"
            popperPlacement="bottom-start"
            inline={inline}
            calendarClassName={calendarClassName}
            showPopperArrow={false}
            renderCustomHeader={inline ? ({
              date,
              decreaseMonth,
              increaseMonth,
              prevMonthButtonDisabled,
              nextMonthButtonDisabled,
            }) => (
              <div className="task-lunar-toolbar">
                <button
                  type="button"
                  className="task-lunar-toolbar-btn"
                  onClick={decreaseMonth}
                  disabled={prevMonthButtonDisabled}
                  aria-label={localeName.startsWith('zh') ? '上个月' : 'Previous month'}
                >
                  ‹
                </button>
                <span className="task-lunar-toolbar-title">{formatSolarToolbarTitle(date, localeName)}</span>
                <button
                  type="button"
                  className="task-lunar-toolbar-btn"
                  onClick={increaseMonth}
                  disabled={nextMonthButtonDisabled}
                  aria-label={localeName.startsWith('zh') ? '下个月' : 'Next month'}
                >
                  ›
                </button>
              </div>
            ) : undefined}
            renderDayContents={(dayOfMonth, date) => {
              if (!lunarOverlay || !date) return dayOfMonth;
              const lunarText = buildLunarText(date);
              return (
                <div className="task-datepicker-day-with-lunar">
                  <span className="task-datepicker-day-solar">{dayOfMonth}</span>
                  <span className="task-datepicker-day-lunar">{lunarText}</span>
                </div>
              );
            }}
          />
          {useInlineTimeInput && (
            <div className="task-solar-time-row">
              <HalfHourTimeSelect
                value={resolvedTimeValue}
                onChange={handleSolarTimeChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskDatePicker;
