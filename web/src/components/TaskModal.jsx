import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  getUserTimeGranularity,
  getUserTimezone,
  logTimeDebug,
  toInputFormat,
  toISOString,
} from '../utils/time';
import { getNaturalTimeOptionsFromUser, parseNaturalTimeFromTitle, parsePriorityFromTitle } from '../utils/naturalTime';
import { getShowCategoryEmoji, onUIPrefsChanged } from '../utils/uiPrefs';
import {
  buildLunarYearlyRuleFromSelection,
  coerceLunarSelection,
  lunarSelectionFromLocalInput,
  nextLocalInputFromLunarSelection,
  solarDateFromLunarSelection,
  LUNAR_TIMEZONE,
  parseLunarYearlyRule,
} from '../utils/lunar';
import { alignStartInputToNearestRecurrence } from '../utils/recurrenceAlign';
import { getLunarInfo } from '../utils/holidays';
import {
  IconCalendar,
  IconClock,
  IconFlag,
  IconHistory,
  IconMoon,
  IconRepeat,
  IconRepeatOff,
  IconSun,
  IconSunrise,
  IconTag,
} from './icons/TaskIcons';
import LiveMarkdownEditor from './LiveMarkdownEditor';
import TaskDatePicker from './TaskDatePicker';
import TaskActivityTimeline from './TaskActivityTimeline';
import { useCategoriesQuery } from '../query/hooks';
import { cancelTaskLocal, createTaskLocal, deleteTaskLocal, updateTaskLocal, updateTaskStatusLocal } from '../data/taskMutations';

const DEFAULT_TASK_START_TIME = '09:00';
const WEEKDAY_ONLY_RE = /^(MO|TU|WE|TH|FR|SA|SU)$/;
const DEFAULT_WORKDAY_KEYS = ['MO', 'TU', 'WE', 'TH', 'FR'];
const BASIC_PANELS_REQUIRING_CONFIRM = new Set(['time', 'recurrence']);

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function normalizeTaskStartTime(value) {
  if (typeof value !== 'string') return DEFAULT_TASK_START_TIME;
  const match = value.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return DEFAULT_TASK_START_TIME;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return DEFAULT_TASK_START_TIME;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getDefaultStartInputValue(timezoneName) {
  const user = getStoredUser();
  const startTime = normalizeTaskStartTime(user.default_task_start_time);
  const [hour, minute] = startTime.split(':').map((part) => Number.parseInt(part, 10));
  return dayjs().tz(timezoneName).hour(hour).minute(minute).second(0).format('YYYY-MM-DDTHH:mm');
}

function parseRecurrenceRule(rawRule) {
  if (!rawRule) return null;
  if (typeof rawRule === 'object') return rawRule;
  if (typeof rawRule !== 'string') return null;
  try {
    return JSON.parse(rawRule);
  } catch {
    return null;
  }
}

function isBasicPanelFloatingLayerTarget(target) {
  if (!(target instanceof Element)) return false;
  return !!(
    target.closest('.task-time-selectbox-menu--floating')
    || target.closest('.react-datepicker-popper')
    || target.closest('.react-datepicker__portal')
  );
}

function getDefaultStartParts() {
  const start = normalizeTaskStartTime(getStoredUser().default_task_start_time);
  const [hour, minute] = start.split(':').map((v) => Number.parseInt(v, 10));
  return { hour: Number.isFinite(hour) ? hour : 9, minute: Number.isFinite(minute) ? minute : 0 };
}

function roundToHalfHour(timeValue) {
  let current = timeValue.second(0).millisecond(0);
  const minute = current.minute();
  if (minute < 15) {
    current = current.minute(0);
  } else if (minute < 45) {
    current = current.minute(30);
  } else {
    current = current.add(1, 'hour').minute(0);
  }
  return current;
}

function buildDefaultRangeAroundNow(timezoneName) {
  const center = roundToHalfHour(dayjs().tz(timezoneName));
  return {
    start: center.subtract(30, 'minute').format('YYYY-MM-DDTHH:mm'),
    end: center.add(30, 'minute').format('YYYY-MM-DDTHH:mm'),
  };
}

function parseInputInTimezone(value, timezoneName) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^invalid date$/i.test(raw)) return null;
  const normalized = raw.replace('T', ' ');
  const formats = ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD'];
  for (const format of formats) {
    try {
      const parsed = dayjs.tz(normalized, format, timezoneName);
      if (parsed.isValid()) return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

function parseAbsoluteInTimezone(value, timezoneName) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^invalid date$/i.test(raw)) return null;
  const direct = dayjs(raw);
  if (direct.isValid()) {
    try {
      return direct.tz(timezoneName);
    } catch {
      return null;
    }
  }
  return parseInputInTimezone(raw, timezoneName);
}

function alignStartInputToWeekday(startInput, weekdayKeys, timezoneName) {
  const start = parseInputInTimezone(startInput, timezoneName);
  if (!start) return startInput || '';
  const dayMap = {
    SU: 0,
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6,
  };
  const targets = [...new Set(
    (Array.isArray(weekdayKeys) ? weekdayKeys : [])
      .map((day) => dayMap[String(day || '').toUpperCase()])
      .filter((day) => Number.isInteger(day))
  )];
  if (targets.length === 0) return startInput || '';
  const currentDay = start.day();
  if (targets.includes(currentDay)) return start.format('YYYY-MM-DDTHH:mm');

  let bestDiff = 8;
  targets.forEach((targetDay) => {
    let diff = (targetDay - currentDay + 7) % 7;
    if (diff === 0) diff = 7;
    if (diff < bestDiff) bestDiff = diff;
  });
  if (!Number.isFinite(bestDiff) || bestDiff <= 0 || bestDiff > 7) return start.format('YYYY-MM-DDTHH:mm');
  return start.add(bestDiff, 'day').format('YYYY-MM-DDTHH:mm');
}

function formatInstanceDateToken(token) {
  const raw = String(token || '').trim();
  if (!/^\d{8}$/.test(raw)) return '';
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function resolveOccurrenceDate(value, timezoneName) {
  const parsed = parseAbsoluteInTimezone(value, timezoneName);
  if (!parsed || !parsed.isValid()) return '';
  return parsed.format('YYYY-MM-DD');
}

function resolveSeriesDeleteOccurrenceStart(task, timezoneName) {
  const explicitStart = parseAbsoluteInTimezone(task?.occurrenceStart || task?.occurrence_start, timezoneName);
  if (explicitStart) return explicitStart;

  const baseStart = parseAbsoluteInTimezone(
    task?.start_time || task?.startTime || task?.due_date || task?.dueDate,
    timezoneName,
  );

  const dateCandidates = [];
  const rawOccurrenceDate = String(task?.occurrenceDate || task?.occurrence_date || '').trim();
  if (rawOccurrenceDate) {
    dateCandidates.push(rawOccurrenceDate.slice(0, 10));
  }

  const instanceID = String(task?.instanceId || task?.instance_id || '').trim();
  const instanceDateToken = instanceID.match(/^\d+_(\d{8})$/)?.[1] || '';
  const instanceDate = formatInstanceDateToken(instanceDateToken);
  if (instanceDate) {
    dateCandidates.push(instanceDate);
  }

  for (const candidate of dateCandidates) {
    const dayOnly = parseInputInTimezone(candidate, timezoneName);
    if (!dayOnly) continue;
    if (!baseStart) return dayOnly.startOf('day');
    return dayOnly
      .hour(baseStart.hour())
      .minute(baseStart.minute())
      .second(baseStart.second())
      .millisecond(0);
  }

  return null;
}

function shiftEndByDuration(originalStartInput, originalEndInput, nextStartInput, timezoneName) {
  const originalStart = parseInputInTimezone(originalStartInput, timezoneName);
  const originalEnd = parseInputInTimezone(originalEndInput, timezoneName);
  const nextStart = parseInputInTimezone(nextStartInput, timezoneName);
  if (!originalStart || !originalEnd || !nextStart) return null;
  const durationMinutes = originalEnd.diff(originalStart, 'minute');
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  return nextStart.add(durationMinutes, 'minute').format('YYYY-MM-DDTHH:mm');
}

function coerceEndNotBeforeStart(startInput, endInput, timezoneName) {
  const start = parseInputInTimezone(startInput, timezoneName);
  const end = parseInputInTimezone(endInput, timezoneName);
  if (!start || !end) return endInput || '';
  if (end.isBefore(start)) {
    return start.format('YYYY-MM-DDTHH:mm');
  }
  return endInput || '';
}

function buildEndFromStart(startInput, timezoneName, minutes = 60) {
  const start = parseInputInTimezone(startInput, timezoneName);
  if (!start) return '';
  return start.add(minutes, 'minute').format('YYYY-MM-DDTHH:mm');
}

function parseLocalInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = dayjs(raw);
  return parsed.isValid() ? parsed : null;
}

function splitDatePart(value) {
  return value && value.includes('T') ? value.split('T')[0] : value || '';
}

function lunarDateLabel(d) {
  try {
    const info = getLunarInfo(d.toDate());
    return info.monthLabel + info.dayLabel;
  } catch {
    return d.format('MM/DD');
  }
}

function buildTimeSummaryLabel(startInput, endInput, isAllDay, noDateLabel, lunarMode = false) {
  const start = parseLocalInput(startInput);
  const end = parseLocalInput(endInput);
  if (!start && !end) return noDateLabel;
  const dateFmt = (d) => lunarMode ? lunarDateLabel(d) : d.format('MM/DD');
  if (!isAllDay) {
    if (start && end) {
      if (start.isSame(end, 'day')) {
        return `${dateFmt(start)} ${start.format('HH:mm')}-${end.format('HH:mm')}`;
      }
      return `${dateFmt(start)} ${start.format('HH:mm')}-${dateFmt(end)} ${end.format('HH:mm')}`;
    }
    if (start) return `${dateFmt(start)} ${start.format('HH:mm')}`;
    return `${dateFmt(end)} ${end.format('HH:mm')}`;
  }
  if (!start && end) return dateFmt(end);
  if (start && !end) return dateFmt(start);
  return `${dateFmt(start)}-${dateFmt(end)}`;
}

function buildCategorySummaryLabel(selectedCategoryIDs, categories, showEmoji, fallbackLabel) {
  const ids = Array.isArray(selectedCategoryIDs) ? selectedCategoryIDs.map(String) : [];
  if (ids.length === 0) return fallbackLabel;
  const selected = categories.filter((cat) => ids.includes(String(cat.id)));
  if (selected.length === 0) return `${fallbackLabel}+${ids.length}`;
  const first = selected[0];
  const firstLabel = showEmoji && first?.emoji ? `${first.emoji}${first.name}` : String(first?.name || fallbackLabel);
  if (selected.length === 1) return firstLabel;
  return `${firstLabel}+${selected.length - 1}`;
}

