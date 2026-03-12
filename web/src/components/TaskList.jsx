import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import TaskModal from './TaskModal';
import {
  formatDateTime,
  getUserTimeGranularity,
  getUserTimezone,
  logTimeDebug,
  toInputFormat,
  toISOString,
} from '../utils/time';
import { getNaturalTimeOptionsFromUser, parseNaturalTimeFromTitle, parsePriorityFromTitle } from '../utils/naturalTime';
import {
  buildLunarYearlyRuleFromSelection,
  coerceLunarSelection,
  lunarSelectionFromLocalInput,
  LUNAR_TIMEZONE,
  nextLocalInputFromLunarSelection,
  parseLunarYearlyRule,
  solarDateFromLunarSelection,
} from '../utils/lunar';
import { alignStartInputToNearestRecurrence } from '../utils/recurrenceAlign';
import { getLunarInfo } from '../utils/holidays';
import {
  getShowCategoryEmoji,
  onUIPrefsChanged,
  getTaskListSortPref,
  setTaskListSortPref,
  getTaskListGroupPref,
  setTaskListGroupPref,
} from '../utils/uiPrefs';
import {
  IconCalendar,
  IconClock,
  IconFlag,
  IconGroup,
  IconHistory,
  IconMoon,
  IconRepeat,
  IconRepeatOff,
  IconSearch,
  IconSort,
  IconSun,
  IconSunrise,
  IconTag,
} from './icons/TaskIcons';
import LiveMarkdownEditor from './LiveMarkdownEditor';
import TaskDatePicker from './TaskDatePicker';
import TaskActivityTimeline from './TaskActivityTimeline';
import { shouldHideRecurringSeriesAnchorInPending } from './taskListRecurringVisibility';
import { useCategoriesQuery, useTasksQuery } from '../query/hooks';
import { queryKeys } from '../query/keys';
import { tasksAPI } from '../api/client';
import {
  cancelTaskLocal,
  createTaskLocal,
  deleteTaskLocal,
  setTasksCache,
  updateTaskLocal,
  updateTaskStatusLocal,
} from '../data/taskMutations';
import { onTaskIDRemapped } from '../data/syncEngine';

const WEEKDAY_ONLY_RE = /^(MO|TU|WE|TH|FR|SA|SU)$/;
const ORDINAL_WEEKDAY_RE = /^(-?\d)(MO|TU|WE|TH|FR|SA|SU)$/;
const DRAFT_IDLE_SUBMIT_MS = 3000;
const DRAFT_TEXT_AUTOSAVE_MS = 2500;
const DEFAULT_WORKDAY_KEYS = ['MO', 'TU', 'WE', 'TH', 'FR'];
const OCCURRENCE_STATUS_OPTIMISTIC_TTL_MS = 5 * 60 * 1000;
const RECURRING_SEARCH_STATUSES = 'pending,completed,cancelled';
const DELETE_DIALOG_KIND_RECURRING_CHOICE = 'recurring-choice';
const DELETE_DIALOG_KIND_RECURRING_SERIES = 'recurring-series';
const DELETE_DIALOG_KIND_TASK = 'task';
const DETAIL_PANELS_REQUIRING_CONFIRM = new Set(['time', 'recurrence']);
const TIME_PANEL_DRAFT_FIELDS = ['all_day', 'start_time', 'end_time'];
const RECURRENCE_PANEL_DRAFT_FIELDS = [
  'recurrence_enabled',
  'recurrence_type',
  'recurrence_days',
  'recurrence_date',
  'recurrence_lunar_month',
  'recurrence_lunar_day',
  'recurrence_lunar_is_leap_month',
];

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

function normalizeDraftForCompare(draft) {
  if (!draft) return null;
  return {
    title: String(draft.title || '').trim(),
    description: String(draft.description || '').trim(),
    priority: Number.parseInt(draft.priority, 10) || 0,
    status: draft.status || 'pending',
    all_day: !!draft.all_day,
    start_time: draft.start_time || '',
    end_time: draft.end_time || '',
    category_ids: [...(draft.category_ids || [])].map(String).sort(),
    recurrence_enabled: !!draft.recurrence_enabled,
    recurrence_type: draft.recurrence_type || 'daily',
    recurrence_days: [...(draft.recurrence_days || [])].map(String).sort(),
    recurrence_date: Number.parseInt(draft.recurrence_date, 10) || 1,
    recurrence_lunar_month: Number.parseInt(draft.recurrence_lunar_month, 10) || 1,
    recurrence_lunar_day: Number.parseInt(draft.recurrence_lunar_day, 10) || 1,
    recurrence_lunar_is_leap_month: !!draft.recurrence_lunar_is_leap_month,
  };
}

function isDetailPanelFloatingLayerTarget(target) {
  if (!(target instanceof Element)) return false;
  return !!(
    target.closest('.task-time-selectbox-menu--floating')
    || target.closest('.react-datepicker-popper')
    || target.closest('.react-datepicker__portal')
  );
}

function getDefaultStartTimeParts() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const value = String(user.default_task_start_time || '').trim();
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) return { hour: 9, minute: 0 };
    const hour = Number.parseInt(match[1], 10);
    const minute = Number.parseInt(match[2], 10);
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return { hour: 9, minute: 0 };
    }
    return { hour, minute };
  } catch {
    return { hour: 9, minute: 0 };
  }
}

