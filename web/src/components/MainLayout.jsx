import React, { Suspense, lazy, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  IconCalendar,
  IconClock,
  IconInbox,
  IconList,
  IconLogout,
  IconPrompt,
  IconSearch,
  IconSettings,
  IconStatus,
  IconTag,
  IconTrash,
} from './icons/TaskIcons';
import { Button } from './ui/Button';
import ErrorBoundary from './ErrorBoundary';
import InlineErrorState from './ui/InlineErrorState';
import { getTokenStore } from '../api/client';
import { getShowCategoryEmoji, onUIPrefsChanged } from '../utils/uiPrefs';
import {
  clearCurrentDraggedTaskID,
  emitTaskCategoryDrop,
  getCurrentDraggedTaskID,
  readTaskDragTaskID,
  shouldTreatPointerReleaseAsClick,
} from '../utils/taskDrag';
import { blurActiveTaskDescriptionEditor } from '../utils/editorFocus';
import { useCategoriesQuery } from '../query/hooks';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { moveTaskToCategoryLocal, updateTaskLocal } from '../data/taskMutations';
import { closeSearchDialog, openSearchDialog, subscribeSearchOverlay } from '../state/searchOverlay';
import {
  getSyncConflicts,
  removeSyncConflict,
  subscribeSyncConflicts,
} from '../state/syncConflictCenter';
import { formatDateTime } from '../utils/time';
import useCalendarCacheStore from '../stores/calendarCacheStore';
import { clearAuthenticatedLocalState } from '../data/syncEngine';
import { clearSyncConflicts } from '../state/syncConflictCenter';

const CalendarView = lazy(() => import('./CalendarView'));
const TaskList = lazy(() => import('./TaskList'));
const TaskListView = lazy(() => import('./TaskList').then((module) => ({ default: module.TaskListView })));
const CategoryManager = lazy(() => import('./CategoryManager'));
const PromptManager = lazy(() => import('./PromptManager'));
const Settings = lazy(() => import('./Settings'));
const SearchDialog = lazy(() => import('./SearchDialog'));

function normalizeMobileDefaultTab(value) {
  if (value === 'calendar' || value === 'settings') return value;
  return 'tasks';
}

function normalizeMobileDefaultTaskView(value) {
  const normalized = String(value || '').trim();
  if (normalized === 'all' || normalized === 'inbox' || normalized === 'today' || normalized === 'upcoming') {
    return normalized;
  }
  if (/^category:\d+$/.test(normalized)) {
    return normalized;
  }
  return 'all';
}

function normalizeMobileTabPreset(value) {
  if (value === 'tasks_calendar_categories_settings' || value === 'tasks_inbox_calendar_settings') {
    return value;
  }
  return 'tasks_calendar_settings';
}

function buildDefaultTasksRoute(defaultTaskView) {
  const normalized = normalizeMobileDefaultTaskView(defaultTaskView);
  if (normalized.startsWith('category:')) {
    const categoryID = Number.parseInt(normalized.slice('category:'.length), 10);
    if (Number.isFinite(categoryID) && categoryID > 0) {
      return `/tasks?category_id=${categoryID}`;
    }
    return '/tasks?view=all';
  }
  return `/tasks?view=${normalized}`;
}

function readMobilePrefsFromStorage() {
  try {
    const rawUser = JSON.parse(localStorage.getItem('user') || '{}');
    return {
      defaultTab: normalizeMobileDefaultTab(rawUser.mobile_default_tab),
      defaultTaskView: normalizeMobileDefaultTaskView(rawUser.mobile_default_task_view),
      tabPreset: normalizeMobileTabPreset(rawUser.mobile_tab_preset),
    };
  } catch {
    return {
      defaultTab: 'tasks',
      defaultTaskView: 'all',
      tabPreset: 'tasks_calendar_settings',
    };
  }
}

const CONFLICT_FIELD_ORDER = [
  'title',
  'description',
  'priority',
  'status',
  'start_time',
  'end_time',
  'due_date',
  'all_day',
  'category_ids',
  'recurrence_rule',
  'recurrence_end_date',
];

const CONFLICT_FIELD_LABEL_MAP = {
  title: 'task.title',
  description: 'task.description',
  priority: 'task.priority',
  status: 'task.status',
  start_time: 'task.startTime',
  end_time: 'task.endTime',
  due_date: 'task.dueDate',
  all_day: 'task.allDay',
  category_ids: 'task.categories',
  recurrence_rule: 'task.repeat',
  recurrence_end_date: 'task.repeatEndDate',
};

const CONFLICT_EXCLUDED_FIELDS = new Set([
  'client_timezone',
  'start_time_local',
  'end_time_local',
  'instance_id',
  'occurrence_date',
]);

