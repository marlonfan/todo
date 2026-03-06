import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import TaskModal from './TaskModal';
import { formatDateTime, getUserTimeGranularity, getUserTimezone, toInputFormat, toISOString } from '../utils/time';
import { getNaturalTimeOptionsFromUser, parseNaturalTimeFromTitle, parsePriorityFromTitle } from '../utils/naturalTime';
import {
  getShowCategoryEmoji,
  onUIPrefsChanged,
  getTaskListSortPref,
  setTaskListSortPref,
  getTaskListGroupPref,
  setTaskListGroupPref,
} from '../utils/uiPrefs';
import { IconClock, IconFlag, IconGroup, IconHistory, IconRepeat, IconRepeatOff, IconSearch, IconSort, IconTag } from './icons/TaskIcons';
import LiveMarkdownEditor from './LiveMarkdownEditor';
import TaskActivityTimeline from './TaskActivityTimeline';
import { useCategoriesQuery, useTasksQuery } from '../query/hooks';
import { queryKeys } from '../query/keys';
import {
  cancelTaskLocal,
  createTaskLocal,
  deleteTaskLocal,
  updateTaskLocal,
  updateTaskStatusLocal,
} from '../data/taskMutations';

const WEEKDAY_ONLY_RE = /^(MO|TU|WE|TH|FR|SA|SU)$/;
const ORDINAL_WEEKDAY_RE = /^(-?\d)(MO|TU|WE|TH|FR|SA|SU)$/;
const DRAFT_IDLE_SUBMIT_MS = 30000;

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

function parseLocalInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = dayjs(raw);
  return parsed.isValid() ? parsed : null;
}

