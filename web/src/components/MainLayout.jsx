import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import CalendarView from './CalendarView';
import TaskList from './TaskList';
import CategoryManager from './CategoryManager';
import Settings from './Settings';
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
import { getShowCategoryEmoji, onUIPrefsChanged } from '../utils/uiPrefs';
import { useCategoriesQuery } from '../query/hooks';
import { moveTaskToCategoryLocal } from '../data/taskMutations';

function normalizeMobileDefaultTab(value) {
  if (value === 'calendar' || value === 'settings') return value;
  return 'tasks';
}

function normalizeMobileTabPreset(value) {
  if (value === 'tasks_calendar_categories_settings' || value === 'tasks_inbox_calendar_settings') {
    return value;
  }
  return 'tasks_calendar_settings';
}

function readMobilePrefsFromStorage() {
  try {
    const rawUser = JSON.parse(localStorage.getItem('user') || '{}');
    return {
      defaultTab: normalizeMobileDefaultTab(rawUser.mobile_default_tab),
      tabPreset: normalizeMobileTabPreset(rawUser.mobile_tab_preset),
    };
  } catch {
    return {
      defaultTab: 'tasks',
      tabPreset: 'tasks_calendar_settings',
    };
  }
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
  const didApplyMobileDefaultRef = useRef(false);
  const initialLocationRef = useRef({
    pathname: location.pathname,
    search: location.search,
  });
  const { data: categories = [] } = useCategoriesQuery();

  useEffect(() => {
    // 根据当前路径设置活动标签
    const path = location.pathname;
    if (path === '/') setActiveTab('calendar');
    else if (path === '/tasks') setActiveTab('tasks');
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
    if (window.innerWidth >= 768) return;
    if (didApplyMobileDefaultRef.current) return;
    didApplyMobileDefaultRef.current = true;

    const initialLocation = initialLocationRef.current;
    if (initialLocation.pathname !== '/' || initialLocation.search) return;

    if (mobilePrefs.defaultTab === 'tasks') {
      navigate('/tasks?view=all', { replace: true });
      return;
    }
    if (mobilePrefs.defaultTab === 'settings') {
      navigate('/settings', { replace: true });
    }
  }, [mobilePrefs.defaultTab, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
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
    { key: 'search', to: '/tasks?view=search', label: t('task.searchTasks'), icon: IconSearch },
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
        to: '/tasks?view=search',
        label: t('task.searchTasks'),
        icon: IconSearch,
        matchSearch: true,
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
      if (location.pathname !== '/tasks') return false;
      const current = new URLSearchParams(location.search || '');
      return (current.get('view') || 'all') === 'search';
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
    if (location.pathname === '/categories') return t('nav.categories');
    if (location.pathname === '/settings') return t('nav.settings');
    return t('nav.calendar');
  }, [location.pathname, location.search, t]);

  return (
    <div className="h-screen bg-slate-100 flex flex-col md:flex-row">
      <div className="md:hidden flex h-11 items-center justify-between px-3 border-b border-slate-200 bg-white">
        <h1 className="truncate text-sm font-semibold text-slate-800">{mobilePageTitle}</h1>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

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
        <div className="m-3 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 px-4 py-4 text-white">
          <h1 className="text-xl font-semibold">{t('app.name')}</h1>
          <p className="text-sm text-blue-100">{user.username}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <Link
            to="/"
            className={`block px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'calendar'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <IconCalendar className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('nav.calendar')}</span>
            </span>
          </Link>

          <div className="mt-4 px-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('task.listView')}
          </div>
          {taskNavItems.map((item) => {
            const ItemIcon = item.icon;
            return (
              <Link
                key={item.key}
                to={item.to}
                className={`mt-1 block px-4 py-2 rounded-lg ${
                  isTaskNavActive(item.to)
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
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
                className={`block px-4 py-2 rounded-lg ${
                  isTaskNavActive(`/tasks?category_id=${cat.id}`)
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : dragOverCategoryID === cat.id
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300'
                      : 'text-slate-600 hover:bg-slate-100'
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

          <div className="mt-4 border-t border-slate-200 pt-3">
            <Link
              to="/tasks?view=completed"
              className={`block px-4 py-2 rounded-lg transition-colors ${
                isTaskNavActive('/tasks?view=completed')
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <IconStatus className="h-4 w-4 shrink-0" />
                <span className="truncate">{t('task.completedTasks')}</span>
              </span>
            </Link>
            <Link
              to="/tasks?view=deleted"
              className={`mt-1 block px-4 py-2 rounded-lg transition-colors ${
                isTaskNavActive('/tasks?view=deleted')
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <IconTrash className="h-4 w-4 shrink-0" />
                <span className="truncate">{t('task.deletedTasks')}</span>
              </span>
            </Link>
            <Link
              to="/categories"
              className={`mt-1 block px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'categories'
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <IconTag className="h-4 w-4 shrink-0" />
                <span className="truncate">{t('category.manageCategories')}</span>
              </span>
            </Link>
          </div>

          <Link
            to="/settings"
            className={`mt-1 block px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'settings'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <IconSettings className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('nav.settings')}</span>
            </span>
          </Link>
        </nav>

        <div className="p-3 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <IconLogout className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('nav.logout')}</span>
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden pb-14 md:pb-0">
        <Routes>
          <Route path="/" element={<CalendarView />} />
          <Route path="/tasks" element={<TaskList />} />
          <Route path="/categories" element={<CategoryManager />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white md:hidden">
        <div className={`grid h-14 ${mobileTabs.length === 5 ? 'grid-cols-5' : mobileTabs.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {mobileTabs.map((item) => {
            const ItemIcon = item.icon;
            const active = isMobileTabActive(item);
            return (
              <Link
                key={item.key}
                to={item.to}
                aria-label={item.label}
                title={item.label}
                className={`flex items-center justify-center ${
                  active ? 'text-blue-600' : 'text-slate-500'
                }`}
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    active ? 'bg-blue-50' : 'hover:bg-slate-100'
                  }`}
                >
                  <ItemIcon className="h-[18px] w-[18px]" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MainLayout;