function stableSerialize(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function valuesEqual(left, right) {
  return stableSerialize(left) === stableSerialize(right);
}

function readTaskFieldValue(task, field) {
  const source = task || {};
  if (field === 'category_ids') {
    if (Array.isArray(source.category_ids)) {
      return source.category_ids.map((id) => Number.parseInt(id, 10)).filter((id) => Number.isFinite(id));
    }
    if (Array.isArray(source.categories)) {
      return source.categories
        .map((item) => Number.parseInt(item?.id, 10))
        .filter((id) => Number.isFinite(id));
    }
    return [];
  }
  if (field === 'start_time') return source.start_time ?? source.startTime ?? null;
  if (field === 'end_time') return source.end_time ?? source.endTime ?? null;
  if (field === 'due_date') return source.due_date ?? source.dueDate ?? null;
  if (field === 'all_day') return typeof source.all_day === 'boolean' ? source.all_day : !!source.allDay;
  if (field === 'recurrence_rule') return source.recurrence_rule ?? source.recurrenceRule ?? null;
  if (field === 'recurrence_end_date') return source.recurrence_end_date ?? source.recurrenceEndDate ?? null;
  return source?.[field];
}

function formatConflictValue(field, value, categories, t) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return t('task.syncConflictValueEmpty');
  }
  if (field === 'priority') {
    const parsed = Number.parseInt(value, 10);
    if (parsed === 1) return t('task.priorityHigh');
    if (parsed === 0) return t('task.priorityMedium');
    return t('task.priorityLow');
  }
  if (field === 'status') {
    if (value === 'completed') return t('task.statusCompleted');
    if (value === 'cancelled') return t('task.statusCancelled');
    if (value === 'skipped') return t('task.statusSkipped');
    return t('task.statusPending');
  }
  if (field === 'all_day') {
    return value ? t('task.allDay') : t('task.noDate');
  }
  if (field === 'category_ids') {
    const ids = Array.isArray(value)
      ? value.map((id) => Number.parseInt(id, 10)).filter((id) => Number.isFinite(id))
      : [];
    if (!ids.length) return t('task.syncConflictValueEmpty');
    const categoryNames = ids
      .map((id) => categories.find((cat) => Number(cat.id) === id)?.name)
      .filter(Boolean);
    if (!categoryNames.length) return ids.join(', ');
    return categoryNames.join(', ');
  }
  if (field === 'start_time' || field === 'end_time' || field === 'due_date') {
    if (typeof value === 'string' && value.trim()) {
      return formatDateTime(value, 'YYYY-MM-DD HH:mm');
    }
    return t('task.syncConflictValueEmpty');
  }
  if (typeof value === 'object') {
    return stableSerialize(value);
  }
  return String(value);
}

function sortConflictFields(fields) {
  const orderMap = new Map(CONFLICT_FIELD_ORDER.map((field, index) => [field, index]));
  return [...fields].sort((a, b) => {
    const left = orderMap.has(a) ? orderMap.get(a) : 999;
    const right = orderMap.has(b) ? orderMap.get(b) : 999;
    if (left !== right) return left - right;
    return String(a).localeCompare(String(b));
  });
}

