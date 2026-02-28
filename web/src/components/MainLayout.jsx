import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { categoriesAPI, tasksAPI } from '../api/client';
import CalendarView from './CalendarView';
import TaskList from './TaskList';
import CategoryManager from './CategoryManager';
import Settings from './Settings';
import { IconCalendar, IconClock, IconInbox, IconList, IconLogout, IconSettings, IconStatus, IconTag, IconTrash } from './icons/TaskIcons';
import { getShowCategoryEmoji, onUIPrefsChanged } from '../utils/uiPrefs';

function MainLayout({ user, setUser }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('calendar');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [dragOverCategoryID, setDragOverCategoryID] = useState(0);
  const [showCategoryEmoji, setShowCategoryEmoji] = useState(getShowCategoryEmoji());

  useEffect(() => {
    // 根据当前路径设置活动标签
    const path = location.pathname;
    if (path === '/') setActiveTab('calendar');
    else if (path === '/tasks') setActiveTab('tasks');
    else if (path === '/categories') setActiveTab('categories');
    else if (path === '/settings') setActiveTab('settings');
    setMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    categoriesAPI
      .list()
      .then((res) => setCategories(res.data || []))
      .catch(() => setCategories([]));
  }, [location.pathname]);

  useEffect(() => onUIPrefsChanged(() => setShowCategoryEmoji(getShowCategoryEmoji())), []);

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
      await tasksAPI.update(taskID, { category_ids: [categoryID] });
      window.dispatchEvent(new CustomEvent('tasks:changed'));
    } catch (error) {
      console.error('Failed to move task to category:', error);
    }
  };

  const taskNavItems = [
    { key: 'all', to: '/tasks?view=all', label: t('task.allTasks'), icon: IconList },
    { key: 'inbox', to: '/tasks?view=inbox', label: t('task.inbox'), icon: IconInbox },
    { key: 'today', to: '/tasks?view=today', label: t('task.today'), icon: IconCalendar },
    { key: 'upcoming', to: '/tasks?view=upcoming', label: t('task.upcoming'), icon: IconClock },
  ];

  const isTaskNavActive = (to) => {
    if (location.pathname !== '/tasks') return false;
    const target = new URLSearchParams(to.split('?')[1] || '');
    const current = new URLSearchParams(location.search || '');
    const targetView = target.get('view') || 'all';
    const currentView = current.get('view') || 'all';
    return targetView === currentView &&
      (target.get('category_id') || '') === (current.get('category_id') || '');
  };

  return (
    <div className="h-screen bg-slate-100 flex flex-col md:flex-row">
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{t('app.name')}</h1>
          <p className="text-xs text-slate-500">{user.username}</p>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="px-3 py-2 text-sm rounded-md border border-slate-300"
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
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<CalendarView />} />
          <Route path="/tasks" element={<TaskList />} />
          <Route path="/categories" element={<CategoryManager />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
}

export default MainLayout;
