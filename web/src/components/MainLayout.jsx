import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import CalendarView from './CalendarView';
import TaskList from './TaskList';
import CategoryManager from './CategoryManager';
import Settings from './Settings';
import SearchDialog from './SearchDialog';
import {
  IconCalendar,
  IconClock,
  IconInbox,
  IconList,
  IconLogout,
  IconSearch,
  IconSettings,
  IconStatus,
  IconTag,
  IconTrash,
} from './icons/TaskIcons';
import { getTokenStore } from '../api/client';
import { getShowCategoryEmoji, onUIPrefsChanged } from '../utils/uiPrefs';
import { useCategoriesQuery } from '../query/hooks';
import { moveTaskToCategoryLocal, updateTaskLocal } from '../data/taskMutations';
import { closeSearchDialog, openSearchDialog, subscribeSearchOverlay } from '../state/searchOverlay';
import {
  getSyncConflicts,
  removeSyncConflict,
  subscribeSyncConflicts,
} from '../state/syncConflictCenter';
import { formatDateTime } from '../utils/time';

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

function MainLayout({ user, setUser }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('calendar');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dragOverCategoryID, setDragOverCategoryID] = useState(0);
  const [showCategoryEmoji, setShowCategoryEmoji] = useState(getShowCategoryEmoji());
  const [mobilePrefs, setMobilePrefs] = useState(readMobilePrefsFromStorage);
  const [searchDialog, setSearchDialog] = useState({ open: false, query: '' });
  const [syncConflicts, setSyncConflicts] = useState(() => getSyncConflicts());
  const [resolveConflictID, setResolveConflictID] = useState(0);
  const [resolveSelections, setResolveSelections] = useState({});
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [resolveConflictError, setResolveConflictError] = useState('');
  const didApplyMobileDefaultRef = useRef(false);
  const initialLocationRef = useRef({
    pathname: location.pathname,
    search: location.search,
  });
  const { data: categories = [] } = useCategoriesQuery();

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
    // 根据当前路径设置活动标签
    const path = location.pathname;
    if (path === '/') setActiveTab('calendar');
    else if (path === '/tasks') setActiveTab('tasks');
    else if (path === '/search') setActiveTab('tasks');
    else if (path === '/categories') setActiveTab('categories');
    else if (path === '/settings') setActiveTab('settings');
    setMobileMenuOpen(false);
  }, [location]);

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
    if (typeof window === 'undefined') return;
    if (didApplyMobileDefaultRef.current) return;
    didApplyMobileDefaultRef.current = true;

    const initialLocation = initialLocationRef.current;
    if (initialLocation.pathname !== '/' || initialLocation.search) return;

    if (mobilePrefs.defaultTab === 'tasks') {
      navigate(buildDefaultTasksRoute(mobilePrefs.defaultTaskView), { replace: true });
      return;
    }
    if (mobilePrefs.defaultTab === 'settings') {
      navigate('/settings', { replace: true });
    }
  }, [mobilePrefs.defaultTab, mobilePrefs.defaultTaskView, navigate]);

  const handleLogout = () => {
    getTokenStore().remove();
    localStorage.removeItem('user');
    setUser(null);
  };

  const handleDropToCategory = async (event, categoryID) => {
    event.preventDefault();
    setDragOverCategoryID(0);

    const rawTaskID = event.dataTransfer.getData('text/task-id');
    const taskID = Number.parseInt(rawTaskID || '', 10);
    if (!taskID) return;

    try {
      await moveTaskToCategoryLocal(queryClient, taskID, categoryID);
    } catch (error) {
      console.error('Failed to move task to category:', error);
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
      settings: {
        key: 'settings',
        to: '/settings',
        label: t('nav.settings'),
        icon: IconSettings,
      },
    };

    switch (mobilePrefs.tabPreset) {
      case 'tasks_calendar_categories_settings':
        return [baseTabs.tasks, baseTabs.search, baseTabs.calendar, baseTabs.categories, baseTabs.settings];
      case 'tasks_inbox_calendar_settings':
        return [baseTabs.inbox, baseTabs.search, baseTabs.calendar, baseTabs.settings];
      default:
        return [baseTabs.tasks, baseTabs.search, baseTabs.calendar, baseTabs.settings];
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
    if (location.pathname === '/settings') return t('nav.settings');
    return t('nav.calendar');
  }, [location.pathname, location.search, t]);

  const navItemClass = (active) => `md-nav-item ${active ? 'md-nav-item-active' : 'md-nav-item-idle'}`;
  const hideMobileHeader = location.pathname === '/';
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

  const handleEditSyncConflict = useCallback(() => {
    if (!activeSyncConflict?.id) return;
    const taskID = Number.parseInt(activeSyncConflict.task_id, 10) || 0;
    removeSyncConflict(activeSyncConflict.id);
    if (Number(resolveConflictID || 0) === Number(activeSyncConflict.id)) {
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

  const handleOpenResolveConflict = useCallback(() => {
    if (!activeSyncConflict?.id) return;
    if (!activeSyncConflict.latest_task || typeof activeSyncConflict.latest_task !== 'object') {
      handleEditSyncConflict();
      return;
    }
    const localPayload = activeSyncConflict?.local_payload && typeof activeSyncConflict.local_payload === 'object'
      ? activeSyncConflict.local_payload
      : {};
    const latestTask = activeSyncConflict.latest_task;
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
    setResolveConflictID(activeSyncConflict.id);
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

  return (
    <div className="h-screen bg-[#eaf2ff] flex flex-col md:flex-row">
      {activeSyncConflict && (
        <div className="fixed right-2 top-2 z-50 w-[min(24rem,calc(100vw-1rem))] rounded-xl border border-amber-200 bg-amber-50/95 p-3 shadow-lg backdrop-blur md:right-4 md:top-4">
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
              className="inline-flex h-8 items-center justify-center rounded-md border border-amber-300 bg-white px-2.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              {t('task.syncConflictDismiss')}
            </button>
            <button
              type="button"
              onClick={handleOpenResolveConflict}
              className="inline-flex h-8 items-center justify-center rounded-md border border-amber-500 bg-amber-500 px-2.5 text-xs font-medium text-white hover:bg-amber-600"
            >
              {t('task.syncConflictResolve')}
            </button>
          </div>
        </div>
      )}
      {!hideMobileHeader && (
        <div className="md:hidden flex h-12 items-center justify-between border-b border-blue-100 bg-white/95 px-4 backdrop-blur">
          <h1 className="truncate text-sm font-semibold text-slate-800">{mobilePageTitle}</h1>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50/70 text-blue-700"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      )}

      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`sidebar flex flex-col fixed md:static inset-y-0 left-0 z-40 transform transition-transform duration-200
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="m-3 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 px-4 py-4 text-white shadow-sm">
          <h1 className="text-xl font-semibold">{t('app.name')}</h1>
          <p className="text-sm text-blue-100">{user.username}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <Link
            to="/"
            className={navItemClass(activeTab === 'calendar')}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <IconCalendar className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('nav.calendar')}</span>
            </span>
          </Link>

          <div className="mt-4 px-4 text-xs font-semibold uppercase tracking-wide text-blue-400">
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
                    <ItemIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                </button>
              );
            }
            return (
              <Link
                key={item.key}
                to={item.to}
                className={navItemClass(isTaskNavActive(item.to))}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <ItemIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
              </Link>
            );
          })}

          <div className="mt-4 space-y-1">
            {categories.map((cat) => (
              <Link
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
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cat.color || '#94a3b8' }} />
                  )}
                  <span className="truncate">{cat.name}</span>
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-4 border-t border-blue-100 pt-3">
            <Link
              to="/tasks?view=completed"
              className={navItemClass(isTaskNavActive('/tasks?view=completed'))}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <IconStatus className="h-4 w-4 shrink-0" />
                <span className="truncate">{t('task.completedTasks')}</span>
              </span>
            </Link>
            <Link
              to="/tasks?view=deleted"
              className={navItemClass(isTaskNavActive('/tasks?view=deleted'))}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <IconTrash className="h-4 w-4 shrink-0" />
                <span className="truncate">{t('task.deletedTasks')}</span>
              </span>
            </Link>
            <Link
              to="/categories"
              className={navItemClass(activeTab === 'categories')}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <IconTag className="h-4 w-4 shrink-0" />
                <span className="truncate">{t('category.manageCategories')}</span>
              </span>
            </Link>
          </div>

          <Link
            to="/settings"
            className={navItemClass(activeTab === 'settings')}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <IconSettings className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('nav.settings')}</span>
            </span>
          </Link>
        </nav>

        <div className="border-t border-blue-100 p-3">
          <button
            onClick={handleLogout}
            className="md-nav-item md-nav-item-idle w-full text-left"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <IconLogout className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('nav.logout')}</span>
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative flex-1 overflow-hidden pb-14 md:pb-0">
        {/* CalendarView 和 TaskList 常驻，用 visibility 切换，保留布局尺寸避免 FullCalendar ResizeObserver 触发 */}
        <div className={`absolute inset-0 ${location.pathname === '/' ? 'z-10' : 'invisible pointer-events-none'}`}>
          <CalendarView />
        </div>
        <div className={`absolute inset-0 ${location.pathname === '/tasks' ? 'z-10' : 'invisible pointer-events-none'}`}>
          <TaskList />
        </div>

        <Routes>
          <Route path="/search" element={<TaskList forcedView="search" />} />
          <Route path="/categories" element={<CategoryManager />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-blue-100 bg-white/95 backdrop-blur md:hidden">
        <div className={`grid h-14 ${mobileTabs.length === 5 ? 'grid-cols-5' : mobileTabs.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {mobileTabs.map((item) => {
            const ItemIcon = item.icon;
            const active = isMobileTabActive(item);
            if (item.action === 'open_search') {
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => openSearchDialog()}
                  className={`appearance-none border-0 bg-transparent p-0 flex items-center justify-center ${
                    active ? 'text-blue-700' : 'text-slate-500'
                  }`}
                >
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center border-b-2 transition-colors ${
                      active ? 'border-blue-700' : 'border-transparent hover:border-blue-200'
                    }`}
                  >
                    <ItemIcon className="h-[18px] w-[18px]" />
                  </span>
                </button>
              );
            }
            return (
              <Link
                key={item.key}
                to={item.to}
                aria-label={item.label}
                title={item.label}
                className={`flex items-center justify-center ${
                  active ? 'text-blue-700' : 'text-slate-500'
                }`}
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center border-b-2 transition-colors ${
                    active ? 'border-blue-700' : 'border-transparent hover:border-blue-200'
                  }`}
                >
                  <ItemIcon className="h-[18px] w-[18px]" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {resolvingConflictItem && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-3">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-slate-800">{t('task.syncConflictResolveTitle')}</div>
              <div className="mt-1 text-xs text-slate-600">
                {resolvingConflictItem.task_title
                  ? t('task.syncConflictHint', { title: resolvingConflictItem.task_title })
                  : t('task.syncConflictHintFallback')}
              </div>
            </div>

            <div className="max-h-[65vh] overflow-auto px-4 py-3">
              {conflictFieldEntries.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {t('task.syncConflictNoFields')}
                </div>
              )}

              <div className="space-y-2">
                {conflictFieldEntries.map((entry) => {
                  const selected = resolveSelections[entry.field] === 'server' ? 'server' : 'local';
                  return (
                    <div key={entry.field} className="rounded-lg border border-slate-200 p-2">
                      <div className="text-xs font-semibold text-slate-700">{entry.label}</div>
                      <div className="mt-1 grid gap-2 md:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => handleResolveChoiceChange(entry.field, 'server')}
                          className={`rounded-md border px-2 py-1.5 text-left text-xs ${
                            selected === 'server'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <div className="font-medium">{t('task.syncConflictServer')}</div>
                          <div className="mt-0.5 break-all text-[11px] opacity-90">{entry.serverDisplay}</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveChoiceChange(entry.field, 'local')}
                          className={`rounded-md border px-2 py-1.5 text-left text-xs ${
                            selected === 'local'
                              ? 'border-blue-500 bg-blue-50 text-blue-800'
                              : 'border-slate-200 bg-white text-slate-700'
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

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                onClick={handleCloseResolveConflict}
                disabled={resolvingConflict}
                className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => { void handleApplyResolvedConflict(); }}
                disabled={resolvingConflict}
                className="inline-flex h-8 items-center justify-center rounded-md border border-blue-600 bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700"
              >
                {resolvingConflict ? t('common.loading') : t('task.syncConflictApply')}
              </button>
            </div>
          </div>
        </div>
      )}

      <SearchDialog
        open={!!searchDialog.open}
        initialQuery={searchDialog.query || ''}
        onClose={() => closeSearchDialog()}
      />
    </div>
  );
}

export default MainLayout;
