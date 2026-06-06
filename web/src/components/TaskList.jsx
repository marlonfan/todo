import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react';
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
  IconCheck,
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
import TaskDescriptionAI from './TaskDescriptionAI';
import TaskDatePicker from './TaskDatePicker';
import TaskActivityTimeline from './TaskActivityTimeline';
import { attachTransientScrollbar } from '../hooks/useTransientScrollbars';
import {
  getTaskPrimaryLocalTime,
  getTaskPrimaryTime,
  isTaskOverdue,
  shouldIncludeTaskInTodayView,
  shouldIncludeTaskInUpcomingView,
} from './taskListOverdue';
import { isTaskUnsyncedLocally } from './taskListRecurringVisibility';
import {
  buildNextPendingFromProjectedTask,
  hasOptimisticOccurrenceStatusForTask,
  upsertProjectedNextOccurrence,
} from './taskListRecurringProjection';
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
import { Button } from './ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/DropdownMenu';

const WEEKDAY_ONLY_RE = /^(MO|TU|WE|TH|FR|SA|SU)$/;
const ORDINAL_WEEKDAY_RE = /^(-?\d)(MO|TU|WE|TH|FR|SA|SU)$/;
const DRAFT_IDLE_SUBMIT_MS = 3000;
const DRAFT_TEXT_AUTOSAVE_MS = 2500;
const DRAFT_DESCRIPTION_RENDER_DELAY_MS = 120;
const DEFAULT_WORKDAY_KEYS = ['MO', 'TU', 'WE', 'TH', 'FR'];
const OCCURRENCE_STATUS_OPTIMISTIC_TTL_MS = 5 * 60 * 1000;
const RECURRING_SEARCH_STATUSES = 'pending,completed,cancelled,skipped';
const DELETE_DIALOG_KIND_RECURRING_CHOICE = 'recurring-choice';
const DELETE_DIALOG_KIND_RECURRING_SERIES = 'recurring-series';
const DELETE_DIALOG_KIND_TASK = 'task';
const DETAIL_PANELS_REQUIRING_CONFIRM = new Set(['time', 'recurrence']);
const DETAIL_PANEL_FLOATING_WIDTH_REMS = {
  activity: 30,
  priority: 12.25,
  category: 14.75,
  recurrence: 18.25,
};
const TASK_DETAIL_SPLIT_MIN_WIDTH = 800;
const TASK_SPLIT_STORAGE_KEY = 'todo:taskListDetailSplitRatio';
const TASK_SPLIT_DEFAULT_RATIO = 0.55;
const TASK_SPLIT_MIN_LIST_WIDTH = 320;
const TASK_SPLIT_MIN_DETAIL_WIDTH = 340;
const TASK_SPLIT_DIVIDER_WIDTH = 8;
const TASK_SPLIT_KEYBOARD_STEP = 0.03;
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

function clampNumber(value, min, max) {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Math.max(safeMin, Number.isFinite(max) ? max : safeMin);
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return safeMin;
  return Math.min(Math.max(parsed, safeMin), safeMax);
}

function readTaskSplitRatio() {
  if (typeof window === 'undefined') return TASK_SPLIT_DEFAULT_RATIO;
  const stored = window.localStorage?.getItem(TASK_SPLIT_STORAGE_KEY);
  return clampNumber(stored, 0.25, 0.75) || TASK_SPLIT_DEFAULT_RATIO;
}

function writeTaskSplitRatio(ratio) {
  if (typeof window === 'undefined') return;
  window.localStorage?.setItem(TASK_SPLIT_STORAGE_KEY, String(clampNumber(ratio, 0.25, 0.75).toFixed(4)));
}

function isDraftSwitchDebugEnabled() {
  if (typeof window === 'undefined') return false;
  return window.localStorage?.getItem('todo:draftDebug') === '1';
}

function summarizeDebugText(value) {
  const text = String(value ?? '');
  const preview = text.length > 120 ? `${text.slice(0, 120)}...` : text;
  return {
    length: text.length,
    preview,
    tail: text.slice(-40),
  };
}

let draftSwitchDebugSeq = 0;
function logDraftSwitchDebug(scope, payload = {}) {
  if (!isDraftSwitchDebugEnabled()) return;
  const entry = {
    seq: ++draftSwitchDebugSeq,
    scope,
    at: new Date().toISOString(),
    ms: typeof performance !== 'undefined' ? Math.round(performance.now()) : 0,
    ...payload,
  };
  console.info('[todo-draft-debug]', JSON.stringify(entry));
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
    target.closest('.md-popover')
    || target.closest('.task-time-selectbox-menu--floating')
    || target.closest('.react-datepicker-popper')
    || target.closest('.react-datepicker__portal')
  );
}

function shouldFocusDescriptionEditorFromShellClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return true;
  return !target.closest(
    'button, input, textarea, select, a, [contenteditable="true"], [role="button"], [role="menuitem"], .task-ai-description'
  );
}