function buildTimeSummaryLabel(startInput, endInput, isAllDay, noDateLabel) {
  const start = parseLocalInput(startInput);
  const end = parseLocalInput(endInput);
  if (!start && !end) return noDateLabel;
  if (!isAllDay) {
    if (start) return start.format('MM/DD HH:mm');
    return end.format('MM/DD HH:mm');
  }
  if (!start && end) return end.format('MM/DD');
  if (start && !end) return start.format('MM/DD');
  if (isAllDay) {
    return `${start.format('MM/DD')}-${end.format('MM/DD')}`;
  }
  return start.format('MM/DD');
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

function buildRecurrenceSummaryLabel(enabled, recurrenceType, selectedDays, t) {
  if (!enabled) return t('task.repeatOff');
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

function parseRecurrenceSelection(rule) {
  if (!rule) return { type: 'daily', days: [], monthDate: 1 };
  const freq = String(rule.freq || 'daily').trim().toLowerCase();
  const interval = Math.max(1, Number.parseInt(rule.interval, 10) || 1);
  const byDay = normalizeByDayList(rule.byday || rule.byDay);
  const monthDate = resolveMonthlyDateFromRule(rule, '');
  if (freq === 'weekly' && interval === 2) {
    return { type: 'biweekly', days: byDay.filter((day) => WEEKDAY_ONLY_RE.test(day)), monthDate };
  }
  return {
    type: freq || 'daily',
    days: byDay.filter((day) => WEEKDAY_ONLY_RE.test(day)),
    monthDate,
  };
}

function getTaskPrimaryTime(task) {
  return task.start_time || task.due_date || '';
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
              </span>
            </div>
          </div>

          {task.description && (
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{task.description}</p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="text-slate-400 sm:hidden">
              {primaryTime ? formatDateTime(primaryTime, 'MM/DD HH:mm', timezone) : ''}
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
  const timeInputStepSeconds = timeGranularity * 60;
  const { data: tasks = [], isLoading: tasksLoading } = useTasksQuery();
  const { data: categories = [] } = useCategoriesQuery();

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
  const [lastSavedAt, setLastSavedAt] = useState('');
  const [detailPanel, setDetailPanel] = useState('');
  const [draftParsePreview, setDraftParsePreview] = useState('');
  const [showDraftCustomRecurrenceMenu, setShowDraftCustomRecurrenceMenu] = useState(false);
  const [showDraftMonthlyDatePicker, setShowDraftMonthlyDatePicker] = useState(false);
  const [showActivityPanel, setShowActivityPanel] = useState(false);
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
  const draftSyncTimerRef = useRef(0);
  const pendingDraftSubmitRef = useRef({ taskID: 0, payload: null });
  const selectedTaskSnapshotRef = useRef(null);
  const draftSnapshotRef = useRef(null);
  const isDraftDirtyRef = useRef(false);
  const isSavingDraftRef = useRef(false);
  const leaveFlushInFlightRef = useRef(false);
  const flushDraftOnLeaveRef = useRef(null);

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
      if (!detailPanelRef.current) return;
      if (!detailPanelRef.current.contains(event.target)) {
        setDetailPanel('');
        setShowActivityPanel(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [detailPanel, showActivityPanel]);

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
  const setTasksCache = (updater) => {
    queryClient.setQueryData(queryKeys.tasks.all, (prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const next = typeof updater === 'function' ? updater(base) : updater;
      return Array.isArray(next) ? next : base;
    });
  };

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
      return tasks.filter((task) => task.status === 'completed');
    }

    if (view === 'deleted') {
      return tasks.filter((task) => task.status === 'cancelled');
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
  }, [activeCategoryID, tasks, timezone, view]);

  const searchedTasks = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (view !== 'search') return baseFilteredTasks;
    if (!keyword) return baseFilteredTasks;
    return baseFilteredTasks.filter((task) => {
      const title = String(task.title || '').toLowerCase();
      const description = String(task.description || '').toLowerCase();
      const categoryText = (task.categories || [])
        .map((cat) => String(cat.name || '').toLowerCase())
        .join(' ');
      return title.includes(keyword) || description.includes(keyword) || categoryText.includes(keyword);
    });
  }, [baseFilteredTasks, searchKeyword, view]);

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
    if (filteredTasks.length === 0) {
      setSelectedTaskID(0);
      setDraft(null);
      draftSourceTaskIDRef.current = 0;
      return;
    }

    const exists = filteredTasks.some((task) => task.id === selectedTaskID);
    if (!exists) {
      setSelectedTaskID(filteredTasks[0].id);
    }
  }, [filteredTasks, selectedTaskID]);

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

  const selectedTask = useMemo(
    () => filteredTasks.find((task) => task.id === selectedTaskID) || null,
    [filteredTasks, selectedTaskID]
  );
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
    t('task.noDate')
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
    t
  );
  const draftRecurrenceButtonClass = detailPanel === 'recurrence'
    ? 'bg-slate-100 text-slate-700'
    : draft?.recurrence_enabled
      ? 'text-emerald-600 hover:bg-emerald-50'
      : 'text-slate-500 hover:bg-slate-100';
  const isDraftCustomRecurrenceType = (draft?.recurrence_type || 'daily') === 'biweekly' || (draft?.recurrence_type || 'daily') === 'lunar';

  useEffect(() => {
    setDraftParsePreview('');
    setShowDraftCustomRecurrenceMenu(false);
    setShowDraftMonthlyDatePicker(false);
    setShowActivityPanel(false);
  }, [selectedTask?.id]);

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
    const parsedRecurrence = parseRecurrenceSelection(recurrenceRule);
    return {
      title: taskValue.title || '',
      description: taskValue.description || '',
      priority: String(taskValue.priority ?? 0),
      status: taskValue.status || 'pending',
      all_day: allDay,
      start_time: startTime ? toInputFormat(startTime, null, allDay) : '',
      end_time: endTime ? toInputFormat(endTime, null, allDay) : '',
      category_ids: (taskValue.categories || []).map((cat) => String(cat.id)),
      recurrence_enabled: !!recurrenceRule,
      recurrence_type: parsedRecurrence.type,
      recurrence_days: parsedRecurrence.days,
      recurrence_date: parsedRecurrence.monthDate,
    };
  };

  useEffect(() => {
    if (!selectedTask) {
      setDraft(null);
      lastSyncedSelectedIDRef.current = 0;
      draftSourceTaskIDRef.current = 0;
      draftTouchedRef.current = false;
      return;
    }

    const nextDraft = buildDraftFromTask(selectedTask);
    if (lastSyncedSelectedIDRef.current !== selectedTask.id) {
      lastSyncedSelectedIDRef.current = selectedTask.id;
      draftSourceTaskIDRef.current = selectedTask.id;
      draftTouchedRef.current = false;
      setDraft(nextDraft);
      setDetailPanel('');
      return;
    }

    if (!draft) {
      draftTouchedRef.current = false;
      draftSourceTaskIDRef.current = selectedTask.id;
      setDraft(nextDraft);
      return;
    }

    // Keep detail draft synced with external updates (drag/drop, modal save, etc.)
    // unless the user is actively editing this draft.
    if (!draftTouchedRef.current) {
      const current = normalizeDraftForCompare(draft);
      const incoming = normalizeDraftForCompare(nextDraft);
      if (JSON.stringify(current) !== JSON.stringify(incoming)) {
        draftSourceTaskIDRef.current = selectedTask.id;
        setDraft(nextDraft);
      }
    }
  }, [selectedTask, draft]);

  useEffect(() => {
    if (!draft) return;

    if (draft.all_day) {
      const nextStart = draft.start_time && draft.start_time.includes('T') ? draft.start_time.split('T')[0] : draft.start_time;
      const nextEnd = draft.end_time && draft.end_time.includes('T') ? draft.end_time.split('T')[0] : draft.end_time;
      if (nextStart !== draft.start_time || nextEnd !== draft.end_time) {
        setDraft((prev) => (prev ? { ...prev, start_time: nextStart || '', end_time: nextEnd || '' } : prev));
      }
      return;
    }

    const nextStart = draft.start_time && !draft.start_time.includes('T') ? `${draft.start_time}T00:00` : draft.start_time;
    const nextEnd = draft.end_time && !draft.end_time.includes('T') ? `${draft.end_time}T23:59` : draft.end_time;
    if (nextStart !== draft.start_time || nextEnd !== draft.end_time) {
      setDraft((prev) => (prev ? { ...prev, start_time: nextStart || '', end_time: nextEnd || '' } : prev));
    }
  }, [draft]);

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
  const hasPendingSubmit = !!selectedTask && pendingSubmitTaskID === selectedTask.id;

  const getPriorityBadge = (priorityValue) => {
    const value = Number.parseInt(priorityValue, 10) || 0;
    if (value === 1) return { text: t('task.priorityHigh'), className: 'text-rose-600 bg-rose-50 border-rose-200' };
    if (value === -1) return { text: t('task.priorityLow'), className: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    return { text: t('task.priorityMedium'), className: 'text-sky-600 bg-sky-50 border-sky-200' };
  };

  const handleStatusChange = useCallback(async (task, newStatus) => {
    if (task.read_only) return;
    try {
      if (task.recurrence_rule) {
        await updateTaskStatusLocal(queryClient, task.id, {
          status: newStatus,
          occurrence_date: dayjs().tz(timezone).format('YYYY-MM-DD'),
        }, {
          submitMeta: {
            submittedAt: new Date().toISOString(),
            submitSource: 'manual',
          },
        });
      } else {
        await updateTaskStatusLocal(queryClient, task.id, newStatus, {
          submitMeta: {
            submittedAt: new Date().toISOString(),
            submitSource: 'manual',
          },
        });
      }
    } catch (err) {
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
        start_time: toISOString(startLocal),
        start_time_local: startLocal,
      };
      if (activeCategoryID > 0) {
        payload.category_ids = [activeCategoryID];
      }

      const createdTask = await createTaskLocal(queryClient, payload);
      setQuickTitle('');
      if (createdTask?.id) {
        setSelectedTaskID(createdTask.id);
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleDraftFieldChange = (field, value) => {
    draftTouchedRef.current = true;
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const applyQuickDatePreset = (preset) => {
    draftTouchedRef.current = true;
    setDraft((prev) => {
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
          end_time: '',
        };
      }

      return {
        ...prev,
        start_time: target.hour(hour).minute(minute).second(0).format('YYYY-MM-DDTHH:mm'),
        end_time: prev.end_time || '',
      };
    });
  };

  const toggleDraftCategory = (catID) => {
    draftTouchedRef.current = true;
    setDraft((prev) => {
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
  };

  const toggleDraftRecurrenceDay = (dayKey) => {
    draftTouchedRef.current = true;
    setDraft((prev) => {
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
  const workDayKeys = ['MO', 'TU', 'WE', 'TH', 'FR'];
  const allDayKeys = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

  const splitDatePart = (value) => (value && value.includes('T') ? value.split('T')[0] : value || '');

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
      || clampMonthlyDate(draftValue.recurrence_date, 1) !== clampMonthlyDate(originalDraft?.recurrence_date, 1);
    const timeChanged =
      !!draftValue.all_day !== !!originalDraft?.all_day
      || String(draftValue.start_time || '') !== String(originalDraft?.start_time || '')
      || String(draftValue.end_time || '') !== String(originalDraft?.end_time || '');

    const payload = {
      title: normalizedTitle,
      description: draftValue.description || '',
      priority: normalizedPriority,
      status: draftValue.status || taskValue.status || 'pending',
      client_timezone: timezone,
      category_ids: (draftValue.category_ids || []).map((id) => Number.parseInt(id, 10)).filter((id) => !Number.isNaN(id)),
    };

    if (timeChanged || recurrenceChanged) {
      const startInput = String(draftValue.start_time || originalDraft?.start_time || '');
      const endInput = String(draftValue.end_time || originalDraft?.end_time || '');
      payload.all_day = !!draftValue.all_day;
      if (payload.all_day) {
        const startDate = splitDatePart(startInput);
        const endDate = splitDatePart(endInput);
        payload.start_time = startDate ? toISOString(`${startDate} 00:00:00`) : null;
        payload.end_time = endDate ? toISOString(`${endDate} 23:59:59`) : null;
      } else {
        payload.start_time = startInput ? toISOString(startInput) : null;
        payload.end_time = endInput ? toISOString(endInput) : null;
      }

      if (startInput) payload.start_time_local = startInput;
      if (endInput) payload.end_time_local = endInput;
    }

    if (draftValue.recurrence_enabled) {
      const normalizedDays = (draftValue.recurrence_days || [])
        .map((day) => String(day || '').toUpperCase())
        .filter((day) => WEEKDAY_ONLY_RE.test(day));
      const rule = {
        freq: draftValue.recurrence_type || 'daily',
        interval: 1,
      };
      if (draftValue.recurrence_type === 'biweekly') {
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
  }, [timezone, workDayKeys]);

  const submitPendingDraft = useCallback(async (taskIDOverride = 0, submitSource = 'idle') => {
    const pending = pendingDraftSubmitRef.current;
    if (!pending?.taskID || !pending?.payload) return;
    const taskID = Number(taskIDOverride || pending.taskID || 0);
    if (!taskID || taskID !== Number(pending.taskID)) return;
    if (submittingDraft) return;

    setSubmittingDraft(true);
    try {
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
      setLastSavedAt(dayjs().format('HH:mm:ss'));
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
    if (!selectedTask || !draft) return;
    if (selectedTask.read_only) return;
    if (savingDraft) return;
    if (draftSourceTaskIDRef.current !== selectedTask.id) return;
    const title = (draft.title || '').trim();
    if (!title) return;

    const targetTaskID = selectedTask.id;
    const built = buildDraftPayload(selectedTask, draft);
    if (!built?.payload) return;

    setSavingDraft(true);
    try {
      if (built.normalizedTitle !== title || String(built.normalizedPriority) !== String(draft.priority)) {
        setDraft((prev) => (prev ? {
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
        return;
      }
      draftTouchedRef.current = false;
      void savedTask;

      pendingDraftSubmitRef.current = { taskID: targetTaskID, payload: built.payload };
      setPendingSubmitTaskID(targetTaskID);
      scheduleIdleDraftSubmit(targetTaskID);
      setLastSavedAt(dayjs().format('HH:mm:ss'));

      if (submitAfter) {
        void submitPendingDraft(targetTaskID, submitSource);
      }
    } catch (err) {
      console.error('Failed to save task details:', err);
    } finally {
      setSavingDraft(false);
    }
  };

  const flushDraftOnLeave = useCallback(async (submitSource = 'leave') => {
    if (leaveFlushInFlightRef.current) return;
    const taskValue = selectedTaskSnapshotRef.current;
    const draftValue = draftSnapshotRef.current;
    if (!taskValue || !draftValue) return;
    if (taskValue.read_only) return;
    if (!isDraftDirtyRef.current || !draftTouchedRef.current) return;
    if (isSavingDraftRef.current) return;
    if (!(draftValue.title || '').trim()) return;

    const built = buildDraftPayload(taskValue, draftValue);
    if (!built?.payload) return;

    leaveFlushInFlightRef.current = true;
    try {
      await updateTaskLocal(queryClient, taskValue.id, built.payload, {
        scheduleSync: false,
        localOnly: true,
      });
      await updateTaskLocal(queryClient, taskValue.id, built.payload, {
        scheduleSync: true,
        localOnly: false,
        skipOptimistic: true,
        submitMeta: {
          submittedAt: new Date().toISOString(),
          submitSource,
        },
      });
    } catch (error) {
      console.error('Failed to flush draft on leave:', error);
    } finally {
      leaveFlushInFlightRef.current = false;
    }
  }, [buildDraftPayload, queryClient]);

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

  const handleSubmitDraft = async () => {
    if (!selectedTask || selectedTask.read_only) return;
    if (isDraftDirty) {
      await handleSaveDraft({ submitAfter: true, submitSource: 'manual' });
      return;
    }
    await submitPendingDraft(selectedTask.id, 'manual');
  };

  const handleDraftEditorSaveShortcut = useCallback(() => {
    void handleSubmitDraft();
  }, [handleSubmitDraft]);

  const handleDeleteSelected = async () => {
    if (!selectedTask) return;
    if (selectedTask.read_only) return;
    if (!confirm(t('task.deleteConfirm'))) return;

    try {
      if (selectedTask?.status === 'cancelled') {
        await deleteTaskLocal(queryClient, selectedTask.id);
      } else {
        await cancelTaskLocal(queryClient, selectedTask.id);
      }
      if (Number(pendingDraftSubmitRef.current?.taskID || 0) === Number(selectedTask.id)) {
        pendingDraftSubmitRef.current = { taskID: 0, payload: null };
        setPendingSubmitTaskID(0);
      }
      setSelectedTaskID(0);
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  useEffect(() => {
    if (!selectedTask || !draft || !isDraftDirty || savingDraft) return;
    if (!draftTouchedRef.current) return;
    if (!(draft.title || '').trim()) return;

    const timer = window.setTimeout(() => {
      handleSaveDraft();
    }, 800);

    return () => window.clearTimeout(timer);
  }, [draft, isDraftDirty, savingDraft, selectedTask]);

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

  const handleTaskSaved = async (savedTask) => {
    handleModalClose();
    if (savedTask?.id) {
      setTasksCache((prev) => {
        const exists = prev.some((taskItem) => taskItem.id === savedTask.id);
        if (exists) {
          return prev.map((taskItem) => (taskItem.id === savedTask.id ? savedTask : taskItem));
        }
        return [savedTask, ...prev];
      });
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

  const handleSelectTask = useCallback((task) => {
    setSelectedTaskID(task.id);
    if (isMobileViewport) {
      openAdvancedModal(task);
    }
  }, [isMobileViewport, openAdvancedModal]);

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
                    className="w-full border-none bg-transparent text-lg font-semibold text-slate-900 outline-none placeholder:text-slate-300 sm:text-xl"
                    placeholder={t('task.title')}
                  />
                </div>
                <div className="mt-2 flex min-h-[36px] items-center justify-between gap-3">
                  <div className="order-2 flex items-center justify-end gap-2 text-xs">
                    {selectedTask.read_only && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">CalDAV Read-only</span>
                    )}
                    {savingDraft ? (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">{t('task.saving')}</span>
                    ) : (submittingDraft && hasPendingSubmit) ? (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-700">{t('task.submitting')}</span>
                    ) : isDraftDirty ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{t('task.unsavedChanges')}</span>
                    ) : hasPendingSubmit ? (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">{t('task.pendingSubmit')}</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">{t('task.saved')}</span>
                    )}
                    {lastSavedAt && <span className="text-slate-400">{t('task.lastSavedAt', { time: lastSavedAt })}</span>}
                  </div>
                  <div ref={detailPanelRef} className="order-1 relative flex min-w-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDetailPanel('');
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
                      onClick={() => setDetailPanel(detailPanel === 'priority' ? '' : 'priority')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${draftPriorityButtonClass}`}
                      title={draftPriorityTitle}
                    >
                      <IconFlag className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailPanel(detailPanel === 'category' ? '' : 'category')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${draftCategoryButtonClass}`}
                      title={draftCategorySummaryLabel}
                    >
                      <IconTag className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailPanel(detailPanel === 'recurrence' ? '' : 'recurrence')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${draftRecurrenceButtonClass}`}
                      title={draftRecurrenceSummaryLabel}
                    >
                      {(draft.recurrence_enabled || detailPanel === 'recurrence')
                        ? <IconRepeat className="h-4 w-4" />
                        : <IconRepeatOff className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailPanel(detailPanel === 'time' ? '' : 'time')}
                      className={`relative inline-flex h-8 min-w-0 items-center gap-1 rounded-md px-2 text-sm ${draftTimeButtonClass}`}
                      title={draftTimeButtonTitle}
                    >
                      <IconClock className="h-4 w-4" />
                      <span className="w-20 truncate text-left text-[11px] leading-4">{draftTimeSummaryLabel}</span>
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
                                handleDraftFieldChange('priority', priorityOption.value);
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
                      <div className="md-popover absolute right-0 top-10 z-20 w-[30rem] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('task.startTime')}</div>
                          <button
                            type="button"
                            onClick={() => handleDraftFieldChange('all_day', !draft.all_day)}
                            className={`rounded-full border px-2.5 py-1 text-xs ${
                              draft.all_day
                                ? 'border-blue-300 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-500'
                            }`}
                          >
                            {t('task.allDay')}
                          </button>
                        </div>
                        <div className="mb-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => applyQuickDatePreset('today')} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
                            {t('task.quickToday')}
                          </button>
                          <button type="button" onClick={() => applyQuickDatePreset('tomorrow')} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
                            {t('task.quickTomorrow')}
                          </button>
                          <button type="button" onClick={() => applyQuickDatePreset('tonight')} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
                            {t('task.quickTonight')}
                          </button>
                          <button type="button" onClick={() => applyQuickDatePreset('next_week')} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
                            {t('task.quickNextWeek')}
                          </button>
                          <button type="button" onClick={() => applyQuickDatePreset('clear')} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50">
                            {t('task.clearDate')}
                          </button>
                        </div>
                        {draft.all_day ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="form-label">{t('task.startTime')}</label>
                              <input
                                type="date"
                                value={splitDatePart(draft.start_time)}
                                onChange={(e) => handleDraftFieldChange('start_time', e.target.value)}
                                className="form-input"
                              />
                            </div>
                            <div>
                              <label className="form-label">{t('task.endTime')}</label>
                              <input
                                type="date"
                                value={splitDatePart(draft.end_time)}
                                onChange={(e) => handleDraftFieldChange('end_time', e.target.value)}
                                className="form-input"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <label className="form-label">{t('task.startTime')}</label>
                              <input
                                type="datetime-local"
                                step={timeInputStepSeconds}
                                value={draft.start_time || ''}
                                onChange={(e) => handleDraftFieldChange('start_time', e.target.value || '')}
                                className="form-input"
                              />
                            </div>
                            <div>
                              <label className="form-label">{t('task.endTime')}</label>
                              <input
                                type="datetime-local"
                                step={timeInputStepSeconds}
                                value={draft.end_time || ''}
                                onChange={(e) => handleDraftFieldChange('end_time', e.target.value || '')}
                                className="form-input"
                              />
                            </div>
                          </div>
                        )}
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
                                    disabled
                                    title={t('task.lunarRepeatPending')}
                                    className="cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-400"
                                  >
                                    {t('task.lunarDay')}
                                  </button>
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
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <label className="mb-1 block text-xs font-medium text-slate-500">{t('task.description')}</label>
                  <LiveMarkdownEditor
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

              <div className="flex items-center justify-between border-t border-blue-100 px-4 py-3">
                <button onClick={handleDeleteSelected} className="btn-danger text-sm">
                  {t('common.delete')}
                </button>
                <button
                  onClick={handleSubmitDraft}
                  disabled={savingDraft || submittingDraft || (!isDraftDirty && !hasPendingSubmit)}
                  className="btn-primary text-sm"
                >
                  {submittingDraft ? t('task.submitting') : t('settings.syncNow')}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {modalOpen && <TaskModal task={modalTask} onClose={handleModalClose} onSaved={handleTaskSaved} />}
    </div>
  );
}

export default TaskList;