function buildRecurrenceSummaryLabel(enabled, recurrenceType, selectedDays, t, lunarSelection = null) {
  if (!enabled) return t('task.repeatOff');
  if (recurrenceType === 'lunar') {
    const month = Number.parseInt(lunarSelection?.month, 10) || 1;
    const day = Number.parseInt(lunarSelection?.day, 10) || 1;
    const leap = !!lunarSelection?.isLeapMonth;
    return `${t('task.lunarYearly')} ${leap ? t('task.lunarLeapPrefix') : ''}${month}/${day}`;
  }
  if (recurrenceType === 'biweekly') {
    const label = t('task.biweekly');
    const dayCount = Array.isArray(selectedDays) ? selectedDays.length : 0;
    return dayCount > 0 ? `${label}(${dayCount})` : label;
  }
  if (recurrenceType === 'weekly') {
    const weeklyLabel = t('task.weekly');
    const dayCount = Array.isArray(selectedDays) ? selectedDays.length : 0;
    return dayCount > 0 ? `${weeklyLabel}(${dayCount})` : weeklyLabel;
  }
  if (recurrenceType === 'monthly') return t('task.monthly');
  if (recurrenceType === 'yearly') return t('task.yearly');
  return t('task.daily');
}

function normalizeByDayList(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map((day) => String(day || '').trim().toUpperCase())
    .filter((day) => day.length > 0);
}

function clampMonthlyDate(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(31, Math.max(1, parsed));
}

function resolveMonthlyDateFromRule(rule, fallbackStartInput) {
  const rawByDate = Array.isArray(rule?.bydate)
    ? rule.bydate
    : Array.isArray(rule?.byDate)
      ? rule.byDate
      : Array.isArray(rule?.bymonthday)
        ? rule.bymonthday
        : [];
  for (const raw of rawByDate) {
    const value = Number.parseInt(raw, 10);
    if (Number.isFinite(value) && value >= 1 && value <= 31) {
      return value;
    }
  }
  const start = parseLocalInput(fallbackStartInput);
  if (start) return start.date();
  return 1;
}

function parseRecurrenceSelection(rule, fallbackStartInput = '') {
  const fallbackLunar = parseLunarYearlyRule({ freq: 'lunar_yearly' }, fallbackStartInput) || {
    year: dayjs().tz(LUNAR_TIMEZONE).year(),
    month: 1,
    day: 1,
    isLeapMonth: false,
  };
  if (!rule) {
    return {
      type: 'daily',
      days: [],
      monthDate: 1,
      lunarYear: fallbackLunar.year,
      lunarMonth: fallbackLunar.month,
      lunarDay: fallbackLunar.day,
      lunarIsLeapMonth: fallbackLunar.isLeapMonth,
    };
  }
  const freq = String(rule.freq || 'daily').trim().toLowerCase();
  const interval = Math.max(1, Number.parseInt(rule.interval, 10) || 1);
  const byDay = normalizeByDayList(rule.byday || rule.byDay);
  const monthDate = resolveMonthlyDateFromRule(rule, fallbackStartInput);
  if (freq === 'lunar_yearly' || freq === 'lunar') {
    const lunar = parseLunarYearlyRule(rule, fallbackStartInput) || fallbackLunar;
    return {
      type: 'lunar',
      days: [],
      monthDate,
      lunarYear: lunar.year,
      lunarMonth: lunar.month,
      lunarDay: lunar.day,
      lunarIsLeapMonth: lunar.isLeapMonth,
    };
  }
  if (freq === 'weekly' && interval === 2) {
    return {
      type: 'biweekly',
      days: byDay.filter((day) => WEEKDAY_ONLY_RE.test(day)),
      monthDate,
      lunarYear: fallbackLunar.year,
      lunarMonth: fallbackLunar.month,
      lunarDay: fallbackLunar.day,
      lunarIsLeapMonth: fallbackLunar.isLeapMonth,
    };
  }
  return {
    type: freq || 'daily',
    days: byDay.filter((day) => WEEKDAY_ONLY_RE.test(day)),
    monthDate,
    lunarYear: fallbackLunar.year,
    lunarMonth: fallbackLunar.month,
    lunarDay: fallbackLunar.day,
    lunarIsLeapMonth: fallbackLunar.isLeapMonth,
  };
}