function getDetailPanelFloatingStyle(triggerElement, panelName) {
  if (typeof window === 'undefined' || !triggerElement) return undefined;
  const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  const width = (DETAIL_PANEL_FLOATING_WIDTH_REMS[panelName] || 24) * rootFontSize;
  const rect = triggerElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth || width;
  const viewportHeight = window.innerHeight || 0;
  const margin = 12;
  const maxLeft = Math.max(margin, viewportWidth - width - margin);
  const left = Math.min(Math.max(rect.left, margin), maxLeft);
  const top = Math.min(
    Math.max(rect.bottom + 8, margin),
    Math.max(margin, viewportHeight - margin),
  );
  return {
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
  };
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

function formatDisplayDateWithYear(date, timezoneName) {
  if (!date) return '';
  const tz = timezoneName || getUserTimezone();
  const d = dayjs(date).tz(tz);
  if (!d.isValid()) return '';
  const currentYear = dayjs().tz(tz).year();
  // 如果日期年份与当前年份不同，显示年份
  if (d.year() !== currentYear) return d.format('YYYY/MM/DD');
  return d.format('MM/DD');
}

function lunarDateLabel(d, showYear = false) {
  try {
    const info = getLunarInfo(d.toDate());
    const yearLabel = showYear ? `${info.yearLabel} ` : '';
    return yearLabel + info.monthLabel + info.dayLabel;
  } catch {
    return showYear ? d.format('YYYY/MM/DD') : d.format('MM/DD');
  }
}

function buildTimeSummaryLabel(startInput, endInput, isAllDay, noDateLabel, lunarMode = false) {
  const start = parseLocalInput(startInput);
  const end = parseLocalInput(endInput);
  if (!start && !end) return noDateLabel;
  const currentYear = dayjs().year();
  const dateFmt = (d) => {
    if (lunarMode) {
      const showYear = d.year() !== currentYear;
      return lunarDateLabel(d, showYear);
    }
    // 如果日期年份与当前年份不同，显示年份
    if (d.year() !== currentYear) return d.format('YYYY/MM/DD');
    return d.format('MM/DD');
  };
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

function getTaskCompletedTime(task) {
  return task?.completed_at || task?.completedAt || '';
}

function getTaskDeletedTime(task) {
  return task?.deleted_at || task?.deletedAt || '';
}

function getTaskCreatedTime(task) {
  return task?.created_at || task?.createdAt || '';
}

function parseTaskTimeValue(value, timezone) {
  const parsed = dayjs(value || '');
  if (!parsed.isValid()) return Number.NEGATIVE_INFINITY;
  return timezone ? parsed.tz(timezone).valueOf() : parsed.valueOf();
}

function getCompletedSortTime(task, timezone) {
  return parseTaskTimeValue(
    getTaskCompletedTime(task) || (String(task?.status || '') === 'completed' ? task?.updated_at || task?.updatedAt || '' : ''),
    timezone,
  );
}

function getDeletedSortTime(task, timezone) {
  return parseTaskTimeValue(
    getTaskDeletedTime(task) || (String(task?.status || '') === 'cancelled' ? task?.updated_at || task?.updatedAt || '' : ''),
    timezone,
  );
}

function getCreatedSortTime(task, timezone) {
  return parseTaskTimeValue(getTaskCreatedTime(task), timezone);
}

function resolveTaskDisplayTime(task, timeMode) {
  if (timeMode === 'completed') {
    return getTaskCompletedTime(task) || (String(task?.status || '') === 'completed' ? task?.updated_at || task?.updatedAt || '' : '');
  }
  if (timeMode === 'deleted') {
    return getTaskDeletedTime(task) || (String(task?.status || '') === 'cancelled' ? task?.updated_at || task?.updatedAt || '' : '');
  }
  return getTaskPrimaryTime(task);
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
    const rawInstanceID = String(item?.instance_id || item?.instanceId || '').trim();
    const fallbackKey = `${taskID}_${occurrenceDate.replace(/-/g, '')}`;
    // 确保 instance_id 总是有值，用于实例级别的更新
    const instanceID = rawInstanceID || fallbackKey;
    const status = resolveOccurrenceStatusFromOptimisticMap(
      occurrenceStatusOptimisticMap,
      taskID,
      instanceID,
      occurrenceDate,
      timezone,
      String(item?.status || 'pending'),
    );
    const dedupeKey = instanceID;
    if (!dedupeKey || seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const baseTask = baseByID.get(taskID) || {};
    const eventPriority = Number.parseInt(item?.priority, 10);
    const priority = Number.isFinite(eventPriority)
      ? eventPriority
      : (Number.parseInt(baseTask?.priority, 10) || 0);
    const occurrenceDescription = typeof item?.description === 'string' ? item.description : '';
    const effectiveDescription = occurrenceDescription.trim() !== ''
      ? occurrenceDescription
      : String(baseTask?.description || '');
    list.push({
      ...baseTask,
      id: `occ_${dedupeKey}`,
      source_task_id: taskID,
      virtual_occurrence: true,
      title: String(item?.title || baseTask?.title || ''),
      description: effectiveDescription,
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
      created_at: item?.created_at || item?.createdAt || baseTask?.created_at || baseTask?.createdAt || '',
      completed_at: item?.completed_at || item?.completedAt || null,
      deleted_at: item?.deleted_at || item?.deletedAt || null,
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
    if (sortBy === 'completed_desc') {
      const va = getCompletedSortTime(a, timezone);
      const vb = getCompletedSortTime(b, timezone);
      if (va !== vb) return vb - va;
      return compareTasksStable(a, b);
    }
    if (sortBy === 'deleted_desc') {
      const va = getDeletedSortTime(a, timezone);
      const vb = getDeletedSortTime(b, timezone);
      if (va !== vb) return vb - va;
      return compareTasksStable(a, b);
    }
    if (sortBy === 'created_desc') {
      const va = getCreatedSortTime(a, timezone);
      const vb = getCreatedSortTime(b, timezone);
      if (va !== vb) return vb - va;
      return compareTasksStable(a, b);
    }
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

const SORT_OPTIONS_DEFAULT = new Set(['due_asc', 'due_desc', 'priority_desc', 'priority_asc']);
const SORT_OPTIONS_COMPLETED = new Set(['completed_desc', 'created_desc']);
const SORT_OPTIONS_DELETED = new Set(['deleted_desc', 'created_desc']);
const GROUP_OPTIONS = new Set(['none', 'due', 'priority', 'category', 'status']);

function resolveTaskListViewKey(view, categoryID) {
  if (Number.isInteger(categoryID) && categoryID > 0) return `category:${categoryID}`;
  return view || 'all';
}

function getDefaultSortValue(view) {
  if (view === 'completed') return 'completed_desc';
  if (view === 'deleted') return 'deleted_desc';
  return 'due_asc';
}

function getSortOptionSet(view) {
  if (view === 'completed') return SORT_OPTIONS_COMPLETED;
  if (view === 'deleted') return SORT_OPTIONS_DELETED;
  return SORT_OPTIONS_DEFAULT;
}

function sanitizeSortValue(value, view) {
  return getSortOptionSet(view).has(value) ? value : getDefaultSortValue(view);
}

function sanitizeGroupValue(value) {
  return GROUP_OPTIONS.has(value) ? value : 'none';
}

const TaskRow = React.memo(function TaskRow({
  task,
  selected,
  timezone,
  labels,
  timeMode,
  onBeforeSelectTask,
  onSelectTask,
  onToggleStatus,
}) {
  const isCompleted = task.status === 'completed';
  const isSkipped = task.status === 'skipped';
  const isDeleted = task.status === 'cancelled' || isSkipped;
  const isReadOnly = !!task.read_only;
  const priorityValue = Number.parseInt(task.priority, 10) || 0;
  const priority = priorityValue === 1
    ? { text: labels.priorityHighShort, title: labels.priorityHigh, className: 'text-rose-600' }
    : priorityValue === -1
      ? { text: labels.priorityLowShort, title: labels.priorityLow, className: 'text-emerald-600' }
      : { text: labels.priorityMediumShort, title: labels.priorityMedium, className: 'text-sky-600' };
  const displayTime = resolveTaskDisplayTime(task, timeMode);
  const overdue = timeMode === 'primary' && isTaskOverdue(task, timezone);
  const displayTimeLabel = formatDisplayDateWithYear(displayTime, timezone);

  return (
    <div
      key={task.id}
      data-testid="task-row"
      data-task-id={String(task.id)}
      draggable={!isReadOnly}
      onDragStart={(event) => {
        if (isReadOnly) return;
        event.dataTransfer.setData('text/task-id', String(task.id));
        event.dataTransfer.effectAllowed = 'move';
      }}
      onPointerDownCapture={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        logDraftSwitchDebug('taskRow.pointerDownCapture', {
          pointer_type: event.pointerType || '',
          row_task_id: task.id,
          row_task_title: task.title || '',
          row_selected: !!selected,
        });
        onBeforeSelectTask?.(task);
      }}
      onClick={() => {
        logDraftSwitchDebug('taskRow.click', {
          row_task_id: task.id,
          row_task_title: task.title || '',
          row_selected: !!selected,
        });
        onSelectTask(task);
      }}
      className={`group relative cursor-pointer border-b border-slate-100 px-3.5 py-2.5 transition-colors duration-150 last:border-b-0 md:px-4 md:py-3 ${
        selected
          ? 'bg-slate-100/70 md:rounded-md'
          : 'bg-white hover:bg-slate-50/80'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          data-testid="task-row-status-checkbox"
          aria-pressed={isCompleted}
          disabled={isDeleted || isReadOnly}
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus(task, isCompleted ? 'pending' : 'completed');
          }}
          className={`grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-colors ${
            isCompleted
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-slate-300 bg-white text-transparent hover:border-blue-500 hover:bg-blue-50'
          } disabled:cursor-not-allowed disabled:opacity-45`}
        >
          <span className="text-[10px] leading-none">✓</span>
        </button>
        <h3 className={`min-w-0 flex-1 truncate text-[0.94rem] leading-5 ${isCompleted || isDeleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
          {task.title}
        </h3>
        <div className="hidden shrink-0 items-center gap-2 text-xs sm:flex">
          {isReadOnly && (
            <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-slate-500">CalDAV</span>
          )}
          {isDeleted && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(task, 'pending');
              }}
              disabled={isReadOnly}
              className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700"
              title={labels.markPending}
            >
              ↺
            </button>
          )}
          {isDeleted && <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-slate-500">{isSkipped ? labels.statusSkipped : labels.statusCancelled}</span>}
          <span title={priority.title} className={priority.className}>{priority.text}</span>
          {task.categories?.slice(0, 2).map((cat) => (
            <span
              key={cat.id}
              className="inline-flex max-w-[6rem] items-center gap-1 rounded-sm px-1.5 py-0.5"
              style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
              <span className="truncate">{cat.name}</span>
            </span>
          ))}
          {task.categories?.length > 2 && (
            <span className="text-slate-400">+{task.categories.length - 2}</span>
          )}
          {displayTimeLabel && (
            <span className={overdue ? 'font-medium text-rose-600' : 'text-slate-400'}>
              {displayTimeLabel}
            </span>
          )}
        </div>
      </div>

      {/* Mobile: time and tags on second line */}
      <div className="mt-1 flex flex-wrap items-center gap-2 pl-6 text-xs text-slate-500 sm:hidden">
        {displayTimeLabel && (
          <span className={overdue ? 'font-medium text-rose-600' : 'text-slate-500'}>
            {displayTimeLabel}
          </span>
        )}
        {isDeleted && <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-slate-500">{isSkipped ? labels.statusSkipped : labels.statusCancelled}</span>}
        {isReadOnly && <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-slate-500">CalDAV</span>}
        <span title={priority.title} className={priority.className}>{priority.text}</span>
        {task.categories?.slice(0, 2).map((cat) => (
          <span
            key={cat.id}
            className="inline-flex max-w-[6rem] items-center gap-1 rounded-sm px-1.5 py-0.5"
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
  );
}, (prev, next) => (
  prev.task === next.task &&
  prev.selected === next.selected &&
  prev.timezone === next.timezone &&
  prev.labels === next.labels &&
  prev.timeMode === next.timeMode
));

export const TaskListView = React.memo(function TaskListView({ forcedView = '', routeLocation }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = routeLocation;
  const timezone = getUserTimezone();
  const timeGranularity = getUserTimeGranularity();
  const { data: tasksRaw = [], isLoading: tasksLoading } = useTasksQuery();
  const { data: categories = [] } = useCategoriesQuery();
  const [occurrenceStatusOptimisticMap, setOccurrenceStatusOptimisticMap] = useState({});
  const occurrenceStatusOptimisticMapRef = useRef(occurrenceStatusOptimisticMap);
  useEffect(() => {
    occurrenceStatusOptimisticMapRef.current = occurrenceStatusOptimisticMap;
  }, [occurrenceStatusOptimisticMap]);
  const searchModeActive = useMemo(() => {
    if (forcedView) return forcedView === 'search';
    if (location.pathname === '/search') return true;
    const params = new URLSearchParams(location.search);
    return (params.get('view') || '') === 'search';
  }, [forcedView, location.pathname, location.search]);
  const { data: recurringNextOccurrences = [] } = useQuery({
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
      const occurrenceDate = normalizeOccurrenceDate(
        item?.occurrence_date || item?.occurrenceDate || item?.original_date || item?.originalDate || start.toISOString(),
        timezone,
      ) || startLocal.format('YYYY-MM-DD');
      const rawInstanceID = String(item?.instance_id || item?.instanceId || '').trim();
      const fallbackKey = `${taskID}_${occurrenceDate.replace(/-/g, '')}`;
      const instanceID = rawInstanceID || fallbackKey;
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
        title: typeof item?.title === 'string' ? item.title : '',
        description: typeof item?.description === 'string' ? item.description : '',
        priority: item?.priority,
        createdAt: item?.created_at || item?.createdAt || '',
        completedAt: item?.completed_at || item?.completedAt || null,
        deletedAt: item?.deleted_at || item?.deletedAt || null,
        status,
        startLocal,
      });
    });
    return pool;
  }, [occurrenceStatusOptimisticMap, recurringNextOccurrences, timezone]);
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
      let nextPending = recurringNextPendingMap.get(taskID);
      if (!nextPending && hasOptimisticOccurrenceStatusForTask(occurrenceStatusOptimisticMap, taskID)) {
        nextPending = buildNextPendingFromProjectedTask({
          task,
          optimisticStatusMap: occurrenceStatusOptimisticMap,
          serverStatusMap: recurringServerStatusMap,
          timezone,
        });
      }
      if (!nextPending) {
        // Recurring base tasks are hidden from normal task details. Keep only local
        // unsynced series anchors until the server can generate occurrence rows.
        return isTaskUnsyncedLocally(task) ? [task] : [];
      }
      const eventPriority = Number.parseInt(nextPending.priority, 10);
      return [{
        ...task,
        id: `occ_${nextPending.instanceId}`,
        source_task_id: taskID,
        virtual_occurrence: true,
        title: String(nextPending.title || task?.title || ''),
        priority: Number.isFinite(eventPriority)
          ? eventPriority
          : (Number.parseInt(task?.priority, 10) || 0),
        start_time: nextPending.startISO,
        end_time: nextPending.endISO,
        instance_id: nextPending.instanceId,
        occurrence_date: nextPending.occurrenceDate,
        occurrence_start: nextPending.startISO,
        occurrence_end: nextPending.endISO,
        description: String(nextPending.description || '').trim() !== ''
          ? nextPending.description
          : String(task?.description || ''),
        status: nextPending.status,
        created_at: nextPending.createdAt || task?.created_at || task?.createdAt || '',
        completed_at: nextPending.completedAt,
        deleted_at: nextPending.deletedAt,
      }];
    });
  }, [occurrenceStatusOptimisticMap, recurringNextPendingMap, recurringServerStatusMap, tasksRaw, timezone]);

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
  const [isMobileViewport, setIsMobileViewport] = useState(true);
  const [isCompactMobile, setIsCompactMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [taskSplitRatio, setTaskSplitRatio] = useState(readTaskSplitRatio);
  const [isTaskSplitDragging, setIsTaskSplitDragging] = useState(false);
  const detailPanelRef = useRef(null);
  const detailPanelTriggerRefs = useRef({});
  const taskWorkspaceRef = useRef(null);
  const taskSplitDragRef = useRef({ startX: 0, startRatio: TASK_SPLIT_DEFAULT_RATIO, workspaceWidth: 0 });
  const taskSplitRatioRef = useRef(taskSplitRatio);
  const listToolbarPanelRef = useRef(null);
  const lastSyncedSelectedIDRef = useRef(0);
  const draftSourceTaskIDRef = useRef(0);
  const draftTouchedRef = useRef(false);
  const draftEditVersionRef = useRef(0);
  const draftSyncTimerRef = useRef(0);
  const draftDescriptionRenderTimerRef = useRef(0);
  const pendingDraftSubmitRef = useRef({ taskID: 0, payload: null });
  const pendingImmediateSubmitSourceRef = useRef('');
  const selectedTaskSnapshotRef = useRef(null);
  const draftSnapshotRef = useRef(null);
  const isDraftDirtyRef = useRef(false);
  const isSavingDraftRef = useRef(false);
  const isSubmittingDraftRef = useRef(false);
  const flushDraftQueueRef = useRef(Promise.resolve());
  const flushDraftOnLeaveRef = useRef(null);
  const discardDraftOnUnloadUntilRef = useRef(0);
  const discardDraftOnUnloadTimerRef = useRef(0);
  const detailPanelSnapshotRef = useRef(null);
  const switchTaskRequestRef = useRef(0);
  const activeRenderTaskIDRef = useRef(0);
  const detailBodyScrollCleanupRef = useRef(null);
  const draftDescriptionEditorRef = useRef(null);
  const draftTitleInputRef = useRef(null);
  const activeDescriptionSessionRef = useRef(0);
  const descriptionSessionSeqRef = useRef(0);
  const descriptionSessionTaskIDRef = useRef(0);
  const latestDescriptionSessionByTaskRef = useRef(new Map());
  const latestEditedDescriptionSessionByTaskRef = useRef(new Map());

  const bindDetailBodyScroll = useCallback((node) => {
    detailBodyScrollCleanupRef.current?.();
    detailBodyScrollCleanupRef.current = node ? attachTransientScrollbar(node) : null;
  }, []);

  useEffect(() => () => {
    detailBodyScrollCleanupRef.current?.();
    detailBodyScrollCleanupRef.current = null;
    if (discardDraftOnUnloadTimerRef.current) {
      window.clearTimeout(discardDraftOnUnloadTimerRef.current);
      discardDraftOnUnloadTimerRef.current = 0;
    }
  }, []);

  useEffect(() => {
    if (!selectedTaskID) return;
    const timer = setTimeout(() => {
      draftDescriptionEditorRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedTaskID]);

  const hasStaleDraftEventContext = useCallback((closureTaskID) => {
    const closureID = Number(closureTaskID || 0);
    const activeID = Number(activeRenderTaskIDRef.current || 0);
    if (closureID > 0 && activeID > 0 && closureID !== activeID) {
      return true;
    }
    return false;
  }, []);

  // 获取任务的有效数字 ID（对于虚拟实例，返回源任务的数字 ID）
  const getEffectiveTaskID = useCallback((task) => {
    if (!task) return 0;
    if (task.virtual_occurrence) {
      return Number(task.source_task_id || task.task_id || 0);
    }
    return Number(task.id || 0);
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

  const scheduleDescriptionDraftRender = useCallback((taskIDInput = 0, sessionIDInput = 0) => {
    if (typeof window === 'undefined') {
      setDraft(draftSnapshotRef.current || null);
      return;
    }
    if (draftDescriptionRenderTimerRef.current) {
      window.clearTimeout(draftDescriptionRenderTimerRef.current);
    }
    const taskID = Number(taskIDInput || 0);
    const sessionID = Number(sessionIDInput || 0);
    draftDescriptionRenderTimerRef.current = window.setTimeout(() => {
      draftDescriptionRenderTimerRef.current = 0;
      if (taskID && Number(draftSourceTaskIDRef.current || 0) !== taskID) return;
      if (sessionID && Number(activeDescriptionSessionRef.current || 0) !== sessionID) return;
      setDraft(draftSnapshotRef.current || null);
    }, DRAFT_DESCRIPTION_RENDER_DELAY_MS);
  }, []);

  const setDraftDescriptionSnapshot = useCallback((value, taskIDInput = 0, sessionIDInput = 0) => {
    const prevSnapshot = draftSnapshotRef.current;
    if (!prevSnapshot) return null;
    const nextSnapshot = {
      ...prevSnapshot,
      description: String(value || ''),
    };
    draftSnapshotRef.current = nextSnapshot;
    scheduleDescriptionDraftRender(taskIDInput, sessionIDInput);
    return nextSnapshot;
  }, [scheduleDescriptionDraftRender]);

  const beginDescriptionSession = useCallback((taskIDInput, reason = '') => {
    const taskID = Number(taskIDInput || 0);
    if (!taskID) {
      activeDescriptionSessionRef.current = 0;
      descriptionSessionTaskIDRef.current = 0;
      return 0;
    }
    if (descriptionSessionTaskIDRef.current === taskID && activeDescriptionSessionRef.current > 0) {
      return activeDescriptionSessionRef.current;
    }
    const nextSessionID = descriptionSessionSeqRef.current + 1;
    descriptionSessionSeqRef.current = nextSessionID;
    activeDescriptionSessionRef.current = nextSessionID;
    descriptionSessionTaskIDRef.current = taskID;
    latestDescriptionSessionByTaskRef.current.set(taskID, nextSessionID);
    logDraftSwitchDebug('draft.description.sessionBegin', {
      reason,
      task_id: taskID,
      session_id: nextSessionID,
    });
    return nextSessionID;
  }, []);

  const markDescriptionSessionEdited = useCallback((taskIDInput, sessionIDInput) => {
    const taskID = Number(taskIDInput || 0);
    const sessionID = Number(sessionIDInput || 0);
    if (!taskID || !sessionID) return;
    const current = Number(latestEditedDescriptionSessionByTaskRef.current.get(taskID) || 0);
    if (sessionID > current) {
      latestEditedDescriptionSessionByTaskRef.current.set(taskID, sessionID);
    }
  }, []);

  const shouldAcceptDescriptionSessionInput = useCallback((taskIDInput, sessionIDInput) => {
    const taskID = Number(taskIDInput || 0);
    const sessionID = Number(sessionIDInput || 0);
    if (!taskID || !sessionID) return true;
    const latestEdited = Number(latestEditedDescriptionSessionByTaskRef.current.get(taskID) || 0);
    return !latestEdited || sessionID >= latestEdited;
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
    const persistedSort = sanitizeSortValue(getTaskListSortPref(viewPrefKey) || getDefaultSortValue(view), view);
    const persistedGroupRaw = getTaskListGroupPref(viewPrefKey) || 'none';
    const persistedGroup = view === 'search' ? 'status' : sanitizeGroupValue(persistedGroupRaw);
    setSortBy(persistedSort);
    setGroupBy(persistedGroup);
  }, [view, viewPrefKey]);

  useEffect(() => {
    if (!viewPrefKey) return;
    const nextSort = sanitizeSortValue(sortBy, view);
    if (nextSort !== sortBy) {
      setSortBy(nextSort);
      return;
    }
    setTaskListSortPref(viewPrefKey, nextSort);
  }, [sortBy, view, viewPrefKey]);

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
      setIsCompactMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    taskSplitRatioRef.current = taskSplitRatio;
  }, [taskSplitRatio]);

  useEffect(() => {
    const element = taskWorkspaceRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const applyWorkspaceWidth = (width) => {
      const shouldUseModal = width < TASK_DETAIL_SPLIT_MIN_WIDTH;
      setIsMobileViewport((prev) => (prev === shouldUseModal ? prev : shouldUseModal));
    };
    applyWorkspaceWidth(element.getBoundingClientRect().width || 0);
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width || 0;
      applyWorkspaceWidth(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const clampTaskSplitRatio = useCallback((nextRatio, workspaceWidth = 0) => {
    const width = workspaceWidth || taskWorkspaceRef.current?.getBoundingClientRect().width || 0;
    if (!width) return clampNumber(nextRatio, 0.25, 0.75);
    const availableWidth = Math.max(1, width - TASK_SPLIT_DIVIDER_WIDTH);
    const minListRatio = TASK_SPLIT_MIN_LIST_WIDTH / availableWidth;
    const maxListRatio = 1 - (TASK_SPLIT_MIN_DETAIL_WIDTH / availableWidth);
    return clampNumber(nextRatio, minListRatio, maxListRatio);
  }, []);

  const commitTaskSplitRatio = useCallback((nextRatio, workspaceWidth = 0) => {
    const clampedRatio = clampTaskSplitRatio(nextRatio, workspaceWidth);
    taskSplitRatioRef.current = clampedRatio;
    setTaskSplitRatio(clampedRatio);
    writeTaskSplitRatio(clampedRatio);
  }, [clampTaskSplitRatio]);

  const handleTaskSplitPointerDown = useCallback((event) => {
    if (isMobileViewport || event.button !== 0) return;
    const rect = taskWorkspaceRef.current?.getBoundingClientRect();
    if (!rect?.width) return;
    event.preventDefault();
    taskSplitDragRef.current = {
      startX: event.clientX,
      startRatio: clampTaskSplitRatio(taskSplitRatioRef.current, rect.width),
      workspaceWidth: rect.width,
    };
    setIsTaskSplitDragging(true);
  }, [clampTaskSplitRatio, isMobileViewport]);

  const handleTaskSplitKeyDown = useCallback((event) => {
    if (isMobileViewport) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home') return;
    event.preventDefault();
    if (event.key === 'Home') {
      commitTaskSplitRatio(TASK_SPLIT_DEFAULT_RATIO);
      return;
    }
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    commitTaskSplitRatio(taskSplitRatio + direction * TASK_SPLIT_KEYBOARD_STEP);
  }, [commitTaskSplitRatio, isMobileViewport, taskSplitRatio]);

  useEffect(() => {
    if (!isTaskSplitDragging) return undefined;
    const handlePointerMove = (event) => {
      const dragState = taskSplitDragRef.current;
      if (!dragState.workspaceWidth) return;
      const nextRatio = dragState.startRatio + ((event.clientX - dragState.startX) / dragState.workspaceWidth);
      const clampedRatio = clampTaskSplitRatio(nextRatio, dragState.workspaceWidth);
      taskSplitRatioRef.current = clampedRatio;
      setTaskSplitRatio(clampedRatio);
    };
    const handlePointerUp = () => {
      const dragState = taskSplitDragRef.current;
      setIsTaskSplitDragging(false);
      writeTaskSplitRatio(clampTaskSplitRatio(taskSplitRatioRef.current, dragState.workspaceWidth));
    };
    document.body.classList.add('task-split-resizing');
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      document.body.classList.remove('task-split-resizing');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [clampTaskSplitRatio, isTaskSplitDragging]);

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
        ...recurringInstanceTasks.filter((task) => ['cancelled', 'skipped'].includes(task.status)),
        ...tasks.filter((task) => ['cancelled', 'skipped'].includes(task.status)),
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
      return pending.filter((task) => shouldIncludeTaskInTodayView(task, timezone, todayStart));
    }

    if (view === 'upcoming') {
      return pending.filter((task) => shouldIncludeTaskInUpcomingView(task, timezone, todayStart));
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
          : status === 'skipped'
            ? t('task.statusSkipped')
            : t('task.statusCancelled');
        pushTaskToGroup(status, title, task);
        return;
      }

      if (isTaskOverdue(task, timezone)) {
        pushTaskToGroup('overdue', t('task.overdueGroup'), task);
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
        const current = getTaskPrimaryLocalTime(task, timezone);
        if (!current) {
          pushTaskToGroup('no-date', t('task.noDate'), task);
          return;
        }
        const currentYear = dayjs().tz(timezone).year();
        const dateLabel = current.year() !== currentYear
          ? current.format('YYYY/MM/DD ddd')
          : current.format('MM/DD ddd');
        pushTaskToGroup(`due-${current.format('YYYY-MM-DD')}`, dateLabel, task);
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
      const order = { pending: 0, completed: 1, skipped: 2, cancelled: 3 };
      groups.sort((a, b) => (order[a.key] ?? 9) - (order[b.key] ?? 9));
      return groups;
    }

    if (effectiveGroupBy === 'priority') {
      const order = { 1: 0, 0: 1, '-1': 2 };
      groups.sort((a, b) => {
        if (a.key === 'overdue') return -1;
        if (b.key === 'overdue') return 1;
        return (order[a.key] ?? 9) - (order[b.key] ?? 9);
      });
      return groups;
    }

    if (effectiveGroupBy === 'due') {
      groups.sort((a, b) => {
        if (a.key === 'overdue') return -1;
        if (b.key === 'overdue') return 1;
        if (a.key === 'no-date') return 1;
        if (b.key === 'no-date') return -1;
        return a.key.localeCompare(b.key);
      });
      return groups;
    }

    groups.sort((a, b) => {
      if (a.key === 'overdue') return -1;
      if (b.key === 'overdue') return 1;
      return a.title.localeCompare(b.title, 'zh-Hans-CN');
    });
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
    // 支持虚拟实例的字符串 ID（如 "occ_123_20260413"）
    const fromFiltered = filteredTasks.find((task) => String(task?.id) === String(selectedTaskID || ''));
    if (fromFiltered) return fromFiltered;
    const fromAllTasks = tasks.find((task) => String(task?.id) === String(selectedTaskID || ''));
    return fromAllTasks || null;
  }, [filteredTasks, selectedTaskID, tasks]);
  // 对于虚拟实例，使用源任务的数字 ID
  activeRenderTaskIDRef.current = getEffectiveTaskID(selectedTask);
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
  const activityPanelFloatingStyle = useMemo(
    () => getDetailPanelFloatingStyle(detailPanelTriggerRefs.current?.activity, 'activity'),
    [showActivityPanel]
  );
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
  const detailPanelFloatingStyle = useMemo(
    () => getDetailPanelFloatingStyle(detailPanelTriggerRefs.current?.[detailPanel], detailPanel),
    [detailPanel]
  );
  const isDraftCustomRecurrenceType = (draft?.recurrence_type || 'daily') === 'biweekly' || (draft?.recurrence_type || 'daily') === 'lunar';
  const draftStatus = draft?.status || selectedTask?.status || 'pending';
  const selectedTaskDraftForAI = useMemo(() => {
    if (!selectedTask || !draft) return selectedTask;
    return {
      ...selectedTask,
      title: draft.title || selectedTask.title || '',
      description: draft.description ?? selectedTask.description ?? '',
      priority: draftPriorityValue,
      status: draftStatus,
      all_day: !!draft.all_day,
      start_time: draft.start_time || '',
      end_time: draft.end_time || '',
      category_ids: draft.category_ids || [],
      categories: categories.filter((cat) => (draft.category_ids || []).map(String).includes(String(cat.id))),
    };
  }, [categories, draft, draftPriorityValue, draftStatus, selectedTask]);
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
      draftSourceTaskIDRef.current = getEffectiveTaskID(selectedTask);
      beginDescriptionSession(draftSourceTaskIDRef.current, 'selected_task_effect');
      draftTouchedRef.current = false;
      draftEditVersionRef.current = 0;
      setDraftWithSnapshot(nextDraft);
      setDraftTimeRangeEnabled(!!nextDraft?.end_time);
      setDetailPanel('');
      return;
    }

    if (!draft) {
      draftTouchedRef.current = false;
      draftSourceTaskIDRef.current = getEffectiveTaskID(selectedTask);
      beginDescriptionSession(draftSourceTaskIDRef.current, 'missing_draft_effect');
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
        // Guard: for recurring tasks, selectedTask.start_time is overridden by the
        // next occurrence date from recurringNextPendingMap. After a local save
        // (updateTaskLocal), tasksRaw is updated immediately but recurringNextPendingMap
        // may still carry the old occurrence date. If the base task's local date matches
        // the current draft's date, the "incoming" change is stale occurrence data —
        // skip the sync to avoid rolling back the user's just-confirmed date change.
        if (selectedTask.occurrence_start) {
          const baseTask = (Array.isArray(tasksRaw) ? tasksRaw : [])
            .find((t) => Number(t?.id) === Number(selectedTask.id));
          if (baseTask?.start_time) {
            const baseDateLocal = dayjs(baseTask.start_time).tz(timezone).format('YYYY-MM-DD');
            const currentDateLocal = (current.start_time || '').split('T')[0];
            if (baseDateLocal && currentDateLocal && baseDateLocal === currentDateLocal) {
              return;
            }
          }
        }
        draftSourceTaskIDRef.current = getEffectiveTaskID(selectedTask);
        setDraftWithSnapshot(nextDraft);
        setDraftTimeRangeEnabled(!!nextDraft?.end_time);
      }
    }
  }, [beginDescriptionSession, selectedTask, draft, detailPanel, isDetailPanelRequiringConfirm, setDraftWithSnapshot, tasksRaw, timezone]);

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
        const shouldInstantProjectNextOccurrence = (
          hasOccurrenceContext
          && ['completed', 'cancelled', 'skipped'].includes(String(newStatus || ''))
        );
        if (hasOccurrenceContext) {
          const optimisticOccurrenceKeys = buildOccurrenceStatusKeys(
            taskID,
            payload.instance_id || instanceID,
            payload.occurrence_date || occurrenceDate,
            timezone,
          );
          if (optimisticOccurrenceKeys.length > 0) {
            const now = Date.now();
            const nextOptimisticMap = { ...(occurrenceStatusOptimisticMapRef.current || {}) };
            optimisticOccurrenceKeys.forEach((key) => {
              if (!key) return;
              nextOptimisticMap[key] = { status: newStatus, updatedAt: now };
            });
            occurrenceStatusOptimisticMapRef.current = nextOptimisticMap;
            setOccurrenceStatusOptimisticMap(nextOptimisticMap);

            if (shouldInstantProjectNextOccurrence) {
              const sourceTask = (Array.isArray(tasksRaw) ? tasksRaw : [])
                .find((item) => Number(item?.id || 0) === taskID) || task;
              const projectedNext = buildNextPendingFromProjectedTask({
                task: sourceTask,
                optimisticStatusMap: nextOptimisticMap,
                serverStatusMap: recurringServerStatusMap,
                timezone,
              });
              if (projectedNext) {
                queryClient.setQueryData(queryKeys.tasks.nextOccurrences(), (prev) => (
                  upsertProjectedNextOccurrence(prev, taskID, projectedNext, timezone)
                ));
                if (String(selectedTaskSnapshotRef.current?.id || '') === String(task?.id || '')) {
                  setSelectedTaskID(`occ_${projectedNext.instanceId}`);
                }
              }
            }

            void (async () => {
              try {
                await updateTaskStatusLocal(queryClient, taskID, payload, {
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
              } catch (err) {
                setOccurrenceStatusOptimisticMap((prev) => {
                  const next = { ...(prev || {}) };
                  let changed = false;
                  optimisticOccurrenceKeys.forEach((key) => {
                    if (!Object.prototype.hasOwnProperty.call(next, key)) return;
                    delete next[key];
                    changed = true;
                  });
                  if (changed) {
                    occurrenceStatusOptimisticMapRef.current = next;
                  }
                  return changed ? next : prev;
                });
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: queryKeys.tasks.nextOccurrences() }),
                  queryClient.invalidateQueries({ queryKey: ['tasks', 'occurrences'] }),
                ]);
                console.error('Failed to update recurring occurrence status:', err);
              }
            })();
            return;
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
      console.error('Failed to update task status:', err);
    }
  }, [queryClient, recurringServerStatusMap, tasksRaw, timezone]);

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
    const closureTaskID = getEffectiveTaskID(selectedTask);
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
    const closureTaskID = getEffectiveTaskID(selectedTask);
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
    const closureTaskID = getEffectiveTaskID(selectedTask);
    if (hasStaleDraftEventContext(closureTaskID)) return;
    markDraftTouched();
    setDraftWithSnapshot((prev) => (prev ? { ...prev, end_time: String(nextValue || '') } : prev));
  };

  const applyQuickDatePreset = (preset) => {
    const closureTaskID = getEffectiveTaskID(selectedTask);
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
    const closureTaskID = getEffectiveTaskID(selectedTask);
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
    const closureTaskID = getEffectiveTaskID(selectedTask);
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

  const handleDraftDescriptionChange = useCallback((nextValue, context = {}) => {
    const value = String(nextValue || '');
    const contextTaskID = Number(context?.taskID || 0);
    const contextSessionID = Number(context?.sessionID || 0);
    const activeTaskID = getEffectiveTaskID(selectedTaskSnapshotRef.current);
    const draftSourceTaskID = Number(draftSourceTaskIDRef.current || 0);

    if (contextTaskID && contextSessionID && !shouldAcceptDescriptionSessionInput(contextTaskID, contextSessionID)) {
      logDraftSwitchDebug('draft.description.inputSkipOlderSession', {
        context_task_id: contextTaskID,
        context_session_id: contextSessionID,
        latest_opened_session_id: Number(latestDescriptionSessionByTaskRef.current.get(contextTaskID) || 0),
        latest_edited_session_id: Number(latestEditedDescriptionSessionByTaskRef.current.get(contextTaskID) || 0),
        active_task_id: activeTaskID,
        description: summarizeDebugText(value),
      });
      return;
    }

    if (!contextTaskID || contextTaskID === activeTaskID) {
      const resolvedTaskID = contextTaskID || activeTaskID;
      const resolvedSessionID = contextSessionID || activeDescriptionSessionRef.current;
      markDescriptionSessionEdited(resolvedTaskID, resolvedSessionID);
      markDraftTouched();
      setDraftDescriptionSnapshot(value, resolvedTaskID, resolvedSessionID);
      logDraftSwitchDebug('draft.description.activeInput', {
        context_task_id: contextTaskID,
        context_session_id: contextSessionID,
        active_task_id: activeTaskID,
        draft_source_task_id: draftSourceTaskID,
        description: summarizeDebugText(value),
      });
      return;
    }

    const taskValue = context?.taskValue || null;
    if (!taskValue || taskValue.read_only || getEffectiveTaskID(taskValue) !== contextTaskID) {
      logDraftSwitchDebug('draft.description.staleSkip', {
        reason: !taskValue ? 'missing_task' : taskValue.read_only ? 'read_only' : 'task_id_mismatch',
        context_task_id: contextTaskID,
        context_session_id: contextSessionID,
        active_task_id: activeTaskID,
        task_title: taskValue?.title || '',
        description: summarizeDebugText(value),
      });
      return;
    }

    const baseDraft = context?.draftValue || buildDraftFromTask(taskValue);
    if (!baseDraft) {
      logDraftSwitchDebug('draft.description.staleSkip', {
        reason: 'missing_draft',
        context_task_id: contextTaskID,
        context_session_id: contextSessionID,
        active_task_id: activeTaskID,
        task_title: taskValue?.title || '',
        description: summarizeDebugText(value),
      });
      return;
    }

    const nextDraft = { ...baseDraft, description: value };
    const originalDraft = buildDraftFromTask(taskValue);
    const snapshotDirty = JSON.stringify(normalizeDraftForCompare(nextDraft))
      !== JSON.stringify(normalizeDraftForCompare(originalDraft));
    logDraftSwitchDebug('draft.description.staleInput', {
      context_task_id: contextTaskID,
      context_session_id: contextSessionID,
      latest_opened_session_id: Number(latestDescriptionSessionByTaskRef.current.get(contextTaskID) || 0),
      latest_edited_session_id: Number(latestEditedDescriptionSessionByTaskRef.current.get(contextTaskID) || 0),
      active_task_id: activeTaskID,
      task_title: taskValue?.title || '',
      snapshot_dirty: snapshotDirty,
      task_description: summarizeDebugText(taskValue?.description),
      base_draft_description: summarizeDebugText(baseDraft?.description),
      next_description: summarizeDebugText(value),
    });
    if (!snapshotDirty) return;

    const built = buildDraftPayload(taskValue, nextDraft);
    if (!built?.payload) {
      logDraftSwitchDebug('draft.description.staleNoPayload', {
        context_task_id: contextTaskID,
        context_session_id: contextSessionID,
        active_task_id: activeTaskID,
      });
      return;
    }

    markDescriptionSessionEdited(contextTaskID, contextSessionID);
    void updateTaskLocal(queryClient, contextTaskID, built.payload, {
      scheduleSync: true,
      localOnly: false,
      submitMeta: {
        submittedAt: new Date().toISOString(),
        submitSource: 'late_editor_input',
      },
    });
    logDraftSwitchDebug('draft.description.staleQueued', {
      context_task_id: contextTaskID,
      context_session_id: contextSessionID,
      active_task_id: activeTaskID,
      task_title: taskValue?.title || '',
      payload_description: summarizeDebugText(built.payload?.description),
      payload_keys: Object.keys(built.payload || {}),
    });
  }, [
    buildDraftFromTask,
    buildDraftPayload,
    getEffectiveTaskID,
    markDescriptionSessionEdited,
    markDraftTouched,
    queryClient,
    setDraftDescriptionSnapshot,
    shouldAcceptDescriptionSessionInput,
  ]);

  const getCurrentDraftDescriptionValue = useCallback(() => (
    draftDescriptionEditorRef.current?.getValue?.()
    ?? draftDescriptionEditorRef.current?.getCachedValue?.()
    ?? draftSnapshotRef.current?.description
    ?? draft?.description
    ?? ''
  ), [draft?.description]);

  const handleApplyAIDraftDescription = useCallback((nextValue) => {
    if (!selectedTaskSnapshotRef.current) return;
    handleDraftDescriptionChange(nextValue, {
      taskID: getEffectiveTaskID(selectedTaskSnapshotRef.current),
      sessionID: activeDescriptionSessionRef.current,
      taskValue: selectedTaskSnapshotRef.current,
      draftValue: draftSnapshotRef.current || draft,
    });
  }, [draft, getEffectiveTaskID, handleDraftDescriptionChange]);

  const captureCurrentDescriptionDraft = useCallback(() => {
    const taskValue = selectedTaskSnapshotRef.current;
    const taskID = getEffectiveTaskID(taskValue);
    const draftValue = draftSnapshotRef.current;
    const editorDebug = draftDescriptionEditorRef.current?.getDebugSnapshot?.() || null;
    if (
      !taskValue
      || taskValue.read_only
      || !draftValue
      || !taskID
      || Number(draftSourceTaskIDRef.current || 0) !== taskID
    ) {
      logDraftSwitchDebug('draft.capture.skip', {
        task_id: taskID,
        task_title: taskValue?.title || '',
        draft_source_task_id: Number(draftSourceTaskIDRef.current || 0),
        has_draft: !!draftValue,
        read_only: !!taskValue?.read_only,
        editor: editorDebug,
      });
      return draftValue;
    }

    const liveDescription = String(
      draftDescriptionEditorRef.current?.getCachedValue?.()
      ?? draftValue.description
      ?? ''
    );
    if (liveDescription === String(draftValue.description || '')) {
      logDraftSwitchDebug('draft.capture.same', {
        task_id: taskID,
        task_title: taskValue?.title || '',
        draft_source_task_id: Number(draftSourceTaskIDRef.current || 0),
        draft_description: summarizeDebugText(draftValue.description),
        live_description: summarizeDebugText(liveDescription),
        editor: draftDescriptionEditorRef.current?.getDebugSnapshot?.() || editorDebug,
      });
      return draftValue;
    }

    draftTouchedRef.current = true;
    draftEditVersionRef.current += 1;
    logDraftSwitchDebug('draft.capture.changed', {
      task_id: taskID,
      task_title: taskValue?.title || '',
      draft_source_task_id: Number(draftSourceTaskIDRef.current || 0),
      draft_edit_version: draftEditVersionRef.current,
      draft_description: summarizeDebugText(draftValue.description),
      live_description: summarizeDebugText(liveDescription),
      editor: draftDescriptionEditorRef.current?.getDebugSnapshot?.() || editorDebug,
    });
    return setDraftWithSnapshot({
      ...draftValue,
      description: liveDescription,
    });
  }, [getEffectiveTaskID, setDraftWithSnapshot]);

  const stageDraftForLeave = useCallback((submitSource = 'leave', options = {}) => {
    const taskValue = options?.taskValue || selectedTaskSnapshotRef.current;
    const draftValue = options?.draftValue || draftSnapshotRef.current;
    const draftSourceTaskID = Number(options?.draftSourceTaskID || draftSourceTaskIDRef.current || 0);
    const taskID = getEffectiveTaskID(taskValue);
    const draftTitle = String(draftValue?.title || '').trim();
    const draftBoundToTask = taskID > 0 && draftSourceTaskID === taskID;
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
    logDraftSwitchDebug('draft.stage.check', {
      submit_source: submitSource,
      task_id: taskID,
      task_title: taskValue?.title || '',
      draft_source_task_id: draftSourceTaskID,
      draft_bound_to_task: draftBoundToTask,
      snapshot_dirty: snapshotDirty,
      has_dirty_draft: hasDirtyDraft,
      task_description: summarizeDebugText(taskValue?.description),
      draft_description: summarizeDebugText(draftValue?.description),
    });
    if (!hasDirtyDraft) return false;

    const built = buildDraftPayload(taskValue, draftValue);
    if (!built?.payload) {
      logDraftSwitchDebug('draft.stage.noPayload', {
        submit_source: submitSource,
        task_id: taskID,
      });
      return false;
    }

    void updateTaskLocal(queryClient, taskID, built.payload, {
      scheduleSync: false,
      localOnly: true,
      submitMeta: {
        submittedAt: new Date().toISOString(),
        submitSource,
      },
    });
    pendingDraftSubmitRef.current = { taskID, payload: built.payload };
    setPendingSubmitTaskID(taskID);
    logDraftSwitchDebug('draft.stage.localOnlyQueued', {
      submit_source: submitSource,
      task_id: taskID,
      task_title: taskValue?.title || '',
      payload_description: summarizeDebugText(built.payload?.description),
      payload_keys: Object.keys(built.payload || {}),
    });
    return true;
  }, [buildDraftFromTask, buildDraftPayload, getEffectiveTaskID, queryClient]);

  const submitPendingDraft = useCallback(async (taskIDOverride = 0, submitSource = 'idle') => {
    const pending = pendingDraftSubmitRef.current;
    if (!pending?.taskID || !pending?.payload) {
      logDraftSwitchDebug('draft.submit.skipNoPending', {
        task_id_override: Number(taskIDOverride || 0),
        submit_source: submitSource,
      });
      return;
    }
    const taskID = Number(taskIDOverride || pending.taskID || 0);
    if (!taskID || taskID !== Number(pending.taskID)) {
      logDraftSwitchDebug('draft.submit.skipTaskMismatch', {
        task_id_override: Number(taskIDOverride || 0),
        pending_task_id: Number(pending.taskID || 0),
        submit_source: submitSource,
      });
      return;
    }
    if (submittingDraft) {
      logDraftSwitchDebug('draft.submit.skipSubmitting', {
        task_id: taskID,
        submit_source: submitSource,
      });
      return;
    }

    setSubmittingDraft(true);
    try {
      logDraftSwitchDebug('draft.submit.start', {
        task_id: taskID,
        submit_source: submitSource,
        payload_description: summarizeDebugText(pending.payload?.description),
        selected_task_id: getEffectiveTaskID(selectedTaskSnapshotRef.current),
      });
      logTimeDebug('taskList.submitPendingDraft.start', {
        task_id: taskID,
        submit_source: submitSource,
        if_match_revision: Number(selectedTaskSnapshotRef.current?.revision || 0) || undefined,
        payload: pending.payload,
      });
      await updateTaskLocal(queryClient, taskID, pending.payload, {
        scheduleSync: true,
        localOnly: false,
        submitMeta: {
          submittedAt: new Date().toISOString(),
          submitSource,
        },
      });
      pendingDraftSubmitRef.current = { taskID: 0, payload: null };
      setPendingSubmitTaskID(0);
      logDraftSwitchDebug('draft.submit.done', {
        task_id: taskID,
        submit_source: submitSource,
      });
    } catch (err) {
      console.error('Failed to submit task details:', err);
      logDraftSwitchDebug('draft.submit.error', {
        task_id: taskID,
        submit_source: submitSource,
        error: err?.message || String(err),
      });
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
    // 对于虚拟实例，使用源任务的数字 ID
    const closureTaskID = getEffectiveTaskID(taskValue);
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
      if (submitAfter) {
        pendingImmediateSubmitSourceRef.current = submitSource;
      }
      return false;
    }
    // 对于虚拟实例，比较源任务 ID
    const effectiveTaskID = getEffectiveTaskID(taskValue);
    if (draftSourceTaskIDRef.current !== effectiveTaskID) {
      return;
    }
    const title = (draftValue.title || '').trim();
    if (!title) {
      return;
    }

    // 对于虚拟实例，使用源任务的数字 ID
    const targetTaskID = getEffectiveTaskID(taskValue);
    if (!targetTaskID) {
      return;
    }

    const editVersionAtStart = draftEditVersionRef.current;
    const built = buildDraftPayload(taskValue, draftValue);
    if (!built?.payload) {
      return;
    }

    setSavingDraft(true);
    try {
      logDraftSwitchDebug('draft.save.start', {
        task_id: targetTaskID,
        submit_after: !!submitAfter,
        submit_source: submitSource,
        edit_version_at_start: editVersionAtStart,
        draft_description: summarizeDebugText(draftValue.description),
      });
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
        logDraftSwitchDebug('draft.save.hasNewEdits', {
          task_id: targetTaskID,
          edit_version_at_start: editVersionAtStart,
          edit_version_now: draftEditVersionRef.current,
          submit_after: !!submitAfter,
          submit_source: submitSource,
        });
        if (submitAfter) {
          pendingImmediateSubmitSourceRef.current = submitSource;
        }
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
      logDraftSwitchDebug('draft.save.done', {
        task_id: targetTaskID,
        submit_after: !!submitAfter,
        submit_source: submitSource,
        payload_description: summarizeDebugText(built.payload?.description),
      });
      return true;
    } catch (err) {
      console.error('Failed to save task details:', err);
      logDraftSwitchDebug('draft.save.error', {
        task_id: targetTaskID,
        submit_after: !!submitAfter,
        submit_source: submitSource,
        error: err?.message || String(err),
      });
      return false;
    } finally {
      setSavingDraft(false);
    }
  };

  const submitDraftImmediately = useCallback((submitSource = 'realtime') => {
    if (typeof window === 'undefined') return;
    window.setTimeout(() => {
      const pending = pendingDraftSubmitRef.current;
      const pendingTaskID = Number(pending?.taskID || 0);
      const activeTaskID = getEffectiveTaskID(selectedTaskSnapshotRef.current);
      if (pendingTaskID > 0 && pending?.payload && (!activeTaskID || pendingTaskID === activeTaskID)) {
        void submitPendingDraft(pendingTaskID, submitSource);
        return;
      }
      void handleSaveDraft({ submitAfter: true, submitSource });
    }, 0);
  }, [getEffectiveTaskID, handleSaveDraft, submitPendingDraft]);

  useEffect(() => {
    if (savingDraft) return;
    const submitSource = pendingImmediateSubmitSourceRef.current;
    if (!submitSource) return;
    pendingImmediateSubmitSourceRef.current = '';
    submitDraftImmediately(submitSource);
  }, [savingDraft, submitDraftImmediately]);

  const flushDraftOnLeave = useCallback((submitSource = 'leave', options = {}) => {
    const runFlush = async () => {
      if (Date.now() < Number(discardDraftOnUnloadUntilRef.current || 0)) {
        pendingDraftSubmitRef.current = { taskID: 0, payload: null };
        setPendingSubmitTaskID(0);
        logDraftSwitchDebug('draft.flush.skipDiscardOnUnload', {
          submit_source: submitSource,
        });
        return;
      }
      const pending = pendingDraftSubmitRef.current;
      const pendingTaskID = Number(pending?.taskID || 0);
      const pendingPayload = pending?.payload && typeof pending.payload === 'object' ? pending.payload : null;
      const hasPendingSubmit = pendingTaskID > 0 && !!pendingPayload;

      const taskValue = options?.taskValue || selectedTaskSnapshotRef.current;
      const draftValue = options?.draftValue || draftSnapshotRef.current;
      // 对于虚拟实例，使用源任务的数字 ID
      const draftSourceTaskID = Number(options?.draftSourceTaskID || draftSourceTaskIDRef.current || 0);
      const taskID = getEffectiveTaskID(taskValue);
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
      logDraftSwitchDebug('draft.flush.check', {
        submit_source: submitSource,
        task_id: taskID,
        task_title: taskValue?.title || '',
        draft_source_task_id: draftSourceTaskID,
        has_pending_submit: hasPendingSubmit,
        pending_task_id: pendingTaskID,
        draft_bound_to_task: draftBoundToTask,
        snapshot_dirty: snapshotDirty,
        has_dirty_draft: hasDirtyDraft,
        task_description: summarizeDebugText(taskValue?.description),
        draft_description: summarizeDebugText(draftValue?.description),
        pending_description: summarizeDebugText(pendingPayload?.description),
      });
      if (!hasPendingSubmit && !hasDirtyDraft) {
        return;
      }

      try {
        if (hasDirtyDraft) {
          const built = buildDraftPayload(taskValue, draftValue);
          if (built?.payload) {
            const targetTaskID = getEffectiveTaskID(taskValue);
            await updateTaskLocal(queryClient, targetTaskID, built.payload, {
              scheduleSync: false,
              localOnly: true,
              awaitPersist: true,
            });
            await updateTaskLocal(queryClient, targetTaskID, built.payload, {
              scheduleSync: true,
              localOnly: false,
              submitMeta: {
                submittedAt: new Date().toISOString(),
                submitSource,
              },
              awaitPersist: true,
            });
            if (Number(pendingDraftSubmitRef.current?.taskID || 0) === targetTaskID) {
              pendingDraftSubmitRef.current = { taskID: 0, payload: null };
              setPendingSubmitTaskID(0);
            }
            logDraftSwitchDebug('draft.flush.dirtySubmitted', {
              submit_source: submitSource,
              task_id: targetTaskID,
              payload_description: summarizeDebugText(built.payload?.description),
            });
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
          logDraftSwitchDebug('draft.flush.pendingSubmitted', {
            submit_source: submitSource,
            task_id: pendingTaskID,
            payload_description: summarizeDebugText(pendingPayload?.description),
          });
        }
      } catch (error) {
        console.error('Failed to flush draft on leave:', error);
        logDraftSwitchDebug('draft.flush.error', {
          submit_source: submitSource,
          task_id: taskID,
          pending_task_id: pendingTaskID,
          error: error?.message || String(error),
        });
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
    if (draftDescriptionRenderTimerRef.current) {
      window.clearTimeout(draftDescriptionRenderTimerRef.current);
      draftDescriptionRenderTimerRef.current = 0;
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
      discardDraftOnUnloadUntilRef.current = Date.now() + 10000;
      if (discardDraftOnUnloadTimerRef.current) {
        window.clearTimeout(discardDraftOnUnloadTimerRef.current);
      }
      discardDraftOnUnloadTimerRef.current = window.setTimeout(() => {
        discardDraftOnUnloadUntilRef.current = 0;
        discardDraftOnUnloadTimerRef.current = 0;
      }, 10000);
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleSubmitDraft = async () => {
    const closureTaskID = getEffectiveTaskID(selectedTask);
    if (hasStaleDraftEventContext(closureTaskID)) return;
    if (!selectedTask || selectedTask.read_only) return;
    const draftValue = draftSnapshotRef.current;
    const snapshotDirty = !!(
      draftValue
      && JSON.stringify(normalizeDraftForCompare(draftValue))
        !== JSON.stringify(normalizeDraftForCompare(buildDraftFromTask(selectedTask)))
    );
    if (isDraftDirtyRef.current || snapshotDirty) {
      let queued = await handleSaveDraft({ submitAfter: false, submitSource: 'manual' });
      if (!queued && (isDraftDirtyRef.current || snapshotDirty)) {
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
        const payload = { status: 'skipped' };
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
          const occurrencePayload = { status: 'skipped' };
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
    statusSkipped: t('task.statusSkipped'),
    markPending: t('task.markPending'),
  }), [i18n.language, t]);

  const handleSelectTask = useCallback(async (task) => {
    // 统一使用右侧面板编辑，包括重复任务实例
    const nextTaskID = Number(task?.id || 0);
    if (!nextTaskID && !task?.virtual_occurrence) return;
    logDraftSwitchDebug('select.start', {
      next_task_id: task?.id || 0,
      next_task_title: task?.title || '',
      current_selected_task_id: selectedTaskSnapshotRef.current?.id || 0,
      current_effective_task_id: getEffectiveTaskID(selectedTaskSnapshotRef.current),
      current_draft_source_task_id: Number(draftSourceTaskIDRef.current || 0),
      current_draft_description: summarizeDebugText(draftSnapshotRef.current?.description),
    });

    // 对于虚拟实例：
    // - sourceTaskID 是源任务的数字 ID，用于保存操作
    // - selectedTaskID 是虚拟实例的字符串 ID，用于 UI 选中状态
    const sourceTaskID = task?.virtual_occurrence
      ? Number(task?.source_task_id || task?.task_id || 0)
      : nextTaskID;
    const selectedID = task?.virtual_occurrence ? task.id : nextTaskID;

    if (!sourceTaskID) return;

    const requestID = switchTaskRequestRef.current + 1;
    switchTaskRequestRef.current = requestID;
    // 对于虚拟实例，使用源任务的数字 ID
    const currentTaskID = getEffectiveTaskID(selectedTaskSnapshotRef.current);
    const currentTaskSnapshot = selectedTaskSnapshotRef.current;
    let currentDraftSnapshot = captureCurrentDescriptionDraft() || draftSnapshotRef.current;
    const currentDraftSourceTaskID = Number(draftSourceTaskIDRef.current || 0);
    // 比较选中状态（字符串 ID）
    const currentSelectedID = String(selectedTaskSnapshotRef.current?.id || '');
    if (currentSelectedID && selectedID === currentSelectedID) {
      logDraftSwitchDebug('select.sameTask', {
        selected_id: selectedID,
        source_task_id: sourceTaskID,
      });
      if (isMobileViewport) {
        openAdvancedModal(task);
      }
      return;
    }
    if (currentTaskID > 0 && sourceTaskID !== currentTaskID) {
      stageDraftForLeave('switch_task_stage', {
        taskValue: currentTaskSnapshot,
        draftValue: currentDraftSnapshot,
        draftSourceTaskID: currentDraftSourceTaskID,
      });
      void flushDraftOnLeave('switch_task', {
        taskValue: currentTaskSnapshot,
        draftValue: currentDraftSnapshot,
        draftSourceTaskID: currentDraftSourceTaskID,
      });
    }
    if (requestID !== switchTaskRequestRef.current) {
      return;
    }
    const nextDraftSnapshot = buildDraftFromTask(task);
    logDraftSwitchDebug('select.applyNextDraft', {
      selected_id: selectedID,
      source_task_id: sourceTaskID,
      next_task_title: task?.title || '',
      next_task_description: summarizeDebugText(task?.description),
      next_draft_description: summarizeDebugText(nextDraftSnapshot?.description),
    });
    draftSourceTaskIDRef.current = sourceTaskID;
    beginDescriptionSession(sourceTaskID, 'select_task');
    draftTouchedRef.current = false;
    draftEditVersionRef.current = 0;
    activeRenderTaskIDRef.current = sourceTaskID;
    setDraftWithSnapshot(nextDraftSnapshot);
    setDraftTimeRangeEnabled(!!nextDraftSnapshot?.end_time);
    setDraftTimeRangeEditing('start');
    setDraftTimeCalendarMode('solar');
    setShowActivityPanel(false);
    detailPanelSnapshotRef.current = null;
    setDetailPanel('');
    setSelectedTaskID(selectedID);
    if (isMobileViewport) {
      openAdvancedModal(task);
    }
  }, [
    buildDraftFromTask,
    beginDescriptionSession,
    captureCurrentDescriptionDraft,
    flushDraftOnLeave,
    getEffectiveTaskID,
    isMobileViewport,
    openAdvancedModal,
    setDraftWithSnapshot,
    stageDraftForLeave,
  ]);

  const canQuickCreate = view !== 'completed' && view !== 'deleted' && view !== 'search';
  const canShowSortGroup = filteredTasks.length > 0 || view === 'search' || view === 'all' || view === 'today' || view === 'upcoming';
  const sortOptions = useMemo(() => {
    if (view === 'completed') {
      return [
        { value: 'completed_desc', label: t('task.sortCompletedDesc') },
        { value: 'created_desc', label: t('task.sortCreatedDesc') },
      ];
    }
    if (view === 'deleted') {
      return [
        { value: 'deleted_desc', label: t('task.sortDeletedDesc') },
        { value: 'created_desc', label: t('task.sortCreatedDesc') },
      ];
    }
    return [
      { value: 'due_asc', label: t('task.sortDueAsc') },
      { value: 'due_desc', label: t('task.sortDueDesc') },
      { value: 'priority_desc', label: t('task.sortPriorityDesc') },
      { value: 'priority_asc', label: t('task.sortPriorityAsc') },
    ];
  }, [t, view]);
  const groupOptions = [
    { value: 'none', label: t('task.groupNone') },
    { value: 'due', label: t('task.groupDueDate') },
    { value: 'priority', label: t('task.groupPriority') },
    ...(canGroupByCategory ? [{ value: 'category', label: t('task.groupCategory') }] : []),
  ];
  const listGroupOptions = view === 'search' ? [{ value: 'status', label: t('task.groupStatus') }] : groupOptions;
  const showMobileSearchBar = isCompactMobile && view === 'search';
  const showListHeader = !isCompactMobile || showMobileSearchBar;
  const rowTimeMode = view === 'completed' ? 'completed' : view === 'deleted' ? 'deleted' : 'primary';
  const taskSplitListPercent = clampNumber(taskSplitRatio, 0.25, 0.75) * 100;
  const taskSplitGridStyle = isMobileViewport
    ? undefined
    : {
        gridTemplateColumns: `clamp(${TASK_SPLIT_MIN_LIST_WIDTH}px, calc((100% - ${TASK_SPLIT_DIVIDER_WIDTH}px) * ${taskSplitRatio.toFixed(4)}), calc(100% - ${TASK_SPLIT_MIN_DETAIL_WIDTH + TASK_SPLIT_DIVIDER_WIDTH}px)) ${TASK_SPLIT_DIVIDER_WIDTH}px minmax(${TASK_SPLIT_MIN_DETAIL_WIDTH}px, 1fr)`,
      };

  return (
    <div className="md-page h-full">
      <div
        ref={taskWorkspaceRef}
        className="grid h-full grid-cols-1 gap-0"
        style={taskSplitGridStyle}
      >
        <section className="md-pane flex h-full min-h-0 flex-col">
          {showListHeader && (
            <div className="bg-white px-5 pb-4 pt-5">
              <div className="flex min-h-[40px] items-center justify-between gap-3">
                <div className="hidden min-w-0 md:block">
                  <h2 className="truncate text-xl font-semibold text-slate-950">{viewTitle}</h2>
                  <p className="mt-0.5 text-xs text-slate-400">{t('task.taskCount', { count: filteredTasks.length })}</p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  {canShowSortGroup && !isCompactMobile && (
                    <>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            data-testid="task-sort-toggle-button"
                            className="text-slate-500 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-0 data-[state=open]:bg-slate-100 data-[state=open]:text-slate-950"
                            title={t('common.filter')}
                          >
                            <IconSort className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-52">
                          <DropdownMenuLabel>{t('common.filter')}</DropdownMenuLabel>
                          <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
                            {sortOptions.map((option) => (
                              <DropdownMenuRadioItem
                                key={option.value}
                                value={option.value}
                                data-testid={`task-sort-option-${option.value}`}
                                className="text-xs"
                              >
                                {option.label}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={`${
                              effectiveGroupBy !== 'none'
                                ? 'bg-slate-100 text-slate-950'
                                : 'text-slate-500 hover:text-slate-950'
                            } hover:bg-slate-100 focus-visible:ring-0 data-[state=open]:bg-slate-100 data-[state=open]:text-slate-950`}
                            title={t('task.groupNone')}
                          >
                            <IconGroup className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-52">
                          <DropdownMenuLabel>{t('task.groupNone')}</DropdownMenuLabel>
                          <DropdownMenuRadioGroup value={effectiveGroupBy} onValueChange={setGroupBy}>
                            {listGroupOptions.map((option) => (
                              <DropdownMenuRadioItem key={option.value} value={option.value} className="text-xs">
                                {option.label}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                  <Button
                    type="button"
                    data-testid="task-new-button"
                    onClick={() => {
                      if (canQuickCreate && quickTitle.trim()) {
                        handleQuickCreate();
                        return;
                      }
                      openAdvancedModal(null);
                    }}
                    size="icon"
                    className="hidden md:inline-flex"
                    title={t('task.newTask')}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {(view === 'search' || canQuickCreate) && (
                <div className="mt-4">
                  {view === 'search' && (
                    <div className="md-input-row min-h-[42px]">
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
                    <div className="md-input-row hidden min-h-[42px] md:flex">
                      <Plus className="h-4 w-4 text-slate-300" />
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
                </div>
              )}
            </div>
          )}

          <div className="mobile-scrollbar-hidden flex-1 overflow-auto bg-white md:bg-white">
            {loading ? (
              <div className="py-8 text-center text-slate-500">{t('common.loading')}</div>
            ) : filteredTasks.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                <p>{view === 'search' ? t('task.searchNoResults') : t('task.noTasks')}</p>
                <p className="mt-2 text-sm">{view === 'search' ? t('task.searchHint') : t('task.createFirst')}</p>
              </div>
            ) : (
              <div className="space-y-5 px-0 py-1 md:px-5">
                {taskGroups.map((group) => (
                  <div key={group.key} className="space-y-1">
                    {group.title ? (
                      <div className="sticky top-0 z-[2] flex items-center gap-2 bg-white/95 px-4 py-2 text-base font-semibold text-slate-900 backdrop-blur md:px-5 md:bg-white/95">
                        <span>{group.title}</span>
                        <span className="text-sm font-normal text-slate-400">{group.tasks.length}</span>
                      </div>
                    ) : null}
                    <div className="bg-white">
                      {group.tasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          selected={selectedTaskID === task.id}
                          timezone={timezone}
                          labels={listLabels}
                          timeMode={rowTimeMode}
                          onBeforeSelectTask={captureCurrentDescriptionDraft}
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
                        data-testid={`task-sort-option-${option.value}`}
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
                    data-testid="task-sort-toggle-button"
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
                data-testid="task-new-button"
                onClick={() => openAdvancedModal(null)}
                className="btn-primary inline-flex h-11 w-11 items-center justify-center rounded-full px-0 py-0 text-lg shadow-sm"
                title={t('task.newTask')}
              >
                +
              </button>
            </div>
          )}
        </section>

        {!isMobileViewport && (
          <button
            type="button"
            aria-label={t('task.resizeTaskDetailSplit')}
            title={t('task.resizeTaskDetailSplit')}
            aria-valuemin={Math.round((TASK_SPLIT_MIN_LIST_WIDTH / Math.max(TASK_DETAIL_SPLIT_MIN_WIDTH, 1)) * 100)}
            aria-valuemax={Math.round((1 - TASK_SPLIT_MIN_DETAIL_WIDTH / Math.max(TASK_DETAIL_SPLIT_MIN_WIDTH, 1)) * 100)}
            aria-valuenow={Math.round(taskSplitListPercent)}
            className={`task-split-resizer${isTaskSplitDragging ? ' task-split-resizer--dragging' : ''}`}
            role="separator"
            onDoubleClick={() => commitTaskSplitRatio(TASK_SPLIT_DEFAULT_RATIO)}
            onKeyDown={handleTaskSplitKeyDown}
            onPointerDown={handleTaskSplitPointerDown}
          >
            <span className="task-split-resizer-line" />
          </button>
        )}

        <section className={`md-pane h-full min-h-0 flex-col ${isMobileViewport ? 'hidden' : 'flex'}`}>
          {!selectedTask || !draft ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              {t('task.selectTaskHint')}
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col bg-white">
              <div className="border-b border-slate-100 px-8 pb-5 pt-5">
                <div className="flex min-h-9 items-center justify-between gap-4">
                  <div ref={detailPanelRef} className="relative flex min-w-0 flex-wrap items-center gap-1.5 text-slate-500">
                    <button
                      type="button"
                      aria-pressed={draftStatus === 'completed'}
                      disabled={selectedTask.read_only || draftStatus === 'cancelled' || draftStatus === 'skipped'}
                      onClick={() => handleStatusChange(selectedTask, draftStatus === 'completed' ? 'pending' : 'completed')}
                      className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors ${
                        draftStatus === 'completed'
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white text-transparent hover:border-blue-500 hover:bg-blue-50'
                      } disabled:cursor-not-allowed disabled:opacity-45`}
                      title={draftStatus === 'completed' ? t('task.statusPending') : t('task.statusCompleted')}
                    >
                      <span className="text-[10px] leading-none">✓</span>
                    </button>
                    <span className="h-4 w-px bg-slate-200" />
                    <div className="relative min-w-0">
                      <button
                        type="button"
                        onClick={() => handleDetailPanelToggle('time')}
                        className={`relative inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-[13px] ${draftTimeButtonClass}`}
                        title={draftTimeButtonTitle}
                      >
                        <IconClock className="h-4 w-4" />
                        <span className="max-w-[14rem] truncate text-left leading-5">{draftTimeSummaryLabel}</span>
                        {hasDraftParsedTimeHint && (
                          <span className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
                        )}
                      </button>
                      {detailPanel === 'time' && (
                        <div className="time-panel-card task-detail-time-panel mobile-scrollbar-hidden md-popover absolute left-0 top-10 z-20 w-[min(22.75rem,calc(100vw-1rem))] max-h-[calc(100vh-7rem)] overflow-y-auto p-2.5">
                          <div className="time-panel-toolbar task-detail-time-panel-header">
                            <div className="time-panel-primary-tabs">
                              <button
                                type="button"
                                onClick={() => {
                                  setDraftTimeRangeEnabled(false);
                                  setDraftTimeRangeEditing('start');
                                  handleDraftFieldChange('end_time', '');
                                }}
                                className={`time-panel-primary-tab${!draftTimeRangeEnabled ? ' time-panel-primary-tab--active' : ''}`}
                              >
                                {t('task.timePanelDate')}
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
                                className={`time-panel-primary-tab${draftTimeRangeEnabled ? ' time-panel-primary-tab--active' : ''}`}
                              >
                                {t('task.timeRange')}
                              </button>
                            </div>
                            <div className="time-panel-subtools">
                              <div className="time-panel-soft-toggle">
                                <button
                                  type="button"
                                  onClick={() => setDraftTimeCalendarMode('solar')}
                                  className={`time-panel-soft-toggle-btn${
                                    draftTimeCalendarMode === 'solar'
                                      ? ' time-panel-soft-toggle-btn--active'
                                      : ''
                                  }`}
                                >
                                  {t('task.calendarSolar')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDraftTimeCalendarMode('lunar')}
                                  className={`time-panel-soft-toggle-btn${
                                    draftTimeCalendarMode === 'lunar'
                                      ? ' time-panel-soft-toggle-btn--active'
                                      : ''
                                  }`}
                                >
                                  {t('task.calendarLunar')}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDraftFieldChange('all_day', !draft.all_day)}
                                className={`time-panel-day-toggle${
                                  draft.all_day
                                    ? ' time-panel-day-toggle--active'
                                    : ''
                                }`}
                              >
                                {t('task.allDay')}
                              </button>
                            </div>
                            <div className="time-quick-actions time-quick-actions--detail">
                              <button
                                type="button"
                                title={t('task.quickToday')}
                                aria-label={t('task.quickToday')}
                                onClick={() => applyQuickDatePreset('today')}
                                className="time-quick-preset"
                              >
                                <IconSun className="h-4 w-4" />
                                <span>{t('task.quickToday')}</span>
                              </button>
                              <button
                                type="button"
                                title={t('task.quickTomorrow')}
                                aria-label={t('task.quickTomorrow')}
                                onClick={() => applyQuickDatePreset('tomorrow')}
                                className="time-quick-preset"
                              >
                                <IconSunrise className="h-4 w-4" />
                                <span>{t('task.quickTomorrow')}</span>
                              </button>
                              <button
                                type="button"
                                title={t('task.quickNextWeek')}
                                aria-label={t('task.quickNextWeek')}
                                onClick={() => applyQuickDatePreset('next_week')}
                                className="time-quick-preset"
                              >
                                <IconCalendar className="h-4 w-4" />
                                <span>{t('task.quickNextWeek')}</span>
                              </button>
                              <button
                                type="button"
                                title={t('task.quickTonight')}
                                aria-label={t('task.quickTonight')}
                                onClick={() => applyQuickDatePreset('tonight')}
                                className="time-quick-preset"
                              >
                                <IconMoon className="h-4 w-4" />
                                <span>{t('task.quickTonight')}</span>
                              </button>
                            </div>
                          </div>
                          <div className="time-panel-calendar-body">
                            <div>
                              {draftTimeRangeEnabled && (
                                <div className="time-panel-range-switch">
                                  <button
                                    type="button"
                                    onClick={() => setDraftTimeRangeEditing('start')}
                                    className={`time-panel-range-switch-btn${draftTimeRangeEditing === 'start' ? ' time-panel-range-switch-btn--active' : ''}`}
                                  >
                                    {t('task.startTime')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDraftTimeRangeEditing('end')}
                                    className={`time-panel-range-switch-btn${draftTimeRangeEditing === 'end' ? ' time-panel-range-switch-btn--active' : ''}`}
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
                                timeSelectVariant="panel-row"
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
                          <div className="time-panel-footer">
                            <button
                              type="button"
                              onClick={() => applyQuickDatePreset('clear')}
                              className="time-panel-clear-btn"
                            >
                              {t('task.clearDate')}
                            </button>
                            <div className="time-panel-footer-actions">
                              <button
                                type="button"
                                onClick={() => closeDetailPanelWithConfirm('time', false)}
                                className="time-panel-cancel-btn"
                              >
                                {t('common.cancel')}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  closeDetailPanelWithConfirm('time', true);
                                  submitDraftImmediately('realtime_time');
                                }}
                                className="time-panel-confirm-btn"
                              >
                                {t('common.confirm')}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      ref={(node) => {
                        detailPanelTriggerRefs.current.activity = node;
                      }}
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
                      <div className="fixed z-20 w-[30rem] max-w-[min(30rem,calc(100vw-3rem))]" style={activityPanelFloatingStyle}>
                        <TaskActivityTimeline taskID={selectedTask.id} />
                      </div>
                    )}
                    <button
                      type="button"
                      ref={(node) => {
                        detailPanelTriggerRefs.current.priority = node;
                      }}
                      onClick={() => handleDetailPanelToggle('priority')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-[13px] ${draftPriorityButtonClass}`}
                      title={draftPriorityTitle}
                    >
                      <IconFlag className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      ref={(node) => {
                        detailPanelTriggerRefs.current.category = node;
                      }}
                      onClick={() => handleDetailPanelToggle('category')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-[13px] ${draftCategoryButtonClass}`}
                      title={draftCategorySummaryLabel}
                    >
                      <IconTag className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      ref={(node) => {
                        detailPanelTriggerRefs.current.recurrence = node;
                      }}
                      onClick={() => handleDetailPanelToggle('recurrence')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-[13px] ${draftRecurrenceButtonClass}`}
                      title={draftRecurrenceSummaryLabel}
                    >
                      {(draft.recurrence_enabled || detailPanel === 'recurrence')
                        ? <IconRepeat className="h-4 w-4" />
                        : <IconRepeatOff className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    {selectedTask.read_only && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">CalDAV Read-only</span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-0 data-[state=open]:bg-slate-100 data-[state=open]:text-slate-700"
                          title={t('common.more')}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-44">
                        <DropdownMenuLabel>{t('common.more')}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                          onSelect={handleDeleteSelected}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="mt-6 py-0.5">
                  <input
                    ref={draftTitleInputRef}
                    data-testid="task-detail-title-input"
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
                    className="w-full border-none bg-transparent px-0 text-[1.55rem] font-semibold leading-9 text-slate-950 outline-none placeholder:text-slate-300 sm:text-[1.65rem]"
                    placeholder={t('task.title')}
                  />
                </div>
                <div className="relative">
                  {detailPanel === 'priority' && (
                      <div className="task-quick-popover md-popover fixed z-20 w-[12.25rem]" style={detailPanelFloatingStyle}>
                        <div className="task-quick-menu">
                          {[
                            { value: '1', label: t('task.priorityHigh'), tone: 'high' },
                            { value: '0', label: t('task.priorityMedium'), tone: 'medium' },
                            { value: '-1', label: t('task.priorityLow'), tone: 'low' },
                          ].map((priorityOption) => {
                            const active = String(draftPriorityValue) === priorityOption.value;
                            return (
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
                                className={`task-quick-option${active ? ' task-quick-option--active' : ''}`}
                              >
                                <span className={`task-quick-option-icon task-quick-option-icon--${priorityOption.tone}`}>
                                  <IconFlag className="h-4 w-4" />
                                </span>
                                <span className="task-quick-option-label">{priorityOption.label}</span>
                                <IconCheck className="task-quick-option-check h-4 w-4" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                  )}

                  {detailPanel === 'category' && (
                      <div className="task-quick-popover task-quick-popover-scroll md-popover fixed z-20 w-[14.75rem]" style={detailPanelFloatingStyle}>
                        <div className="task-quick-menu">
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
                                className={`task-quick-option${active ? ' task-quick-option--active' : ''}`}
                              >
                                <span className="task-quick-option-icon">
                                  {showCategoryEmoji && cat.emoji ? (
                                    <span className="task-quick-category-emoji">{cat.emoji}</span>
                                  ) : (
                                    <span className="task-quick-category-swatch" style={{ backgroundColor: cat.color || '#94a3b8' }} />
                                  )}
                                </span>
                                <span className="task-quick-option-label">{cat.name}</span>
                                <IconCheck className="task-quick-option-check h-4 w-4" />
                              </button>
                            );
                          })}
                        </div>
                        {categories.length === 0 && (
                          <p className="task-quick-empty">{t('category.noCategories')}</p>
                        )}
                      </div>
                  )}

                  {detailPanel === 'recurrence' && (
                      <div className="task-quick-popover task-quick-popover-scroll md-popover fixed z-20 w-[18.25rem]" style={detailPanelFloatingStyle}>
                        <div className="task-quick-header">
                          <div className="task-quick-title">{t('task.repeat')}</div>
                          <div className="task-quick-toggle">
                            <button
                              type="button"
                              onClick={() => {
                                handleDraftFieldChange('recurrence_enabled', false);
                                handleDraftFieldChange('recurrence_type', 'daily');
                                handleDraftFieldChange('recurrence_days', []);
                                handleDraftFieldChange('recurrence_date', 1);
                              }}
                              className={`task-quick-toggle-btn${!draft.recurrence_enabled ? ' task-quick-toggle-btn--active' : ''}`}
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
                              className={`task-quick-toggle-btn${draft.recurrence_enabled ? ' task-quick-toggle-btn--active' : ''}`}
                            >
                              {t('task.repeatOn')}
                            </button>
                          </div>
                        </div>

                        {draft.recurrence_enabled && (
                          <div className="space-y-2">
                            <div className="task-quick-menu">
                              {[
                                { value: 'daily', label: t('task.daily') },
                                { value: 'weekly', label: t('task.weekly') },
                                { value: 'monthly', label: t('task.monthly') },
                                { value: 'yearly', label: t('task.yearly') },
                              ].map((option) => {
                                const active = (draft.recurrence_type || 'daily') === option.value;
                                return (
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
                                    className={`task-quick-option${active ? ' task-quick-option--active' : ''}`}
                                  >
                                    <span className="task-quick-option-icon">
                                      <IconRepeat className="h-4 w-4" />
                                    </span>
                                    <span className="task-quick-option-label">{option.label}</span>
                                    <IconCheck className="task-quick-option-check h-4 w-4" />
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() => setShowDraftCustomRecurrenceMenu((prev) => !prev)}
                                className={`task-quick-option${isDraftCustomRecurrenceType || showDraftCustomRecurrenceMenu ? ' task-quick-option--active' : ''}`}
                              >
                                <span className="task-quick-option-icon">
                                  <IconRepeat className="h-4 w-4" />
                                </span>
                                <span className="task-quick-option-label">{t('task.customRepeat')}</span>
                                <IconCheck className="task-quick-option-check h-4 w-4" />
                              </button>
                            </div>
                            {(showDraftCustomRecurrenceMenu || isDraftCustomRecurrenceType) && (
                              <div className="task-quick-section task-quick-subpanel">
                                <div className="task-quick-section-title">{t('task.customRepeat')}</div>
                                <div className="task-quick-chip-row">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDraftFieldChange('recurrence_type', 'biweekly');
                                      if ((draft.recurrence_days || []).length === 0) {
                                        handleDraftFieldChange('recurrence_days', workDayKeys);
                                      }
                                    }}
                                    className={`task-quick-chip${(draft.recurrence_type || 'daily') === 'biweekly' ? ' task-quick-chip--active' : ''}`}
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
                                    className={`task-quick-chip${(draft.recurrence_type || 'daily') === 'lunar' ? ' task-quick-chip--active' : ''}`}
                                  >
                                    {t('task.lunarYearly')}
                                  </button>
                                </div>
                              </div>
                            )}

                            {(draft.recurrence_type || 'daily') === 'lunar' && (
                              <div className="task-quick-section task-quick-subpanel">
                                <div className="task-quick-section-title">{t('task.lunarYearly')}</div>
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
                                <div className="mt-2 rounded-xl bg-white px-2 py-1.5 text-xs text-slate-600">
                                  {`${t('task.lunarYearly')} ${draft.recurrence_lunar_is_leap_month ? t('task.lunarLeapPrefix') : ''}${Number.parseInt(draft.recurrence_lunar_month, 10) || 1}/${Number.parseInt(draft.recurrence_lunar_day, 10) || 1}`}
                                </div>
                              </div>
                            )}

                            {((draft.recurrence_type || 'daily') === 'weekly' || (draft.recurrence_type || 'daily') === 'biweekly') && (
                              <div className="task-quick-section">
                                <p className="task-quick-section-title">{t('task.selectWeekdays')}</p>
                                <div className="task-quick-chip-row mb-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDraftFieldChange('recurrence_days', workDayKeys)}
                                    className="task-quick-chip"
                                  >
                                    {t('task.weekdaysWorkdays')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDraftFieldChange('recurrence_days', allDayKeys)}
                                    className="task-quick-chip"
                                  >
                                    {t('task.weekdaysAll')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDraftFieldChange('recurrence_days', [])}
                                    className="task-quick-chip"
                                  >
                                    {t('task.weekdaysClear')}
                                  </button>
                                </div>
                                <div className="task-quick-weekday-grid">
                                  {weekDays.map((day) => (
                                    <button
                                      key={day.key}
                                      type="button"
                                      onClick={() => toggleDraftRecurrenceDay(day.key)}
                                      className={`task-quick-weekday${(draft.recurrence_days || []).includes(day.key) ? ' task-quick-weekday--active' : ''}`}
                                    >
                                      {day.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(draft.recurrence_type || 'daily') === 'monthly' && (
                              <div className="task-quick-section">
                                <button
                                  type="button"
                                  onClick={() => setShowDraftMonthlyDatePicker((prev) => !prev)}
                                  className="task-quick-date-trigger"
                                >
                                  <span>{t('task.monthlyOnDate')}</span>
                                  <span className="task-quick-date-value">
                                    {clampMonthlyDate(draft.recurrence_date, 1)}
                                  </span>
                                </button>
                                {showDraftMonthlyDatePicker && (
                                  <div className="task-quick-date-grid">
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
                                            className={`task-quick-date-cell${active ? ' task-quick-date-cell--active' : ''}`}
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
                        <div className="task-quick-footer">
                          <button
                            type="button"
                            onClick={() => closeDetailPanelWithConfirm('recurrence', false)}
                            className="task-quick-action task-quick-action--ghost"
                          >
                            {t('common.cancel')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              closeDetailPanelWithConfirm('recurrence', true);
                              submitDraftImmediately('realtime_recurrence');
                            }}
                            className="task-quick-action task-quick-action--primary"
                          >
                            {t('common.confirm')}
                          </button>
                        </div>
                      </div>
                  )}
                </div>
              </div>

              <div ref={bindDetailBodyScroll} className="task-detail-body-scroll editor-scrollbar-overlay flex min-h-0 flex-1 flex-col overflow-auto px-8 py-6">
                <div
                  className="task-description-editor-shell flex min-h-0 min-w-0 flex-1 cursor-text flex-col overflow-hidden bg-white"
                  onClick={(event) => {
                    if (shouldFocusDescriptionEditorFromShellClick(event)) {
                      draftDescriptionEditorRef.current?.focus();
                    }
                  }}
                >
                  <TaskDescriptionAI
                    task={selectedTaskDraftForAI}
                    allTasks={tasksRaw}
                    categories={categories}
                    getCurrentDescription={getCurrentDraftDescriptionValue}
                    onApply={handleApplyAIDraftDescription}
                    disabled={selectedTask.read_only}
                  />
                  <LiveMarkdownEditor
                    ref={draftDescriptionEditorRef}
                    key={`task-editor-${selectedTask.id}`}
                    value={draft.description}
                    onChange={(nextValue) => handleDraftDescriptionChange(nextValue, {
                      taskID: getEffectiveTaskID(selectedTask),
                      sessionID: activeDescriptionSessionRef.current,
                      taskValue: selectedTask,
                      draftValue: draft,
                    })}
                    onSaveShortcut={handleDraftEditorSaveShortcut}
                    placeholder={t('task.description')}
                    className="min-h-0 min-w-0 flex-1 overflow-hidden"
                    fill
                    minHeight={280}
                  />
                </div>
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
                  {deleteDialogSubmitting ? t('task.submitting') : t('task.skipThis')}
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
});

function TaskList({ forcedView = '' }) {
  const location = useLocation();
  return <TaskListView forcedView={forcedView} routeLocation={location} />;
}

export default TaskList;