function getDefaultStartInputValue(timezoneName) {
  const { hour, minute } = getDefaultStartTimeParts();
  return dayjs()
    .tz(timezoneName)
    .hour(hour)
    .minute(minute)
    .second(0)
    .format('YYYY-MM-DDTHH:mm');
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

function buildDraftDefaultRangeAroundNow(timezoneName) {
  const center = roundToHalfHour(dayjs().tz(timezoneName));
  return {
    start: center.subtract(30, 'minute').format('YYYY-MM-DDTHH:mm'),
    end: center.add(30, 'minute').format('YYYY-MM-DDTHH:mm'),
  };
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

function shiftEndByDurationLocal(originalStartInput, originalEndInput, nextStartInput) {
  const originalStart = parseLocalInput(originalStartInput);
  const originalEnd = parseLocalInput(originalEndInput);
  const nextStart = parseLocalInput(nextStartInput);
  if (!originalStart || !originalEnd || !nextStart) return '';
  const durationMinutes = originalEnd.diff(originalStart, 'minute');
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return '';
  return nextStart.add(durationMinutes, 'minute').format('YYYY-MM-DDTHH:mm');
}

function coerceEndNotBeforeStartLocal(startInput, endInput) {
  const start = parseLocalInput(startInput);
  const end = parseLocalInput(endInput);
  if (!start || !end) return endInput || '';
  if (end.isBefore(start)) {
    return start.format('YYYY-MM-DDTHH:mm');
  }
  return endInput || '';
}

function buildEndFromStartLocal(startInput, minutes = 60) {
  const start = parseLocalInput(startInput);
  if (!start) return '';
  return start.add(minutes, 'minute').format('YYYY-MM-DDTHH:mm');
}

function alignStartToWeekdayLocal(startInput, weekdayKeys) {
  const start = parseLocalInput(startInput);
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
  if (targets.length === 0) return start.format('YYYY-MM-DDTHH:mm');
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
    const biweeklyLabel = t('task.biweekly');
    const dayCount = Array.isArray(selectedDays) ? selectedDays.length : 0;
    return dayCount > 0 ? `${biweeklyLabel}(${dayCount})` : biweeklyLabel;
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

function getTaskPrimaryTime(task) {
  return task.start_time || task.due_date || '';
}

function resolveTaskOccurrenceDate(task, timezone) {
  const explicit = String(task?.occurrence_date || task?.occurrenceDate || '').trim();
  if (explicit) {
    const parsed = dayjs(explicit);
    if (parsed.isValid()) return parsed.tz(timezone).format('YYYY-MM-DD');
  }
  const instanceID = String(task?.instance_id || task?.instanceId || '').trim();
  const token = instanceID.match(/^\d+_(\d{8})$/)?.[1] || '';
  if (!token) return '';
  return `${token.slice(0, 4)}-${token.slice(4, 6)}-${token.slice(6, 8)}`;
}

function normalizeOccurrenceDate(value, timezone) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = dayjs(raw);
  if (!parsed.isValid()) return '';
  return parsed.tz(timezone).format('YYYY-MM-DD');
}

function buildOccurrenceStatusKeys(taskID, instanceID, occurrenceDate, timezone) {
  const numericTaskID = Number(taskID || 0);
  if (!numericTaskID) return [];
  const keys = [];
  const normalizedInstanceID = String(instanceID || '').trim();
  if (normalizedInstanceID) {
    keys.push(`instance:${numericTaskID}:${normalizedInstanceID}`);
  }
  const normalizedDate = normalizeOccurrenceDate(occurrenceDate, timezone);
  if (normalizedDate) {
    keys.push(`date:${numericTaskID}:${normalizedDate}`);
  }
  return keys;
}

function resolveOccurrenceStatusFromOptimisticMap(
  optimisticMap,
  taskID,
  instanceID,
  occurrenceDate,
  timezone,
  fallbackStatus = 'pending'
) {
  const fallback = String(fallbackStatus || 'pending');
  const map = optimisticMap && typeof optimisticMap === 'object' ? optimisticMap : {};
  const keys = buildOccurrenceStatusKeys(taskID, instanceID, occurrenceDate, timezone);
  for (const key of keys) {
    const value = String(map?.[key]?.status || '').trim();
    if (value) return value;
  }
  return fallback;
}

function buildDeleteContext(task, timezone) {
  if (!task || task.read_only) return null;
  const taskID = Number(task?.source_task_id || task?.task_id || task?.id || 0);
  if (!taskID) return null;
  const recurrenceRule = parseRecurrenceRule(task?.recurrence_rule || task?.recurrenceRule);
  const instanceID = String(task?.instance_id || task?.instanceId || '').trim();
  const validInstanceID = /^\d+_\d{8}$/.test(instanceID);
  const occurrenceDate = resolveTaskOccurrenceDate(task, timezone);
  const occurrenceStart = String(
    task?.occurrence_start
    || task?.occurrenceStart
    || task?.start_time
    || task?.startTime
    || ''
  );
  return {
    taskID,
    isRecurring: !!recurrenceRule,
    hasOccurrenceContext: !!(validInstanceID || occurrenceDate),
    validInstanceID,
    instanceID,
    occurrenceDate,
    occurrenceStart,
    status: String(task?.status || 'pending'),
  };
}

function buildRecurringInstanceTasksFromOccurrences(occurrenceItems, tasksRaw, occurrenceStatusOptimisticMap, timezone) {
  const baseByID = new Map();
  (Array.isArray(tasksRaw) ? tasksRaw : []).forEach((task) => {
    const taskID = Number(task?.id || 0);
    if (!taskID) return;
    baseByID.set(taskID, task);
  });

  const seen = new Set();
  const list = [];
  (Array.isArray(occurrenceItems) ? occurrenceItems : []).forEach((item) => {
    const taskID = Number(item?.task_id || item?.taskID || 0);
    if (!taskID) return;
    const start = dayjs(item?.start_time || item?.startTime || '');
    if (!start.isValid()) return;
    const startISO = start.toISOString();
    const end = item?.end_time || item?.endTime ? dayjs(item?.end_time || item?.endTime) : null;
    const endISO = end && end.isValid() ? end.toISOString() : null;
    const occurrenceDate = normalizeOccurrenceDate(
      item?.occurrence_date || item?.occurrenceDate || item?.original_date || item?.originalDate || start.toISOString(),
      timezone,
    ) || start.tz(timezone).format('YYYY-MM-DD');
    const instanceID = String(item?.instance_id || item?.instanceId || '').trim();
    const status = resolveOccurrenceStatusFromOptimisticMap(
      occurrenceStatusOptimisticMap,
      taskID,
      instanceID,
      occurrenceDate,
      timezone,
      String(item?.status || 'pending'),
    );
    const fallbackKey = `${taskID}_${occurrenceDate.replace(/-/g, '')}`;
    const dedupeKey = instanceID || fallbackKey;
    if (!dedupeKey || seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const baseTask = baseByID.get(taskID) || {};
    const eventPriority = Number.parseInt(item?.priority, 10);
    const priority = Number.isFinite(eventPriority)
      ? eventPriority
      : (Number.parseInt(baseTask?.priority, 10) || 0);
    list.push({
      ...baseTask,
      id: `occ_${dedupeKey}`,
      source_task_id: taskID,
      virtual_occurrence: true,
      title: String(item?.title || baseTask?.title || ''),
      description: typeof item?.description === 'string' ? item.description : '',
      priority,
      status,
      start_time: startISO,
      end_time: endISO,
      due_date: null,
      recurrence_rule: baseTask?.recurrence_rule || baseTask?.recurrenceRule || { freq: 'daily', interval: 1 },
      instance_id: instanceID,
      occurrence_date: occurrenceDate,
      occurrence_start: startISO,
      occurrence_end: endISO,
      categories: Array.isArray(baseTask?.categories) ? baseTask.categories : [],
      read_only: !!baseTask?.read_only,
    });
  });

  return list;
}

function compareTasksStable(a, b) {
  const aNum = Number(a?.id);
  const bNum = Number(b?.id);
  const aNumValid = Number.isFinite(aNum);
  const bNumValid = Number.isFinite(bNum);
  if (aNumValid && bNumValid && aNum !== bNum) return aNum - bNum;

  const aID = String(a?.id ?? '');
  const bID = String(b?.id ?? '');
  if (aID !== bID) return aID.localeCompare(bID, 'en', { numeric: true, sensitivity: 'base' });

  const aCreated = dayjs(a?.created_at || a?.createdAt || '').valueOf();
  const bCreated = dayjs(b?.created_at || b?.createdAt || '').valueOf();
  const aCreatedValid = Number.isFinite(aCreated);
  const bCreatedValid = Number.isFinite(bCreated);
  if (aCreatedValid && bCreatedValid && aCreated !== bCreated) return aCreated - bCreated;

  const aTitle = String(a?.title || '');
  const bTitle = String(b?.title || '');
  if (aTitle !== bTitle) return aTitle.localeCompare(bTitle, 'zh-Hans-CN');
  return 0;
}

function sortTasksByOption(inputTasks, sortBy, timezone) {
  const cloned = [...inputTasks];
  cloned.sort((a, b) => {
    if (sortBy === 'priority_desc' || sortBy === 'priority_asc') {
      const pa = Number.parseInt(a.priority, 10) || 0;
      const pb = Number.parseInt(b.priority, 10) || 0;
      if (pa !== pb) return sortBy === 'priority_desc' ? pb - pa : pa - pb;
    }

    const ta = getTaskPrimaryTime(a);
    const tb = getTaskPrimaryTime(b);
    const va = ta ? dayjs(ta).tz(timezone).valueOf() : Number.POSITIVE_INFINITY;
    const vb = tb ? dayjs(tb).tz(timezone).valueOf() : Number.POSITIVE_INFINITY;
    if (va !== vb) {
      return sortBy === 'due_desc' ? vb - va : va - vb;
    }
    return compareTasksStable(a, b);
  });
  return cloned;
}

const SORT_OPTIONS = new Set(['due_asc', 'due_desc', 'priority_desc', 'priority_asc']);
const GROUP_OPTIONS = new Set(['none', 'due', 'priority', 'category', 'status']);

function resolveTaskListViewKey(view, categoryID) {
  if (Number.isInteger(categoryID) && categoryID > 0) return `category:${categoryID}`;
  return view || 'all';
}

function sanitizeSortValue(value) {
  return SORT_OPTIONS.has(value) ? value : 'due_asc';
}

function sanitizeGroupValue(value) {
  return GROUP_OPTIONS.has(value) ? value : 'none';
}

const TaskRow = React.memo(function TaskRow({
  task,
  selected,
  timezone,
  labels,
  showLunar,
  onSelectTask,
  onToggleStatus,
}) {
  const isCompleted = task.status === 'completed';
  const isDeleted = task.status === 'cancelled';
  const isReadOnly = !!task.read_only;
  const priorityValue = Number.parseInt(task.priority, 10) || 0;
  const priority = priorityValue === 1
    ? { text: labels.priorityHighShort, title: labels.priorityHigh, className: 'text-rose-600' }
    : priorityValue === -1
      ? { text: labels.priorityLowShort, title: labels.priorityLow, className: 'text-emerald-600' }
      : { text: labels.priorityMediumShort, title: labels.priorityMedium, className: 'text-sky-600' };
  const primaryTime = getTaskPrimaryTime(task);
  const lunarAnnotation = showLunar && primaryTime ? (() => {
    try { return getLunarInfo(new Date(primaryTime)).displayLabel; } catch { return ''; }
  })() : '';

  return (
    <div
      key={task.id}
      draggable={!isReadOnly}
      onDragStart={(event) => {
        if (isReadOnly) return;
        event.dataTransfer.setData('text/task-id', String(task.id));
        event.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onSelectTask(task)}
      className={`group cursor-pointer rounded-xl border-l-2 px-2.5 py-1.5 transition ${
        selected
          ? 'border-l-blue-500 bg-blue-50/70'
          : 'border-l-transparent bg-slate-50/70 hover:border-l-blue-300 hover:bg-blue-50/50'
      }`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={isCompleted}
          disabled={isDeleted || isReadOnly}
          onChange={(e) => {
            e.stopPropagation();
            onToggleStatus(task, isCompleted ? 'pending' : 'completed');
          }}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className={`truncate text-[13px] font-medium ${isCompleted || isDeleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
              {task.title}
            </h3>
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              {isReadOnly && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">CalDAV</span>
              )}
              {isDeleted && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStatus(task, 'pending');
                  }}
                  disabled={isReadOnly}
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700"
                  title={labels.markPending}
                >
                  ↺
                </button>
              )}
              <span className="text-[10px] text-slate-400">
                {primaryTime ? formatDateTime(primaryTime, 'MM/DD HH:mm', timezone) : ''}
                {lunarAnnotation && <span className="ml-0.5 text-slate-300">{lunarAnnotation}</span>}
              </span>
            </div>
          </div>

          {task.description && (
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{task.description}</p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="text-slate-400 sm:hidden">
              {primaryTime ? formatDateTime(primaryTime, 'MM/DD HH:mm', timezone) : ''}
              {lunarAnnotation && <span className="ml-0.5 text-slate-300">{lunarAnnotation}</span>}
            </span>
            {isDeleted && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">{labels.statusCancelled}</span>}
            {isReadOnly && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">CalDAV</span>}
            <span title={priority.title} className={priority.className}>{priority.text}</span>
            {task.categories?.slice(0, 2).map((cat) => (
              <span
                key={cat.id}
                className="inline-flex max-w-[10rem] items-center gap-1 rounded px-1.5 py-0.5"
                style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="truncate">{cat.name}</span>
              </span>
            ))}
            {task.categories?.length > 2 && (
              <span className="text-slate-400">+{task.categories.length - 2}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}, (prev, next) => (
  prev.task === next.task &&
  prev.selected === next.selected &&
  prev.timezone === next.timezone &&
  prev.labels === next.labels
));

function TaskList({ forcedView = '' }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const timezone = getUserTimezone();
  const timeGranularity = getUserTimeGranularity();
  const { data: tasksRaw = [], isLoading: tasksLoading } = useTasksQuery();
  const { data: categories = [] } = useCategoriesQuery();
  const [occurrenceStatusOptimisticMap, setOccurrenceStatusOptimisticMap] = useState({});
  const searchModeActive = useMemo(() => {
    if (forcedView) return forcedView === 'search';
    if (location.pathname === '/search') return true;
    const params = new URLSearchParams(location.search);
    return (params.get('view') || '') === 'search';
  }, [forcedView, location.pathname, location.search]);
  const { data: recurringNextOccurrences = [], isFetched: recurringNextOccurrencesFetched } = useQuery({
    queryKey: queryKeys.tasks.nextOccurrences(),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await tasksAPI.listNextOccurrences();
      return Array.isArray(res?.data) ? res.data : [];
    },
  });
  const { data: recurringHistoryPayload = { items: [] } } = useQuery({
    queryKey: queryKeys.tasks.occurrences('history', 0, 500),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await tasksAPI.listOccurrences({
        limit: 500,
        cursor: 0,
      });
      if (Array.isArray(res?.data)) {
        return { items: res.data };
      }
      const payload = res?.data && typeof res.data === 'object' ? res.data : {};
      return {
        items: Array.isArray(payload?.items) ? payload.items : [],
      };
    },
  });
  const recurringHistoryItems = useMemo(() => {
    const value = recurringHistoryPayload?.items;
    return Array.isArray(value) ? value : [];
  }, [recurringHistoryPayload]);
  const { data: recurringSearchPayload = { items: [] } } = useQuery({
    queryKey: queryKeys.tasks.occurrences(RECURRING_SEARCH_STATUSES, 0, 500),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    enabled: searchModeActive,
    queryFn: async () => {
      const res = await tasksAPI.listOccurrences({
        status: RECURRING_SEARCH_STATUSES,
        limit: 500,
        cursor: 0,
      });
      if (Array.isArray(res?.data)) {
        return { items: res.data };
      }
      const payload = res?.data && typeof res.data === 'object' ? res.data : {};
      return {
        items: Array.isArray(payload?.items) ? payload.items : [],
      };
    },
  });
  const recurringSearchItems = useMemo(() => {
    const value = recurringSearchPayload?.items;
    return Array.isArray(value) ? value : [];
  }, [recurringSearchPayload]);
  const recurringNextPendingMap = useMemo(() => {
    const pool = new Map();
    (Array.isArray(recurringNextOccurrences) ? recurringNextOccurrences : []).forEach((item) => {
      const taskID = Number(item?.task_id || item?.taskID || 0);
      if (!taskID) return;
      const start = dayjs(item?.start_time || item?.startTime || '');
      if (!start.isValid()) return;
      const startLocal = start.tz(timezone);
      const instanceID = String(item?.instance_id || item?.instanceId || '').trim();
      const occurrenceDate = normalizeOccurrenceDate(
        item?.occurrence_date || item?.occurrenceDate || item?.original_date || item?.originalDate || start.toISOString(),
        timezone,
      ) || startLocal.format('YYYY-MM-DD');
      const status = resolveOccurrenceStatusFromOptimisticMap(
        occurrenceStatusOptimisticMap,
        taskID,
        instanceID,
        occurrenceDate,
        timezone,
        String(item?.status || 'pending'),
      );
      if (status !== 'pending') return;
      const current = pool.get(taskID);
      if (current && !startLocal.isBefore(current.startLocal)) return;
      const end = item?.end_time || item?.endTime ? dayjs(item?.end_time || item?.endTime) : null;
      pool.set(taskID, {
        instanceId: instanceID,
        occurrenceDate,
        startISO: start.toISOString(),
        endISO: end && end.isValid() ? end.toISOString() : null,
        description: typeof item?.description === 'string' ? item.description : '',
        status,
        startLocal,
      });
    });
    return pool;
  }, [occurrenceStatusOptimisticMap, recurringNextOccurrences, timezone]);
  const recurringInstanceTasks = useMemo(() => {
    return buildRecurringInstanceTasksFromOccurrences(
      recurringHistoryItems,
      tasksRaw,
      occurrenceStatusOptimisticMap,
      timezone,
    );
  }, [occurrenceStatusOptimisticMap, recurringHistoryItems, tasksRaw, timezone]);
  const recurringSearchInstanceTasks = useMemo(() => (
    buildRecurringInstanceTasksFromOccurrences(
      recurringSearchItems,
      tasksRaw,
      occurrenceStatusOptimisticMap,
      timezone,
    )
  ), [occurrenceStatusOptimisticMap, recurringSearchItems, tasksRaw, timezone]);
  const tasks = useMemo(() => {
    const base = Array.isArray(tasksRaw) ? tasksRaw : [];
    if (base.length === 0) return [];
    return base.flatMap((task) => {
      const recurrenceRule = parseRecurrenceRule(task?.recurrence_rule || task?.recurrenceRule);
      if (!recurrenceRule) return [task];
      const taskID = Number(task?.id || 0);
      const nextPending = recurringNextPendingMap.get(taskID);
      if (!nextPending) {
        if (shouldHideRecurringSeriesAnchorInPending({
          task,
          hasNextPending: false,
          nextOccurrencesFetched: recurringNextOccurrencesFetched,
        })) {
          // Recurring series with no next pending occurrence should not fall back to series anchor in pending list.
          return [];
        }
        return [task];
      }
      return [{
        ...task,
        start_time: nextPending.startISO,
        end_time: nextPending.endISO,
        instance_id: nextPending.instanceId,
        occurrence_date: nextPending.occurrenceDate,
        occurrence_start: nextPending.startISO,
        occurrence_end: nextPending.endISO,
        description: nextPending.description,
        status: nextPending.status,
      }];
    });
  }, [recurringNextOccurrencesFetched, recurringNextPendingMap, tasksRaw]);

  const recurringServerStatusMap = useMemo(() => {
    const statusMap = new Map();
    const ingest = (item) => {
      const taskID = Number(item?.task_id || item?.taskID || 0);
      if (!taskID) return;
      const startLocal = dayjs(item?.start_time || item?.startTime || '').tz(timezone);
      const fallbackStart = startLocal.isValid() ? startLocal.toISOString() : '';
      const occurrenceDate = normalizeOccurrenceDate(
        item?.occurrence_date || item?.occurrenceDate || item?.original_date || item?.originalDate || fallbackStart,
        timezone,
      );
      const instanceID = String(item?.instance_id || item?.instanceId || '').trim();
      const keys = buildOccurrenceStatusKeys(taskID, instanceID, occurrenceDate, timezone);
      const status = String(item?.status || 'pending');
      keys.forEach((key) => {
        if (!key || statusMap.has(key)) return;
        statusMap.set(key, status);
      });
    };
    (Array.isArray(recurringNextOccurrences) ? recurringNextOccurrences : []).forEach(ingest);
    (Array.isArray(recurringHistoryItems) ? recurringHistoryItems : []).forEach(ingest);
    return statusMap;
  }, [recurringHistoryItems, recurringNextOccurrences, timezone]);

  useEffect(() => {
    if (recurringServerStatusMap.size === 0) return;
    setOccurrenceStatusOptimisticMap((prev) => {
      const entries = Object.entries(prev || {});
      if (entries.length === 0) return prev;
      let changed = false;
      const next = {};
      entries.forEach(([key, value]) => {
        const status = String(value?.status || '').trim();
        if (!status) {
          changed = true;
          return;
        }
        if (recurringServerStatusMap.get(key) === status) {
          changed = true;
          return;
        }
        next[key] = value;
      });
      return changed ? next : prev;
    });
  }, [recurringServerStatusMap]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const prune = () => {
      const now = Date.now();
      setOccurrenceStatusOptimisticMap((prev) => {
        const entries = Object.entries(prev || {});
        if (entries.length === 0) return prev;
        let changed = false;
        const next = {};
        entries.forEach(([key, value]) => {
          const status = String(value?.status || '').trim();
          const updatedAt = Number(value?.updatedAt || 0);
          if (!status) {
            changed = true;
            return;
          }
          if (!updatedAt || (now - updatedAt) <= OCCURRENCE_STATUS_OPTIMISTIC_TTL_MS) {
            next[key] = value;
            return;
          }
          changed = true;
        });
        return changed ? next : prev;
      });
    };
    const timerID = window.setInterval(prune, 60 * 1000);
    return () => window.clearInterval(timerID);
  }, []);

  useEffect(() => {
    logTimeDebug('taskList.timezone.resolved', {
      component: 'TaskList',
      timezone,
    });
  }, [timezone]);

  useEffect(() => {
    if (!selectedTaskID) return;
    const timer = setTimeout(() => {
      draftTitleInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedTaskID]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTask, setModalTask] = useState(null);
  const [selectedTaskID, setSelectedTaskID] = useState(0);
  const [draft, setDraft] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingDraft, setSubmittingDraft] = useState(false);
  const [pendingSubmitTaskID, setPendingSubmitTaskID] = useState(0);
  const [quickTitle, setQuickTitle] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortBy, setSortBy] = useState('due_asc');
  const [groupBy, setGroupBy] = useState('none');
  const [listToolbarPanel, setListToolbarPanel] = useState('');
  const [detailPanel, setDetailPanel] = useState('');
  const [draftParsePreview, setDraftParsePreview] = useState('');
  const [showDraftCustomRecurrenceMenu, setShowDraftCustomRecurrenceMenu] = useState(false);
  const [showDraftMonthlyDatePicker, setShowDraftMonthlyDatePicker] = useState(false);
  const [draftTimeRangeEnabled, setDraftTimeRangeEnabled] = useState(false);
  const [draftTimeRangeEditing, setDraftTimeRangeEditing] = useState('start');
  const [draftTimeCalendarMode, setDraftTimeCalendarMode] = useState('solar');
  const [draftRecurrenceLunarYear, setDraftRecurrenceLunarYear] = useState(dayjs().tz(LUNAR_TIMEZONE).year());
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, kind: '', context: null });
  const [deleteDialogSubmitting, setDeleteDialogSubmitting] = useState(false);
  const [showCategoryEmoji, setShowCategoryEmoji] = useState(getShowCategoryEmoji());
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );
  const [isCompactMobile, setIsCompactMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const detailPanelRef = useRef(null);
  const listToolbarPanelRef = useRef(null);
  const lastSyncedSelectedIDRef = useRef(0);
  const draftSourceTaskIDRef = useRef(0);
  const draftTouchedRef = useRef(false);
  const draftEditVersionRef = useRef(0);
  const draftSyncTimerRef = useRef(0);
  const pendingDraftSubmitRef = useRef({ taskID: 0, payload: null });
  const selectedTaskSnapshotRef = useRef(null);
  const draftSnapshotRef = useRef(null);
  const isDraftDirtyRef = useRef(false);
  const isSavingDraftRef = useRef(false);
  const isSubmittingDraftRef = useRef(false);
  const flushDraftQueueRef = useRef(Promise.resolve());
  const flushDraftOnLeaveRef = useRef(null);
  const detailPanelSnapshotRef = useRef(null);
  const switchTaskRequestRef = useRef(0);
  const activeRenderTaskIDRef = useRef(0);
  const draftDescriptionEditorRef = useRef(null);
  const draftTitleInputRef = useRef(null);

  const hasStaleDraftEventContext = useCallback((closureTaskID) => {
    const closureID = Number(closureTaskID || 0);
    const activeID = Number(activeRenderTaskIDRef.current || 0);
    if (closureID > 0 && activeID > 0 && closureID !== activeID) {
      return true;
    }
    return false;
  }, []);

  const markDraftTouched = useCallback(() => {
    draftTouchedRef.current = true;
    draftEditVersionRef.current += 1;
  }, []);

  const setDraftWithSnapshot = useCallback((updater) => {
    const prevSnapshot = draftSnapshotRef.current;
    const next = typeof updater === 'function' ? updater(prevSnapshot) : updater;
    const normalizedNext = next ?? null;
    draftSnapshotRef.current = normalizedNext;
    setDraft(normalizedNext);
    return normalizedNext;
  }, []);

  const isDetailPanelRequiringConfirm = useCallback(
    (panelName) => DETAIL_PANELS_REQUIRING_CONFIRM.has(String(panelName || '')),
    []
  );

  const createDetailPanelSnapshot = useCallback((panelName, draftValue) => {
    if (!draftValue || !isDetailPanelRequiringConfirm(panelName)) return null;
    const fields = panelName === 'time' ? TIME_PANEL_DRAFT_FIELDS : RECURRENCE_PANEL_DRAFT_FIELDS;
    const draftState = {};
    fields.forEach((field) => {
      const value = draftValue[field];
      draftState[field] = Array.isArray(value) ? [...value] : value;
    });
    if (panelName === 'time') {
      return {
        panel: panelName,
        draftState,
        uiState: {
          draftTimeRangeEnabled: !!draftTimeRangeEnabled,
          draftTimeRangeEditing: draftTimeRangeEditing === 'end' ? 'end' : 'start',
          draftTimeCalendarMode: draftTimeCalendarMode === 'lunar' ? 'lunar' : 'solar',
        },
      };
    }
    return {
      panel: panelName,
      draftState,
      uiState: {
        showDraftCustomRecurrenceMenu: !!showDraftCustomRecurrenceMenu,
        showDraftMonthlyDatePicker: !!showDraftMonthlyDatePicker,
        draftRecurrenceLunarYear: Number.parseInt(draftRecurrenceLunarYear, 10) || dayjs().tz(LUNAR_TIMEZONE).year(),
      },
    };
  }, [
    draftRecurrenceLunarYear,
    draftTimeCalendarMode,
    draftTimeRangeEditing,
    draftTimeRangeEnabled,
    isDetailPanelRequiringConfirm,
    showDraftCustomRecurrenceMenu,
    showDraftMonthlyDatePicker,
  ]);

  const restoreDetailPanelSnapshot = useCallback((snapshot) => {
    if (!snapshot || typeof snapshot !== 'object') return;
    const draftState = snapshot.draftState && typeof snapshot.draftState === 'object'
      ? snapshot.draftState
      : {};
    setDraftWithSnapshot((prev) => {
      if (!prev) return prev;
      return { ...prev, ...draftState };
    });
    if (snapshot.panel === 'time') {
      setDraftTimeRangeEnabled(!!snapshot?.uiState?.draftTimeRangeEnabled);
      setDraftTimeRangeEditing(snapshot?.uiState?.draftTimeRangeEditing === 'end' ? 'end' : 'start');
      setDraftTimeCalendarMode(snapshot?.uiState?.draftTimeCalendarMode === 'lunar' ? 'lunar' : 'solar');
      return;
    }
    if (snapshot.panel === 'recurrence') {
      setShowDraftCustomRecurrenceMenu(!!snapshot?.uiState?.showDraftCustomRecurrenceMenu);
      setShowDraftMonthlyDatePicker(!!snapshot?.uiState?.showDraftMonthlyDatePicker);
      const nextYear = Number.parseInt(snapshot?.uiState?.draftRecurrenceLunarYear, 10);
      if (Number.isFinite(nextYear)) {
        setDraftRecurrenceLunarYear(nextYear);
      }
    }
  }, [setDraftWithSnapshot]);

  const closeDetailPanelWithConfirm = useCallback((panelName, shouldApply = false) => {
    const name = String(panelName || '');
    const snapshot = detailPanelSnapshotRef.current;
    if (!shouldApply && snapshot && snapshot.panel === name) {
      restoreDetailPanelSnapshot(snapshot);
    }
    if (snapshot && snapshot.panel === name) {
      detailPanelSnapshotRef.current = null;
    }
    if (name === 'recurrence') {
      setShowDraftCustomRecurrenceMenu(false);
      setShowDraftMonthlyDatePicker(false);
    }
    setDetailPanel('');
  }, [restoreDetailPanelSnapshot]);

  const handleDetailPanelToggle = useCallback((panelName) => {
    const nextPanel = String(panelName || '');
    const currentPanel = String(detailPanel || '');
    let nextPanelDraftState = draft;

    if (currentPanel === nextPanel) {
      if (isDetailPanelRequiringConfirm(currentPanel)) {
        closeDetailPanelWithConfirm(currentPanel, false);
      } else {
        setDetailPanel('');
      }
      return;
    }

    if (currentPanel) {
      if (isDetailPanelRequiringConfirm(currentPanel)) {
        const snapshot = detailPanelSnapshotRef.current;
        if (snapshot && snapshot.panel === currentPanel) {
          if (nextPanelDraftState && typeof snapshot.draftState === 'object') {
            nextPanelDraftState = { ...nextPanelDraftState, ...snapshot.draftState };
          }
          restoreDetailPanelSnapshot(snapshot);
          detailPanelSnapshotRef.current = null;
        }
        if (currentPanel === 'recurrence') {
          setShowDraftCustomRecurrenceMenu(false);
          setShowDraftMonthlyDatePicker(false);
        }
        setDetailPanel('');
      } else {
        setDetailPanel('');
      }
    }

    if (isDetailPanelRequiringConfirm(nextPanel)) {
      detailPanelSnapshotRef.current = createDetailPanelSnapshot(nextPanel, nextPanelDraftState);
    } else {
      detailPanelSnapshotRef.current = null;
    }
    setShowActivityPanel(false);
    setDetailPanel(nextPanel);
  }, [
    closeDetailPanelWithConfirm,
    createDetailPanelSnapshot,
    detailPanel,
    draft,
    isDetailPanelRequiringConfirm,
    restoreDetailPanelSnapshot,
  ]);

  const params = new URLSearchParams(location.search);
  const isSearchPath = location.pathname === '/search';
  const view = forcedView || (isSearchPath ? 'search' : (params.get('view') || 'all'));
  const legacySearchQuery = String(params.get('q') || '').trim();
  const categoryID = Number.parseInt(params.get('category_id') || '', 10);
  const taskIDParam = Number.parseInt(params.get('task_id') || '', 10);
  const activeCategoryID = Number.isNaN(categoryID) ? 0 : categoryID;
  const focusTaskID = Number.isNaN(taskIDParam) ? 0 : taskIDParam;
  const viewPrefKey = useMemo(() => resolveTaskListViewKey(view, activeCategoryID), [activeCategoryID, view]);

  useEffect(() => onUIPrefsChanged(() => setShowCategoryEmoji(getShowCategoryEmoji())), []);

  useEffect(() => {
    if (view !== 'search' || isSearchPath) return;
    const keyword = searchKeyword.trim() || legacySearchQuery;
    if (keyword) {
      navigate(`/search?q=${encodeURIComponent(keyword)}`, { replace: true });
      return;
    }
    navigate('/search', { replace: true });
  }, [isSearchPath, legacySearchQuery, navigate, searchKeyword, view]);

  useEffect(() => {
    if (view !== 'search') return;
    setSearchKeyword(legacySearchQuery);
  }, [legacySearchQuery, view]);

  useEffect(() => {
    const persistedSort = sanitizeSortValue(getTaskListSortPref(viewPrefKey) || 'due_asc');
    const persistedGroupRaw = getTaskListGroupPref(viewPrefKey) || 'none';
    const persistedGroup = view === 'search' ? 'status' : sanitizeGroupValue(persistedGroupRaw);
    setSortBy(persistedSort);
    setGroupBy(persistedGroup);
  }, [view, viewPrefKey]);

  useEffect(() => {
    if (!viewPrefKey) return;
    const nextSort = sanitizeSortValue(sortBy);
    if (nextSort !== sortBy) {
      setSortBy(nextSort);
      return;
    }
    setTaskListSortPref(viewPrefKey, nextSort);
  }, [sortBy, viewPrefKey]);

  useEffect(() => {
    if (!viewPrefKey || view === 'search') return;
    const nextGroup = sanitizeGroupValue(groupBy);
    if (nextGroup !== groupBy) {
      setGroupBy(nextGroup);
      return;
    }
    setTaskListGroupPref(viewPrefKey, nextGroup);
  }, [groupBy, view, viewPrefKey]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 1024);
      setIsCompactMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!detailPanel && !showActivityPanel) return undefined;
    const handlePointerDown = (event) => {
      if (isDetailPanelFloatingLayerTarget(event.target)) return;
      if (!detailPanelRef.current) return;
      if (!detailPanelRef.current.contains(event.target)) {
        if (isDetailPanelRequiringConfirm(detailPanel)) {
          closeDetailPanelWithConfirm(detailPanel, false);
        } else {
          setDetailPanel('');
        }
        setShowActivityPanel(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [closeDetailPanelWithConfirm, detailPanel, isDetailPanelRequiringConfirm, showActivityPanel]);

  useEffect(() => {
    if (detailPanel) {
      setShowActivityPanel(false);
    }
  }, [detailPanel]);

  useEffect(() => {
    if (!listToolbarPanel) return undefined;
    const handlePointerDown = (event) => {
      if (!listToolbarPanelRef.current) return;
      if (!listToolbarPanelRef.current.contains(event.target)) {
        setListToolbarPanel('');
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [listToolbarPanel]);

  const loading = tasksLoading && tasks.length === 0;

  useEffect(() => {
    if (view === 'search') {
      setGroupBy('status');
      return;
    }
    if (groupBy === 'status') {
      setGroupBy('none');
    }
  }, [groupBy, view]);

  const baseFilteredTasks = useMemo(() => {
    const now = dayjs().tz(timezone);
    const todayStart = now.startOf('day');
    const todayEnd = now.endOf('day');
    const sevenDayEnd = todayStart.add(6, 'day').endOf('day');

    if (activeCategoryID > 0) {
      return tasks.filter((task) => (task.categories || []).some((cat) => cat.id === activeCategoryID) && task.status === 'pending');
    }

    if (view === 'completed') {
      return [
        ...recurringInstanceTasks.filter((task) => task.status === 'completed'),
        ...tasks.filter((task) => task.status === 'completed'),
      ];
    }

    if (view === 'deleted') {
      return [
        ...recurringInstanceTasks.filter((task) => task.status === 'cancelled'),
        ...tasks.filter((task) => task.status === 'cancelled'),
      ];
    }

    if (view === 'search') {
      return tasks;
    }

    const pending = tasks.filter((task) => task.status === 'pending');

    if (view === 'inbox') {
      return pending.filter((task) => !task.categories || task.categories.length === 0);
    }

    if (view === 'today') {
      return pending.filter((task) => {
        const time = getTaskPrimaryTime(task);
        if (!time) return false;
        const current = dayjs(time).tz(timezone);
        return (current.isAfter(todayStart) || current.isSame(todayStart)) && (current.isBefore(todayEnd) || current.isSame(todayEnd));
      });
    }

    if (view === 'upcoming') {
      return pending.filter((task) => {
        const time = getTaskPrimaryTime(task);
        if (!time) return false;
        const current = dayjs(time).tz(timezone);
        return (current.isAfter(todayStart) || current.isSame(todayStart)) && (current.isBefore(sevenDayEnd) || current.isSame(sevenDayEnd));
      });
    }

    return pending;
  }, [activeCategoryID, recurringInstanceTasks, tasks, timezone, view]);

  const searchedTasks = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (view !== 'search') return baseFilteredTasks;
    const recurringKeySet = new Set();
    recurringSearchInstanceTasks.forEach((task) => {
      const taskID = Number(task?.source_task_id || task?.task_id || task?.id || 0);
      if (!taskID) return;
      const instanceID = String(task?.instance_id || task?.instanceId || '').trim();
      if (instanceID) {
        recurringKeySet.add(`instance:${taskID}:${instanceID}`);
        return;
      }
      const occurrenceDate = resolveTaskOccurrenceDate(task, timezone);
      if (occurrenceDate) recurringKeySet.add(`date:${taskID}:${occurrenceDate}`);
    });
    const baseSearchTasks = baseFilteredTasks.filter((task) => {
      const recurrenceRule = parseRecurrenceRule(task?.recurrence_rule || task?.recurrenceRule);
      if (!recurrenceRule) return true;
      const taskID = Number(task?.source_task_id || task?.task_id || task?.id || 0);
      if (!taskID) return true;
      const instanceID = String(task?.instance_id || task?.instanceId || '').trim();
      if (instanceID && recurringKeySet.has(`instance:${taskID}:${instanceID}`)) return false;
      const occurrenceDate = resolveTaskOccurrenceDate(task, timezone);
      if (occurrenceDate && recurringKeySet.has(`date:${taskID}:${occurrenceDate}`)) return false;
      return true;
    });
    const searchSource = [...baseSearchTasks, ...recurringSearchInstanceTasks];
    if (!keyword) return searchSource;
    return searchSource.filter((task) => {
      const title = String(task.title || '').toLowerCase();
      const description = String(task.description || '').toLowerCase();
      const categoryText = (task.categories || [])
        .map((cat) => String(cat.name || '').toLowerCase())
        .join(' ');
      return title.includes(keyword) || description.includes(keyword) || categoryText.includes(keyword);
    });
  }, [baseFilteredTasks, recurringSearchInstanceTasks, searchKeyword, timezone, view]);

  const sortedTasks = useMemo(
    () => sortTasksByOption(searchedTasks, sortBy, timezone),
    [searchedTasks, sortBy, timezone]
  );

  const canGroupByCategory = view === 'all' || view === 'today' || view === 'upcoming';
  const effectiveGroupBy = view === 'search' ? 'status' : groupBy;

  const taskGroups = useMemo(() => {
    if (sortedTasks.length === 0) return [];
    if (effectiveGroupBy === 'none') {
      return [{ key: 'all', title: '', tasks: sortedTasks }];
    }

    const groupMap = new Map();
    const pushTaskToGroup = (key, title, task) => {
      if (!groupMap.has(key)) {
        groupMap.set(key, { key, title, tasks: [] });
      }
      groupMap.get(key).tasks.push(task);
    };

    sortedTasks.forEach((task) => {
      if (effectiveGroupBy === 'status') {
        const status = task.status || 'cancelled';
        const title =
          status === 'pending'
            ? t('task.statusPending')
            : status === 'completed'
              ? t('task.statusCompleted')
              : t('task.statusCancelled');
        pushTaskToGroup(status, title, task);
        return;
      }

      if (effectiveGroupBy === 'priority') {
        const priority = Number.parseInt(task.priority, 10) || 0;
        const key = String(priority);
        const title = priority === 1 ? t('task.priorityHigh') : priority === -1 ? t('task.priorityLow') : t('task.priorityMedium');
        pushTaskToGroup(key, title, task);
        return;
      }

      if (effectiveGroupBy === 'due') {
        const taskTime = getTaskPrimaryTime(task);
        if (!taskTime) {
          pushTaskToGroup('no-date', t('task.noDate'), task);
          return;
        }
        const current = dayjs(taskTime).tz(timezone);
        pushTaskToGroup(`due-${current.format('YYYY-MM-DD')}`, current.format('MM/DD ddd'), task);
        return;
      }

      if (effectiveGroupBy === 'category') {
        const firstCategory = (task.categories || [])[0];
        if (!firstCategory) {
          pushTaskToGroup('category-none', t('task.inbox'), task);
          return;
        }
        const label = showCategoryEmoji && firstCategory.emoji
          ? `${firstCategory.emoji} ${firstCategory.name}`
          : firstCategory.name;
        pushTaskToGroup(`category-${firstCategory.id}`, label, task);
      }
    });

    let groups = Array.from(groupMap.values());
    if (effectiveGroupBy === 'status') {
      const order = { pending: 0, completed: 1, cancelled: 2 };
      groups.sort((a, b) => (order[a.key] ?? 9) - (order[b.key] ?? 9));
      return groups;
    }

    if (effectiveGroupBy === 'priority') {
      const order = { 1: 0, 0: 1, '-1': 2 };
      groups.sort((a, b) => (order[a.key] ?? 9) - (order[b.key] ?? 9));
      return groups;
    }

    if (effectiveGroupBy === 'due') {
      groups.sort((a, b) => {
        if (a.key === 'no-date') return 1;
        if (b.key === 'no-date') return -1;
        return a.key.localeCompare(b.key);
      });
      return groups;
    }

    groups.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));
    return groups;
  }, [effectiveGroupBy, showCategoryEmoji, sortedTasks, t, timezone]);

  const filteredTasks = useMemo(() => taskGroups.flatMap((group) => group.tasks), [taskGroups]);

  // Stable primitives for the auto-reset effect — only changes when task IDs change,
  // so background syncs that fetch the same tasks don't trigger the effect.
  const filteredTaskIDsRef = useRef([]);
  const tasksRef = useRef(tasks);
  filteredTaskIDsRef.current = useMemo(() => filteredTasks.map((t) => t.id), [filteredTasks]);
  tasksRef.current = tasks;
  const filteredTaskIDsKey = filteredTaskIDsRef.current.join(',');
  // Guard refs — read inside the effect but NOT in deps, so their transitions
  // (e.g. savingDraft true→false) don't trigger spurious resets mid-save.
  const savingDraftRef = useRef(savingDraft);
  const submittingDraftRef = useRef(submittingDraft);
  const pendingSubmitTaskIDRef = useRef(pendingSubmitTaskID);
  savingDraftRef.current = savingDraft;
  submittingDraftRef.current = submittingDraft;
  pendingSubmitTaskIDRef.current = pendingSubmitTaskID;

  const activeCategory = categories.find((cat) => cat.id === activeCategoryID);
  const viewTitle = activeCategory
    ? showCategoryEmoji && activeCategory.emoji
      ? `${activeCategory.emoji} ${activeCategory.name}`
      : activeCategory.name
    : view === 'inbox'
      ? t('task.inbox')
      : view === 'today'
        ? t('task.today')
        : view === 'upcoming'
          ? t('task.upcoming')
          : view === 'search'
            ? t('task.searchTasks')
          : view === 'completed'
            ? t('task.completedTasks')
            : view === 'deleted'
              ? t('task.deletedTasks')
            : t('task.allTasks');

  useEffect(() => {
    const currentFilteredIDs = filteredTaskIDsRef.current;
    const currentTasks = tasksRef.current;
    const selectedExistsInAllTasks = currentTasks.some((task) => Number(task?.id) === Number(selectedTaskID || 0));
    // Read save-state from refs so that transitions (e.g. savingDraft true→false)
    // don't re-trigger this effect and cause a spurious mid-save reset.
    const shouldPreserveCurrentSelection = !!(
      selectedTaskID
      && selectedExistsInAllTasks
      && (
        draftTouchedRef.current
        || savingDraftRef.current
        || submittingDraftRef.current
        || Number(pendingSubmitTaskIDRef.current || 0) === Number(selectedTaskID || 0)
      )
    );

    if (currentFilteredIDs.length === 0) {
      if (shouldPreserveCurrentSelection) return;
      setSelectedTaskID(0);
      setDraftWithSnapshot(null);
      draftSourceTaskIDRef.current = 0;
      return;
    }

    const exists = currentFilteredIDs.includes(selectedTaskID);
    if (!exists && shouldPreserveCurrentSelection) {
      return;
    }
    // Don't reset when selectedTaskID is a negative temp ID — the task is being synced
    // and onTaskIDRemapped will update it to the real ID shortly.
    if (!exists && Number(selectedTaskID) < 0) {
      return;
    }
    if (!exists) {
      setSelectedTaskID(currentFilteredIDs[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTaskIDsKey, selectedTaskID, setDraftWithSnapshot]);

  useEffect(() => {
    return onTaskIDRemapped(({ fromID, toID }) => {
      setSelectedTaskID((prev) => (Number(prev) === Number(fromID) ? toID : prev));
    });
  }, []);

  useEffect(() => {
    if (!focusTaskID) return;
    const targetExists = filteredTasks.some((task) => task.id === focusTaskID);
    if (!targetExists) return;
    if (selectedTaskID !== focusTaskID) {
      setSelectedTaskID(focusTaskID);
      return;
    }
    const nextParams = new URLSearchParams(location.search);
    if (!nextParams.has('task_id')) return;
    nextParams.delete('task_id');
    const nextQuery = nextParams.toString();
    navigate(`${location.pathname}${nextQuery ? `?${nextQuery}` : ''}`, { replace: true });
  }, [filteredTasks, focusTaskID, location.pathname, location.search, navigate, selectedTaskID]);

  const selectedTask = useMemo(() => {
    const fromFiltered = filteredTasks.find((task) => Number(task?.id) === Number(selectedTaskID || 0));
    if (fromFiltered) return fromFiltered;
    const fromAllTasks = tasks.find((task) => Number(task?.id) === Number(selectedTaskID || 0));
    return fromAllTasks || null;
  }, [filteredTasks, selectedTaskID, tasks]);
  activeRenderTaskIDRef.current = Number(selectedTask?.id || 0);
  const parsedDraftPriority = parsePriorityFromTitle(String(draft?.title || ''));
  const draftPriorityValue = Number.isInteger(parsedDraftPriority?.priority)
    ? parsedDraftPriority.priority
    : (Number.parseInt(draft?.priority, 10) || 0);
  const draftPriorityTone = draftPriorityValue === 1 ? 'high' : (draftPriorityValue === 0 ? 'medium' : 'default');
  const draftPriorityButtonClass = detailPanel === 'priority'
    ? draftPriorityTone === 'high'
      ? 'bg-rose-50 text-rose-700'
      : draftPriorityTone === 'medium'
        ? 'bg-sky-50 text-sky-700'
        : 'bg-slate-100 text-slate-700'
    : draftPriorityTone === 'high'
      ? 'text-rose-600 hover:bg-rose-50'
      : draftPriorityTone === 'medium'
        ? 'text-sky-600 hover:bg-sky-50'
        : 'text-slate-500 hover:bg-slate-100';
  const draftPriorityTitle = draftPriorityTone === 'high'
    ? t('task.priorityHigh')
    : draftPriorityTone === 'medium'
      ? t('task.priorityMedium')
      : t('task.priorityLow');
  const draftTimeSummaryLabel = buildTimeSummaryLabel(
    draft?.start_time || '',
    draft?.end_time || '',
    !!draft?.all_day,
    t('task.noDate'),
    draftTimeCalendarMode === 'lunar'
  );
  const hasDraftParsedTimeHint = !!draftParsePreview;
  const hasDraftTimeValue = !!(draft?.start_time || draft?.end_time);
  const draftTimeButtonClass = detailPanel === 'time'
    ? 'bg-sky-50 text-sky-700'
    : (hasDraftParsedTimeHint || hasDraftTimeValue)
      ? 'text-sky-600 hover:bg-sky-50'
      : 'text-slate-500 hover:bg-slate-100';
  const draftTimeButtonTitle = hasDraftParsedTimeHint ? draftParsePreview : draftTimeSummaryLabel;
  const hasDraftCategoryValue = Array.isArray(draft?.category_ids) && draft.category_ids.length > 0;
  const draftCategorySummaryLabel = buildCategorySummaryLabel(
    draft?.category_ids || [],
    categories,
    showCategoryEmoji,
    t('task.categories')
  );
  const draftCategoryButtonClass = detailPanel === 'category'
    ? 'bg-indigo-50 text-indigo-700'
    : hasDraftCategoryValue
      ? 'text-indigo-600 hover:bg-indigo-50'
      : 'text-slate-500 hover:bg-slate-100';
  const draftRecurrenceSummaryLabel = buildRecurrenceSummaryLabel(
    !!draft?.recurrence_enabled,
    draft?.recurrence_type || 'daily',
    draft?.recurrence_days || [],
    t,
    {
      month: draft?.recurrence_lunar_month,
      day: draft?.recurrence_lunar_day,
      isLeapMonth: draft?.recurrence_lunar_is_leap_month,
    },
  );
  const draftRecurrenceButtonClass = detailPanel === 'recurrence'
    ? 'bg-slate-100 text-slate-700'
    : draft?.recurrence_enabled
      ? 'text-emerald-600 hover:bg-emerald-50'
      : 'text-slate-500 hover:bg-slate-100';
  const isDraftCustomRecurrenceType = (draft?.recurrence_type || 'daily') === 'biweekly' || (draft?.recurrence_type || 'daily') === 'lunar';
  const draftRecurrenceLunarPickerDate = (
    solarDateFromLunarSelection({
      year: draftRecurrenceLunarYear,
      month: Number.parseInt(draft?.recurrence_lunar_month, 10) || 1,
      day: Number.parseInt(draft?.recurrence_lunar_day, 10) || 1,
      isLeapMonth: !!draft?.recurrence_lunar_is_leap_month,
    })
    || splitDatePart(draft?.start_time || '')
    || dayjs().tz(timezone).format('YYYY-MM-DD')
  );

  useEffect(() => {
    setDraftParsePreview('');
    setShowDraftCustomRecurrenceMenu(false);
    setShowDraftMonthlyDatePicker(false);
    setDraftTimeRangeEditing('start');
    setDraftTimeCalendarMode('solar');
    setShowActivityPanel(false);
    detailPanelSnapshotRef.current = null;
  }, [selectedTask?.id]);

  useEffect(() => {
    if (!selectedTask) return;
    const allDay = !!(selectedTask.all_day || selectedTask.allDay);
    const startValue = selectedTask.start_time || selectedTask.startTime || selectedTask.due_date || selectedTask.dueDate || '';
    const startInput = startValue ? toInputFormat(startValue, null, allDay) : '';
    const recurrence = parseRecurrenceRule(selectedTask.recurrence_rule || selectedTask.recurrenceRule);
    const fallback = parseLunarYearlyRule(recurrence || { freq: 'lunar_yearly' }, startInput);
    if (!fallback) return;
    setDraftRecurrenceLunarYear(fallback.year);
  }, [selectedTask]);

  useEffect(() => {
    if (!draft?.recurrence_enabled) {
      setShowDraftCustomRecurrenceMenu(false);
      setShowDraftMonthlyDatePicker(false);
      return;
    }
    if ((draft?.recurrence_type || 'daily') !== 'monthly') {
      setShowDraftMonthlyDatePicker(false);
    }
  }, [draft?.recurrence_enabled, draft?.recurrence_type]);

  const buildDraftFromTask = (taskValue) => {
    if (!taskValue) return null;
    const allDay = !!(taskValue.all_day || taskValue.allDay);
    const startTime = taskValue.start_time || taskValue.startTime || taskValue.due_date || '';
    const endTime = taskValue.end_time || taskValue.endTime || '';
    const recurrenceRule = parseRecurrenceRule(taskValue.recurrence_rule || taskValue.recurrenceRule);
    const parsedRecurrence = parseRecurrenceSelection(recurrenceRule, startTime ? toInputFormat(startTime, null, allDay) : '');
    let startInput = startTime ? toInputFormat(startTime, null, allDay) : '';
    let endInput = endTime ? toInputFormat(endTime, null, allDay) : '';
    if (!allDay && (parsedRecurrence.type === 'weekly' || parsedRecurrence.type === 'biweekly') && startInput) {
      const alignedStartInput = alignStartToWeekdayLocal(
        startInput,
        parsedRecurrence.days.length > 0 ? parsedRecurrence.days : DEFAULT_WORKDAY_KEYS,
      );
      if (alignedStartInput && alignedStartInput !== startInput) {
        const shiftedEndInput = shiftEndByDurationLocal(startInput, endInput, alignedStartInput);
        startInput = alignedStartInput;
        if (shiftedEndInput) {
          endInput = shiftedEndInput;
        }
      }
      endInput = coerceEndNotBeforeStartLocal(startInput, endInput);
    }
    return {
      title: taskValue.title || '',
      description: taskValue.description || '',
      priority: String(taskValue.priority ?? 0),
      status: taskValue.status || 'pending',
      all_day: allDay,
      start_time: startInput,
      end_time: endInput,
      category_ids: (taskValue.categories || []).map((cat) => String(cat.id)),
      recurrence_enabled: !!recurrenceRule,
      recurrence_type: parsedRecurrence.type,
      recurrence_days: parsedRecurrence.days,
      recurrence_date: parsedRecurrence.monthDate,
      recurrence_lunar_month: parsedRecurrence.lunarMonth,
      recurrence_lunar_day: parsedRecurrence.lunarDay,
      recurrence_lunar_is_leap_month: parsedRecurrence.lunarIsLeapMonth,
    };
  };

  useEffect(() => {
    if (!selectedTask) {
      setDraftWithSnapshot(null);
      setDraftTimeRangeEnabled(false);
      detailPanelSnapshotRef.current = null;
      lastSyncedSelectedIDRef.current = 0;
      draftSourceTaskIDRef.current = 0;
      draftTouchedRef.current = false;
      draftEditVersionRef.current = 0;
      return;
    }

    const nextDraft = buildDraftFromTask(selectedTask);
    if (lastSyncedSelectedIDRef.current !== selectedTask.id) {
      lastSyncedSelectedIDRef.current = selectedTask.id;
      draftSourceTaskIDRef.current = selectedTask.id;
      draftTouchedRef.current = false;
      draftEditVersionRef.current = 0;
      setDraftWithSnapshot(nextDraft);
      setDraftTimeRangeEnabled(!!nextDraft?.end_time);
      setDetailPanel('');
      return;
    }

    if (!draft) {
      draftTouchedRef.current = false;
      draftSourceTaskIDRef.current = selectedTask.id;
      draftEditVersionRef.current = 0;
      setDraftWithSnapshot(nextDraft);
      setDraftTimeRangeEnabled(!!nextDraft?.end_time);
      return;
    }

    // Keep detail draft synced with external updates (drag/drop, modal save, etc.)
    // unless the user is actively editing this draft.
    if (!draftTouchedRef.current && !isDetailPanelRequiringConfirm(detailPanel)) {
      const current = normalizeDraftForCompare(draft);
      const incoming = normalizeDraftForCompare(nextDraft);
      if (JSON.stringify(current) !== JSON.stringify(incoming)) {
        draftSourceTaskIDRef.current = selectedTask.id;
        setDraftWithSnapshot(nextDraft);
        setDraftTimeRangeEnabled(!!nextDraft?.end_time);
      }
    }
  }, [selectedTask, draft, detailPanel, isDetailPanelRequiringConfirm, setDraftWithSnapshot]);

  useEffect(() => {
    if (!draft) return;

    if (draft.all_day) {
      const nextStart = draft.start_time && draft.start_time.includes('T') ? draft.start_time.split('T')[0] : draft.start_time;
      const nextEnd = draft.end_time && draft.end_time.includes('T') ? draft.end_time.split('T')[0] : draft.end_time;
      if (nextStart !== draft.start_time || nextEnd !== draft.end_time) {
        setDraftWithSnapshot((prev) => (prev ? { ...prev, start_time: nextStart || '', end_time: nextEnd || '' } : prev));
      }
      return;
    }

    const { hour: defaultHour, minute: defaultMinute } = getDefaultStartTimeParts();
    const defaultTime = `${String(defaultHour).padStart(2, '0')}:${String(defaultMinute).padStart(2, '0')}`;
    const nextStart = draft.start_time && !draft.start_time.includes('T')
      ? `${draft.start_time}T${defaultTime}`
      : draft.start_time;
    const nextEnd = draft.end_time && !draft.end_time.includes('T') ? `${draft.end_time}T23:59` : draft.end_time;
    if (nextStart !== draft.start_time || nextEnd !== draft.end_time) {
      setDraftWithSnapshot((prev) => (prev ? { ...prev, start_time: nextStart || '', end_time: nextEnd || '' } : prev));
    }
  }, [draft, setDraftWithSnapshot]);

  const isDraftDirty = useMemo(() => {
    if (!selectedTask || !draft) return false;
    const current = normalizeDraftForCompare(draft);
    const original = normalizeDraftForCompare(buildDraftFromTask(selectedTask));
    return JSON.stringify(current) !== JSON.stringify(original);
  }, [draft, selectedTask]);
  useEffect(() => {
    selectedTaskSnapshotRef.current = selectedTask || null;
  }, [selectedTask]);
  useEffect(() => {
    draftSnapshotRef.current = draft || null;
  }, [draft]);
  useEffect(() => {
    isDraftDirtyRef.current = isDraftDirty;
  }, [isDraftDirty]);
  useEffect(() => {
    isSavingDraftRef.current = savingDraft;
  }, [savingDraft]);
  useEffect(() => {
    isSubmittingDraftRef.current = submittingDraft;
  }, [submittingDraft]);
  const getPriorityBadge = (priorityValue) => {
    const value = Number.parseInt(priorityValue, 10) || 0;
    if (value === 1) return { text: t('task.priorityHigh'), className: 'text-rose-600 bg-rose-50 border-rose-200' };
    if (value === -1) return { text: t('task.priorityLow'), className: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    return { text: t('task.priorityMedium'), className: 'text-sky-600 bg-sky-50 border-sky-200' };
  };

  const handleStatusChange = useCallback(async (task, newStatus) => {
    if (task.read_only) return;
    const taskID = Number(task?.source_task_id || task?.task_id || task?.id || 0);
    if (!taskID) return;
    let optimisticOccurrenceKeys = [];
    try {
      const recurrenceRule = parseRecurrenceRule(task?.recurrence_rule || task?.recurrenceRule);
      if (recurrenceRule) {
        const instanceID = String(task?.instance_id || task?.instanceId || '').trim();
        const occurrenceDate = resolveTaskOccurrenceDate(task, timezone);
        const payload = { status: newStatus };
        if (/^\d+_\d{8}$/.test(instanceID)) {
          payload.instance_id = instanceID;
        }
        if (occurrenceDate) {
          payload.occurrence_date = occurrenceDate;
        }
        const hasOccurrenceContext = !!(payload.instance_id || payload.occurrence_date);
        const restoringCancelledOccurrenceAsDetachedTask = (
          hasOccurrenceContext
          && String(newStatus || '') === 'pending'
          && String(task?.status || '') === 'cancelled'
        );
        if (restoringCancelledOccurrenceAsDetachedTask) {
          const startTime = task?.occurrence_start || task?.occurrenceStart || task?.start_time || task?.startTime || null;
          const endTime = task?.occurrence_end || task?.occurrenceEnd || task?.end_time || task?.endTime || null;
          const dueDate = task?.due_date || task?.dueDate || null;
          const categoryIDs = Array.isArray(task?.categories)
            ? task.categories.map((cat) => Number(cat?.id || 0)).filter((id) => id > 0)
            : [];
          const detachedTask = await createTaskLocal(queryClient, {
            title: String(task?.title || '').trim(),
            description: String(task?.description || ''),
            priority: Number.parseInt(task?.priority, 10) || 0,
            status: 'pending',
            all_day: !!(task?.all_day || task?.allDay),
            start_time: startTime,
            end_time: endTime,
            due_date: dueDate,
            category_ids: categoryIDs,
            recurrence_rule: null,
            recurrence_end_date: null,
          }, {
            submitMeta: {
              submittedAt: new Date().toISOString(),
              submitSource: 'manual',
            },
          });
          if (detachedTask?.id) {
            setSelectedTaskID(detachedTask.id);
          }
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.nextOccurrences() }),
            queryClient.invalidateQueries({ queryKey: ['tasks', 'occurrences'] }),
          ]);
          return;
        }
        if (hasOccurrenceContext) {
          optimisticOccurrenceKeys = buildOccurrenceStatusKeys(
            taskID,
            payload.instance_id || instanceID,
            payload.occurrence_date || occurrenceDate,
            timezone,
          );
          if (optimisticOccurrenceKeys.length > 0) {
            const now = Date.now();
            setOccurrenceStatusOptimisticMap((prev) => {
              const next = { ...(prev || {}) };
              optimisticOccurrenceKeys.forEach((key) => {
                if (!key) return;
                next[key] = { status: newStatus, updatedAt: now };
              });
              return next;
            });
          }
        }
        await updateTaskStatusLocal(queryClient, taskID, hasOccurrenceContext ? payload : newStatus, {
          submitMeta: {
            submittedAt: new Date().toISOString(),
            submitSource: 'manual',
          },
          awaitPersist: true,
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.nextOccurrences() }),
          queryClient.invalidateQueries({ queryKey: ['tasks', 'occurrences'] }),
        ]);
      } else {
        await updateTaskStatusLocal(queryClient, taskID, newStatus, {
          submitMeta: {
            submittedAt: new Date().toISOString(),
            submitSource: 'manual',
          },
          awaitPersist: true,
        });
      }
    } catch (err) {
      if (optimisticOccurrenceKeys.length > 0) {
        setOccurrenceStatusOptimisticMap((prev) => {
          const next = { ...(prev || {}) };
          let changed = false;
          optimisticOccurrenceKeys.forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(next, key)) return;
            delete next[key];
            changed = true;
          });
          return changed ? next : prev;
        });
      }
      console.error('Failed to update task status:', err);
    }
  }, [queryClient, timezone]);

  const handleQuickCreate = async () => {
    const title = quickTitle.trim();
    if (!title) return;

    try {
      let storedUser = {};
      try {
        storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      } catch {
        storedUser = {};
      }
      const parsedPriority = parsePriorityFromTitle(title);
      const priorityNormalizedTitle = (parsedPriority?.cleanedTitle || title).trim() || title;
      const parsedNaturalTime = parseNaturalTimeFromTitle(priorityNormalizedTitle, timezone, getNaturalTimeOptionsFromUser(storedUser));
      const normalizedTitle = (parsedNaturalTime?.cleanedTitle || priorityNormalizedTitle).trim() || priorityNormalizedTitle;
      const now = dayjs().tz(timezone);
      const { hour, minute } = getDefaultStartTimeParts();
      const startLocal = parsedNaturalTime?.parsedAtInput || now.hour(hour).minute(minute).second(0).format('YYYY-MM-DDTHH:mm');
      const payload = {
        title: normalizedTitle,
        description: '',
        priority: Number.isInteger(parsedPriority?.priority) ? parsedPriority.priority : 0,
        all_day: false,
        client_timezone: timezone,
        start_time: toISOString(startLocal, timezone),
        start_time_local: startLocal,
      };
      if (activeCategoryID > 0) {
        payload.category_ids = [activeCategoryID];
      }

      const createdTask = await createTaskLocal(queryClient, payload);
      logTimeDebug('taskList.quickCreate.payload', {
        task_id: createdTask?.id || 0,
        start_time_local: payload.start_time_local,
        start_time: payload.start_time,
        client_timezone: payload.client_timezone,
      });
      setQuickTitle('');
      if (createdTask?.id) {
        setSelectedTaskID(createdTask.id);
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleDraftFieldChange = (field, value, options = {}) => {
    const closureTaskID = Number(selectedTask?.id || 0);
    if (hasStaleDraftEventContext(closureTaskID)) return;
    const submitNow = !!options?.submitNow;
    const submitSource = options?.submitSource || 'realtime';
    markDraftTouched();
    setDraftWithSnapshot((prev) => {
      if (!prev) return prev;
      if (field !== 'start_time') return { ...prev, [field]: value };

      const nextStart = String(value || '');
      if (!nextStart || !prev.end_time) {
        return { ...prev, start_time: nextStart };
      }

      if (prev.all_day) {
        const startDay = parseLocalInput(nextStart);
        const endDay = parseLocalInput(prev.end_time);
        if (startDay && endDay && endDay.isBefore(startDay, 'day')) {
          return { ...prev, start_time: nextStart, end_time: nextStart };
        }
        return { ...prev, start_time: nextStart };
      }

      const alignedEnd = coerceEndNotBeforeStartLocal(nextStart, prev.end_time);
      return { ...prev, start_time: nextStart, end_time: alignedEnd };
    });
    if (submitNow) {
      submitDraftImmediately(submitSource);
    }
  };

  const handleDraftStartDateTimeChange = (nextValue) => {
    const closureTaskID = Number(selectedTask?.id || 0);
    if (hasStaleDraftEventContext(closureTaskID)) return;
    const nextStart = String(nextValue || '');
    markDraftTouched();
    setDraftWithSnapshot((prev) => {
      if (!prev) return prev;
      if (!draftTimeRangeEnabled) {
        return { ...prev, start_time: nextStart, end_time: '' };
      }
      if (!nextStart || !prev.end_time) {
        return { ...prev, start_time: nextStart };
      }
      const alignedEnd = coerceEndNotBeforeStartLocal(nextStart, prev.end_time);
      return { ...prev, start_time: nextStart, end_time: alignedEnd };
    });
  };

  const handleDraftEndDateTimeChange = (nextValue) => {
    const closureTaskID = Number(selectedTask?.id || 0);
    if (hasStaleDraftEventContext(closureTaskID)) return;
    markDraftTouched();
    setDraftWithSnapshot((prev) => (prev ? { ...prev, end_time: String(nextValue || '') } : prev));
  };

  const applyQuickDatePreset = (preset) => {
    const closureTaskID = Number(selectedTask?.id || 0);
    if (hasStaleDraftEventContext(closureTaskID)) return;
    markDraftTouched();
    setDraftWithSnapshot((prev) => {
      if (!prev) return prev;
      if (preset === 'clear') {
        return { ...prev, start_time: '', end_time: '' };
      }

      const now = dayjs().tz(timezone);
      const { hour: defaultHour, minute: defaultMinute } = getDefaultStartTimeParts();

      let target = now;
      if (preset === 'tomorrow') target = now.add(1, 'day');
      if (preset === 'next_week') target = now.add(7, 'day');

      let hour = defaultHour;
      let minute = defaultMinute;
      if (preset === 'tonight') {
        hour = 20;
        minute = 0;
      }

      if (prev.all_day) {
        return {
          ...prev,
          start_time: target.format('YYYY-MM-DD'),
          end_time: draftTimeRangeEnabled ? target.format('YYYY-MM-DD') : '',
        };
      }

      const nextStart = target.hour(hour).minute(minute).second(0).format('YYYY-MM-DDTHH:mm');
      const shiftedEnd = shiftEndByDurationLocal(prev.start_time, prev.end_time, nextStart);
      const nextEnd = shiftedEnd || coerceEndNotBeforeStartLocal(nextStart, prev.end_time);
      return {
        ...prev,
        start_time: nextStart,
        end_time: draftTimeRangeEnabled ? nextEnd : '',
      };
    });
  };

  const toggleDraftCategory = (catID) => {
    const closureTaskID = Number(selectedTask?.id || 0);
    if (hasStaleDraftEventContext(closureTaskID)) return;
    markDraftTouched();
    setDraftWithSnapshot((prev) => {
      if (!prev) return prev;
      const id = String(catID);
      const exists = prev.category_ids.includes(id);
      return {
        ...prev,
        category_ids: exists
          ? prev.category_ids.filter((currentID) => currentID !== id)
          : [...prev.category_ids, id],
      };
    });
    submitDraftImmediately('realtime_category');
  };

  const toggleDraftRecurrenceDay = (dayKey) => {
    const closureTaskID = Number(selectedTask?.id || 0);
    if (hasStaleDraftEventContext(closureTaskID)) return;
    markDraftTouched();
    setDraftWithSnapshot((prev) => {
      if (!prev) return prev;
      const current = Array.isArray(prev.recurrence_days) ? prev.recurrence_days : [];
      const exists = current.includes(dayKey);
      return {
        ...prev,
        recurrence_days: exists ? current.filter((day) => day !== dayKey) : [...current, dayKey],
      };
    });
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

  const buildDraftPayload = useCallback((taskValue, draftValue) => {
    if (!taskValue || !draftValue) return null;
    const title = (draftValue.title || '').trim();
    if (!title) return null;
    const parsedPriority = parsePriorityFromTitle(title);
    const normalizedTitle = parsedPriority?.cleanedTitle?.trim() || title;
    const normalizedPriority = Number.isInteger(parsedPriority?.priority)
      ? parsedPriority.priority
      : (Number.parseInt(draftValue.priority, 10) || 0);
    const originalDraft = buildDraftFromTask(taskValue);
    const recurrenceChanged =
      !!draftValue.recurrence_enabled !== !!originalDraft?.recurrence_enabled
      || String(draftValue.recurrence_type || 'daily') !== String(originalDraft?.recurrence_type || 'daily')
      || JSON.stringify([...(draftValue.recurrence_days || [])].map((day) => String(day || '').toUpperCase()).sort())
        !== JSON.stringify([...(originalDraft?.recurrence_days || [])].map((day) => String(day || '').toUpperCase()).sort())
      || clampMonthlyDate(draftValue.recurrence_date, 1) !== clampMonthlyDate(originalDraft?.recurrence_date, 1)
      || (
        (
          String(draftValue.recurrence_type || 'daily') === 'lunar'
          || String(originalDraft?.recurrence_type || 'daily') === 'lunar'
        )
        && (
          (Number.parseInt(draftValue.recurrence_lunar_month, 10) || 1) !== (Number.parseInt(originalDraft?.recurrence_lunar_month, 10) || 1)
          || (Number.parseInt(draftValue.recurrence_lunar_day, 10) || 1) !== (Number.parseInt(originalDraft?.recurrence_lunar_day, 10) || 1)
          || !!draftValue.recurrence_lunar_is_leap_month !== !!originalDraft?.recurrence_lunar_is_leap_month
        )
      );
    const timeChanged =
      !!draftValue.all_day !== !!originalDraft?.all_day
      || String(draftValue.start_time || '') !== String(originalDraft?.start_time || '')
      || String(draftValue.end_time || '') !== String(originalDraft?.end_time || '');
    const recurrenceRule = parseRecurrenceRule(taskValue?.recurrence_rule || taskValue?.recurrenceRule);
    const scopedInstanceID = String(taskValue?.instance_id || taskValue?.instanceId || '').trim();
    const scopedOccurrenceDate = resolveTaskOccurrenceDate(taskValue, timezone);
    const hasOccurrenceContext = !!(
      recurrenceRule
      && (
        /^\d+_\d{8}$/.test(scopedInstanceID)
        || !!scopedOccurrenceDate
      )
    );

    const payload = {
      title: normalizedTitle,
      description: draftValue.description || '',
      priority: normalizedPriority,
      status: draftValue.status || taskValue.status || 'pending',
      client_timezone: timezone,
      category_ids: (draftValue.category_ids || []).map((id) => Number.parseInt(id, 10)).filter((id) => !Number.isNaN(id)),
    };
    if (hasOccurrenceContext) {
      if (/^\d+_\d{8}$/.test(scopedInstanceID)) {
        payload.instance_id = scopedInstanceID;
      }
      if (scopedOccurrenceDate) {
        payload.occurrence_date = scopedOccurrenceDate;
      }
    }

    if (timeChanged || recurrenceChanged) {
      const fallbackTimeParts = getDefaultStartTimeParts();
      const fallbackTime = `${String(fallbackTimeParts.hour).padStart(2, '0')}:${String(fallbackTimeParts.minute).padStart(2, '0')}`;
      const lunarSelection = coerceLunarSelection({
        year: draftRecurrenceLunarYear,
        month: Number.parseInt(draftValue.recurrence_lunar_month, 10) || 1,
        day: Number.parseInt(draftValue.recurrence_lunar_day, 10) || 1,
        isLeapMonth: !!draftValue.recurrence_lunar_is_leap_month,
      });
      const recurrenceType = String(draftValue.recurrence_type || 'daily');
      const normalizedRecurrenceDays = (draftValue.recurrence_days || [])
        .map((day) => String(day || '').toUpperCase())
        .filter((day) => WEEKDAY_ONLY_RE.test(day));
      const recurrenceDaysForAlignment = normalizedRecurrenceDays.length > 0
        ? normalizedRecurrenceDays
        : workDayKeys;
      const isLunarRecurrence = !!draftValue.recurrence_enabled && draftValue.recurrence_type === 'lunar';
      const shouldAlignNearestSolarStart = !!(
        recurrenceChanged
        && draftValue.recurrence_enabled
        && !isLunarRecurrence
        && ['weekly', 'biweekly', 'monthly', 'yearly'].includes(recurrenceType)
      );
      const nowLocalInput = dayjs().tz(timezone).format('YYYY-MM-DDTHH:mm');
      const nowLocalDateInput = dayjs().tz(timezone).format('YYYY-MM-DD');
      const nowLunarInput = dayjs().tz(LUNAR_TIMEZONE).format('YYYY-MM-DDTHH:mm');
      const nowLunarDateInput = dayjs().tz(LUNAR_TIMEZONE).format('YYYY-MM-DD');

      const startInputRaw = String(draftValue.start_time ?? originalDraft?.start_time ?? '');
      const endInputRaw = String(draftValue.end_time ?? originalDraft?.end_time ?? '');
      payload.all_day = !!draftValue.all_day;
      if (payload.all_day) {
        let nextStartInput = startInputRaw;
        let nextEndInput = endInputRaw;
        if (isLunarRecurrence) {
          const lunarAlignedStart = nextLocalInputFromLunarSelection(lunarSelection, {
            currentValue: nextStartInput,
            allDay: true,
            timezoneName: LUNAR_TIMEZONE,
            fallbackTime,
            fromValue: nowLunarDateInput,
          });
          if (lunarAlignedStart && lunarAlignedStart !== nextStartInput) {
            const shiftedEnd = shiftEndByDurationLocal(nextStartInput, nextEndInput, lunarAlignedStart);
            nextStartInput = lunarAlignedStart;
            if (shiftedEnd) {
              nextEndInput = shiftedEnd;
            }
          }
        }
        if (shouldAlignNearestSolarStart) {
          const alignedStartInput = alignStartInputToNearestRecurrence({
            startInput: nextStartInput,
            recurrenceType,
            recurrenceDays: recurrenceDaysForAlignment,
            recurrenceDate: draftValue.recurrence_date,
            allDay: true,
            referenceInput: nowLocalDateInput,
            timezoneName: timezone,
          });
          if (alignedStartInput && alignedStartInput !== nextStartInput) {
            const shiftedEnd = shiftEndByDurationLocal(nextStartInput, nextEndInput, alignedStartInput);
            nextStartInput = alignedStartInput;
            if (shiftedEnd) {
              nextEndInput = shiftedEnd;
            }
          }
        }
        const startDate = splitDatePart(nextStartInput);
        let endDate = splitDatePart(nextEndInput);
        if (startDate && endDate) {
          const startDay = parseLocalInput(startDate);
          const endDay = parseLocalInput(endDate);
          if (startDay && endDay && endDay.isBefore(startDay, 'day')) {
            endDate = startDate;
          }
        }
        payload.start_time = startDate ? toISOString(`${startDate} 00:00:00`, timezone) : null;
        payload.end_time = endDate ? toISOString(`${endDate} 23:59:59`, timezone) : null;
        if (startDate) payload.start_time_local = startDate;
        if (endDate) payload.end_time_local = endDate;
      } else {
        let nextStartInput = startInputRaw;
        let nextEndInput = endInputRaw;
        if (isLunarRecurrence) {
          const lunarAlignedStart = nextLocalInputFromLunarSelection(lunarSelection, {
            currentValue: nextStartInput,
            allDay: false,
            timezoneName: LUNAR_TIMEZONE,
            fallbackTime,
            fromValue: nowLunarInput,
          });
          if (lunarAlignedStart && lunarAlignedStart !== nextStartInput) {
            const shiftedEnd = shiftEndByDurationLocal(nextStartInput, nextEndInput, lunarAlignedStart);
            nextStartInput = lunarAlignedStart;
            if (shiftedEnd) {
              nextEndInput = shiftedEnd;
            }
          }
        }
        if (shouldAlignNearestSolarStart) {
          const alignedStartInput = alignStartInputToNearestRecurrence({
            startInput: nextStartInput,
            recurrenceType,
            recurrenceDays: recurrenceDaysForAlignment,
            recurrenceDate: draftValue.recurrence_date,
            allDay: false,
            referenceInput: nowLocalInput,
            timezoneName: timezone,
          });
          if (alignedStartInput && alignedStartInput !== nextStartInput) {
            const shiftedEnd = shiftEndByDurationLocal(nextStartInput, nextEndInput, alignedStartInput);
            nextStartInput = alignedStartInput;
            if (shiftedEnd) {
              nextEndInput = shiftedEnd;
            }
          }
        }
        nextEndInput = coerceEndNotBeforeStartLocal(nextStartInput, nextEndInput);
        payload.start_time = nextStartInput ? toISOString(nextStartInput, timezone) : null;
        payload.end_time = nextEndInput ? toISOString(nextEndInput, timezone) : null;
        if (nextStartInput) payload.start_time_local = nextStartInput;
        if (nextEndInput) payload.end_time_local = nextEndInput;
      }

      logTimeDebug('taskList.buildDraftPayload.time', {
        task_id: Number(taskValue?.id || 0),
        all_day: payload.all_day,
        start_input: startInputRaw,
        end_input: endInputRaw,
        start_time_local: payload.start_time_local || '',
        end_time_local: payload.end_time_local || '',
        start_time: payload.start_time,
        end_time: payload.end_time,
        client_timezone: payload.client_timezone,
      });
    }

    if (draftValue.recurrence_enabled) {
      const normalizedDays = (draftValue.recurrence_days || [])
        .map((day) => String(day || '').toUpperCase())
        .filter((day) => WEEKDAY_ONLY_RE.test(day));
      let rule = {
        freq: draftValue.recurrence_type || 'daily',
        interval: 1,
      };
      if (draftValue.recurrence_type === 'lunar') {
        const normalizedSelection = coerceLunarSelection({
          year: draftRecurrenceLunarYear,
          month: Number.parseInt(draftValue.recurrence_lunar_month, 10) || 1,
          day: Number.parseInt(draftValue.recurrence_lunar_day, 10) || 1,
          isLeapMonth: !!draftValue.recurrence_lunar_is_leap_month,
        });
        rule = buildLunarYearlyRuleFromSelection(normalizedSelection);
      } else if (draftValue.recurrence_type === 'biweekly') {
        rule.freq = 'weekly';
        rule.interval = 2;
        rule.byday = normalizedDays.length > 0 ? normalizedDays : workDayKeys;
      } else if (draftValue.recurrence_type === 'monthly') {
        rule.bydate = [clampMonthlyDate(draftValue.recurrence_date, 1)];
      } else if (rule.freq === 'weekly' && normalizedDays.length > 0) {
        rule.byday = normalizedDays;
      }
      payload.recurrence_rule = rule;
    } else {
      payload.recurrence_rule = null;
    }

    return {
      payload,
      normalizedTitle,
      normalizedPriority,
    };
  }, [draftRecurrenceLunarYear, timezone, workDayKeys]);

  const submitPendingDraft = useCallback(async (taskIDOverride = 0, submitSource = 'idle') => {
    const pending = pendingDraftSubmitRef.current;
    if (!pending?.taskID || !pending?.payload) {
      return;
    }
    const taskID = Number(taskIDOverride || pending.taskID || 0);
    if (!taskID || taskID !== Number(pending.taskID)) {
      return;
    }
    if (submittingDraft) {
      return;
    }

    setSubmittingDraft(true);
    try {
      logTimeDebug('taskList.submitPendingDraft.start', {
        task_id: taskID,
        submit_source: submitSource,
        if_match_revision: Number(selectedTaskSnapshotRef.current?.revision || 0) || undefined,
        payload: pending.payload,
      });
      await updateTaskLocal(queryClient, taskID, pending.payload, {
        scheduleSync: true,
        localOnly: false,
        skipOptimistic: true,
        submitMeta: {
          submittedAt: new Date().toISOString(),
          submitSource,
        },
      });
      pendingDraftSubmitRef.current = { taskID: 0, payload: null };
      setPendingSubmitTaskID(0);
    } catch (err) {
      console.error('Failed to submit task details:', err);
    } finally {
      setSubmittingDraft(false);
    }
  }, [queryClient, submittingDraft]);

  const scheduleIdleDraftSubmit = useCallback((taskID) => {
    if (draftSyncTimerRef.current) {
      window.clearTimeout(draftSyncTimerRef.current);
      draftSyncTimerRef.current = 0;
    }
    if (!taskID) return;
    draftSyncTimerRef.current = window.setTimeout(() => {
      const pending = pendingDraftSubmitRef.current;
      if (Number(pending?.taskID || 0) === Number(taskID || 0)) {
        void submitPendingDraft(taskID, 'idle');
      }
      draftSyncTimerRef.current = 0;
    }, DRAFT_IDLE_SUBMIT_MS);
  }, [submitPendingDraft]);

  const handleSaveDraft = async ({ submitAfter = false, submitSource = 'idle' } = {}) => {
    const taskValue = selectedTaskSnapshotRef.current || selectedTask;
    const draftValue = draftSnapshotRef.current || draft;
    const closureTaskID = Number(taskValue?.id || 0);
    if (hasStaleDraftEventContext(closureTaskID)) {
      return;
    }
    if (!taskValue || !draftValue) {
      return;
    }
    if (taskValue.read_only) {
      return;
    }
    if (savingDraft) {
      return;
    }
    if (draftSourceTaskIDRef.current !== taskValue.id) {
      return;
    }
    const title = (draftValue.title || '').trim();
    if (!title) {
      return;
    }

    const targetTaskID = taskValue.id;
    const editVersionAtStart = draftEditVersionRef.current;
    const built = buildDraftPayload(taskValue, draftValue);
    if (!built?.payload) {
      return;
    }

    setSavingDraft(true);
    try {
      if (built.normalizedTitle !== title || String(built.normalizedPriority) !== String(draftValue.priority)) {
        setDraftWithSnapshot((prev) => (prev ? {
          ...prev,
          title: built.normalizedTitle,
          priority: String(built.normalizedPriority),
        } : prev));
      }

      const savedTask = await updateTaskLocal(queryClient, targetTaskID, built.payload, {
        scheduleSync: false,
        localOnly: true,
      });
      if (draftSourceTaskIDRef.current !== targetTaskID) {
        return false;
      }
      const hasNewEdits = draftEditVersionRef.current !== editVersionAtStart;
      if (hasNewEdits) {
        return false;
      }
      draftTouchedRef.current = false;
      void savedTask;

      pendingDraftSubmitRef.current = { taskID: targetTaskID, payload: built.payload };
      logTimeDebug('taskList.handleSaveDraft.localSaved', {
        task_id: targetTaskID,
        submit_after: !!submitAfter,
        submit_source: submitSource,
        payload: built.payload,
      });
      setPendingSubmitTaskID(targetTaskID);
      scheduleIdleDraftSubmit(targetTaskID);

      if (submitAfter) {
        void submitPendingDraft(targetTaskID, submitSource);
      }
      return true;
    } catch (err) {
      console.error('Failed to save task details:', err);
      return false;
    } finally {
      setSavingDraft(false);
    }
  };

  const submitDraftImmediately = useCallback((submitSource = 'realtime') => {
    if (typeof window === 'undefined') return;
    window.setTimeout(() => {
      void handleSaveDraft({ submitAfter: true, submitSource });
    }, 0);
  }, [handleSaveDraft]);

  const flushDraftOnLeave = useCallback((submitSource = 'leave', options = {}) => {
    const runFlush = async () => {
      const pending = pendingDraftSubmitRef.current;
      const pendingTaskID = Number(pending?.taskID || 0);
      const pendingPayload = pending?.payload && typeof pending.payload === 'object' ? pending.payload : null;
      const hasPendingSubmit = pendingTaskID > 0 && !!pendingPayload;

      const taskValue = options?.taskValue || selectedTaskSnapshotRef.current;
      const draftValue = options?.draftValue || draftSnapshotRef.current;
      const draftSourceTaskID = Number(options?.draftSourceTaskID || draftSourceTaskIDRef.current || 0);
      const taskID = Number(taskValue?.id || 0);
      const draftBoundToTask = taskID > 0 && draftSourceTaskID === taskID;
      const draftTitle = String(draftValue?.title || '').trim();
      const snapshotDirty = !!(
        taskValue
        && draftValue
        && draftBoundToTask
        && JSON.stringify(normalizeDraftForCompare(draftValue))
          !== JSON.stringify(normalizeDraftForCompare(buildDraftFromTask(taskValue)))
      );
      const hasDirtyDraft = !!(
        taskValue
        && draftValue
        && draftBoundToTask
        && !taskValue.read_only
        && draftTitle
        && snapshotDirty
      );
      if (!hasPendingSubmit && !hasDirtyDraft) {
        return;
      }

      try {
        if (hasDirtyDraft) {
          const built = buildDraftPayload(taskValue, draftValue);
          if (built?.payload) {
            await updateTaskLocal(queryClient, taskValue.id, built.payload, {
              scheduleSync: false,
              localOnly: true,
              awaitPersist: true,
            });
            await updateTaskLocal(queryClient, taskValue.id, built.payload, {
              scheduleSync: true,
              localOnly: false,
              skipOptimistic: true,
              submitMeta: {
                submittedAt: new Date().toISOString(),
                submitSource,
              },
              awaitPersist: true,
            });
            if (Number(pendingDraftSubmitRef.current?.taskID || 0) === Number(taskValue.id)) {
              pendingDraftSubmitRef.current = { taskID: 0, payload: null };
              setPendingSubmitTaskID(0);
            }
          }
        } else if (hasPendingSubmit) {
          await updateTaskLocal(queryClient, pendingTaskID, pendingPayload, {
            scheduleSync: false,
            localOnly: true,
            awaitPersist: true,
          });
          await updateTaskLocal(queryClient, pendingTaskID, pendingPayload, {
            scheduleSync: true,
            localOnly: false,
            skipOptimistic: true,
            submitMeta: {
              submittedAt: new Date().toISOString(),
              submitSource,
            },
            awaitPersist: true,
          });
          if (Number(pendingDraftSubmitRef.current?.taskID || 0) === Number(pendingTaskID || 0)) {
            pendingDraftSubmitRef.current = { taskID: 0, payload: null };
            setPendingSubmitTaskID(0);
          }
        }
      } catch (error) {
        console.error('Failed to flush draft on leave:', error);
      }
    };
    const queued = flushDraftQueueRef.current.then(runFlush, runFlush);
    flushDraftQueueRef.current = queued.catch(() => {});
    return queued;
  }, [buildDraftFromTask, buildDraftPayload, queryClient]);

  useEffect(() => {
    flushDraftOnLeaveRef.current = flushDraftOnLeave;
  }, [flushDraftOnLeave]);

  useEffect(() => () => {
    if (draftSyncTimerRef.current) {
      window.clearTimeout(draftSyncTimerRef.current);
      draftSyncTimerRef.current = 0;
    }
    const flush = flushDraftOnLeaveRef.current;
    if (typeof flush === 'function') {
      void flush('leave');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handlePageHide = () => {
      const flush = flushDraftOnLeaveRef.current;
      if (typeof flush === 'function') {
        void flush('pagehide');
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handleVisibilityChange = () => {
      if (!document.hidden) return;
      const flush = flushDraftOnLeaveRef.current;
      if (typeof flush === 'function') {
        void flush('visibilitychange');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleBeforeUnload = (event) => {
      const pending = pendingDraftSubmitRef.current;
      const hasPendingSubmit = !!(
        Number(pending?.taskID || 0) > 0
        && pending?.payload
        && typeof pending.payload === 'object'
      );
      const taskValue = selectedTaskSnapshotRef.current;
      const draftValue = draftSnapshotRef.current;
      const hasDraftSessionEdits = !!(
        taskValue
        && draftValue
        && !taskValue.read_only
        && draftTouchedRef.current
        && (draftValue.title || '').trim()
      );
      const hasUnsyncedChanges = !!(
        hasDraftSessionEdits
        || isDraftDirtyRef.current
        || hasPendingSubmit
        || isSavingDraftRef.current
        || isSubmittingDraftRef.current
      );
      if (!hasUnsyncedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleSubmitDraft = async () => {
    const closureTaskID = Number(selectedTask?.id || 0);
    if (hasStaleDraftEventContext(closureTaskID)) return;
    if (!selectedTask || selectedTask.read_only) return;
    if (isDraftDirtyRef.current) {
      let queued = await handleSaveDraft({ submitAfter: false, submitSource: 'manual' });
      if (!queued && isDraftDirtyRef.current) {
        queued = await handleSaveDraft({ submitAfter: false, submitSource: 'manual' });
      }
      if (!queued) return;
    }
    await submitPendingDraft(selectedTask.id, 'manual');
  };

  const handleDraftEditorSaveShortcut = useCallback(() => {
    void handleSubmitDraft();
  }, [handleSubmitDraft]);

  const closeDeleteDialog = useCallback(() => {
    if (deleteDialogSubmitting) return;
    setDeleteDialog({ open: false, kind: '', context: null });
  }, [deleteDialogSubmitting]);

  const executeDeleteAction = useCallback(async (action) => {
    if (deleteDialogSubmitting) return;
    const ctx = deleteDialog?.context;
    if (!ctx) return;

    const taskID = Number(ctx.taskID || 0);
    if (!taskID) return;
    const submitMeta = {
      submittedAt: new Date().toISOString(),
      submitSource: 'manual',
    };
    const fallbackOccurrenceDate = (() => {
      const explicit = String(ctx.occurrenceDate || '').trim();
      if (explicit) return explicit;
      const fromInstance = String(ctx.instanceID || '').trim().match(/^\d+_(\d{8})$/)?.[1] || '';
      if (fromInstance) {
        return `${fromInstance.slice(0, 4)}-${fromInstance.slice(4, 6)}-${fromInstance.slice(6, 8)}`;
      }
      const fromStart = normalizeOccurrenceDate(ctx.occurrenceStart, timezone);
      return fromStart || '';
    })();
    const fallbackInstanceID = (() => {
      if (ctx.validInstanceID) return String(ctx.instanceID || '').trim();
      if (!fallbackOccurrenceDate) return '';
      return `${taskID}_${fallbackOccurrenceDate.replace(/-/g, '')}`;
    })();

    setDeleteDialogSubmitting(true);
    try {
      if (action === 'single') {
        const payload = { status: 'cancelled' };
        if (fallbackInstanceID) payload.instance_id = fallbackInstanceID;
        if (fallbackOccurrenceDate) payload.occurrence_date = fallbackOccurrenceDate;
        await updateTaskStatusLocal(queryClient, taskID, payload, { submitMeta, awaitPersist: true });
      } else if (action === 'series') {
        const baseTask = (Array.isArray(tasksRaw) ? tasksRaw : []).find((item) => Number(item?.id) === taskID) || null;
        const occurrenceStart = dayjs(ctx.occurrenceStart || '');
        const seriesStart = dayjs(
          baseTask?.start_time
          || baseTask?.startTime
          || baseTask?.due_date
          || baseTask?.dueDate
          || ''
        );
        if (ctx.hasOccurrenceContext && occurrenceStart.isValid() && seriesStart.isValid() && occurrenceStart.isAfter(seriesStart)) {
          await updateTaskLocal(queryClient, taskID, {
            recurrence_end_date: occurrenceStart.subtract(1, 'second').utc().toISOString(),
          }, { submitMeta, awaitPersist: true });
          const occurrencePayload = { status: 'cancelled' };
          if (fallbackInstanceID) occurrencePayload.instance_id = fallbackInstanceID;
          if (fallbackOccurrenceDate) occurrencePayload.occurrence_date = fallbackOccurrenceDate;
          if (occurrencePayload.instance_id || occurrencePayload.occurrence_date) {
            await updateTaskStatusLocal(queryClient, taskID, occurrencePayload, { submitMeta, awaitPersist: true });
          }
        } else {
          await deleteTaskLocal(queryClient, taskID);
        }
      } else if (action === 'task') {
        if (ctx.status === 'cancelled') {
          await deleteTaskLocal(queryClient, taskID);
        } else {
          await cancelTaskLocal(queryClient, taskID);
        }
      } else {
        return;
      }

      if (Number(pendingDraftSubmitRef.current?.taskID || 0) === taskID) {
        pendingDraftSubmitRef.current = { taskID: 0, payload: null };
        setPendingSubmitTaskID(0);
      }
      setDeleteDialog({ open: false, kind: '', context: null });
      setSelectedTaskID(0);
    } catch (err) {
      console.error('Failed to delete task:', err);
    } finally {
      setDeleteDialogSubmitting(false);
    }
  }, [deleteDialog, deleteDialogSubmitting, queryClient, tasksRaw, timezone]);

  const handleDeleteSelected = useCallback(() => {
    const ctx = buildDeleteContext(selectedTask, timezone);
    if (!ctx) return;
    if (ctx.isRecurring) {
      setDeleteDialog({
        open: true,
        kind: ctx.hasOccurrenceContext ? DELETE_DIALOG_KIND_RECURRING_CHOICE : DELETE_DIALOG_KIND_RECURRING_SERIES,
        context: ctx,
      });
      return;
    }
    if (ctx.status === 'cancelled') {
      setDeleteDialog({
        open: true,
        kind: DELETE_DIALOG_KIND_TASK,
        context: ctx,
      });
      return;
    }
    setDeleteDialog({
      open: true,
      kind: DELETE_DIALOG_KIND_TASK,
      context: ctx,
    });
  }, [selectedTask, timezone]);

  useEffect(() => {
    if (!deleteDialog.open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      closeDeleteDialog();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeDeleteDialog, deleteDialog.open]);

  useEffect(() => {
    if (!selectedTask || !draft || !isDraftDirty || savingDraft) return;
    if (!draftTouchedRef.current) return;
    if (!(draft.title || '').trim()) return;
    if (isDetailPanelRequiringConfirm(detailPanel)) return;

    const timer = window.setTimeout(() => {
      void handleSaveDraft({ submitAfter: true, submitSource: 'debounced' });
    }, DRAFT_TEXT_AUTOSAVE_MS);

    return () => window.clearTimeout(timer);
  }, [detailPanel, draft, handleSaveDraft, isDetailPanelRequiringConfirm, isDraftDirty, savingDraft, selectedTask]);

  useEffect(() => {
    if (!isDraftDirty) {
      draftTouchedRef.current = false;
    }
  }, [isDraftDirty]);

  const openAdvancedModal = useCallback((task = null) => {
    if (task?.read_only) return;
    setModalTask(task);
    setModalOpen(true);
  }, []);

  const handleModalClose = () => {
    setModalOpen(false);
    setModalTask(null);
  };

  const handleTaskSaved = (savedTask) => {
    handleModalClose();
    if (savedTask?.id) {
      setSelectedTaskID(savedTask.id);
    }
  };

  const listLabels = useMemo(() => ({
    priorityHigh: t('task.priorityHigh'),
    priorityMedium: t('task.priorityMedium'),
    priorityLow: t('task.priorityLow'),
    priorityHighShort: i18n.language === 'zh-CN' ? '高' : 'High',
    priorityMediumShort: i18n.language === 'zh-CN' ? '中' : 'Medium',
    priorityLowShort: i18n.language === 'zh-CN' ? '低' : 'Low',
    statusCancelled: t('task.statusCancelled'),
    markPending: t('task.markPending'),
  }), [i18n.language, t]);

  const handleSelectTask = useCallback(async (task) => {
    if (task?.virtual_occurrence) {
      const sourceTaskID = Number(task?.source_task_id || task?.task_id || 0);
      if (!sourceTaskID) return;
      openAdvancedModal({
        ...task,
        id: sourceTaskID,
        source_task_id: sourceTaskID,
      });
      return;
    }
    const nextTaskID = Number(task?.id || 0);
    if (!nextTaskID) return;
    const requestID = switchTaskRequestRef.current + 1;
    switchTaskRequestRef.current = requestID;
    const currentTaskID = Number(selectedTaskSnapshotRef.current?.id || 0);
    const currentTaskSnapshot = selectedTaskSnapshotRef.current;
    let currentDraftSnapshot = draftSnapshotRef.current;
    const currentDraftSourceTaskID = Number(draftSourceTaskIDRef.current || 0);
    if (
      currentTaskID > 0
      && nextTaskID !== currentTaskID
      && currentDraftSnapshot
      && currentDraftSourceTaskID === currentTaskID
    ) {
      const liveDescription = String(draftDescriptionEditorRef.current?.getValue?.() || '');
      const draftDescription = String(currentDraftSnapshot.description || '');
      if (liveDescription !== draftDescription) {
        currentDraftSnapshot = {
          ...currentDraftSnapshot,
          description: liveDescription,
        };
      }
    }
    if (currentTaskID > 0 && nextTaskID === currentTaskID) {
      if (isMobileViewport) {
        openAdvancedModal(task);
      }
      return;
    }
    if (currentTaskID > 0 && nextTaskID !== currentTaskID) {
      await flushDraftOnLeave('switch_task', {
        taskValue: currentTaskSnapshot,
        draftValue: currentDraftSnapshot,
        draftSourceTaskID: currentDraftSourceTaskID,
      });
    }
    if (requestID !== switchTaskRequestRef.current) {
      return;
    }
    const nextDraftSnapshot = buildDraftFromTask(task);
    draftSourceTaskIDRef.current = nextTaskID;
    draftTouchedRef.current = false;
    draftEditVersionRef.current = 0;
    activeRenderTaskIDRef.current = nextTaskID;
    setDraftWithSnapshot(nextDraftSnapshot);
    setDraftTimeRangeEnabled(!!nextDraftSnapshot?.end_time);
    setDraftTimeRangeEditing('start');
    setDraftTimeCalendarMode('solar');
    setShowActivityPanel(false);
    detailPanelSnapshotRef.current = null;
    setDetailPanel('');
    setSelectedTaskID(nextTaskID);
    if (isMobileViewport) {
      openAdvancedModal(task);
    }
  }, [buildDraftFromTask, flushDraftOnLeave, isMobileViewport, openAdvancedModal, setDraftWithSnapshot]);

  const canQuickCreate = view !== 'completed' && view !== 'deleted' && view !== 'search';
  const canShowSortGroup = filteredTasks.length > 0 || view === 'search' || view === 'all' || view === 'today' || view === 'upcoming';
  const sortOptions = [
    { value: 'due_asc', label: t('task.sortDueAsc') },
    { value: 'due_desc', label: t('task.sortDueDesc') },
    { value: 'priority_desc', label: t('task.sortPriorityDesc') },
    { value: 'priority_asc', label: t('task.sortPriorityAsc') },
  ];
  const groupOptions = [
    { value: 'none', label: t('task.groupNone') },
    { value: 'due', label: t('task.groupDueDate') },
    { value: 'priority', label: t('task.groupPriority') },
    ...(canGroupByCategory ? [{ value: 'category', label: t('task.groupCategory') }] : []),
  ];
  const listGroupOptions = view === 'search' ? [{ value: 'status', label: t('task.groupStatus') }] : groupOptions;
  const showMobileSearchBar = isCompactMobile && view === 'search';
  const showListHeader = !isCompactMobile || showMobileSearchBar;

  return (
    <div className="md-page h-full">
      <div className="grid h-full grid-cols-1 gap-0 lg:grid-cols-[minmax(460px,0.95fr)_minmax(360px,1.05fr)]">
        <section className="md-pane flex h-full min-h-0 flex-col">
          {showListHeader && (
            <div className="border-b border-blue-100 px-3 py-2.5">
              <div className="flex min-h-[36px] items-center justify-end gap-2 md:gap-3">
                <div className="hidden min-w-0 md:block md:flex-none">
                  <h2 className="truncate text-sm font-semibold text-slate-800 md:text-base">{viewTitle}</h2>
                  <p className="text-xs text-slate-500">{t('task.taskCount', { count: filteredTasks.length })}</p>
                </div>
                <div className="flex min-w-0 items-center gap-2 md:flex-1">
                  {view === 'search' && (
                    <div className="md-input-row flex-1">
                      <IconSearch className="h-4 w-4 text-slate-400" />
                      <input
                        value={searchKeyword}
                        onChange={(event) => setSearchKeyword(event.target.value)}
                        placeholder={t('task.searchPlaceholder')}
                        className="w-full border-none bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  )}
                  {canQuickCreate && (
                    <div className="md-input-row hidden flex-1 md:flex">
                      <IconSearch className="h-4 w-4 text-slate-400" />
                      <input
                        value={quickTitle}
                        onChange={(event) => setQuickTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleQuickCreate();
                          }
                        }}
                        placeholder={t('task.quickAddPlaceholder')}
                        className="w-full border-none bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  )}
                  {canShowSortGroup && !isCompactMobile && (
                    <div ref={listToolbarPanelRef} className="relative flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setListToolbarPanel(listToolbarPanel === 'sort' ? '' : 'sort')}
                        className={`md-icon-btn text-sm ${
                          listToolbarPanel === 'sort'
                            ? 'bg-sky-50 text-sky-700'
                            : 'text-slate-500'
                        }`}
                        title={t('common.filter')}
                      >
                        <IconSort className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setListToolbarPanel(listToolbarPanel === 'group' ? '' : 'group')}
                        className={`md-icon-btn text-sm ${
                          listToolbarPanel === 'group' || effectiveGroupBy !== 'none'
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-slate-500'
                        }`}
                        title={t('task.groupNone')}
                      >
                        <IconGroup className="h-4 w-4" />
                      </button>

                      {listToolbarPanel === 'sort' && (
                        <div className="md-popover absolute right-0 top-10 z-20 w-52">
                          <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            {t('common.filter')}
                          </div>
                          <div className="space-y-1">
                            {sortOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setSortBy(option.value);
                                  setListToolbarPanel('');
                                }}
                                className={`w-full rounded-md px-2 py-1.5 text-left text-xs ${
                                  sortBy === option.value
                                    ? 'bg-sky-50 text-sky-700'
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {listToolbarPanel === 'group' && (
                        <div className="md-popover absolute right-0 top-10 z-20 w-52">
                          <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            {t('task.groupNone')}
                          </div>
                          <div className="space-y-1">
                            {listGroupOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setGroupBy(option.value);
                                  setListToolbarPanel('');
                                }}
                                className={`w-full rounded-md px-2 py-1.5 text-left text-xs ${
                                  effectiveGroupBy === option.value
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (canQuickCreate && quickTitle.trim()) {
                        handleQuickCreate();
                        return;
                      }
                      openAdvancedModal(null);
                    }}
                    className="btn-primary hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg px-0 py-0 text-base md:inline-flex"
                    title={t('task.newTask')}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto p-1.5 md:p-2">
            {loading ? (
              <div className="py-8 text-center text-slate-500">{t('common.loading')}</div>
            ) : filteredTasks.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                <p>{view === 'search' ? t('task.searchNoResults') : t('task.noTasks')}</p>
                <p className="mt-2 text-sm">{view === 'search' ? t('task.searchHint') : t('task.createFirst')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {taskGroups.map((group) => (
                  <div key={group.key} className="space-y-1">
                    {group.title ? (
                      <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {group.title} · {group.tasks.length}
                      </div>
                    ) : null}
                    <div className="space-y-1">
                      {group.tasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          selected={selectedTaskID === task.id}
                          timezone={timezone}
                          labels={listLabels}
                          showLunar={i18n.language === 'zh-CN'}
                          onSelectTask={handleSelectTask}
                          onToggleStatus={handleStatusChange}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isCompactMobile && (
            <div ref={listToolbarPanelRef} className="fixed bottom-20 right-3 z-30 flex flex-col items-end gap-2 md:hidden">
              {listToolbarPanel === 'sort' && (
                <div className="md-popover w-52">
                  <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {t('common.filter')}
                  </div>
                  <div className="space-y-1">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setSortBy(option.value);
                          setListToolbarPanel('');
                        }}
                        className={`w-full rounded-md px-2 py-1.5 text-left text-xs ${
                          sortBy === option.value
                            ? 'bg-sky-50 text-sky-700'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {listToolbarPanel === 'group' && (
                <div className="md-popover w-52">
                  <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {t('task.groupNone')}
                  </div>
                  <div className="space-y-1">
                    {listGroupOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setGroupBy(option.value);
                          setListToolbarPanel('');
                        }}
                        className={`w-full rounded-md px-2 py-1.5 text-left text-xs ${
                          effectiveGroupBy === option.value
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {canShowSortGroup && (
                <>
                  <button
                    type="button"
                    onClick={() => setListToolbarPanel(listToolbarPanel === 'group' ? '' : 'group')}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-blue-100 bg-white shadow-sm ${
                      listToolbarPanel === 'group' || effectiveGroupBy !== 'none'
                        ? 'text-indigo-700 ring-2 ring-indigo-100'
                        : 'text-slate-600'
                    }`}
                    title={t('task.groupNone')}
                  >
                    <IconGroup className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setListToolbarPanel(listToolbarPanel === 'sort' ? '' : 'sort')}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-blue-100 bg-white shadow-sm ${
                      listToolbarPanel === 'sort'
                        ? 'text-sky-700 ring-2 ring-sky-100'
                        : 'text-slate-600'
                    }`}
                    title={t('common.filter')}
                  >
                    <IconSort className="h-4 w-4" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => openAdvancedModal(null)}
                className="btn-primary inline-flex h-11 w-11 items-center justify-center rounded-full px-0 py-0 text-lg shadow-sm"
                title={t('task.newTask')}
              >
                +
              </button>
            </div>
          )}
        </section>

        <section className="md-pane hidden h-full min-h-0 flex-col lg:flex lg:border-l lg:border-blue-100">
          {!selectedTask || !draft ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              {t('task.selectTaskHint')}
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-blue-100 px-3 py-2.5">
                <div className="px-1 py-0.5">
                  <input
                    ref={draftTitleInputRef}
                    value={draft.title}
                    onChange={(e) => {
                      setDraftParsePreview('');
                      handleDraftFieldChange('title', e.target.value);
                    }}
                    onBlur={(e) => {
                      const rawTitle = String(e.target.value || '');
                      const parsedPriority = parsePriorityFromTitle(rawTitle);
                      const priorityNormalizedTitle = typeof parsedPriority?.cleanedTitle === 'string'
                        ? parsedPriority.cleanedTitle
                        : rawTitle;
                      if (Number.isInteger(parsedPriority?.priority)) {
                        handleDraftFieldChange('priority', String(parsedPriority.priority));
                      }
                      const parsed = parseNaturalTimeFromTitle(
                        priorityNormalizedTitle,
                        timezone,
                        getNaturalTimeOptionsFromUser((() => {
                          try {
                            return JSON.parse(localStorage.getItem('user') || '{}');
                          } catch {
                            return {};
                          }
                        })())
                      );
                      if (!parsed) {
                        if (priorityNormalizedTitle !== rawTitle) {
                          handleDraftFieldChange('title', priorityNormalizedTitle);
                        }
                        setDraftParsePreview('');
                        return;
                      }
                      const cleanedTitle = parsed.cleanedTitle || priorityNormalizedTitle;
                      if (cleanedTitle !== rawTitle) {
                        handleDraftFieldChange('title', cleanedTitle);
                      }
                      setDraftParsePreview(`${t('task.timeParsedHint')}: ${parsed.parsedAtDisplay}`);
                    }}
                    className="w-full rounded-md border-none bg-transparent px-1 text-lg font-semibold text-slate-900 outline-none transition-colors placeholder:text-slate-300 focus:bg-slate-50 sm:text-xl"
                    placeholder={t('task.title')}
                  />
                </div>
                <div className="mt-2 flex min-h-[36px] items-center justify-between gap-3">
                  <div className="order-2 flex items-center justify-end gap-2 text-xs">
                    {selectedTask.read_only && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">CalDAV Read-only</span>
                    )}
                  </div>
                  <div ref={detailPanelRef} className="order-1 relative flex min-w-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (isDetailPanelRequiringConfirm(detailPanel)) {
                          closeDetailPanelWithConfirm(detailPanel, false);
                        } else {
                          setDetailPanel('');
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
                    {showActivityPanel && selectedTask && (
                      <div className="absolute left-0 top-10 z-20 w-[30rem] max-w-[min(30rem,calc(100vw-3rem))]">
                        <TaskActivityTimeline taskID={selectedTask.id} />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDetailPanelToggle('priority')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${draftPriorityButtonClass}`}
                      title={draftPriorityTitle}
                    >
                      <IconFlag className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDetailPanelToggle('category')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${draftCategoryButtonClass}`}
                      title={draftCategorySummaryLabel}
                    >
                      <IconTag className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDetailPanelToggle('recurrence')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${draftRecurrenceButtonClass}`}
                      title={draftRecurrenceSummaryLabel}
                    >
                      {(draft.recurrence_enabled || detailPanel === 'recurrence')
                        ? <IconRepeat className="h-4 w-4" />
                        : <IconRepeatOff className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDetailPanelToggle('time')}
                      className={`relative inline-flex h-8 min-w-0 items-center gap-1 rounded-md px-2 text-sm ${draftTimeButtonClass}`}
                      title={draftTimeButtonTitle}
                    >
                      <IconClock className="h-4 w-4" />
                      <span className="max-w-[11.5rem] truncate text-left text-[11px] leading-4">{draftTimeSummaryLabel}</span>
                      {hasDraftParsedTimeHint && (
                        <span className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
                      )}
                    </button>
                    {detailPanel === 'priority' && (
                      <div className="md-popover absolute right-0 top-10 z-20 w-[22rem] p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('task.priority')}</div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { value: '1', label: t('task.priorityHigh') },
                            { value: '0', label: t('task.priorityMedium') },
                            { value: '-1', label: t('task.priorityLow') },
                          ].map((priorityOption) => (
                            <button
                              key={priorityOption.value}
                              type="button"
                              onClick={() => {
                                handleDraftFieldChange('priority', priorityOption.value, {
                                  submitNow: true,
                                  submitSource: 'realtime_priority',
                                });
                                setDetailPanel('');
                              }}
                              className={`rounded-full border px-3 py-1 text-sm ${
                                draft.priority === priorityOption.value
                                  ? getPriorityBadge(priorityOption.value).className
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {priorityOption.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {detailPanel === 'time' && (
                      <div className="time-panel-card md-popover absolute right-0 top-10 z-20 w-[min(24.5rem,calc(100vw-1rem))] max-h-[calc(100vh-7rem)] overflow-y-auto p-2.5">
                        <div className="time-panel-toolbar mb-2 space-y-1.5 border-b border-slate-100 pb-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setDraftTimeRangeEnabled(false);
                                  setDraftTimeRangeEditing('start');
                                  handleDraftFieldChange('end_time', '');
                                }}
                                className={`rounded-full px-2 py-1 text-[11px] ${
                                  !draftTimeRangeEnabled
                                    ? 'bg-sky-100 text-sky-700'
                                    : 'text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                {t('task.timePoint')}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDraftTimeRangeEnabled(true);
                                  setDraftTimeRangeEditing('end');
                                  const timezoneName = getUserTimezone();
                                  const currentStart = String(draft.start_time || '');
                                  const currentEnd = String(draft.end_time || '');
                                  if (draft.all_day) {
                                    if (!currentStart) {
                                      const today = dayjs().tz(timezoneName).format('YYYY-MM-DD');
                                      handleDraftFieldChange('start_time', today);
                                      handleDraftFieldChange('end_time', today);
                                    } else if (!currentEnd) {
                                      handleDraftFieldChange('end_time', currentStart);
                                    }
                                    return;
                                  }
                                  if (!currentStart && !currentEnd) {
                                    const range = buildDraftDefaultRangeAroundNow(timezoneName);
                                    handleDraftFieldChange('start_time', range.start);
                                    handleDraftFieldChange('end_time', range.end);
                                    return;
                                  }
                                  if (currentStart && !currentEnd) {
                                    const nextEnd = buildEndFromStartLocal(currentStart, 60) || currentStart;
                                    handleDraftFieldChange('end_time', nextEnd);
                                  } else if (!currentStart && currentEnd) {
                                    const range = buildDraftDefaultRangeAroundNow(timezoneName);
                                    handleDraftFieldChange('start_time', range.start);
                                    handleDraftFieldChange('end_time', coerceEndNotBeforeStartLocal(range.start, currentEnd));
                                  }
                                }}
                                className={`rounded-full px-2 py-1 text-[11px] ${
                                  draftTimeRangeEnabled
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
                                onClick={() => setDraftTimeCalendarMode('solar')}
                                className={`rounded-full px-2 py-1 text-[11px] ${
                                  draftTimeCalendarMode === 'solar'
                                    ? 'bg-sky-100 text-sky-700'
                                    : 'text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                {t('task.calendarSolar')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDraftTimeCalendarMode('lunar')}
                                className={`rounded-full px-2 py-1 text-[11px] ${
                                  draftTimeCalendarMode === 'lunar'
                                    ? 'bg-sky-100 text-sky-700'
                                    : 'text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                {t('task.calendarLunar')}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDraftFieldChange('all_day', !draft.all_day)}
                              className={`rounded-full border px-2 py-1 text-[11px] ${
                                draft.all_day
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
                            {draftTimeRangeEnabled && (
                              <div className="mb-1 inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5">
                                <button
                                  type="button"
                                  onClick={() => setDraftTimeRangeEditing('start')}
                                  className={`rounded-full px-2 py-1 text-[11px] ${
                                    draftTimeRangeEditing === 'start'
                                      ? 'bg-sky-100 text-sky-700'
                                      : 'text-slate-500 hover:bg-slate-50'
                                  }`}
                                >
                                  {t('task.startTime')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDraftTimeRangeEditing('end')}
                                  className={`rounded-full px-2 py-1 text-[11px] ${
                                    draftTimeRangeEditing === 'end'
                                      ? 'bg-sky-100 text-sky-700'
                                      : 'text-slate-500 hover:bg-slate-50'
                                  }`}
                                >
                                  {t('task.endTime')}
                                </button>
                              </div>
                            )}
                            <TaskDatePicker
                              key={`draft-time-${draftTimeCalendarMode}-${draftTimeRangeEnabled ? draftTimeRangeEditing : 'point'}-${draft.all_day ? 'all' : 'timed'}`}
                              value={draft.all_day
                                ? splitDatePart((draftTimeRangeEnabled && draftTimeRangeEditing === 'end') ? draft.end_time : draft.start_time)
                                : ((draftTimeRangeEnabled && draftTimeRangeEditing === 'end') ? (draft.end_time || '') : (draft.start_time || ''))}
                              allDay={!!draft.all_day}
                              stepMinutes={30}
                              inline
                              lunarOverlay
                              lunarMode={draftTimeCalendarMode === 'lunar'}
                              onChange={(nextValue) => {
                                if (draftTimeRangeEnabled && draftTimeRangeEditing === 'end') {
                                  handleDraftEndDateTimeChange(nextValue);
                                  return;
                                }
                                handleDraftStartDateTimeChange(nextValue);
                              }}
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                          <button
                            type="button"
                            onClick={() => closeDetailPanelWithConfirm('time', false)}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            {t('common.cancel')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              closeDetailPanelWithConfirm('time', true);
                              submitDraftImmediately('realtime_time');
                            }}
                            className="rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
                          >
                            {t('common.confirm')}
                          </button>
                        </div>
                      </div>
                    )}

                    {detailPanel === 'category' && (
                      <div className="md-popover absolute right-0 top-10 z-20 w-[26rem] p-3">
                        <label className="form-label">{t('task.categories')}</label>
                        <div className="flex flex-wrap gap-2">
                          {categories.map((cat) => {
                            const active = draft.category_ids.includes(String(cat.id));
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  toggleDraftCategory(cat.id);
                                  setDetailPanel('');
                                }}
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                                  active ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {showCategoryEmoji && cat.emoji ? (
                                  <span>{cat.emoji}</span>
                                ) : (
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color || '#94a3b8' }} />
                                )}
                                <span>{cat.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {detailPanel === 'recurrence' && (
                      <div className="md-popover absolute right-0 top-10 z-20 w-[24rem] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <label className="text-sm font-medium text-slate-700">{t('task.repeat')}</label>
                          <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
                            <button
                              type="button"
                              onClick={() => {
                                handleDraftFieldChange('recurrence_enabled', false);
                                handleDraftFieldChange('recurrence_type', 'daily');
                                handleDraftFieldChange('recurrence_days', []);
                                handleDraftFieldChange('recurrence_date', 1);
                              }}
                              className={`rounded-full px-2.5 py-1 text-xs ${
                                !draft.recurrence_enabled
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              {t('task.repeatOff')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleDraftFieldChange('recurrence_enabled', true);
                                if (
                                  ((draft.recurrence_type || 'daily') === 'weekly'
                                    || (draft.recurrence_type || 'daily') === 'biweekly')
                                  && (draft.recurrence_days || []).length === 0
                                ) {
                                  handleDraftFieldChange('recurrence_days', workDayKeys);
                                }
                              }}
                              className={`rounded-full px-2.5 py-1 text-xs ${
                                draft.recurrence_enabled
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              {t('task.repeatOn')}
                            </button>
                          </div>
                        </div>

                        {draft.recurrence_enabled && (
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
                                    handleDraftFieldChange('recurrence_type', option.value);
                                    setShowDraftCustomRecurrenceMenu(false);
                                    if ((option.value === 'weekly' || option.value === 'biweekly') && (draft.recurrence_days || []).length === 0) {
                                      handleDraftFieldChange('recurrence_days', workDayKeys);
                                    }
                                    if (option.value !== 'weekly' && option.value !== 'biweekly') {
                                      handleDraftFieldChange('recurrence_days', []);
                                    }
                                    if (option.value === 'monthly') {
                                      const start = parseLocalInput(draft.start_time || '');
                                      if (start) {
                                        handleDraftFieldChange('recurrence_date', clampMonthlyDate(start.date(), 1));
                                      }
                                    }
                                  }}
                                  className={`rounded-full border px-3 py-1 text-xs ${
                                    (draft.recurrence_type || 'daily') === option.value
                                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => setShowDraftCustomRecurrenceMenu((prev) => !prev)}
                                className={`rounded-full border px-3 py-1 text-xs ${
                                  isDraftCustomRecurrenceType || showDraftCustomRecurrenceMenu
                                    ? 'border-sky-300 bg-sky-50 text-sky-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {t('task.customRepeat')}
                              </button>
                            </div>
                            {(showDraftCustomRecurrenceMenu || isDraftCustomRecurrenceType) && (
                              <div className="space-y-2 rounded-xl border border-sky-100 bg-sky-50/40 p-2.5">
                                <div className="text-[11px] font-medium uppercase tracking-wide text-sky-700">{t('task.customRepeat')}</div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDraftFieldChange('recurrence_type', 'biweekly');
                                      if ((draft.recurrence_days || []).length === 0) {
                                        handleDraftFieldChange('recurrence_days', workDayKeys);
                                      }
                                    }}
                                    className={`rounded-full border px-3 py-1 text-xs ${
                                      (draft.recurrence_type || 'daily') === 'biweekly'
                                        ? 'border-sky-300 bg-sky-100 text-sky-800'
                                        : 'border-sky-200 bg-white text-sky-700 hover:bg-sky-100/60'
                                    }`}
                                  >
                                    {t('task.biweekly')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDraftFieldChange('recurrence_type', 'lunar');
                                      handleDraftFieldChange('recurrence_days', []);
                                      const fallback = parseLunarYearlyRule(
                                        { freq: 'lunar_yearly' },
                                        draft.start_time || getDefaultStartInputValue(timezone),
                                      ) || {
                                        year: dayjs().tz(LUNAR_TIMEZONE).year(),
                                        month: 1,
                                        day: 1,
                                        isLeapMonth: false,
                                      };
                                      setDraftRecurrenceLunarYear(fallback.year);
                                      handleDraftFieldChange('recurrence_lunar_month', fallback.month);
                                      handleDraftFieldChange('recurrence_lunar_day', fallback.day);
                                      handleDraftFieldChange('recurrence_lunar_is_leap_month', fallback.isLeapMonth);
                                    }}
                                    className={`rounded-full border px-3 py-1 text-xs ${
                                      (draft.recurrence_type || 'daily') === 'lunar'
                                        ? 'border-sky-300 bg-sky-100 text-sky-800'
                                        : 'border-sky-200 bg-white text-sky-700 hover:bg-sky-100/60'
                                    }`}
                                  >
                                    {t('task.lunarYearly')}
                                  </button>
                                </div>
                              </div>
                            )}

                            {(draft.recurrence_type || 'daily') === 'lunar' && (
                              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-2.5">
                                <div className="text-xs font-medium text-slate-700">{t('task.lunarYearly')}</div>
                                <TaskDatePicker
                                  value={draftRecurrenceLunarPickerDate}
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
                                    setDraftRecurrenceLunarYear(nextSelection.year);
                                    handleDraftFieldChange('recurrence_lunar_month', nextSelection.month);
                                    handleDraftFieldChange('recurrence_lunar_day', nextSelection.day);
                                    handleDraftFieldChange('recurrence_lunar_is_leap_month', nextSelection.isLeapMonth);
                                  }}
                                />
                                <div className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
                                  {`${t('task.lunarYearly')} ${draft.recurrence_lunar_is_leap_month ? t('task.lunarLeapPrefix') : ''}${Number.parseInt(draft.recurrence_lunar_month, 10) || 1}/${Number.parseInt(draft.recurrence_lunar_day, 10) || 1}`}
                                </div>
                              </div>
                            )}

                            {((draft.recurrence_type || 'daily') === 'weekly' || (draft.recurrence_type || 'daily') === 'biweekly') && (
                              <div>
                                <p className="mb-2 text-sm text-slate-600">{t('task.selectWeekdays')}</p>
                                <div className="mb-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDraftFieldChange('recurrence_days', workDayKeys)}
                                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                                  >
                                    {t('task.weekdaysWorkdays')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDraftFieldChange('recurrence_days', allDayKeys)}
                                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                                  >
                                    {t('task.weekdaysAll')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDraftFieldChange('recurrence_days', [])}
                                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
                                  >
                                    {t('task.weekdaysClear')}
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {weekDays.map((day) => (
                                    <button
                                      key={day.key}
                                      type="button"
                                      onClick={() => toggleDraftRecurrenceDay(day.key)}
                                      className={`rounded-full px-3 py-1 text-sm ${
                                        (draft.recurrence_days || []).includes(day.key)
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
                            {(draft.recurrence_type || 'daily') === 'monthly' && (
                              <div className="space-y-2">
                                <button
                                  type="button"
                                  onClick={() => setShowDraftMonthlyDatePicker((prev) => !prev)}
                                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  <span>{t('task.monthlyOnDate')}</span>
                                  <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700">
                                    {clampMonthlyDate(draft.recurrence_date, 1)}
                                  </span>
                                </button>
                                {showDraftMonthlyDatePicker && (
                                  <div className="rounded-xl border border-slate-200 bg-white p-2">
                                    <div className="grid grid-cols-7 gap-1">
                                      {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => {
                                        const active = clampMonthlyDate(draft.recurrence_date, 1) === day;
                                        return (
                                          <button
                                            key={day}
                                            type="button"
                                            onClick={() => {
                                              handleDraftFieldChange('recurrence_date', day);
                                              setShowDraftMonthlyDatePicker(false);
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
                            onClick={() => closeDetailPanelWithConfirm('recurrence', false)}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            {t('common.cancel')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              closeDetailPanelWithConfirm('recurrence', true);
                              submitDraftImmediately('realtime_recurrence');
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
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3">
                <div
                  className="flex min-h-0 min-w-0 flex-1 cursor-text flex-col overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-colors focus-within:border-blue-200 focus-within:bg-blue-50/20"
                  onClick={() => draftDescriptionEditorRef.current?.focus()}
                >
                  <label className="mb-1 block cursor-text text-xs font-medium text-slate-500">{t('task.description')}</label>
                  <LiveMarkdownEditor
                    ref={draftDescriptionEditorRef}
                    key={`task-editor-${selectedTask.id}`}
                    value={draft.description}
                    onChange={(nextValue) => handleDraftFieldChange('description', nextValue)}
                    onSaveShortcut={handleDraftEditorSaveShortcut}
                    placeholder={t('task.description')}
                    className="min-h-0 min-w-0 flex-1 overflow-hidden"
                    fill
                    minHeight={280}
                  />
                </div>
              </div>

              <div className="flex items-center justify-start border-t border-blue-100 px-4 py-3">
                <button onClick={handleDeleteSelected} className="btn-danger text-sm">
                  {t('common.delete')}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {deleteDialog.open && (
        <div
          className="fixed inset-0 z-[70] bg-black/35"
          onClick={() => {
            closeDeleteDialog();
          }}
        >
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-slate-200 bg-white px-4 pb-4 pt-3 shadow-2xl md:bottom-auto md:left-1/2 md:top-1/2 md:w-[min(28rem,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 md:hidden" />
            <h3 className="text-base font-semibold text-slate-900">
              {deleteDialog.kind === DELETE_DIALOG_KIND_RECURRING_CHOICE || deleteDialog.kind === DELETE_DIALOG_KIND_RECURRING_SERIES
                ? t('task.deleteRecurringDialogTitle')
                : t('task.deleteDialogTitle')}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {deleteDialog.kind === DELETE_DIALOG_KIND_RECURRING_CHOICE
                ? t('task.deleteRecurringDialogHint')
                : deleteDialog.kind === DELETE_DIALOG_KIND_RECURRING_SERIES
                  ? t('task.deleteRecurringSeriesDialogHint')
                  : t('task.deleteConfirm')}
            </p>

            {deleteDialog.kind === DELETE_DIALOG_KIND_RECURRING_CHOICE ? (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  disabled={deleteDialogSubmitting}
                  onClick={() => {
                    void executeDeleteAction('single');
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteDialogSubmitting ? t('task.submitting') : t('task.deleteOnlyThis')}
                </button>
                <button
                  type="button"
                  disabled={deleteDialogSubmitting}
                  onClick={() => {
                    void executeDeleteAction('series');
                  }}
                  className="w-full rounded-xl bg-rose-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteDialogSubmitting ? t('task.submitting') : t('task.deleteAllSeries')}
                </button>
                <button
                  type="button"
                  disabled={deleteDialogSubmitting}
                  onClick={() => {
                    closeDeleteDialog();
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={deleteDialogSubmitting}
                  onClick={() => {
                    closeDeleteDialog();
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={deleteDialogSubmitting}
                  onClick={() => {
                    if (deleteDialog.kind === DELETE_DIALOG_KIND_RECURRING_SERIES) {
                      void executeDeleteAction('series');
                      return;
                    }
                    void executeDeleteAction('task');
                  }}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteDialogSubmitting ? t('task.submitting') : t('common.delete')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {modalOpen && <TaskModal task={modalTask} onClose={handleModalClose} onSaved={handleTaskSaved} />}
    </div>
  );
}

export default TaskList;
