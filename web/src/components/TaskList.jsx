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
import { IconClock, IconFlag, IconGroup, IconRepeat, IconSearch, IconSort, IconTag } from './icons/TaskIcons';
import LiveMarkdownEditor from './LiveMarkdownEditor';
import { useCategoriesQuery, useTasksQuery } from '../query/hooks';
import { queryKeys } from '../query/keys';
import {
  cancelTaskLocal,
  createTaskLocal,
  deleteTaskLocal,
  updateTaskLocal,
  updateTaskStatusLocal,
} from '../data/taskMutations';
import { scheduleSync } from '../data/syncEngine';

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
  const [quickTitle, setQuickTitle] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortBy, setSortBy] = useState('due_asc');
  const [groupBy, setGroupBy] = useState('none');
  const [listToolbarPanel, setListToolbarPanel] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState('');
  const [detailPanel, setDetailPanel] = useState('');
  const [draftParsePreview, setDraftParsePreview] = useState('');
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

  const params = new URLSearchParams(location.search);
  const isSearchPath = location.pathname === '/search';
  const view = forcedView || (isSearchPath ? 'search' : (params.get('view') || 'all'));
  const legacySearchQuery = String(params.get('q') || '').trim();
  const categoryID = Number.parseInt(params.get('category_id') || '', 10);
  const activeCategoryID = Number.isNaN(categoryID) ? 0 : categoryID;
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
    if (!detailPanel) return undefined;
    const handlePointerDown = (event) => {
      if (!detailPanelRef.current) return;
      if (!detailPanelRef.current.contains(event.target)) {
        setDetailPanel('');
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
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

  useEffect(() => () => {
    if (draftSyncTimerRef.current) {
      window.clearTimeout(draftSyncTimerRef.current);
      draftSyncTimerRef.current = 0;
      // Flush deferred outbox sync on unmount to avoid pending local-only edits.
      scheduleSync();
    }
  }, []);

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

  const selectedTask = useMemo(
    () => filteredTasks.find((task) => task.id === selectedTaskID) || null,
    [filteredTasks, selectedTaskID]
  );
  const parsedDraftPriority = parsePriorityFromTitle(String(draft?.title || ''));
  const draftPriorityValue = Number.isInteger(parsedDraftPriority?.priority)
    ? parsedDraftPriority.priority
    : (Number.parseInt(draft?.priority, 10) || 0);
  const isZh = i18n.language === 'zh-CN';
  const draftPriorityIndicator = draftPriorityValue === 1
    ? { text: isZh ? '高' : 'High', title: t('task.priorityHigh'), className: 'text-rose-600' }
    : draftPriorityValue === -1
      ? { text: isZh ? '低' : 'Low', title: t('task.priorityLow'), className: 'text-emerald-600' }
      : { text: isZh ? '中' : 'Medium', title: t('task.priorityMedium'), className: 'text-sky-600' };

  useEffect(() => {
    setDraftParsePreview('');
  }, [selectedTask?.id]);

  const buildDraftFromTask = (taskValue) => {
    if (!taskValue) return null;
    const allDay = !!(taskValue.all_day || taskValue.allDay);
    const startTime = taskValue.start_time || taskValue.startTime || taskValue.due_date || '';
    const endTime = taskValue.end_time || taskValue.endTime || '';
    const recurrenceRule = parseRecurrenceRule(taskValue.recurrence_rule || taskValue.recurrenceRule);
    const recurrenceType = recurrenceRule?.freq || 'daily';
    const byDay = recurrenceRule?.byday || recurrenceRule?.byDay;
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
      recurrence_type: recurrenceType,
      recurrence_days: Array.isArray(byDay) ? byDay.map((day) => String(day)) : [],
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
        });
      } else {
        await updateTaskStatusLocal(queryClient, task.id, newStatus);
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
  const handleSaveDraft = async () => {
    if (!selectedTask || !draft) return;
    if (selectedTask.read_only) return;
    if (savingDraft) return;
    if (draftSourceTaskIDRef.current !== selectedTask.id) return;
    const title = (draft.title || '').trim();
    if (!title) return;

    const targetTaskID = selectedTask.id;
    setSavingDraft(true);
    try {
      const parsedPriority = parsePriorityFromTitle(title);
      const normalizedTitle = parsedPriority?.cleanedTitle?.trim() || title;
      const normalizedPriority = Number.isInteger(parsedPriority?.priority)
        ? parsedPriority.priority
        : (Number.parseInt(draft.priority, 10) || 0);
      if (normalizedTitle !== title || String(normalizedPriority) !== String(draft.priority)) {
        setDraft((prev) => (prev ? {
          ...prev,
          title: normalizedTitle,
          priority: String(normalizedPriority),
        } : prev));
      }
      const originalDraft = buildDraftFromTask(selectedTask);
      const timeChanged =
        !!draft.all_day !== !!originalDraft?.all_day ||
        String(draft.start_time || '') !== String(originalDraft?.start_time || '') ||
        String(draft.end_time || '') !== String(originalDraft?.end_time || '');

      const payload = {
        title: normalizedTitle,
        description: draft.description || '',
        priority: normalizedPriority,
        status: draft.status || selectedTask.status || 'pending',
        client_timezone: timezone,
        category_ids: (draft.category_ids || []).map((id) => Number.parseInt(id, 10)).filter((id) => !Number.isNaN(id)),
      };

      if (timeChanged) {
        payload.all_day = !!draft.all_day;
        if (payload.all_day) {
          payload.start_time = draft.start_time ? toISOString(`${draft.start_time} 00:00:00`) : null;
          payload.end_time = draft.end_time ? toISOString(`${draft.end_time} 23:59:59`) : null;
        } else {
          payload.start_time = draft.start_time ? toISOString(draft.start_time) : null;
          payload.end_time = draft.end_time ? toISOString(draft.end_time) : null;
        }

        if (draft.start_time) payload.start_time_local = draft.start_time;
        if (draft.end_time) payload.end_time_local = draft.end_time;
      }

      if (draft.recurrence_enabled) {
        const rule = {
          freq: draft.recurrence_type || 'daily',
          interval: 1,
        };
        if (rule.freq === 'weekly' && Array.isArray(draft.recurrence_days) && draft.recurrence_days.length > 0) {
          rule.byday = draft.recurrence_days;
        }
        payload.recurrence_rule = rule;
      } else {
        payload.recurrence_rule = null;
      }

      const savedTask = await updateTaskLocal(queryClient, targetTaskID, payload, { scheduleSync: false });
      if (draftSourceTaskIDRef.current !== targetTaskID) {
        return;
      }
      draftTouchedRef.current = false;
      // Do not overwrite draft from saved response here.
      // For controlled editors, forced value resets can clear redo history stack.
      void savedTask;
      if (draftSyncTimerRef.current) {
        window.clearTimeout(draftSyncTimerRef.current);
      }
      draftSyncTimerRef.current = window.setTimeout(() => {
        scheduleSync();
        draftSyncTimerRef.current = 0;
      }, 4000);
      setLastSavedAt(dayjs().format('HH:mm:ss'));
    } catch (err) {
      console.error('Failed to save task details:', err);
    } finally {
      setSavingDraft(false);
    }
  };

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
                  <div className="mt-1 flex h-5 items-center justify-between gap-2">
                    <p className={`min-w-0 truncate text-xs leading-4 ${draftParsePreview ? 'text-emerald-600' : 'text-transparent'}`}>
                      {draftParsePreview || '\u00A0'}
                    </p>
                    <span
                      title={draftPriorityIndicator.title}
                      className={`shrink-0 text-[10px] font-semibold leading-4 ${draftPriorityIndicator.className}`}
                    >
                      {draftPriorityIndicator.text}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex min-h-[36px] items-center justify-between gap-3">
                  <div className="order-2 flex items-center justify-end gap-2 text-xs">
                    {selectedTask.read_only && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">CalDAV Read-only</span>
                    )}
                    {savingDraft ? (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">{t('task.saving')}</span>
                    ) : isDraftDirty ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{t('task.unsavedChanges')}</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">{t('task.saved')}</span>
                    )}
                    {lastSavedAt && <span className="text-slate-400">{t('task.lastSavedAt', { time: lastSavedAt })}</span>}
                  </div>
                  <div ref={detailPanelRef} className="order-1 relative flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDetailPanel(detailPanel === 'priority' ? '' : 'priority')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${
                        detailPanel === 'priority'
                          ? 'bg-amber-50 text-amber-700'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                      title={t('task.priority')}
                    >
                      <IconFlag className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailPanel(detailPanel === 'time' ? '' : 'time')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${
                        detailPanel === 'time'
                          ? 'bg-rose-50 text-rose-700'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                      title={t('task.startTime')}
                    >
                      <IconClock className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailPanel(detailPanel === 'category' ? '' : 'category')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${
                        detailPanel === 'category'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                      title={t('task.categories')}
                    >
                      <IconTag className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailPanel(detailPanel === 'recurrence' ? '' : 'recurrence')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${
                        detailPanel === 'recurrence' || draft.recurrence_enabled
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                      title={t('task.repeat')}
                    >
                      <IconRepeat className="h-4 w-4" />
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
                                onClick={() => toggleDraftCategory(cat.id)}
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
                                if ((draft.recurrence_type || 'daily') === 'weekly' && (draft.recurrence_days || []).length === 0) {
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
                                    if (option.value === 'weekly' && (draft.recurrence_days || []).length === 0) {
                                      handleDraftFieldChange('recurrence_days', workDayKeys);
                                    }
                                    if (option.value !== 'weekly') {
                                      handleDraftFieldChange('recurrence_days', []);
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
                            </div>

                            {(draft.recurrence_type || 'daily') === 'weekly' && (
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
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3">
                <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <label className="mb-1 block text-xs font-medium text-slate-500">{t('task.description')}</label>
                  <LiveMarkdownEditor
                    key={`task-editor-${selectedTask.id}`}
                    value={draft.description}
                    onChange={(nextValue) => handleDraftFieldChange('description', nextValue)}
                    placeholder={t('task.description')}
                    className="min-h-0 flex-1"
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
                  onClick={handleSaveDraft}
                  disabled={savingDraft || !isDraftDirty}
                  className="btn-primary text-sm"
                >
                  {savingDraft ? t('common.loading') : t('common.save')}
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