function TaskModal({ task, initialRange, onClose, onSaved }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { register, handleSubmit, watch, setValue, getValues } = useForm();
  const { data: categories = [] } = useCategoriesQuery();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('daily');
  const [selectedDays, setSelectedDays] = useState([]);
  const [monthlyDate, setMonthlyDate] = useState(1);
  const [showCustomRecurrenceMenu, setShowCustomRecurrenceMenu] = useState(false);
  const [showMonthlyDatePicker, setShowMonthlyDatePicker] = useState(false);
  const [timeRangeEnabled, setTimeRangeEnabled] = useState(false);
  const [timeRangeEditing, setTimeRangeEditing] = useState('start');
  const [timeCalendarMode, setTimeCalendarMode] = useState('solar');
  const [startLunarYear, setStartLunarYear] = useState(dayjs().tz(LUNAR_TIMEZONE).year());
  const [startLunarMonth, setStartLunarMonth] = useState(1);
  const [startLunarDay, setStartLunarDay] = useState(1);
  const [startLunarIsLeapMonth, setStartLunarIsLeapMonth] = useState(false);
  const [endLunarYear, setEndLunarYear] = useState(dayjs().tz(LUNAR_TIMEZONE).year());
  const [endLunarMonth, setEndLunarMonth] = useState(1);
  const [endLunarDay, setEndLunarDay] = useState(1);
  const [endLunarIsLeapMonth, setEndLunarIsLeapMonth] = useState(false);
  const [recurrenceLunarYear, setRecurrenceLunarYear] = useState(dayjs().tz(LUNAR_TIMEZONE).year());
  const [recurrenceLunarMonth, setRecurrenceLunarMonth] = useState(1);
  const [recurrenceLunarDay, setRecurrenceLunarDay] = useState(1);
  const [recurrenceLunarIsLeapMonth, setRecurrenceLunarIsLeapMonth] = useState(false);
  const [timeTouched, setTimeTouched] = useState(false);
  const [parsePreview, setParsePreview] = useState('');
  const [basicPanel, setBasicPanel] = useState('');
  const [deleteChoiceOpen, setDeleteChoiceOpen] = useState(false);
  const [showCategoryEmoji, setShowCategoryEmoji] = useState(getShowCategoryEmoji());
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  const basicPanelRef = useRef(null);
  const detailPanelSnapshotRef = useRef(null);
  const modalHistoryRef = useRef({ hasEntry: false, ignoreNextPop: false });
  const descriptionEditorRef = useRef(null);
  const timeGranularity = getUserTimeGranularity();

  const isEditing = !!task;
  const recurrenceRule = parseRecurrenceRule(task?.recurrence_rule || task?.recurrenceRule);
  const isAllDay = watch('all_day');
  const titleValue = watch('title') || '';
  const priorityValue = watch('priority') || '0';
  const startInputValue = watch('start_time');
  const endInputValue = watch('end_time');
  const descriptionValue = watch('description') ?? '';
  const watchedCategoryIDs = watch('category_ids');
  const selectedCategoryValues = Array.isArray(watchedCategoryIDs)
    ? watchedCategoryIDs.map((id) => String(id))
      : watchedCategoryIDs
      ? [String(watchedCategoryIDs)]
      : [];
  const parsedPriorityFromTitle = parsePriorityFromTitle(titleValue || '');
  const displayPriorityValue = Number.isInteger(parsedPriorityFromTitle?.priority)
    ? parsedPriorityFromTitle.priority
    : (Number.parseInt(priorityValue, 10) || 0);
  const priorityIconTone = displayPriorityValue === 1 ? 'high' : (displayPriorityValue === 0 ? 'medium' : 'default');
  const priorityButtonClass = basicPanel === 'priority'
    ? priorityIconTone === 'high'
      ? 'bg-rose-50 text-rose-700'
      : priorityIconTone === 'medium'
        ? 'bg-sky-50 text-sky-700'
        : 'bg-slate-100 text-slate-700'
    : priorityIconTone === 'high'
      ? 'text-rose-600 hover:bg-rose-50'
      : priorityIconTone === 'medium'
        ? 'text-sky-600 hover:bg-sky-50'
        : 'text-slate-500 hover:bg-slate-100';
  const priorityButtonTitle = priorityIconTone === 'high'
    ? t('task.priorityHigh')
    : priorityIconTone === 'medium'
      ? t('task.priorityMedium')
      : t('task.priorityLow');
  const timeSummaryLabel = buildTimeSummaryLabel(startInputValue, endInputValue, isAllDay, t('task.noDate'), timeCalendarMode === 'lunar');
  const hasParsedTimeHint = !!parsePreview;
  const hasTimeValue = !!(startInputValue || endInputValue);
  const timeButtonClass = basicPanel === 'time'
    ? 'bg-sky-50 text-sky-700'
    : (hasParsedTimeHint || hasTimeValue)
      ? 'text-sky-600 hover:bg-sky-50'
      : 'text-slate-500 hover:bg-slate-100';
  const timeButtonTitle = hasParsedTimeHint ? parsePreview : timeSummaryLabel;
  const hasCategoryValue = selectedCategoryValues.length > 0;
  const categorySummaryLabel = buildCategorySummaryLabel(
    selectedCategoryValues,
    categories,
    showCategoryEmoji,
    t('task.categories')
  );
  const categoryButtonClass = basicPanel === 'category'
    ? 'bg-indigo-50 text-indigo-700'
    : hasCategoryValue
      ? 'text-indigo-600 hover:bg-indigo-50'
      : 'text-slate-500 hover:bg-slate-100';
  const recurrenceSummaryLabel = buildRecurrenceSummaryLabel(showRecurrence, recurrenceType, selectedDays, t, {
    month: recurrenceLunarMonth,
    day: recurrenceLunarDay,
    isLeapMonth: recurrenceLunarIsLeapMonth,
  });
  const recurrenceButtonClass = basicPanel === 'recurrence'
    ? 'bg-slate-100 text-slate-700'
    : showRecurrence
      ? 'text-emerald-600 hover:bg-emerald-50'
      : 'text-slate-500 hover:bg-slate-100';
  const isCustomRecurrenceType = recurrenceType === 'biweekly' || recurrenceType === 'lunar';
  const recurrenceLunarPickerDate = (
    solarDateFromLunarSelection({
      year: recurrenceLunarYear,
      month: recurrenceLunarMonth,
      day: recurrenceLunarDay,
      isLeapMonth: recurrenceLunarIsLeapMonth,
    })
    || splitDatePart(startInputValue || '')
    || dayjs().tz(getUserTimezone()).format('YYYY-MM-DD')
  );

  const isBasicPanelRequiringConfirm = useCallback(
    (panelName) => BASIC_PANELS_REQUIRING_CONFIRM.has(String(panelName || '')),
    []
  );

  const createBasicPanelSnapshot = useCallback((panelName) => {
    const name = String(panelName || '');
    if (!isBasicPanelRequiringConfirm(name)) return null;
    if (name === 'time') {
      return {
        panel: name,
        draftState: {
          all_day: !!getValues('all_day'),
          start_time: String(getValues('start_time') || ''),
          end_time: String(getValues('end_time') || ''),
        },
        uiState: {
          timeRangeEnabled: !!timeRangeEnabled,
          timeRangeEditing: timeRangeEditing === 'end' ? 'end' : 'start',
          timeCalendarMode: timeCalendarMode === 'lunar' ? 'lunar' : 'solar',
          timeTouched: !!timeTouched,
          parsePreview: String(parsePreview || ''),
        },
      };
    }
    return {
      panel: name,
      draftState: {
        showRecurrence: !!showRecurrence,
        recurrenceType: recurrenceType || 'daily',
        selectedDays: [...selectedDays],
        monthlyDate: clampMonthlyDate(monthlyDate, 1),
        recurrenceLunarYear: Number.parseInt(recurrenceLunarYear, 10) || dayjs().tz(LUNAR_TIMEZONE).year(),
        recurrenceLunarMonth: Number.parseInt(recurrenceLunarMonth, 10) || 1,
        recurrenceLunarDay: Number.parseInt(recurrenceLunarDay, 10) || 1,
        recurrenceLunarIsLeapMonth: !!recurrenceLunarIsLeapMonth,
      },
      uiState: {
        showCustomRecurrenceMenu: !!showCustomRecurrenceMenu,
        showMonthlyDatePicker: !!showMonthlyDatePicker,
      },
    };
  }, [
    getValues,
    isBasicPanelRequiringConfirm,
    monthlyDate,
    parsePreview,
    recurrenceLunarDay,
    recurrenceLunarIsLeapMonth,
    recurrenceLunarMonth,
    recurrenceLunarYear,
    recurrenceType,
    selectedDays,
    showCustomRecurrenceMenu,
    showMonthlyDatePicker,
    showRecurrence,
    timeCalendarMode,
    timeRangeEditing,
    timeRangeEnabled,
    timeTouched,
  ]);

  const restoreBasicPanelSnapshot = useCallback((snapshot) => {
    if (!snapshot || typeof snapshot !== 'object') return;
    const panelName = String(snapshot.panel || '');
    const draftState = snapshot.draftState && typeof snapshot.draftState === 'object'
      ? snapshot.draftState
      : {};
    if (panelName === 'time') {
      setValue('all_day', !!draftState.all_day, { shouldDirty: true });
      setValue('start_time', String(draftState.start_time || ''), { shouldDirty: true });
      setValue('end_time', String(draftState.end_time || ''), { shouldDirty: true });
      setTimeRangeEnabled(!!snapshot?.uiState?.timeRangeEnabled);
      setTimeRangeEditing(snapshot?.uiState?.timeRangeEditing === 'end' ? 'end' : 'start');
      setTimeCalendarMode(snapshot?.uiState?.timeCalendarMode === 'lunar' ? 'lunar' : 'solar');
      setTimeTouched(!!snapshot?.uiState?.timeTouched);
      setParsePreview(String(snapshot?.uiState?.parsePreview || ''));
      return;
    }
    if (panelName === 'recurrence') {
      setShowRecurrence(!!draftState.showRecurrence);
      setRecurrenceType(String(draftState.recurrenceType || 'daily'));
      setSelectedDays(Array.isArray(draftState.selectedDays) ? [...draftState.selectedDays] : []);
      setMonthlyDate(clampMonthlyDate(draftState.monthlyDate, 1));
      setRecurrenceLunarYear(Number.parseInt(draftState.recurrenceLunarYear, 10) || dayjs().tz(LUNAR_TIMEZONE).year());
      setRecurrenceLunarMonth(Number.parseInt(draftState.recurrenceLunarMonth, 10) || 1);
      setRecurrenceLunarDay(Number.parseInt(draftState.recurrenceLunarDay, 10) || 1);
      setRecurrenceLunarIsLeapMonth(!!draftState.recurrenceLunarIsLeapMonth);
      setShowCustomRecurrenceMenu(!!snapshot?.uiState?.showCustomRecurrenceMenu);
      setShowMonthlyDatePicker(!!snapshot?.uiState?.showMonthlyDatePicker);
    }
  }, [setValue]);

  const closeBasicPanelWithConfirm = useCallback((panelName, shouldApply = false) => {
    const name = String(panelName || '');
    const snapshot = detailPanelSnapshotRef.current;
    if (!shouldApply && snapshot && snapshot.panel === name) {
      restoreBasicPanelSnapshot(snapshot);
    }
    if (snapshot && snapshot.panel === name) {
      detailPanelSnapshotRef.current = null;
    }
    if (name === 'recurrence') {
      setShowCustomRecurrenceMenu(false);
      setShowMonthlyDatePicker(false);
    }
    setBasicPanel('');
  }, [restoreBasicPanelSnapshot]);

  const handleBasicPanelToggle = useCallback((panelName) => {
    const nextPanel = String(panelName || '');
    const currentPanel = String(basicPanel || '');

    if (currentPanel === nextPanel) {
      if (isBasicPanelRequiringConfirm(currentPanel)) {
        closeBasicPanelWithConfirm(currentPanel, false);
      } else {
        setBasicPanel('');
      }
      return;
    }

    if (currentPanel) {
      if (isBasicPanelRequiringConfirm(currentPanel)) {
        const snapshot = detailPanelSnapshotRef.current;
        if (snapshot && snapshot.panel === currentPanel) {
          restoreBasicPanelSnapshot(snapshot);
          detailPanelSnapshotRef.current = null;
        }
        if (currentPanel === 'recurrence') {
          setShowCustomRecurrenceMenu(false);
          setShowMonthlyDatePicker(false);
        }
      }
      setBasicPanel('');
    }

    if (isBasicPanelRequiringConfirm(nextPanel)) {
      detailPanelSnapshotRef.current = createBasicPanelSnapshot(nextPanel);
    } else {
      detailPanelSnapshotRef.current = null;
    }
    setShowActivityPanel(false);
    setBasicPanel(nextPanel);
  }, [
    basicPanel,
    closeBasicPanelWithConfirm,
    createBasicPanelSnapshot,
    isBasicPanelRequiringConfirm,
    restoreBasicPanelSnapshot,
  ]);

  const normalizeSelectionByYear = (selection) => coerceLunarSelection(selection, dayjs().tz(LUNAR_TIMEZONE).year());
  const handleStartDateTimeChange = (nextValue) => {
    const nextStart = String(nextValue || '');
    const timezoneName = getUserTimezone();
    const currentEnd = String(getValues('end_time') || '');
    setValue('start_time', nextStart, { shouldDirty: true });
    if (timeRangeEnabled) {
      if (nextStart && currentEnd) {
        const alignedEnd = coerceEndNotBeforeStart(nextStart, currentEnd, timezoneName);
        if (alignedEnd !== currentEnd) {
          setValue('end_time', alignedEnd, { shouldDirty: true });
        }
      }
    } else if (currentEnd) {
      setValue('end_time', '', { shouldDirty: true });
    }
    setTimeTouched(true);
  };
  const handleEndDateTimeChange = (nextValue) => {
    setValue('end_time', String(nextValue || ''), { shouldDirty: true });
    setTimeTouched(true);
  };

  useEffect(() => onUIPrefsChanged(() => setShowCategoryEmoji(getShowCategoryEmoji())), []);

  useEffect(() => {
    if (!basicPanel && !showActivityPanel) return undefined;
    const handlePointerDown = (event) => {
      if (isBasicPanelFloatingLayerTarget(event.target)) return;
      if (!basicPanelRef.current) return;
      if (!basicPanelRef.current.contains(event.target)) {
        if (basicPanel && isBasicPanelRequiringConfirm(basicPanel)) {
          closeBasicPanelWithConfirm(basicPanel, false);
        } else {
          setBasicPanel('');
        }
        setShowActivityPanel(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [basicPanel, closeBasicPanelWithConfirm, isBasicPanelRequiringConfirm, showActivityPanel]);

  useEffect(() => {
    if (basicPanel) {
      setShowActivityPanel(false);
    }
  }, [basicPanel]);

  useEffect(() => {
    setShowActivityPanel(false);
    detailPanelSnapshotRef.current = null;
  }, [task?.id]);

  useEffect(() => {
    if (!showRecurrence) {
      setShowCustomRecurrenceMenu(false);
      setShowMonthlyDatePicker(false);
      return;
    }
    if (recurrenceType !== 'monthly') {
      setShowMonthlyDatePicker(false);
    }
  }, [showRecurrence, recurrenceType]);

  useEffect(() => {
    const lunar = lunarSelectionFromLocalInput(startInputValue, !!isAllDay, LUNAR_TIMEZONE);
    if (!lunar) return;
    const normalized = normalizeSelectionByYear(lunar);
    setStartLunarYear(normalized.year);
    setStartLunarMonth(normalized.month);
    setStartLunarDay(normalized.day);
    setStartLunarIsLeapMonth(normalized.isLeapMonth);
  }, [isAllDay, startInputValue]);

  useEffect(() => {
    const lunar = lunarSelectionFromLocalInput(endInputValue, !!isAllDay, LUNAR_TIMEZONE);
    if (!lunar) return;
    const normalized = normalizeSelectionByYear(lunar);
    setEndLunarYear(normalized.year);
    setEndLunarMonth(normalized.month);
    setEndLunarDay(normalized.day);
    setEndLunarIsLeapMonth(normalized.isLeapMonth);
  }, [endInputValue, isAllDay]);

  const applyQuickDatePreset = (preset) => {
    if (preset === 'clear') {
      setValue('start_time', '');
      setValue('end_time', '');
      setTimeTouched(true);
      return;
    }

    const timezoneName = getUserTimezone();
    const now = dayjs().tz(timezoneName);
    const { hour: defaultHour, minute: defaultMinute } = getDefaultStartParts();

    let target = now;
    if (preset === 'tomorrow') target = now.add(1, 'day');
    if (preset === 'next_week') target = now.add(7, 'day');

    let hour = defaultHour;
    let minute = defaultMinute;
    if (preset === 'tonight') {
      hour = 20;
      minute = 0;
    }

    if (isAllDay) {
      setValue('start_time', target.format('YYYY-MM-DD'));
      if (timeRangeEnabled) {
        setValue('end_time', target.format('YYYY-MM-DD'));
      } else {
        setValue('end_time', '');
      }
      setTimeTouched(true);
      return;
    }

    const nextStartInput = target.hour(hour).minute(minute).second(0).format('YYYY-MM-DDTHH:mm');
    const currentStartInput = getValues('start_time') || '';
    const currentEndInput = getValues('end_time') || '';
    const shiftedEnd = shiftEndByDuration(currentStartInput, currentEndInput, nextStartInput, timezoneName);
    const nextEndInput = shiftedEnd || coerceEndNotBeforeStart(nextStartInput, currentEndInput, timezoneName);

    setValue('start_time', nextStartInput);
    if (timeRangeEnabled) {
      if (nextEndInput !== currentEndInput) {
        setValue('end_time', nextEndInput);
      }
    } else if (currentEndInput) {
      setValue('end_time', '');
    }
    setTimeTouched(true);
  };

  useEffect(() => {
    setTimeTouched(false);
    setParsePreview('');
    setTimeRangeEditing('start');
    setTimeCalendarMode('solar');
    
    if (task) {
      // 编辑模式：填充表单数据
      setValue('title', task.title || '');
      setValue('description', task.description || '');
      setValue('priority', task.priority?.toString() || '0');
      setValue('status', task.status || 'pending');
      
      // 处理时间字段（支持 snake_case 和 camelCase）
      const baseStartTime = task.start_time || task.startTime;
      const baseEndTime = task.end_time || task.endTime;
      const allDay = task.all_day || task.allDay;
      const recurrenceRule = parseRecurrenceRule(task.recurrence_rule || task.recurrenceRule);
      const hasOccurrenceContext = !!(
        recurrenceRule
        && (
          String(task?.instanceId || task?.instance_id || '').trim()
          || String(task?.occurrenceDate || task?.occurrence_date || '').trim()
          || String(task?.occurrenceStart || task?.occurrence_start || '').trim()
        )
      );
      let startTime = baseStartTime;
      let endTime = baseEndTime;
      if (hasOccurrenceContext) {
        const occurrenceStart = task?.occurrenceStart || task?.occurrence_start || '';
        const occurrenceEnd = task?.occurrenceEnd || task?.occurrence_end || '';
        if (occurrenceStart) {
          startTime = occurrenceStart;
          if (occurrenceEnd) {
            endTime = occurrenceEnd;
          } else {
            const timezoneName = getUserTimezone();
            const baseStartParsed = parseAbsoluteInTimezone(baseStartTime, timezoneName);
            const baseEndParsed = parseAbsoluteInTimezone(baseEndTime, timezoneName);
            const occurrenceStartParsed = parseAbsoluteInTimezone(occurrenceStart, timezoneName);
            if (baseStartParsed && baseEndParsed && occurrenceStartParsed) {
              const durationMinutes = baseEndParsed.diff(baseStartParsed, 'minute');
              if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
                endTime = occurrenceStartParsed.add(durationMinutes, 'minute').toISOString();
              }
            }
          }
        }
      }
      let startInput = startTime ? toInputFormat(startTime, null, allDay) : '';
      let endInput = endTime ? toInputFormat(endTime, null, allDay) : '';
      const parsedSelection = parseRecurrenceSelection(recurrenceRule, startInput);
      if (
        !allDay
        && (parsedSelection.type === 'weekly' || parsedSelection.type === 'biweekly')
        && startInput
      ) {
        const nextStartInput = alignStartInputToWeekday(
          startInput,
          parsedSelection.days.length > 0 ? parsedSelection.days : DEFAULT_WORKDAY_KEYS,
          getUserTimezone()
        );
        if (nextStartInput && nextStartInput !== startInput) {
          const shiftedEnd = shiftEndByDuration(startInput, endInput, nextStartInput, getUserTimezone());
          startInput = nextStartInput;
          if (shiftedEnd) {
            endInput = shiftedEnd;
          }
        }
        endInput = coerceEndNotBeforeStart(startInput, endInput, getUserTimezone());
      }
      setValue('start_time', startInput || '');
      setValue('end_time', endInput || '');
      setValue('all_day', allDay || false);
      setTimeRangeEnabled(!!endInput);
      
      // 处理重复规则
      setShowRecurrence(false);
      setRecurrenceType('daily');
      setSelectedDays([]);
      setMonthlyDate(resolveMonthlyDateFromRule(null, startInput));
      const fallbackRecurrenceLunar = parseLunarYearlyRule(
        { freq: 'lunar_yearly' },
        startInput || getDefaultStartInputValue(getUserTimezone()),
      ) || { year: dayjs().tz(LUNAR_TIMEZONE).year(), month: 1, day: 1, isLeapMonth: false };
      setRecurrenceLunarYear(fallbackRecurrenceLunar.year);
      setRecurrenceLunarMonth(fallbackRecurrenceLunar.month);
      setRecurrenceLunarDay(fallbackRecurrenceLunar.day);
      setRecurrenceLunarIsLeapMonth(fallbackRecurrenceLunar.isLeapMonth);
      setShowCustomRecurrenceMenu(false);
      setShowMonthlyDatePicker(false);
      if (recurrenceRule) {
        setShowRecurrence(true);
        setRecurrenceType(parsedSelection.type);
        setSelectedDays(parsedSelection.days);
        setMonthlyDate(resolveMonthlyDateFromRule(recurrenceRule, startInput));
        setRecurrenceLunarYear(Number.parseInt(parsedSelection.lunarYear, 10) || fallbackRecurrenceLunar.year);
        setRecurrenceLunarMonth(Number.parseInt(parsedSelection.lunarMonth, 10) || fallbackRecurrenceLunar.month);
        setRecurrenceLunarDay(Number.parseInt(parsedSelection.lunarDay, 10) || fallbackRecurrenceLunar.day);
        setRecurrenceLunarIsLeapMonth(!!parsedSelection.lunarIsLeapMonth);
        if (parsedSelection.type === 'biweekly' || parsedSelection.type === 'lunar') {
          setShowCustomRecurrenceMenu(true);
        }
      }
      
      // 处理分类
      if (task.categories && task.categories.length > 0) {
        setValue('category_ids', task.categories.map(c => c.id.toString()));
      } else {
        setValue('category_ids', []);
      }
    } else {
      // 新建模式：默认当前时间
      setShowRecurrence(false);
      setRecurrenceType('daily');
      setSelectedDays([]);
      setMonthlyDate(1);
      const fallbackLunarSelection = parseLunarYearlyRule(
        { freq: 'lunar_yearly' },
        initialRange?.start || getDefaultStartInputValue(getUserTimezone()),
      ) || { year: dayjs().tz(LUNAR_TIMEZONE).year(), month: 1, day: 1, isLeapMonth: false };
      setRecurrenceLunarYear(fallbackLunarSelection.year);
      setRecurrenceLunarMonth(fallbackLunarSelection.month);
      setRecurrenceLunarDay(fallbackLunarSelection.day);
      setRecurrenceLunarIsLeapMonth(fallbackLunarSelection.isLeapMonth);
      setShowCustomRecurrenceMenu(false);
      setShowMonthlyDatePicker(false);
      if (initialRange?.start) {
        setValue('all_day', !!initialRange.allDay);
        setValue('start_time', initialRange.start);
        setValue('end_time', initialRange.end || '');
        setTimeRangeEnabled(!!initialRange.end);
        setMonthlyDate(clampMonthlyDate(dayjs(initialRange.start).date(), 1));
      } else {
        const timezone = getUserTimezone();
        const defaultStart = getDefaultStartInputValue(timezone);
        setValue('start_time', defaultStart);
        setValue('end_time', '');
        setValue('all_day', false);
        setTimeRangeEnabled(false);
        setMonthlyDate(clampMonthlyDate(dayjs(defaultStart).date(), 1));
      }
      setValue('priority', '0');
      setValue('category_ids', []);
    }
    detailPanelSnapshotRef.current = null;
    setBasicPanel('');
  }, [task, initialRange, setValue]);

  useEffect(() => {
    const startTime = getValues('start_time');
    const endTime = getValues('end_time');

    if (isAllDay) {
      if (startTime && startTime.includes('T')) {
        setValue('start_time', startTime.split('T')[0]);
      }
      if (endTime && endTime.includes('T')) {
        setValue('end_time', endTime.split('T')[0]);
      }
      return;
    }

    const { hour: defaultHour, minute: defaultMinute } = getDefaultStartParts();
    const defaultTime = `${String(defaultHour).padStart(2, '0')}:${String(defaultMinute).padStart(2, '0')}`;
    if (startTime && !startTime.includes('T')) {
      setValue('start_time', `${startTime}T${defaultTime}`);
    }
    if (endTime && !endTime.includes('T')) {
      setValue('end_time', `${endTime}T23:59`);
    }
  }, [isAllDay, getValues, setValue]);

  const applyNaturalTimeFromTitle = (titleValue, shouldUpdateTime) => {
    const rawTitle = String(titleValue || '');
    const parsedPriority = parsePriorityFromTitle(rawTitle);
    const priorityNormalizedTitle = typeof parsedPriority?.cleanedTitle === 'string'
      ? parsedPriority.cleanedTitle
      : rawTitle;
    const originalStartTime = getValues('start_time') || '';
    const originalEndTime = getValues('end_time') || '';
    const parsed = parseNaturalTimeFromTitle(
      priorityNormalizedTitle,
      getUserTimezone(),
      getNaturalTimeOptionsFromUser(getStoredUser())
    );
    if (Number.isInteger(parsedPriority?.priority)) {
      setValue('priority', String(parsedPriority.priority), { shouldDirty: true });
    }
    if (!parsed) {
      if (priorityNormalizedTitle !== rawTitle) {
        setValue('title', priorityNormalizedTitle, { shouldDirty: true });
      }
      setParsePreview('');
      return null;
    }
    const cleanedTitle = parsed.cleanedTitle || priorityNormalizedTitle;
    if (cleanedTitle !== rawTitle) {
      setValue('title', cleanedTitle, { shouldDirty: true });
    }
    if (shouldUpdateTime && parsed.parsedAtInput !== originalStartTime) {
      setValue('start_time', parsed.parsedAtInput);
      const shiftedEndTime = shiftEndByDuration(
        originalStartTime,
        originalEndTime,
        parsed.parsedAtInput,
        getUserTimezone()
      );
      if (shiftedEndTime) {
        setValue('end_time', shiftedEndTime);
      }
    }
    setParsePreview(`${t('task.timeParsedHint')}: ${parsed.parsedAtDisplay}`);
    return parsed;
  };

  const onSubmit = async (data, options = {}) => {
    setError('');
    const submitOptions = options && typeof options === 'object' ? options : {};
    const silent = !!submitOptions.silent;
    const submitSource = String(submitOptions.submitSource || 'manual');

    try {
      const liveDescription = String(descriptionEditorRef.current?.getValue?.() ?? data.description ?? '');
      if (liveDescription !== String(data.description || '')) {
        data.description = liveDescription;
        setValue('description', liveDescription, { shouldDirty: true });
      }
      const clientTimezone = getUserTimezone();
      logTimeDebug('taskModal.submit.start', {
        task_id: Number(task?.id || 0),
        is_editing: !!isEditing,
        timezone: clientTimezone,
      });
      const rawTitle = (data.title || '').trim();
      const parsedPriority = parsePriorityFromTitle(rawTitle);
      const priorityNormalizedTitle = parsedPriority?.cleanedTitle?.trim() || rawTitle;
      const parsedNaturalTime = applyNaturalTimeFromTitle(priorityNormalizedTitle, !timeTouched);
      const normalizedTitle = parsedNaturalTime?.cleanedTitle?.trim() || priorityNormalizedTitle;

      const payload = {
        title: normalizedTitle,
        description: data.description || '',
        priority: Number.isInteger(parsedPriority?.priority) ? parsedPriority.priority : parseInt(data.priority),
        all_day: !!data.all_day,
        client_timezone: clientTimezone,
      };
      
      if (isEditing) {
        payload.status = data.status || task.status || 'pending';
      }

      const existingRecurrenceRule = isEditing ? parseRecurrenceRule(task?.recurrence_rule || task?.recurrenceRule) : null;
      const hasOccurrenceContext = !!(
        isEditing
        && existingRecurrenceRule
        && (
          String(task?.instanceId || task?.instance_id || '').trim()
          || String(task?.occurrenceDate || task?.occurrence_date || '').trim()
          || String(task?.occurrenceStart || task?.occurrence_start || '').trim()
        )
      );
      const existingRecurrenceSelection = parseRecurrenceSelection(
        existingRecurrenceRule,
        toInputFormat(task?.start_time || task?.startTime || task?.due_date || task?.dueDate || '', null, !!data.all_day),
      );
      const normalizedExistingDays = (existingRecurrenceSelection.days || [])
        .map((day) => String(day || '').toUpperCase())
        .filter((day) => WEEKDAY_ONLY_RE.test(day))
        .sort();
      const normalizedSelectedDays = selectedDays
        .map((day) => String(day || '').toUpperCase())
        .filter((day) => WEEKDAY_ONLY_RE.test(day))
        .sort();
      const normalizedExistingLunar = {
        month: Number.parseInt(existingRecurrenceSelection.lunarMonth, 10) || 1,
        day: Number.parseInt(existingRecurrenceSelection.lunarDay, 10) || 1,
        leap: !!existingRecurrenceSelection.lunarIsLeapMonth,
      };
      const normalizedCurrentLunar = {
        month: Number.parseInt(recurrenceLunarMonth, 10) || 1,
        day: Number.parseInt(recurrenceLunarDay, 10) || 1,
        leap: !!recurrenceLunarIsLeapMonth,
      };
      const recurrenceChanged = isEditing && (
        showRecurrence !== !!existingRecurrenceRule
        || (showRecurrence && (
          (recurrenceType || 'daily') !== (existingRecurrenceSelection.type || 'daily')
          || JSON.stringify(normalizedSelectedDays) !== JSON.stringify(normalizedExistingDays)
          || ((recurrenceType || 'daily') === 'monthly'
            && clampMonthlyDate(monthlyDate) !== clampMonthlyDate(existingRecurrenceSelection.monthDate, 1))
          || ((recurrenceType || 'daily') === 'lunar' && (
            normalizedCurrentLunar.month !== normalizedExistingLunar.month
            || normalizedCurrentLunar.day !== normalizedExistingLunar.day
            || normalizedCurrentLunar.leap !== normalizedExistingLunar.leap
          ))
        ))
      );
      const shouldFallbackScheduleFromTask = recurrenceChanged && !timeTouched;
      const fallbackStartInput = shouldFallbackScheduleFromTask
        ? toInputFormat(task?.start_time || task?.startTime || task?.due_date || task?.dueDate || '', null, !!data.all_day)
        : '';
      const fallbackEndInput = shouldFallbackScheduleFromTask
        ? toInputFormat(task?.end_time || task?.endTime || '', null, !!data.all_day)
        : '';
      const resolveInputValue = (value, fallback) => {
        const raw = typeof value === 'string' ? value : '';
        if (raw) return raw;
        if (shouldFallbackScheduleFromTask) return fallback || '';
        return '';
      };
      const defaultStartParts = getDefaultStartParts();
      const defaultStartTime = `${String(defaultStartParts.hour).padStart(2, '0')}:${String(defaultStartParts.minute).padStart(2, '0')}`;
      const lunarSelection = coerceLunarSelection({
        year: recurrenceLunarYear,
        month: Number.parseInt(recurrenceLunarMonth, 10) || 1,
        day: Number.parseInt(recurrenceLunarDay, 10) || 1,
        isLeapMonth: !!recurrenceLunarIsLeapMonth,
      });
      const shouldAlignLunarStart = !!showRecurrence && recurrenceType === 'lunar';
      const recurrenceDaysForAlignment = normalizedSelectedDays.length > 0 ? normalizedSelectedDays : workDayKeys;
      const shouldAlignNearestSolarStart = !!(
        showRecurrence
        && recurrenceType !== 'lunar'
        && ['weekly', 'biweekly', 'monthly', 'yearly'].includes(recurrenceType)
        && (!isEditing || recurrenceChanged)
      );
      const nowLocalInput = dayjs().tz(clientTimezone).format('YYYY-MM-DDTHH:mm');
      const nowLocalDateInput = dayjs().tz(clientTimezone).format('YYYY-MM-DD');
      const nowLunarInput = dayjs().tz(LUNAR_TIMEZONE).format('YYYY-MM-DDTHH:mm');
      const nowLunarDateInput = dayjs().tz(LUNAR_TIMEZONE).format('YYYY-MM-DD');

      // 处理日期时间
      if (data.all_day) {
        let startInput = resolveInputValue(data.start_time, fallbackStartInput);
        let endInput = resolveInputValue(data.end_time, fallbackEndInput);
        if (shouldAlignLunarStart) {
          const lunarAlignedStart = nextLocalInputFromLunarSelection(lunarSelection, {
            currentValue: startInput,
            allDay: true,
            timezoneName: LUNAR_TIMEZONE,
            fallbackTime: defaultStartTime,
            fromValue: nowLunarDateInput,
          });
          if (lunarAlignedStart && lunarAlignedStart !== startInput) {
            const shiftedEndTime = shiftEndByDuration(
              startInput,
              endInput,
              lunarAlignedStart,
              clientTimezone
            );
            startInput = lunarAlignedStart;
            if (shiftedEndTime) {
              endInput = shiftedEndTime;
            }
          }
        }
        if (shouldAlignNearestSolarStart) {
          const nextStartInput = alignStartInputToNearestRecurrence({
            startInput,
            recurrenceType,
            recurrenceDays: recurrenceDaysForAlignment,
            recurrenceDate: monthlyDate,
            allDay: true,
            referenceInput: nowLocalDateInput,
            timezoneName: clientTimezone,
          });
          if (nextStartInput && nextStartInput !== startInput) {
            const shiftedEndTime = shiftEndByDuration(
              startInput,
              endInput,
              nextStartInput,
              clientTimezone
            );
            startInput = nextStartInput;
            if (shiftedEndTime) {
              endInput = shiftedEndTime;
            }
          }
        }
        const startDate = splitDatePart(startInput);
        let endDate = splitDatePart(endInput);
        if (startDate && endDate) {
          const startDay = parseLocalInput(startDate);
          const endDay = parseLocalInput(endDate);
          if (startDay && endDay && endDay.isBefore(startDay, 'day')) {
            endDate = startDate;
          }
        }
        payload.start_time = startDate ? toISOString(`${startDate} 00:00:00`, clientTimezone) : null;
        payload.end_time = endDate ? toISOString(`${endDate} 23:59:59`, clientTimezone) : null;
        data.start_time = startDate;
        data.end_time = endDate;
      } else {
        let originalStartInput = resolveInputValue(data.start_time, fallbackStartInput);
        let originalEndInput = resolveInputValue(data.end_time, fallbackEndInput);
        if (parsedNaturalTime && !timeTouched) {
          data.start_time = parsedNaturalTime.parsedAtInput;
          const shiftedEndTime = shiftEndByDuration(
            originalStartInput,
            originalEndInput,
            data.start_time,
            clientTimezone
          );
          if (shiftedEndTime) {
            data.end_time = shiftedEndTime;
          }
        }
        if (!isEditing && !data.start_time) {
          data.start_time = getDefaultStartInputValue(clientTimezone);
        }
        if (typeof data.start_time === 'string' && data.start_time) {
          originalStartInput = data.start_time;
        }
        if (typeof data.end_time === 'string' && data.end_time) {
          originalEndInput = data.end_time;
        }
        if (shouldAlignLunarStart) {
          const lunarAlignedStart = nextLocalInputFromLunarSelection(lunarSelection, {
            currentValue: originalStartInput,
            allDay: false,
            timezoneName: LUNAR_TIMEZONE,
            fallbackTime: defaultStartTime,
            fromValue: nowLunarInput,
          });
          if (lunarAlignedStart && lunarAlignedStart !== originalStartInput) {
            const shiftedEndTime = shiftEndByDuration(
              originalStartInput,
              originalEndInput,
              lunarAlignedStart,
              clientTimezone
            );
            originalStartInput = lunarAlignedStart;
            if (shiftedEndTime) {
              originalEndInput = shiftedEndTime;
            }
          }
        }
        if (shouldAlignNearestSolarStart) {
          const nextStartInput = alignStartInputToNearestRecurrence({
            startInput: originalStartInput,
            recurrenceType,
            recurrenceDays: recurrenceDaysForAlignment,
            recurrenceDate: monthlyDate,
            allDay: false,
            referenceInput: nowLocalInput,
            timezoneName: clientTimezone,
          });
          if (nextStartInput && nextStartInput !== originalStartInput) {
            const shiftedEndTime = shiftEndByDuration(
              originalStartInput,
              originalEndInput,
              nextStartInput,
              clientTimezone
            );
            originalStartInput = nextStartInput;
            if (shiftedEndTime) {
              originalEndInput = shiftedEndTime;
            }
          }
        }
        originalEndInput = coerceEndNotBeforeStart(originalStartInput, originalEndInput, clientTimezone);
        payload.start_time = originalStartInput ? toISOString(originalStartInput, clientTimezone) : null;
        payload.end_time = originalEndInput ? toISOString(originalEndInput, clientTimezone) : null;
        data.start_time = originalStartInput;
        data.end_time = originalEndInput;
      }
      if (data.start_time) {
        payload.start_time_local = data.start_time;
      }
      if (data.end_time) {
        payload.end_time_local = data.end_time;
      }

      if (!isEditing) {
        if (!payload.start_time) delete payload.start_time;
        if (!payload.end_time) delete payload.end_time;
      }
      if (hasOccurrenceContext) {
        const instanceID = String(task?.instanceId || task?.instance_id || '').trim();
        if (/^\d+_\d{8}$/.test(instanceID)) {
          payload.instance_id = instanceID;
        }
        const occurrenceBase = task?.occurrenceDate
          || task?.occurrence_date
          || task?.occurrenceStart
          || task?.occurrence_start
          || '';
        const occurrenceDate = resolveOccurrenceDate(occurrenceBase, clientTimezone);
        if (occurrenceDate) {
          payload.occurrence_date = occurrenceDate;
        }
      }
      const shouldSkipOccurrenceScheduleWrite = !!(
        isEditing
        && hasOccurrenceContext
        && !timeTouched
        && !recurrenceChanged
      );
      if (shouldSkipOccurrenceScheduleWrite) {
        delete payload.start_time;
        delete payload.end_time;
        delete payload.start_time_local;
        delete payload.end_time_local;
        delete payload.all_day;
      }

      logTimeDebug('taskModal.submit.payload_time', {
        task_id: Number(task?.id || 0),
        is_editing: !!isEditing,
        all_day: !!payload.all_day,
        start_time_local: payload.start_time_local || '',
        end_time_local: payload.end_time_local || '',
        start_time: payload.start_time,
        end_time: payload.end_time,
        client_timezone: payload.client_timezone,
        instance_id: payload.instance_id || '',
        occurrence_date: payload.occurrence_date || '',
      });

      // 处理重复规则
      if (showRecurrence) {
        const normalizedDays = selectedDays
          .map((day) => String(day || '').toUpperCase())
          .filter((day) => WEEKDAY_ONLY_RE.test(day));
        let rule = { freq: recurrenceType, interval: 1 };
        if (recurrenceType === 'lunar') {
          const normalizedSelection = coerceLunarSelection({
            year: recurrenceLunarYear,
            month: recurrenceLunarMonth,
            day: recurrenceLunarDay,
            isLeapMonth: recurrenceLunarIsLeapMonth,
          });
          rule = buildLunarYearlyRuleFromSelection(normalizedSelection);
        } else if (recurrenceType === 'biweekly') {
          rule.freq = 'weekly';
          rule.interval = 2;
          rule.byday = normalizedDays.length > 0 ? normalizedDays : workDayKeys;
        } else if (recurrenceType === 'monthly') {
          rule.bydate = [clampMonthlyDate(monthlyDate)];
        } else if (recurrenceType === 'weekly' && normalizedDays.length > 0) {
          rule.byday = normalizedDays;
        }
        payload.recurrence_rule = rule;
      } else if (isEditing) {
        payload.recurrence_rule = null;
      }

      // 处理分类
      const selectedCategoryIDs = Array.isArray(data.category_ids)
        ? data.category_ids
        : data.category_ids
          ? [data.category_ids]
          : [];
      if (selectedCategoryIDs.length > 0) {
        payload.category_ids = selectedCategoryIDs.map(id => parseInt(id, 10));
      } else if (isEditing) {
        payload.category_ids = [];
      }

      const submitMeta = {
        submittedAt: new Date().toISOString(),
        submitSource,
      };
      const saveContext = {
        is_occurrence_scoped: hasOccurrenceContext,
        task_id: Number(task?.id || 0),
        instance_id: String(payload.instance_id || '').trim(),
        occurrence_date: String(payload.occurrence_date || '').trim(),
        description: String(payload.description || ''),
      };
      let savePromise;
      if (isEditing) {
        const localSavedTask = await updateTaskLocal(queryClient, task.id, payload, {
          localOnly: true,
          scheduleSync: false,
        });
        savePromise = updateTaskLocal(queryClient, task.id, payload, {
          localOnly: false,
          scheduleSync: true,
          skipOptimistic: true,
          submitMeta,
        });
        if (!silent) {
          onSaved(localSavedTask || null, saveContext);
        }
      } else {
        savePromise = createTaskLocal(queryClient, payload, { submitMeta });
        // onSaved called once from Promise.resolve below, with the created task (temp ID)
      }

      // Close immediately with optimistic UI; persistence/sync continues in background.
      void Promise.resolve(savePromise)
        .then((savedTask) => {
          if (!silent && (isEditing ? savedTask?.id : true)) {
            onSaved(savedTask || null, saveContext);
          }
        })
        .catch((err) => {
          console.error('Failed to persist task after optimistic save:', err);
        });
    } catch (err) {
      console.error('TaskModal onSubmit failed:', err);
      setError(err.response?.data?.error || t('task.saveFailed'));
    }
  };

  const triggerRealtimeSave = useCallback((submitSource, overrides = null) => {
    if (!isEditing || loading) return;
    void handleSubmit((formData) => onSubmit(
      overrides && typeof overrides === 'object'
        ? { ...formData, ...overrides }
        : formData,
      {
        silent: true,
        submitSource,
      }
    ))();
  }, [handleSubmit, isEditing, loading, onSubmit]);

  const handleDescriptionSaveShortcut = useCallback(() => {
    if (loading) return;
    void handleSubmit(onSubmit)();
  }, [handleSubmit, loading, onSubmit]);

  const requestClose = useCallback(() => {
    const state = modalHistoryRef.current;
    if (typeof window !== 'undefined' && state.hasEntry) {
      state.ignoreNextPop = true;
      state.hasEntry = false;
      window.history.back();
    }
    onClose();
  }, [onClose]);

  const executeDelete = useCallback(async (scope = 'series') => {
    if (!isEditing || !task) return;
    setLoading(true);
    setError('');
    try {
      if (scope === 'single') {
        const instanceID = String(task.instanceId || task.instance_id || '').trim();
        const payload = { status: 'cancelled' };
        const validInstanceID = /^\d+_\d{8}$/.test(instanceID);
        if (validInstanceID) {
          payload.instance_id = instanceID;
        }
        const timezoneName = getUserTimezone();
        const occurrenceBase = task.occurrenceDate || task.occurrence_date || task.start_time || task.startTime || task.due_date || task.dueDate;
        const occurrenceDate = resolveOccurrenceDate(occurrenceBase, timezoneName);
        if (occurrenceDate) {
          payload.occurrence_date = occurrenceDate;
        }
        await updateTaskStatusLocal(queryClient, task.id, payload, {
          submitMeta: {
            submittedAt: new Date().toISOString(),
            submitSource: 'manual',
          },
        });
      } else {
        const hasRecurrence = !!parseRecurrenceRule(task.recurrence_rule || task.recurrenceRule);
        if (hasRecurrence) {
          const timezoneName = getUserTimezone();
          const occurrenceStart = resolveSeriesDeleteOccurrenceStart(task, timezoneName);
          const taskStart = parseAbsoluteInTimezone(
            task?.start_time || task?.startTime || task?.due_date || task?.dueDate,
            timezoneName,
          );
          if (occurrenceStart && taskStart && !occurrenceStart.isAfter(taskStart)) {
            // Deleting from the very first occurrence => delete whole series.
            await deleteTaskLocal(queryClient, task.id);
          } else if (occurrenceStart) {
            // Keep historical occurrences, stop current/future occurrences.
            await updateTaskLocal(queryClient, task.id, {
              recurrence_end_date: occurrenceStart.subtract(1, 'second').utc().toISOString(),
            }, {
              submitMeta: {
                submittedAt: new Date().toISOString(),
                submitSource: 'manual',
              },
            });
          } else {
            await deleteTaskLocal(queryClient, task.id);
          }
        } else if (task?.status === 'cancelled') {
          await deleteTaskLocal(queryClient, task.id);
        } else {
          await cancelTaskLocal(queryClient, task.id);
        }
      }
      onSaved(null);
      requestClose();
    } catch (err) {
      setError(err.response?.data?.error || t('task.deleteFailed'));
    } finally {
      setLoading(false);
      setDeleteChoiceOpen(false);
    }
  }, [isEditing, onSaved, queryClient, requestClose, t, task]);

  const handleDelete = () => {
    if (!isEditing || !task) return;
    if (recurrenceRule) {
      setDeleteChoiceOpen(true);
      return;
    }
    void executeDelete('series');
  };

  const handleToggleCompleted = async () => {
    if (!isEditing || !task) return;
    setLoading(true);
    setError('');
    try {
      const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
      const recurrenceRule = parseRecurrenceRule(task.recurrence_rule || task.recurrenceRule);
      let statusPayload = nextStatus;
      let occurrenceDateForSaveContext = '';
      if (recurrenceRule) {
        const instanceID = String(task.instanceId || task.instance_id || '').trim();
        const validInstanceID = /^\d+_\d{8}$/.test(instanceID);
        if (validInstanceID) {
          statusPayload = { status: nextStatus, instance_id: instanceID };
        }
        const timezoneName = getUserTimezone();
        const occurrenceBase = task.occurrenceDate || task.occurrence_date || task.start_time || task.startTime || task.due_date || task.dueDate;
        const occurrenceDate = resolveOccurrenceDate(occurrenceBase, timezoneName);
        occurrenceDateForSaveContext = occurrenceDate || '';
        statusPayload = {
          ...(typeof statusPayload === 'string' ? { status: nextStatus } : statusPayload),
          ...(occurrenceDate ? { occurrence_date: occurrenceDate } : {}),
        };
      }
      const savedTask = await updateTaskStatusLocal(queryClient, task.id, statusPayload, {
        submitMeta: {
          submittedAt: new Date().toISOString(),
          submitSource: 'manual',
        },
      });
      const scopedPayload = statusPayload && typeof statusPayload === 'object' ? statusPayload : {};
      const saveContext = (scopedPayload.instance_id || scopedPayload.occurrence_date)
        ? {
            is_occurrence_scoped: true,
            task_id: Number(task.id || 0),
            instance_id: String(scopedPayload.instance_id || '').trim(),
            occurrence_date: String(scopedPayload.occurrence_date || occurrenceDateForSaveContext || '').trim(),
            description: String(task.description || ''),
          }
        : null;
      onSaved(savedTask || { ...task, status: nextStatus }, saveContext);
      requestClose();
    } catch (err) {
      setError(err.response?.data?.error || t('task.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const weekDays = [
    { key: 'MO', label: t('calendar.weekday.mo') },
    { key: 'TU', label: t('calendar.weekday.tu') },
    { key: 'WE', label: t('calendar.weekday.we') },
    { key: 'TH', label: t('calendar.weekday.th') },
    { key: 'FR', label: t('calendar.weekday.fr') },
    { key: 'SA', label: t('calendar.weekday.sa') },
    { key: 'SU', label: t('calendar.weekday.su') },
  ];
  const workDayKeys = DEFAULT_WORKDAY_KEYS;
  const allDayKeys = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const baseState = window.history.state && typeof window.history.state === 'object'
      ? window.history.state
      : {};
    window.history.pushState({ ...baseState, __todoModal: 'task-modal' }, '');
    modalHistoryRef.current.hasEntry = true;
    modalHistoryRef.current.ignoreNextPop = false;

    const handlePopState = () => {
      const state = modalHistoryRef.current;
      if (state.ignoreNextPop) {
        state.ignoreNextPop = false;
        return;
      }
      if (!state.hasEntry) return;
      state.hasEntry = false;
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      modalHistoryRef.current.ignoreNextPop = false;
      modalHistoryRef.current.hasEntry = false;
    };
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isEscape = event.key === 'Escape' || event.key === 'Esc' || event.code === 'Escape' || event.keyCode === 27;
      if (isEscape && !loading) {
        event.preventDefault();
        event.stopPropagation();
        if (deleteChoiceOpen) {
          setDeleteChoiceOpen(false);
          return;
        }
        requestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [deleteChoiceOpen, loading, requestClose]);

  return createPortal(
    <div className="modal-overlay" onClick={requestClose}>
      <div
        className="modal-content task-modal-shell"
        onClick={e => e.stopPropagation()}
      >
        <div className="task-modal-frame relative flex min-h-0 flex-col">
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6 md:py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <input
                  value={titleValue}
                  onChange={(e) => {
                    setParsePreview('');
                    setValue('title', e.target.value, { shouldDirty: true });
                  }}
                  onBlur={(e) => applyNaturalTimeFromTitle(e.target.value, !timeTouched)}
                  className="w-full rounded-md border-none bg-transparent px-1 text-lg font-semibold text-slate-900 outline-none transition-colors placeholder:text-slate-300 focus:bg-slate-50 md:text-xl"
                  placeholder={t('task.title')}
                />
              </div>
              <button onClick={requestClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                ✕
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden bg-white">
              {error && (
                <div className="mx-4 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                  {error}
                </div>
              )}

              <div className="border-b border-slate-200 px-3 py-2.5 md:px-4 md:py-3">
                <input type="hidden" {...register('priority')} />
                {isEditing && <input type="hidden" {...register('status')} />}
                <input type="hidden" {...register('title', { required: true })} />
                <input type="checkbox" {...register('all_day')} className="hidden" />
                <input type="hidden" {...register('start_time')} />
                <input type="hidden" {...register('end_time')} />
                <input type="hidden" {...register('description')} />
                <input type="hidden" {...register('category_ids')} />
                <div ref={basicPanelRef} className="relative flex items-center gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {isEditing && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const currentPanel = String(basicPanel || '');
                            if (currentPanel && isBasicPanelRequiringConfirm(currentPanel)) {
                              closeBasicPanelWithConfirm(currentPanel, false);
                            } else if (currentPanel) {
                              setBasicPanel('');
                              detailPanelSnapshotRef.current = null;
                            }
                            setShowActivityPanel((prev) => !prev);
                          }}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${
                            showActivityPanel
                              ? 'bg-slate-100 text-slate-700'
                              : 'text-slate-500 hover:bg-slate-100'
                          }`}
                          title={t('task.activityTitle')}
                        >
                          <IconHistory className="h-4 w-4" />
                        </button>
                        {showActivityPanel && task?.id && (
                          <div className="absolute left-0 top-10 z-20 w-[min(30rem,calc(100vw-3.5rem))]">
                            <TaskActivityTimeline taskID={task.id} />
                          </div>
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => handleBasicPanelToggle('priority')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${priorityButtonClass}`}
                      title={priorityButtonTitle}
                    >
                      <IconFlag className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBasicPanelToggle('category')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${categoryButtonClass}`}
                      title={categorySummaryLabel}
                    >
                      <IconTag className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBasicPanelToggle('recurrence')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${recurrenceButtonClass}`}
                      title={recurrenceSummaryLabel}
                    >
                      {(showRecurrence || basicPanel === 'recurrence')
                        ? <IconRepeat className="h-4 w-4" />
                        : <IconRepeatOff className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBasicPanelToggle('time')}
                      className={`relative inline-flex h-8 min-w-0 items-center gap-1 rounded-md px-2 text-sm ${timeButtonClass}`}
                      title={timeButtonTitle}
                    >
                      <IconClock className="h-4 w-4" />
                      <span className="max-w-[11.5rem] truncate text-left text-[11px] leading-4">{timeSummaryLabel}</span>
                      {hasParsedTimeHint && (
                        <span className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
                      )}
                    </button>
                  </div>
                    {basicPanel === 'priority' && (
                    <div className="absolute left-0 top-10 z-20 w-[min(22rem,calc(100vw-3.5rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('task.priority')}</div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: '1', label: t('task.priorityHigh'), className: 'border-rose-300 bg-rose-50 text-rose-700' },
                          { value: '0', label: t('task.priorityMedium'), className: 'border-sky-300 bg-sky-50 text-sky-700' },
                          { value: '-1', label: t('task.priorityLow'), className: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
                        ].map((priorityOption) => (
                          <button
                            key={priorityOption.value}
                            type="button"
                            onClick={() => {
                              setValue('priority', priorityOption.value, { shouldDirty: true });
                              setBasicPanel('');
                              detailPanelSnapshotRef.current = null;
                              if (isEditing) {
                                triggerRealtimeSave('realtime_priority', { priority: priorityOption.value });
                              }
                            }}
                            className={`rounded-full border px-3 py-1 text-sm ${
                              priorityValue === priorityOption.value
                                ? priorityOption.className
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {priorityOption.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {basicPanel === 'time' && (
                    <div className="time-panel-card absolute left-0 top-10 z-20 w-[min(24.5rem,calc(100vw-1rem))] max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg">
                      <div className="time-panel-toolbar mb-2 space-y-1.5 border-b border-slate-100 pb-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setTimeRangeEnabled(false);
                                setTimeRangeEditing('start');
                                setValue('end_time', '', { shouldDirty: true });
                                setTimeTouched(true);
                              }}
                              className={`rounded-full px-2 py-1 text-[11px] ${
                                !timeRangeEnabled
                                  ? 'bg-sky-100 text-sky-700'
                                  : 'text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              {t('task.timePoint')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTimeRangeEnabled(true);
                                setTimeRangeEditing('end');
                                const timezoneName = getUserTimezone();
                                const currentStart = String(getValues('start_time') || '');
                                const currentEnd = String(getValues('end_time') || '');
                                if (isAllDay) {
                                  if (!currentStart) {
                                    const today = dayjs().tz(timezoneName).format('YYYY-MM-DD');
                                    setValue('start_time', today, { shouldDirty: true });
                                    setValue('end_time', today, { shouldDirty: true });
                                  } else if (!currentEnd) {
                                    setValue('end_time', currentStart, { shouldDirty: true });
                                  }
                                  setTimeTouched(true);
                                  return;
                                }
                                if (!currentStart && !currentEnd) {
                                  const range = buildDefaultRangeAroundNow(timezoneName);
                                  setValue('start_time', range.start, { shouldDirty: true });
                                  setValue('end_time', range.end, { shouldDirty: true });
                                  setTimeTouched(true);
                                  return;
                                }
                                if (currentStart && !currentEnd) {
                                  const nextEnd = buildEndFromStart(currentStart, timezoneName, 60)
                                    || currentStart;
                                  setValue('end_time', nextEnd, { shouldDirty: true });
                                } else if (!currentStart && currentEnd) {
                                  const range = buildDefaultRangeAroundNow(timezoneName);
                                  setValue('start_time', range.start, { shouldDirty: true });
                                  setValue('end_time', coerceEndNotBeforeStart(range.start, currentEnd, timezoneName), { shouldDirty: true });
                                }
                                setTimeTouched(true);
                              }}
                              className={`rounded-full px-2 py-1 text-[11px] ${
                                timeRangeEnabled
                                  ? 'bg-sky-100 text-sky-700'
                                  : 'text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              {t('task.timeRange')}
                            </button>
                          </div>
                          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5">
                            <button
                              type="button"
                              onClick={() => setTimeCalendarMode('solar')}
                              className={`rounded-full px-2 py-1 text-[11px] ${
                                timeCalendarMode === 'solar'
                                  ? 'bg-sky-100 text-sky-700'
                                  : 'text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              {t('task.calendarSolar')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setTimeCalendarMode('lunar')}
                              className={`rounded-full px-2 py-1 text-[11px] ${
                                timeCalendarMode === 'lunar'
                                  ? 'bg-sky-100 text-sky-700'
                                  : 'text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              {t('task.calendarLunar')}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setValue('all_day', !isAllDay, { shouldDirty: true });
                              setTimeTouched(true);
                            }}
                            className={`rounded-full border px-2 py-1 text-[11px] ${
                              isAllDay
                                ? 'border-blue-300 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {t('task.allDay')}
                          </button>
                          <button
                            type="button"
                            onClick={() => applyQuickDatePreset('clear')}
                            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
                          >
                            {t('task.clearDate')}
                          </button>
                          <div className="time-quick-actions ml-auto">
                            <button
                              type="button"
                              title={t('task.quickToday')}
                              aria-label={t('task.quickToday')}
                              onClick={() => applyQuickDatePreset('today')}
                              className="time-quick-btn"
                            >
                              <IconSun className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              title={t('task.quickTomorrow')}
                              aria-label={t('task.quickTomorrow')}
                              onClick={() => applyQuickDatePreset('tomorrow')}
                              className="time-quick-btn"
                            >
                              <IconSunrise className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              title={t('task.quickNextWeek')}
                              aria-label={t('task.quickNextWeek')}
                              onClick={() => applyQuickDatePreset('next_week')}
                              className="time-quick-btn"
                            >
                              <IconCalendar className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              title={t('task.quickTonight')}
                              aria-label={t('task.quickTonight')}
                              onClick={() => applyQuickDatePreset('tonight')}
                              className="time-quick-btn"
                            >
                              <IconMoon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          {timeRangeEnabled && (
                            <div className="mb-1 inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5">
                              <button
                                type="button"
                                onClick={() => setTimeRangeEditing('start')}
                                className={`rounded-full px-2 py-1 text-[11px] ${
                                  timeRangeEditing === 'start'
                                    ? 'bg-sky-100 text-sky-700'
                                    : 'text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                {t('task.startTime')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setTimeRangeEditing('end')}
                                className={`rounded-full px-2 py-1 text-[11px] ${
                                  timeRangeEditing === 'end'
                                    ? 'bg-sky-100 text-sky-700'
                                    : 'text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                {t('task.endTime')}
                              </button>
                            </div>
                          )}
                          <TaskDatePicker
                            key={`modal-time-${timeCalendarMode}-${timeRangeEnabled ? timeRangeEditing : 'point'}-${isAllDay ? 'all' : 'timed'}`}
                            value={isAllDay
                              ? splitDatePart((timeRangeEnabled && timeRangeEditing === 'end') ? endInputValue : startInputValue)
                              : ((timeRangeEnabled && timeRangeEditing === 'end') ? (endInputValue || '') : (startInputValue || ''))}
                            allDay={!!isAllDay}
                            stepMinutes={30}
                            inline
                            lunarOverlay
                            lunarMode={timeCalendarMode === 'lunar'}
                            onChange={(nextValue) => {
                              if (timeRangeEnabled && timeRangeEditing === 'end') {
                                handleEndDateTimeChange(nextValue);
                                return;
                              }
                              handleStartDateTimeChange(nextValue);
                            }}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                        <button
                          type="button"
                          onClick={() => closeBasicPanelWithConfirm('time', false)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            closeBasicPanelWithConfirm('time', true);
                            if (isEditing) {
                              triggerRealtimeSave('realtime_time');
                            }
                          }}
                          className="rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
                        >
                          {t('common.confirm')}
                        </button>
                      </div>
                    </div>
                  )}

                  {basicPanel === 'category' && (
                    <div className="absolute left-0 top-10 z-20 w-[min(26rem,calc(100vw-3.5rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                      <label className="form-label">{t('task.categories')}</label>
                      <div className="flex flex-wrap gap-2">
                        {categories.map(cat => {
                          const active = selectedCategoryValues.includes(String(cat.id));
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                const current = getValues('category_ids');
                                const asArray = Array.isArray(current) ? current.map(String) : current ? [String(current)] : [];
                                const next = asArray.includes(String(cat.id))
                                  ? asArray.filter((id) => id !== String(cat.id))
                                  : [...asArray, String(cat.id)];
                                setValue('category_ids', next, { shouldDirty: true });
                                setBasicPanel('');
                                detailPanelSnapshotRef.current = null;
                                if (isEditing) {
                                  triggerRealtimeSave('realtime_category', { category_ids: next });
                                }
                              }}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                                active
                                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {showCategoryEmoji && cat.emoji ? (
                                <span>{cat.emoji}</span>
                              ) : null}
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                              <span>{cat.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      {categories.length === 0 && (
                        <p className="text-xs text-slate-500">{t('category.noCategories')}</p>
                      )}
                    </div>
                  )}

                  {basicPanel === 'recurrence' && (
                    <div className="absolute left-0 top-10 z-20 w-[min(24rem,calc(100vw-3.5rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-700">{t('task.repeat')}</label>
                        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
                          <button
                            type="button"
                            onClick={() => {
                              setShowRecurrence(false);
                              setSelectedDays([]);
                              setRecurrenceType('daily');
                            }}
                            className={`rounded-full px-2.5 py-1 text-xs ${
                              !showRecurrence
                                ? 'bg-slate-100 text-slate-700'
                                : 'text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {t('task.repeatOff')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowRecurrence(true);
                              if ((recurrenceType === 'weekly' || recurrenceType === 'biweekly') && selectedDays.length === 0) {
                                setSelectedDays(workDayKeys);
                              }
                            }}
                            className={`rounded-full px-2.5 py-1 text-xs ${
                              showRecurrence
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {t('task.repeatOn')}
                          </button>
                        </div>
                      </div>

                      {showRecurrence && (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {[
                              { value: 'daily', label: t('task.daily') },
                              { value: 'weekly', label: t('task.weekly') },
                              { value: 'monthly', label: t('task.monthly') },
                              { value: 'yearly', label: t('task.yearly') },
                            ].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setRecurrenceType(option.value);
                                  setShowCustomRecurrenceMenu(false);
                                  if ((option.value === 'weekly' || option.value === 'biweekly') && selectedDays.length === 0) {
                                    setSelectedDays(workDayKeys);
                                  }
                                  if (option.value !== 'weekly' && option.value !== 'biweekly') {
                                    setSelectedDays([]);
                                  }
                                  if (option.value === 'monthly') {
                                    const start = parseLocalInput(startInputValue || getValues('start_time') || '');
                                    if (start) setMonthlyDate(clampMonthlyDate(start.date(), monthlyDate));
                                  }
                                }}
                                className={`rounded-full border px-3 py-1 text-xs ${
                                  recurrenceType === option.value
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setShowCustomRecurrenceMenu((prev) => !prev)}
                              className={`rounded-full border px-3 py-1 text-xs ${
                                isCustomRecurrenceType || showCustomRecurrenceMenu
                                  ? 'border-sky-300 bg-sky-50 text-sky-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {t('task.customRepeat')}
                            </button>
                          </div>
                          {(showCustomRecurrenceMenu || isCustomRecurrenceType) && (
                            <div className="space-y-2 rounded-xl border border-sky-100 bg-sky-50/40 p-2.5">
                              <div className="text-[11px] font-medium uppercase tracking-wide text-sky-700">{t('task.customRepeat')}</div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRecurrenceType('biweekly');
                                    if (selectedDays.length === 0) {
                                      setSelectedDays(workDayKeys);
                                    }
                                  }}
                                  className={`rounded-full border px-3 py-1 text-xs ${
                                    recurrenceType === 'biweekly'
                                      ? 'border-sky-300 bg-sky-100 text-sky-800'
                                      : 'border-sky-200 bg-white text-sky-700 hover:bg-sky-100/60'
                                  }`}
                                  >
                                    {t('task.biweekly')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRecurrenceType('lunar');
                                      setSelectedDays([]);
                                      const fallback = parseLunarYearlyRule(
                                        { freq: 'lunar_yearly' },
                                        startInputValue || getValues('start_time') || getDefaultStartInputValue(getUserTimezone()),
                                      ) || {
                                        year: dayjs().tz(LUNAR_TIMEZONE).year(),
                                        month: 1,
                                        day: 1,
                                        isLeapMonth: false,
                                      };
                                      setRecurrenceLunarYear(fallback.year);
                                      setRecurrenceLunarMonth(fallback.month);
                                      setRecurrenceLunarDay(fallback.day);
                                      setRecurrenceLunarIsLeapMonth(fallback.isLeapMonth);
                                    }}
                                    className={`rounded-full border px-3 py-1 text-xs ${
                                      recurrenceType === 'lunar'
                                        ? 'border-sky-300 bg-sky-100 text-sky-800'
                                        : 'border-sky-200 bg-white text-sky-700 hover:bg-sky-100/60'
                                    }`}
                                  >
                                    {t('task.lunarYearly')}
                                  </button>
                              </div>
                            </div>
                          )}

                          {recurrenceType === 'lunar' && (
                            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-2.5">
                              <div className="text-xs font-medium text-slate-700">{t('task.lunarYearly')}</div>
                              <TaskDatePicker
                                value={recurrenceLunarPickerDate}
                                allDay
                                inline
                                lunarOverlay
                                lunarMode
                                stepMinutes={timeGranularity}
                                onChange={(nextValue) => {
                                  const value = String(nextValue || '').trim();
                                  if (!value) return;
                                  const lunar = lunarSelectionFromLocalInput(value, true, LUNAR_TIMEZONE);
                                  if (!lunar) return;
                                  const nextSelection = coerceLunarSelection({
                                    year: lunar.year,
                                    month: lunar.month,
                                    day: lunar.day,
                                    isLeapMonth: lunar.isLeapMonth,
                                  });
                                  setRecurrenceLunarYear(nextSelection.year);
                                  setRecurrenceLunarMonth(nextSelection.month);
                                  setRecurrenceLunarDay(nextSelection.day);
                                  setRecurrenceLunarIsLeapMonth(nextSelection.isLeapMonth);
                                }}
                              />
                              <div className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
                                {`${t('task.lunarYearly')} ${recurrenceLunarIsLeapMonth ? t('task.lunarLeapPrefix') : ''}${recurrenceLunarMonth}/${recurrenceLunarDay}`}
                              </div>
                            </div>
                          )}

                          {(recurrenceType === 'weekly' || recurrenceType === 'biweekly') && (
                            <div>
                              <p className="mb-2 text-sm text-slate-600">{t('task.selectWeekdays')}</p>
                              <div className="mb-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedDays(workDayKeys)}
                                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                                >
                                  {t('task.weekdaysWorkdays')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedDays(allDayKeys)}
                                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                                >
                                  {t('task.weekdaysAll')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedDays([])}
                                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
                                >
                                  {t('task.weekdaysClear')}
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {weekDays.map(day => (
                                  <button
                                    key={day.key}
                                    type="button"
                                    onClick={() => toggleDay(day.key)}
                                    className={`rounded-full px-3 py-1 text-sm ${
                                      selectedDays.includes(day.key)
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                  >
                                    {day.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {recurrenceType === 'monthly' && (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => setShowMonthlyDatePicker((prev) => !prev)}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                              >
                                <span>{t('task.monthlyOnDate')}</span>
                                <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700">{clampMonthlyDate(monthlyDate)}</span>
                              </button>
                              {showMonthlyDatePicker && (
                                <div className="rounded-xl border border-slate-200 bg-white p-2">
                                  <div className="grid grid-cols-7 gap-1">
                                    {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => {
                                      const active = clampMonthlyDate(monthlyDate) === day;
                                      return (
                                        <button
                                          key={day}
                                          type="button"
                                          onClick={() => {
                                            setMonthlyDate(day);
                                            setShowMonthlyDatePicker(false);
                                          }}
                                          className={`h-8 rounded-md text-xs font-medium ${
                                            active
                                              ? 'bg-sky-600 text-white'
                                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                                          }`}
                                        >
                                          {day}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                        <button
                          type="button"
                          onClick={() => closeBasicPanelWithConfirm('recurrence', false)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            closeBasicPanelWithConfirm('recurrence', true);
                            if (isEditing) {
                              triggerRealtimeSave('realtime_recurrence');
                            }
                          }}
                          className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          {t('common.confirm')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 h-full flex-1 flex-col gap-2.5 overflow-auto p-3 md:p-4">
                <div
                  className="flex min-h-0 min-w-0 flex-1 cursor-text flex-col overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-colors focus-within:border-blue-200 focus-within:bg-blue-50/20"
                  onClick={() => descriptionEditorRef.current?.focus()}
                >
                  <label className="mb-1 block cursor-text text-xs font-medium text-slate-500">{t('task.description')}</label>
                  <LiveMarkdownEditor
                    ref={descriptionEditorRef}
                    key={isEditing ? `task-editor-${task?.id || 0}` : 'task-editor-new'}
                    value={descriptionValue}
                    onChange={(nextValue) => setValue('description', nextValue, { shouldDirty: true })}
                    onSaveShortcut={handleDescriptionSaveShortcut}
                    placeholder={t('task.description')}
                    className="min-h-0 min-w-0 flex-1 overflow-hidden"
                    fill
                    minHeight={320}
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 z-20 flex items-center justify-between border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
              <div>
                {isEditing && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleCompleted}
                      disabled={loading}
                      className="btn-secondary"
                    >
                      {task?.status === 'completed' ? t('task.statusPending') : t('task.statusCompleted')}
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={loading}
                      className="btn-danger"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                )}
              </div>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={requestClose}
                  className="btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
          </form>
        </div>
        {deleteChoiceOpen && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/25 p-4"
            onClick={() => {
              if (!loading) setDeleteChoiceOpen(false);
            }}
          >
            <div
              className="w-full max-w-[18rem] rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => { void executeDelete('single'); }}
                  disabled={loading}
                  className="btn-secondary w-full"
                >
                  {t('task.deleteOnlyThis')}
                </button>
                <button
                  type="button"
                  onClick={() => { void executeDelete('series'); }}
                  disabled={loading}
                  className="btn-danger w-full"
                >
                  {t('task.deleteAllSeries')}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteChoiceOpen(false)}
                  disabled={loading}
                  className="btn-secondary w-full"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default TaskModal;