function StableNavLink({
  to,
  replace = false,
  state,
  relative,
  children,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDragStart,
  ...props
}) {
  const navigate = useNavigate();
  const pointerStateRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    navigatedFromPointer: false,
  });

  const isModifiedPointerEvent = (event) => !!(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

  return (
    <Link
      {...props}
      to={to}
      replace={replace}
      state={state}
      relative={relative}
      draggable={false}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (event.defaultPrevented || isModifiedPointerEvent(event)) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        blurActiveTaskDescriptionEditor();
        pointerStateRef.current = {
          active: true,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          lastX: event.clientX,
          lastY: event.clientY,
          navigatedFromPointer: false,
        };
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        const pointerState = pointerStateRef.current;
        if (!pointerState.active || pointerState.pointerId !== event.pointerId) return;
        pointerState.lastX = event.clientX;
        pointerState.lastY = event.clientY;
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        const pointerState = pointerStateRef.current;
        if (!pointerState.active || pointerState.pointerId !== event.pointerId) return;
        pointerState.active = false;
        if (event.defaultPrevented || isModifiedPointerEvent(event)) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (shouldTreatPointerReleaseAsClick({
          startX: pointerState.startX,
          startY: pointerState.startY,
          endX: event.clientX,
          endY: event.clientY,
        })) {
          pointerState.navigatedFromPointer = true;
          navigate(to, { replace, state, relative });
        }
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        pointerStateRef.current.active = false;
      }}
      onDragStart={(event) => {
        onDragStart?.(event);
        if (!event.defaultPrevented) event.preventDefault();
      }}
      onClick={(event) => {
        if (pointerStateRef.current.navigatedFromPointer && !isModifiedPointerEvent(event)) {
          pointerStateRef.current.navigatedFromPointer = false;
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}

function MainLayout({ user, setUser }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dragOverCategoryID, setDragOverCategoryID] = useState(0);
  const [showCategoryEmoji, setShowCategoryEmoji] = useState(getShowCategoryEmoji());
  const [mobilePrefs, setMobilePrefs] = useState(readMobilePrefsFromStorage);
  const [searchDialog, setSearchDialog] = useState({ open: false, query: '' });
  const [settingsOpen, setSettingsOpen] = useState(location.pathname === '/settings');
  const [syncConflicts, setSyncConflicts] = useState(() => getSyncConflicts());
  const [resolveConflictID, setResolveConflictID] = useState(0);
  const [resolveSelections, setResolveSelections] = useState({});
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [resolveConflictError, setResolveConflictError] = useState('');
  const [workspaceVisited, setWorkspaceVisited] = useState(() => ({
    calendar: location.pathname === '/',
    tasks: location.pathname === '/tasks',
  }));
  const initialLocationRef = useRef({
    pathname: location.pathname,
    search: location.search,
  });
  const resolveConflictDialogRef = useRef(null);
  const settingsDialogRef = useRef(null);
  const { data: categories = [] } = useCategoriesQuery();

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
    setMobileMenuOpen(false);
    if (location.pathname === '/settings') {
      navigate('/tasks?view=all', { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const unsubscribe = subscribeSearchOverlay((next) => {
      setSearchDialog(next);
    });
    return unsubscribe;
  }, []);

  useEffect(() => subscribeSyncConflicts((next) => {
    setSyncConflicts(next);
  }), []);

  useEffect(() => {
    setMobileMenuOpen(false);
    if (location.pathname === '/settings') {
      setSettingsOpen(true);
      navigate('/tasks?view=all', { replace: true });
      return;
    }
    if (location.pathname === '/' || location.pathname === '/tasks') {
      setWorkspaceVisited((prev) => {
        const key = location.pathname === '/' ? 'calendar' : 'tasks';
        return prev[key] ? prev : { ...prev, [key]: true };
      });
    }
  }, [location.pathname, location.search, navigate]);

  useEffect(() => onUIPrefsChanged(() => setShowCategoryEmoji(getShowCategoryEmoji())), []);

  useEffect(() => {
    const syncMobilePrefs = () => {
      setMobilePrefs(readMobilePrefsFromStorage());
    };
    window.addEventListener('user:profile-updated', syncMobilePrefs);
    window.addEventListener('storage', syncMobilePrefs);
    return () => {
      window.removeEventListener('user:profile-updated', syncMobilePrefs);
      window.removeEventListener('storage', syncMobilePrefs);
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen]);

  // 计算初始重定向目标（仅在首次挂载时、路径为 / 时），lazy initializer 保证只算一次
  const [initialRedirectTo] = useState(() => {
    const loc = initialLocationRef.current;
    if (loc.pathname !== '/' || loc.search) return null;
    const prefs = readMobilePrefsFromStorage();
    if (prefs.defaultTab === 'tasks') return buildDefaultTasksRoute(prefs.defaultTaskView);
    if (prefs.defaultTab === 'settings') return '/settings';
    return null;
  });
  const initialRedirectConsumedRef = useRef(false);

  const handleLogout = async () => {
    getTokenStore().remove();
    localStorage.removeItem('user');
    await clearAuthenticatedLocalState(queryClient);
    clearSyncConflicts();
    setUser(null);
  };

  const handleDropToCategory = async (event, categoryID) => {
    event.preventDefault();
    setDragOverCategoryID(0);

    const taskID = readTaskDragTaskID(event.dataTransfer, getCurrentDraggedTaskID());
    if (!taskID) return;

    try {
      await moveTaskToCategoryLocal(queryClient, taskID, categoryID);
      emitTaskCategoryDrop({ taskID, categoryID });
    } catch (error) {
      console.error('Failed to move task to category:', error);
    } finally {
      clearCurrentDraggedTaskID(taskID);
    }
  };

  const taskNavItems = [
    { key: 'all', to: '/tasks?view=all', label: t('task.allTasks'), icon: IconList },
    { key: 'inbox', to: '/tasks?view=inbox', label: t('task.inbox'), icon: IconInbox },
    { key: 'today', to: '/tasks?view=today', label: t('task.today'), icon: IconCalendar },
    { key: 'upcoming', to: '/tasks?view=upcoming', label: t('task.upcoming'), icon: IconClock },
    { key: 'search', to: '/search', label: t('task.searchTasks'), icon: IconSearch, action: 'open_search' },
  ];

  const mobileTabs = useMemo(() => {
    const baseTabs = {
      tasks: {
        key: 'tasks',
        to: '/tasks?view=all',
        label: t('nav.tasks'),
        icon: IconList,
        matchTasks: true,
      },
      search: {
        key: 'search',
        to: '/search',
        label: t('task.searchTasks'),
        icon: IconSearch,
        matchSearch: true,
        action: 'open_search',
      },
      inbox: {
        key: 'inbox',
        to: '/tasks?view=inbox',
        label: t('task.inbox'),
        icon: IconInbox,
        matchTasks: true,
      },
      calendar: {
        key: 'calendar',
        to: '/',
        label: t('nav.calendar'),
        icon: IconCalendar,
      },
      categories: {
        key: 'categories',
        to: '/categories',
        label: t('nav.categories'),
        icon: IconTag,
      },
      prompts: {
        key: 'prompts',
        to: '/prompts',
        label: t('nav.prompts'),
        icon: IconPrompt,
      },
      settings: {
        key: 'settings',
        to: '#settings',
        label: t('nav.settings'),
        icon: IconSettings,
        action: 'open_settings',
      },
    };

    switch (mobilePrefs.tabPreset) {
      case 'tasks_calendar_categories_settings':
        return [baseTabs.tasks, baseTabs.calendar, baseTabs.categories, baseTabs.prompts, baseTabs.settings];
      case 'tasks_inbox_calendar_settings':
        return [baseTabs.inbox, baseTabs.prompts, baseTabs.search, baseTabs.calendar, baseTabs.settings];
      default:
        return [baseTabs.tasks, baseTabs.prompts, baseTabs.search, baseTabs.calendar, baseTabs.settings];
    }
  }, [mobilePrefs.tabPreset, t]);

  const isTaskNavActive = (to) => {
    if (location.pathname !== '/tasks') return false;
    const target = new URLSearchParams(to.split('?')[1] || '');
    const current = new URLSearchParams(location.search || '');
    const targetView = target.get('view') || 'all';
    const currentView = current.get('view') || 'all';
    return targetView === currentView &&
      (target.get('category_id') || '') === (current.get('category_id') || '');
  };

  const isMobileTabActive = (item) => {
    if (item.matchSearch) {
      return location.pathname === '/search';
    }
    if (item.matchTasks) {
      if (location.pathname !== '/tasks') return false;
      const current = new URLSearchParams(location.search || '');
      return (current.get('view') || 'all') !== 'search';
    }
    const path = item.to.split('?')[0];
    return location.pathname === path;
  };

  const mobilePageTitle = useMemo(() => {
    if (location.pathname === '/tasks') {
      const current = new URLSearchParams(location.search || '');
      const view = current.get('view') || 'all';
      if (view === 'inbox') return t('task.inbox');
      if (view === 'today') return t('task.today');
      if (view === 'upcoming') return t('task.upcoming');
      if (view === 'search') return t('task.searchTasks');
      if (view === 'completed') return t('task.completedTasks');
      if (view === 'deleted') return t('task.deletedTasks');
      if (current.get('category_id')) return t('nav.tasks');
      return t('task.allTasks');
    }
    if (location.pathname === '/search') return t('task.searchTasks');
    if (location.pathname === '/categories') return t('nav.categories');
    if (location.pathname === '/prompts') return t('nav.prompts');
    if (location.pathname === '/settings') return t('nav.settings');
    return t('nav.calendar');
  }, [location.pathname, location.search, t]);

  const navItemClass = (active) => `md-nav-item ${active ? 'md-nav-item-active' : 'md-nav-item-idle'}`;
  const appInitial = String(t('app.name') || 'T').trim().slice(0, 1).toUpperCase();
  const userAvatarURL = String(user?.avatar_url || '').trim();
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [userAvatarURL]);
  const workspaceFallback = (
    <div className="flex h-full min-h-0 items-center justify-center bg-card text-sm text-muted-foreground">
      {t('common.loading')}
    </div>
  );
  const workspaceErrorFallback = useCallback(({ reset }) => (
    <InlineErrorState
      title={t('common.somethingWentWrong')}
      message={t('common.tryAgainHint')}
      retryLabel={t('common.tryAgain')}
      onRetry={reset}
      className="h-full min-h-0 bg-card"
    />
  ), [t]);
  const searchDialogFallback = (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/35 p-3 pt-14 md:p-4 md:pt-20">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl" aria-hidden="true">
        <div className="border-b border-border px-3 py-2.5 md:px-4 md:py-3">
          <div className="h-4 w-24 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="space-y-3 p-3 md:p-4">
          <div className="h-9 animate-pulse rounded-md bg-muted" />
          <div className="h-3 w-40 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
  const hideMobileHeader = location.pathname === '/';
  const taskPanelLocationRef = useRef(
    location.pathname === '/tasks'
      ? location
      : { pathname: '/tasks', search: '?view=all', hash: '', state: null, key: 'tasks-default' }
  );
  if (location.pathname === '/tasks') {
    taskPanelLocationRef.current = location;
  }
  const activeTab = location.pathname === '/'
    ? 'calendar'
    : (location.pathname === '/tasks' || location.pathname === '/search')
      ? 'tasks'
      : location.pathname === '/categories'
        ? 'categories'
        : location.pathname === '/prompts'
          ? 'prompts'
          : location.pathname === '/settings'
            ? 'settings'
            : '';
  const showCalendarWorkspace = location.pathname === '/';
  const showTaskWorkspace = location.pathname === '/tasks';
  const shouldRenderCalendarWorkspace = workspaceVisited.calendar || showCalendarWorkspace;
  const shouldRenderTaskWorkspace = workspaceVisited.tasks || showTaskWorkspace;
  const activeSyncConflict = syncConflicts[0] || null;
  const syncConflictMoreCount = Math.max(0, syncConflicts.length - 1);
  const resolvingConflictItem = syncConflicts.find(
    (item) => Number(item?.id || 0) === Number(resolveConflictID || 0)
  ) || null;

  const conflictFieldEntries = useMemo(() => {
    if (!resolvingConflictItem) return [];
    const localPayload = resolvingConflictItem?.local_payload && typeof resolvingConflictItem.local_payload === 'object'
      ? resolvingConflictItem.local_payload
      : {};
    const latestTask = resolvingConflictItem?.latest_task && typeof resolvingConflictItem.latest_task === 'object'
      ? resolvingConflictItem.latest_task
      : {};
    const keys = sortConflictFields(
      Object.keys(localPayload).filter((field) => !CONFLICT_EXCLUDED_FIELDS.has(field))
    );
    return keys.map((field) => {
      const localValue = localPayload[field];
      const serverValue = readTaskFieldValue(latestTask, field);
      const labelKey = CONFLICT_FIELD_LABEL_MAP[field];
      return {
        field,
        label: labelKey ? t(labelKey) : field,
        localValue,
        serverValue,
        localDisplay: formatConflictValue(field, localValue, categories, t),
        serverDisplay: formatConflictValue(field, serverValue, categories, t),
      };
    });
  }, [categories, resolvingConflictItem, t]);

  const handleDismissSyncConflict = useCallback(() => {
    if (!activeSyncConflict?.id) return;
    removeSyncConflict(activeSyncConflict.id);
    if (Number(resolveConflictID || 0) === Number(activeSyncConflict.id)) {
      setResolveConflictID(0);
      setResolveSelections({});
      setResolveConflictError('');
    }
  }, [activeSyncConflict, resolveConflictID]);

  const handleEditSyncConflict = useCallback((conflict = activeSyncConflict) => {
    if (!conflict?.id) return;
    const taskID = Number.parseInt(conflict.task_id, 10) || 0;
    removeSyncConflict(conflict.id);
    if (Number(resolveConflictID || 0) === Number(conflict.id)) {
      setResolveConflictID(0);
      setResolveSelections({});
      setResolveConflictError('');
    }
    if (taskID > 0) {
      navigate(`/tasks?view=all&task_id=${taskID}`);
      return;
    }
    navigate('/tasks?view=all');
  }, [activeSyncConflict, navigate, resolveConflictID]);

  const handleOpenResolveConflict = useCallback((conflict = activeSyncConflict) => {
    if (!conflict?.id) return;
    if (!conflict.latest_task || typeof conflict.latest_task !== 'object') {
      handleEditSyncConflict(conflict);
      return;
    }
    const localPayload = conflict?.local_payload && typeof conflict.local_payload === 'object'
      ? conflict.local_payload
      : {};
    const latestTask = conflict.latest_task;
    const nextSelections = {};
    sortConflictFields(
      Object.keys(localPayload).filter((field) => !CONFLICT_EXCLUDED_FIELDS.has(field))
    ).forEach((field) => {
      const localValue = localPayload[field];
      const serverValue = readTaskFieldValue(latestTask, field);
      nextSelections[field] = valuesEqual(localValue, serverValue) ? 'server' : 'local';
    });
    setResolveSelections(nextSelections);
    setResolveConflictError('');
    setResolveConflictID(conflict.id);
  }, [activeSyncConflict, handleEditSyncConflict]);

  const handleResolveChoiceChange = useCallback((field, choice) => {
    setResolveSelections((prev) => ({
      ...prev,
      [field]: choice === 'server' ? 'server' : 'local',
    }));
  }, []);

  const handleCloseResolveConflict = useCallback(() => {
    if (resolvingConflict) return;
    setResolveConflictID(0);
    setResolveSelections({});
    setResolveConflictError('');
  }, [resolvingConflict]);

  useEffect(() => {
    if (!resolvingConflictItem) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      handleCloseResolveConflict();
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleCloseResolveConflict, resolvingConflictItem]);

  const handleApplyResolvedConflict = useCallback(async () => {
    if (!resolvingConflictItem?.id) return;
    const taskID = Number.parseInt(resolvingConflictItem.task_id, 10) || 0;
    if (!taskID) {
      removeSyncConflict(resolvingConflictItem.id);
      setResolveConflictID(0);
      setResolveSelections({});
      setResolveConflictError('');
      return;
    }

    const localPayload = resolvingConflictItem?.local_payload && typeof resolvingConflictItem.local_payload === 'object'
      ? resolvingConflictItem.local_payload
      : {};
    const latestTask = resolvingConflictItem?.latest_task && typeof resolvingConflictItem.latest_task === 'object'
      ? resolvingConflictItem.latest_task
      : {};
    const payload = {};
    Object.keys(localPayload)
      .filter((field) => !CONFLICT_EXCLUDED_FIELDS.has(field))
      .forEach((field) => {
        const choice = resolveSelections[field] === 'server' ? 'server' : 'local';
        if (choice === 'local') {
          payload[field] = localPayload[field];
          return;
        }
        const serverValue = readTaskFieldValue(latestTask, field);
        if (typeof serverValue !== 'undefined') {
          payload[field] = serverValue;
        }
      });

    if (!Object.keys(payload).length) {
      removeSyncConflict(resolvingConflictItem.id);
      setResolveConflictID(0);
      setResolveSelections({});
      setResolveConflictError('');
      return;
    }

    setResolvingConflict(true);
    setResolveConflictError('');
    try {
      await updateTaskLocal(queryClient, taskID, payload, {
        scheduleSync: true,
        localOnly: false,
        submitMeta: {
          submittedAt: new Date().toISOString(),
          submitSource: 'conflict-resolve',
        },
      });
      removeSyncConflict(resolvingConflictItem.id);
      setResolveConflictID(0);
      setResolveSelections({});
      setResolveConflictError('');
      navigate(`/tasks?view=all&task_id=${taskID}`);
    } catch (error) {
      setResolveConflictError(error?.response?.data?.error || t('task.syncConflictResolveFailed'));
    } finally {
      setResolvingConflict(false);
    }
  }, [navigate, queryClient, resolveSelections, resolvingConflictItem, t]);

  useEffect(() => {
    if (!resolveConflictID) return;
    const exists = syncConflicts.some((item) => Number(item?.id || 0) === Number(resolveConflictID || 0));
    if (exists) return;
    setResolveConflictID(0);
    setResolveSelections({});
    setResolveConflictError('');
    setResolvingConflict(false);
  }, [resolveConflictID, syncConflicts]);

  useFocusTrap(!!resolvingConflictItem, resolveConflictDialogRef);
  useFocusTrap(settingsOpen, settingsDialogRef);

  // 首次进入 / 时同步重定向，后续手动返回 / 不再强制跳转
  if (!initialRedirectConsumedRef.current && initialRedirectTo && location.pathname === '/') {
    initialRedirectConsumedRef.current = true;
    return <Navigate to={initialRedirectTo} replace />;
  }

  return (
    <div className="app-shell flex h-screen min-w-0 flex-col overflow-hidden bg-card md:flex-row">
      {activeSyncConflict && (
        <div className="sync-conflict-toast fixed right-2 top-14 z-50 w-[min(24rem,calc(100vw-1rem))] rounded-xl border border-amber-200 bg-amber-50/95 p-3 shadow-lg backdrop-blur md:right-4 md:top-4">
          <div className="text-xs font-semibold text-amber-900">{t('task.syncConflictTitle')}</div>
          <div className="mt-1 text-xs leading-relaxed text-amber-800">
            {activeSyncConflict.task_title
              ? t('task.syncConflictHint', { title: activeSyncConflict.task_title })
              : t('task.syncConflictHintFallback')}
          </div>
          {syncConflictMoreCount > 0 && (
            <div className="mt-1 text-[11px] text-amber-700">
              {t('task.syncConflictMore', { count: syncConflictMoreCount })}
            </div>
          )}
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleDismissSyncConflict}
              className="inline-flex h-8 items-center justify-center rounded-md border border-amber-300 bg-card px-2.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              {t('task.syncConflictDismiss')}
            </button>
            <button
              type="button"
              onClick={() => handleOpenResolveConflict(activeSyncConflict)}
              className="inline-flex h-8 items-center justify-center rounded-md border border-amber-500 bg-amber-500 px-2.5 text-xs font-medium text-white hover:bg-amber-600"
            >
              {syncConflictMoreCount > 0 ? t('task.syncConflictViewAll') : t('task.syncConflictResolve')}
            </button>
          </div>
        </div>
      )}
      {!hideMobileHeader && (
        <div className="mobile-top-bar md:hidden flex h-12 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur">
          <h1 className="truncate text-sm font-semibold text-foreground">{mobilePageTitle}</h1>
          <Button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            variant="ghost"
            size="icon"
            className="text-foreground-strong"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </Button>
        </div>
      )}

      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="mobile-menu-backdrop fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`sidebar fixed inset-y-0 left-0 z-40 flex flex-col transform transition-transform duration-200 md:static md:shrink-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="mx-5 mb-5 mt-6 flex h-12 items-center gap-3">
          <button
            type="button"
            onClick={openSettings}
            className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary text-sm font-semibold text-white shadow-sm transition hover:ring-2 hover:ring-ring"
            title={t('nav.settings')}
            aria-label={t('nav.settings')}
          >
            {userAvatarURL && !avatarLoadFailed ? (
              <img
                src={userAvatarURL}
                alt={t('settings.avatar')}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
                onError={() => setAvatarLoadFailed(true)}
              />
            ) : (
              appInitial
            )}
          </button>
          <div className="flex min-w-0 flex-col justify-center">
            <h1 className="truncate text-lg font-semibold leading-6 text-foreground">{t('app.name')}</h1>
            <p className="-mt-0.5 truncate text-sm leading-5 text-muted-foreground">{user.username}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 px-5 pb-4">
          <StableNavLink
            to="/"
            className={navItemClass(activeTab === 'calendar')}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <IconCalendar className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{t('nav.calendar')}</span>
            </span>
          </StableNavLink>

          <div className="mt-5 px-3 pb-1 text-xs font-semibold text-muted-foreground">
            {t('task.listView')}
          </div>
          {taskNavItems.map((item) => {
            const ItemIcon = item.icon;
            if (item.action === 'open_search') {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => openSearchDialog()}
                  className={`${navItemClass(location.pathname === '/search')} w-full text-left`}
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <ItemIcon className="h-[18px] w-[18px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                </button>
              );
            }
            return (
              <StableNavLink
                key={item.key}
                to={item.to}
                className={navItemClass(isTaskNavActive(item.to))}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <ItemIcon className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
              </StableNavLink>
            );
          })}

          {categories.length > 0 && (
            <div className="mt-4 space-y-1.5 border-t border-border pt-3">
              {categories.map((cat) => (
                <StableNavLink
                  key={cat.id}
                  to={`/tasks?category_id=${cat.id}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverCategoryID(cat.id);
                  }}
                  onDragLeave={() => setDragOverCategoryID(0)}
                  onDrop={(event) => handleDropToCategory(event, cat.id)}
                  className={`md-nav-item ${
                    isTaskNavActive(`/tasks?category_id=${cat.id}`)
                      ? 'md-nav-item-active'
                      : dragOverCategoryID === cat.id
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300'
                        : 'md-nav-item-idle'
                  }`}
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    {showCategoryEmoji && cat.emoji ? (
                      <span className="shrink-0">{cat.emoji}</span>
                    ) : (
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cat.color || '#94a3b8' }} />
                    )}
                    <span className="truncate">{cat.name}</span>
                  </span>
                </StableNavLink>
              ))}
            </div>
          )}

          <div className={`${categories.length > 0 ? 'mt-4' : 'mt-5'} border-t border-border pt-3`}>
            <StableNavLink
              to="/tasks?view=completed"
              className={navItemClass(isTaskNavActive('/tasks?view=completed'))}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <IconStatus className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{t('task.completedTasks')}</span>
              </span>
            </StableNavLink>
            <StableNavLink
              to="/tasks?view=deleted"
              className={navItemClass(isTaskNavActive('/tasks?view=deleted'))}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <IconTrash className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{t('task.deletedTasks')}</span>
              </span>
            </StableNavLink>
            <StableNavLink
              to="/categories"
              className={navItemClass(activeTab === 'categories')}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <IconTag className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{t('category.manageCategories')}</span>
              </span>
            </StableNavLink>
            <StableNavLink
              to="/prompts"
              className={navItemClass(activeTab === 'prompts')}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <IconPrompt className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{t('nav.prompts')}</span>
              </span>
            </StableNavLink>
          </div>

          <button
            type="button"
            onClick={openSettings}
            className={`${navItemClass(settingsOpen)} w-full text-left`}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <IconSettings className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{t('nav.settings')}</span>
            </span>
          </button>
        </nav>

        <div className="border-t border-border p-5">
          <button
            onClick={handleLogout}
            className="md-nav-item md-nav-item-idle w-full text-left"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <IconLogout className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{t('nav.logout')}</span>
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-workspace relative min-w-0 flex-1 overflow-hidden pb-14 md:pb-0">
        <Suspense fallback={workspaceFallback}>
          {shouldRenderCalendarWorkspace && (
            <div className={`absolute inset-0 ${showCalendarWorkspace ? 'z-10' : 'pointer-events-none opacity-0 [contain:layout_paint]'}`}>
              <ErrorBoundary fallback={workspaceErrorFallback}>
                <CalendarView />
              </ErrorBoundary>
            </div>
          )}
          {shouldRenderTaskWorkspace && (
            <div className={`absolute inset-0 ${showTaskWorkspace ? 'z-10' : 'hidden'}`}>
              <ErrorBoundary fallback={workspaceErrorFallback}>
                <TaskListView routeLocation={taskPanelLocationRef.current} />
              </ErrorBoundary>
            </div>
          )}

          <Routes>
            <Route
              path="/search"
              element={(
                <ErrorBoundary fallback={workspaceErrorFallback}>
                  <TaskList forcedView="search" />
                </ErrorBoundary>
              )}
            />
            <Route
              path="/categories"
              element={(
                <ErrorBoundary fallback={workspaceErrorFallback}>
                  <CategoryManager />
                </ErrorBoundary>
              )}
            />
            <Route
              path="/prompts"
              element={(
                <ErrorBoundary fallback={workspaceErrorFallback}>
                  <PromptManager />
                </ErrorBoundary>
              )}
            />
          </Routes>
        </Suspense>
      </div>

      <div className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card md:hidden">
        <div className={`grid h-14 ${mobileTabs.length === 5 ? 'grid-cols-5' : mobileTabs.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {mobileTabs.map((item) => {
            const ItemIcon = item.icon;
            const active = isMobileTabActive(item);
            if (item.action === 'open_search' || item.action === 'open_settings') {
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => {
                    if (item.action === 'open_settings') {
                      openSettings();
                      return;
                    }
                    openSearchDialog();
                  }}
                  className={`appearance-none border-0 bg-transparent p-0 flex items-center justify-center ${
                    (item.action === 'open_settings' ? settingsOpen : active) ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center border-b-2 transition-colors ${
                      (item.action === 'open_settings' ? settingsOpen : active) ? 'border-[hsl(var(--primary))]' : 'border-transparent hover:border-[hsl(var(--border-strong))]'
                    }`}
                  >
                    <ItemIcon className="h-[18px] w-[18px]" />
                  </span>
                </button>
              );
            }
            return (
              <StableNavLink
                key={item.key}
                to={item.to}
                aria-label={item.label}
                title={item.label}
                className={`flex items-center justify-center ${
                  active ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center border-b-2 transition-colors ${
                    active ? 'border-[hsl(var(--primary))]' : 'border-transparent hover:border-[hsl(var(--border-strong))]'
                  }`}
                >
                  <ItemIcon className="h-[18px] w-[18px]" />
                </span>
              </StableNavLink>
            );
          })}
        </div>
      </div>

      {resolvingConflictItem && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-3">
          <div
            ref={resolveConflictDialogRef}
            className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sync-conflict-resolve-title"
            tabIndex={-1}
          >
            <div className="border-b border-border px-4 py-3">
              <div id="sync-conflict-resolve-title" className="text-sm font-semibold text-foreground">{t('task.syncConflictResolveTitle')}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {resolvingConflictItem.task_title
                  ? t('task.syncConflictHint', { title: resolvingConflictItem.task_title })
                  : t('task.syncConflictHintFallback')}
              </div>
            </div>

            <div className="max-h-[65vh] overflow-auto px-4 py-3">
              {syncConflicts.length > 1 && (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  {syncConflicts.map((item, index) => {
                    const active = Number(item?.id || 0) === Number(resolvingConflictItem.id || 0);
                    return (
                      <button
                        key={item.id || index}
                        type="button"
                        onClick={() => handleOpenResolveConflict(item)}
                        aria-pressed={active}
                        className={`inline-flex min-w-[8rem] max-w-[12rem] shrink-0 flex-col rounded-md border px-2.5 py-2 text-left text-xs ${
                          active
                            ? 'border-amber-400 bg-amber-50 text-amber-900'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <span className="font-semibold">{t('task.syncConflictItem', { index: index + 1 })}</span>
                        <span className="mt-0.5 truncate">{item.task_title || t('task.syncConflictHintFallback')}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {conflictFieldEntries.length === 0 && (
                <div className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {t('task.syncConflictNoFields')}
                </div>
              )}

              <div className="space-y-2">
                {conflictFieldEntries.map((entry) => {
                  const selected = resolveSelections[entry.field] === 'server' ? 'server' : 'local';
                  return (
                    <div key={entry.field} className="rounded-lg border border-border p-2">
                      <div className="text-xs font-semibold text-foreground-strong">{entry.label}</div>
                      <div className="mt-1 grid gap-2 md:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => handleResolveChoiceChange(entry.field, 'server')}
                          aria-pressed={selected === 'server'}
                          className={`rounded-md border px-2 py-1.5 text-left text-xs ${
                            selected === 'server'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                              : 'border-border bg-card text-foreground-strong'
                          }`}
                        >
                          <div className="font-medium">{t('task.syncConflictServer')}</div>
                          <div className="mt-0.5 break-all text-[11px] opacity-90">{entry.serverDisplay}</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveChoiceChange(entry.field, 'local')}
                          aria-pressed={selected === 'local'}
                          className={`rounded-md border px-2 py-1.5 text-left text-xs ${
                            selected === 'local'
                              ? 'border-primary bg-accent text-primary'
                              : 'border-border bg-card text-foreground-strong'
                          }`}
                        >
                          <div className="font-medium">{t('task.syncConflictLocal')}</div>
                          <div className="mt-0.5 break-all text-[11px] opacity-90">{entry.localDisplay}</div>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {resolveConflictError && (
                <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
                  {resolveConflictError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                onClick={handleCloseResolveConflict}
                disabled={resolvingConflict}
                className="inline-flex h-8 items-center justify-center rounded-md border border-border-strong bg-card px-3 text-xs font-medium text-foreground-strong hover:bg-muted"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => { void handleApplyResolvedConflict(); }}
                disabled={resolvingConflict}
                className="inline-flex h-8 items-center justify-center rounded-md border border-primary bg-primary px-3 text-xs font-medium text-white hover:bg-primary-strong"
              >
                {resolvingConflict ? t('common.loading') : t('task.syncConflictApply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {searchDialog.open && (
        <ErrorBoundary fallback={workspaceErrorFallback}>
          <Suspense fallback={searchDialogFallback}>
            <SearchDialog
              open
              initialQuery={searchDialog.query || ''}
              onClose={() => closeSearchDialog()}
            />
          </Suspense>
        </ErrorBoundary>
      )}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-3 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSettingsOpen(false);
            }
          }}
        >
          <div
            ref={settingsDialogRef}
            className="h-[min(46rem,calc(100vh-2rem))] w-[min(54rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl bg-card shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={t('settings.title')}
            tabIndex={-1}
          >
            <Suspense fallback={workspaceFallback}>
              <ErrorBoundary fallback={workspaceErrorFallback}>
                <Settings
                  modal
                  user={user}
                  setUser={setUser}
                  onClose={() => setSettingsOpen(false)}
                />
              </ErrorBoundary>
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}

export default MainLayout;
