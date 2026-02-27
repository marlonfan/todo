import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { categoriesAPI, tasksAPI } from '../api/client';
import TaskModal from './TaskModal';
import { formatDateTime, getUserTimezone, toInputFormat, toISOString } from '../utils/time';
import { getNaturalTimeOptionsFromUser, parseNaturalTimeFromTitle } from '../utils/naturalTime';
import { getShowCategoryEmoji, onUIPrefsChanged } from '../utils/uiPrefs';
import { IconClock, IconFlag, IconTag } from './icons/TaskIcons';

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

function TaskList() {
  const { t } = useTranslation();
  const location = useLocation();
  const timezone = getUserTimezone();

  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTask, setModalTask] = useState(null);
  const [selectedTaskID, setSelectedTaskID] = useState(0);
  const [draft, setDraft] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState('');
  const [detailPanel, setDetailPanel] = useState('');
  const [showCategoryEmoji, setShowCategoryEmoji] = useState(getShowCategoryEmoji());
  const detailPanelRef = useRef(null);
  const lastSyncedSelectedIDRef = useRef(0);
  const draftTouchedRef = useRef(false);

  const params = new URLSearchParams(location.search);
  const view = params.get('view') || 'all';
  const categoryID = Number.parseInt(params.get('category_id') || '', 10);
  const activeCategoryID = Number.isNaN(categoryID) ? 0 : categoryID;

  useEffect(() => {
    fetchTasks();
    fetchCategories();
  }, []);

  useEffect(() => {
    const handleTasksChanged = () => {
      fetchTasks();
    };
    window.addEventListener('tasks:changed', handleTasksChanged);
    return () => window.removeEventListener('tasks:changed', handleTasksChanged);
  }, []);

  useEffect(() => onUIPrefsChanged(() => setShowCategoryEmoji(getShowCategoryEmoji())), []);

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

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await tasksAPI.list();
      setTasks(res.data || []);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await categoriesAPI.list();
      setCategories(res.data || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const getTaskTime = (task) => task.start_time || task.due_date || '';

  const sortedTasks = useMemo(() => {
    const cloned = [...tasks];
    cloned.sort((a, b) => {
      const ta = getTaskTime(a);
      const tb = getTaskTime(b);
      if (!ta && !tb) return a.id - b.id;
      if (!ta) return 1;
      if (!tb) return -1;
      return dayjs(ta).valueOf() - dayjs(tb).valueOf();
    });
    return cloned;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const now = dayjs().tz(timezone);
    const todayStart = now.startOf('day');
    const todayEnd = now.endOf('day');
    const sevenDayEnd = todayStart.add(6, 'day').endOf('day');

    if (activeCategoryID > 0) {
      return sortedTasks.filter((task) => (task.categories || []).some((cat) => cat.id === activeCategoryID) && task.status === 'pending');
    }

    if (view === 'completed') {
      return sortedTasks.filter((task) => task.status === 'completed');
    }

    if (view === 'deleted') {
      return sortedTasks.filter((task) => task.status === 'cancelled');
    }

    const pending = sortedTasks.filter((task) => task.status === 'pending');

    if (view === 'inbox') {
      return pending.filter((task) => !task.categories || task.categories.length === 0);
    }

    if (view === 'today') {
      return pending.filter((task) => {
        const time = getTaskTime(task);
        if (!time) return false;
        const current = dayjs(time).tz(timezone);
        return (current.isAfter(todayStart) || current.isSame(todayStart)) && (current.isBefore(todayEnd) || current.isSame(todayEnd));
      });
    }

    if (view === 'upcoming') {
      return pending.filter((task) => {
        const time = getTaskTime(task);
        if (!time) return false;
        const current = dayjs(time).tz(timezone);
        return (current.isAfter(todayStart) || current.isSame(todayStart)) && (current.isBefore(sevenDayEnd) || current.isSame(sevenDayEnd));
      });
    }

    return pending;
  }, [activeCategoryID, sortedTasks, timezone, view]);

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
          : view === 'completed'
            ? t('task.completedTasks')
            : view === 'deleted'
              ? t('task.deletedTasks')
            : t('task.allTasks');

  useEffect(() => {
    if (filteredTasks.length === 0) {
      setSelectedTaskID(0);
      setDraft(null);
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

  const buildDraftFromTask = (taskValue) => {
    if (!taskValue) return null;
    const allDay = !!(taskValue.all_day || taskValue.allDay);
    const startTime = taskValue.start_time || taskValue.startTime || taskValue.due_date || '';
    const endTime = taskValue.end_time || taskValue.endTime || '';
    return {
      title: taskValue.title || '',
      description: taskValue.description || '',
      priority: String(taskValue.priority ?? 0),
      status: taskValue.status || 'pending',
      all_day: allDay,
      start_time: startTime ? toInputFormat(startTime, null, allDay) : '',
      end_time: endTime ? toInputFormat(endTime, null, allDay) : '',
      category_ids: (taskValue.categories || []).map((cat) => String(cat.id)),
    };
  };

  useEffect(() => {
    if (!selectedTask) {
      setDraft(null);
      lastSyncedSelectedIDRef.current = 0;
      draftTouchedRef.current = false;
      return;
    }

    const nextDraft = buildDraftFromTask(selectedTask);
    if (lastSyncedSelectedIDRef.current !== selectedTask.id) {
      lastSyncedSelectedIDRef.current = selectedTask.id;
      draftTouchedRef.current = false;
      setDraft(nextDraft);
      setDetailPanel('');
      return;
    }

    if (!draft) {
      draftTouchedRef.current = false;
      setDraft(nextDraft);
      return;
    }

    // Keep detail draft synced with external updates (drag/drop, modal save, etc.)
    // unless the user is actively editing this draft.
    if (!draftTouchedRef.current) {
      const current = normalizeDraftForCompare(draft);
      const incoming = normalizeDraftForCompare(nextDraft);
      if (JSON.stringify(current) !== JSON.stringify(incoming)) {
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

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 1:
        return { text: t('task.priorityHigh'), class: 'text-rose-600' };
      case -1:
        return { text: t('task.priorityLow'), class: 'text-emerald-600' };
      default:
        return { text: t('task.priorityMedium'), class: 'text-sky-600' };
    }
  };

  const getPriorityBadge = (priorityValue) => {
    const value = Number.parseInt(priorityValue, 10) || 0;
    if (value === 1) return { text: t('task.priorityHigh'), className: 'text-rose-600 bg-rose-50 border-rose-200' };
    if (value === -1) return { text: t('task.priorityLow'), className: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    return { text: t('task.priorityMedium'), className: 'text-sky-600 bg-sky-50 border-sky-200' };
  };

  const getDueSummary = () => {
    if (!draft?.start_time) return t('task.noDate');
    const parsed = dayjs(draft.start_time);
    if (!parsed.isValid()) return t('task.noDate');

    const formatted = draft.all_day
      ? parsed.format('MM/DD')
      : parsed.format('MM/DD HH:mm');

    const isPending = (draft.status || 'pending') === 'pending';
    const overdueDays = dayjs().startOf('day').diff(parsed.startOf('day'), 'day');
    if (isPending && overdueDays > 0) {
      return `${formatted} · ${t('task.overdueDays', { days: overdueDays })}`;
    }
    return formatted;
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      if (task.recurrence_rule) {
        await tasksAPI.updateStatus(task.id, {
          status: newStatus,
          occurrence_date: dayjs().tz(timezone).format('YYYY-MM-DD'),
        });
      } else {
        await tasksAPI.updateStatus(task.id, newStatus);
      }
      await fetchTasks();
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

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
      const parsedNaturalTime = parseNaturalTimeFromTitle(title, timezone, getNaturalTimeOptionsFromUser(storedUser));
      const normalizedTitle = (parsedNaturalTime?.cleanedTitle || title).trim() || title;
      const now = dayjs().tz(timezone);
      const { hour, minute } = getDefaultStartTimeParts();
      const startLocal = parsedNaturalTime?.parsedAtInput || now.hour(hour).minute(minute).second(0).format('YYYY-MM-DDTHH:mm');
      const payload = {
        title: normalizedTitle,
        description: '',
        priority: 0,
        all_day: false,
        client_timezone: timezone,
        start_time: toISOString(startLocal),
        start_time_local: startLocal,
      };
      if (activeCategoryID > 0) {
        payload.category_ids = [activeCategoryID];
      }
      const res = await tasksAPI.create(payload);
      setQuickTitle('');
      await fetchTasks();
      if (res?.data?.id) {
        setSelectedTaskID(res.data.id);
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

  const splitDatePart = (value) => (value && value.includes('T') ? value.split('T')[0] : value || '');
  const splitTimePart = (value, fallback = '09:00') => {
    if (!value) return fallback;
    if (!value.includes('T')) return fallback;
    return value.split('T')[1].slice(0, 5) || fallback;
  };

  const mergeDateTime = (datePart, timePart) => {
    if (!datePart) return '';
    return `${datePart}T${timePart || '09:00'}`;
  };

  const handleSaveDraft = async () => {
    if (!selectedTask || !draft) return;
    if (savingDraft) return;
    const title = (draft.title || '').trim();
    if (!title) return;

    setSavingDraft(true);
    try {
      const payload = {
        title,
        description: draft.description || '',
        priority: Number.parseInt(draft.priority, 10) || 0,
        status: draft.status || selectedTask.status || 'pending',
        all_day: !!draft.all_day,
        client_timezone: timezone,
        category_ids: (draft.category_ids || []).map((id) => Number.parseInt(id, 10)).filter((id) => !Number.isNaN(id)),
      };

      if (payload.all_day) {
        payload.start_time = draft.start_time ? toISOString(`${draft.start_time} 00:00:00`) : null;
        payload.end_time = draft.end_time ? toISOString(`${draft.end_time} 23:59:59`) : null;
      } else {
        payload.start_time = draft.start_time ? toISOString(draft.start_time) : null;
        payload.end_time = draft.end_time ? toISOString(draft.end_time) : null;
      }

      if (draft.start_time) payload.start_time_local = draft.start_time;
      if (draft.end_time) payload.end_time_local = draft.end_time;

      const res = await tasksAPI.update(selectedTask.id, payload);
      if (res?.data?.id) {
        const savedTask = res.data;
        setTasks((prev) => prev.map((taskItem) => (taskItem.id === savedTask.id ? savedTask : taskItem)));
      }
      setLastSavedAt(dayjs().format('HH:mm:ss'));
    } catch (err) {
      console.error('Failed to save task details:', err);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedTask) return;
    if (!confirm(t('task.deleteConfirm'))) return;

    try {
      await tasksAPI.updateStatus(selectedTask.id, 'cancelled');
      await fetchTasks();
      window.dispatchEvent(new CustomEvent('tasks:changed'));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleResetDraft = () => {
    if (!selectedTask) return;
    draftTouchedRef.current = false;
    setDraft(buildDraftFromTask(selectedTask));
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

  const openAdvancedModal = (task = null) => {
    setModalTask(task);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setModalTask(null);
  };

  const handleTaskSaved = async () => {
    handleModalClose();
    await fetchTasks();
    window.dispatchEvent(new CustomEvent('tasks:changed'));
  };

  const renderTaskRow = (task) => {
    const selected = selectedTaskID === task.id;
    const isCompleted = task.status === 'completed';
    const isDeleted = task.status === 'cancelled';
    const priority = getPriorityLabel(task.priority);

    return (
      <div
        key={task.id}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData('text/task-id', String(task.id));
          event.dataTransfer.effectAllowed = 'move';
        }}
        onClick={() => setSelectedTaskID(task.id)}
        className={`group cursor-pointer rounded-xl border px-3 py-2 transition ${
          selected
            ? 'border-blue-300 bg-blue-50/70'
            : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
        }`}
      >
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={isCompleted}
            disabled={isDeleted}
            onChange={(e) => {
              e.stopPropagation();
              handleStatusChange(task, isCompleted ? 'pending' : 'completed');
            }}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h3 className={`truncate text-[14px] font-medium ${isCompleted || isDeleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                {task.title}
              </h3>
              <div className="flex shrink-0 items-center gap-2">
                {isDeleted && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange(task, 'pending');
                    }}
                    className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-50"
                    title={t('task.markPending')}
                  >
                    ↺
                  </button>
                )}
                <span className="text-[11px] text-slate-400">
                  {task.start_time ? formatDateTime(task.start_time, 'MM/DD HH:mm') : ''}
                </span>
              </div>
            </div>

            {task.description && (
              <p className="mt-0.5 truncate text-[12px] text-slate-500">{task.description}</p>
            )}

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              {isDeleted && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">{t('task.statusCancelled')}</span>}
              <span className={`${priority.class}`}>{priority.text}</span>
              {task.categories?.slice(0, 2).map((cat) => (
                <span
                  key={cat.id}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                  style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span>{cat.name}</span>
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
  };

  const canQuickCreate = view !== 'completed' && view !== 'deleted';

  return (
    <div className="h-full bg-slate-100 p-3 md:p-4">
      <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[minmax(460px,0.95fr)_minmax(360px,1.05fr)]">
        <section className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">{viewTitle}</h2>
                <p className="text-xs text-slate-500">{t('task.taskCount', { count: filteredTasks.length })}</p>
              </div>
              <button onClick={() => openAdvancedModal(null)} className="btn-primary text-sm">
                + {t('task.newTask')}
              </button>
            </div>
            {canQuickCreate && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                <span className="text-slate-400">＋</span>
                <input
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQuickCreate();
                    }
                  }}
                  placeholder={`${t('common.add')}${t('task.title')}`}
                  className="w-full border-none bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-2">
            {loading ? (
              <div className="py-8 text-center text-slate-500">{t('common.loading')}</div>
            ) : filteredTasks.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                <p>{t('task.noTasks')}</p>
                <p className="mt-2 text-sm">{t('task.createFirst')}</p>
              </div>
            ) : (
              <div className="space-y-1.5">{filteredTasks.map(renderTaskRow)}</div>
            )}
          </div>
        </section>

        <section className="hidden h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white lg:flex">
          {!selectedTask || !draft ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              {t('task.selectTaskHint')}
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">
                      {selectedTask.start_time ? formatDateTime(selectedTask.start_time) : t('task.statusPending')}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      {savingDraft ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">{t('task.saving')}</span>
                      ) : isDraftDirty ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{t('task.unsavedChanges')}</span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">{t('task.saved')}</span>
                      )}
                      {lastSavedAt && <span className="text-slate-400">{t('task.lastSavedAt', { time: lastSavedAt })}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetDraft}
                      disabled={!isDraftDirty || savingDraft}
                      className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                    >
                      {t('task.resetChanges')}
                    </button>
                    <button
                      onClick={() => openAdvancedModal(selectedTask)}
                      className="rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                    >
                      {t('task.advancedEdit')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-auto p-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <input
                    value={draft.title}
                    onChange={(e) => handleDraftFieldChange('title', e.target.value)}
                    className="w-full border-none bg-transparent text-2xl font-semibold text-slate-900 outline-none placeholder:text-slate-300"
                    placeholder={t('task.title')}
                  />
                  <p className="mt-2 text-xs text-slate-500">{getDueSummary()}</p>
                </div>

                <div ref={detailPanelRef} className="relative rounded-xl border border-slate-200 bg-white p-2">
                  <div className="flex items-center gap-1">
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
                  </div>

                  {detailPanel === 'priority' && (
                    <div className="absolute left-2 right-2 top-12 z-20 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
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
                    <div className="absolute left-2 right-2 top-12 z-20 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
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
                          <div className="grid grid-cols-[1fr_120px] gap-2">
                            <input
                              type="date"
                              value={splitDatePart(draft.start_time)}
                              onChange={(e) => {
                                const nextDate = e.target.value;
                                const currentTime = splitTimePart(draft.start_time, '09:00');
                                handleDraftFieldChange('start_time', nextDate ? mergeDateTime(nextDate, currentTime) : '');
                              }}
                              className="form-input"
                            />
                            <input
                              type="time"
                              step="300"
                              value={splitTimePart(draft.start_time, '09:00')}
                              onChange={(e) => {
                                const baseDate = splitDatePart(draft.start_time) || dayjs().tz(timezone).format('YYYY-MM-DD');
                                handleDraftFieldChange('start_time', mergeDateTime(baseDate, e.target.value));
                              }}
                              className="form-input"
                            />
                          </div>
                          <div className="grid grid-cols-[1fr_120px] gap-2">
                            <input
                              type="date"
                              value={splitDatePart(draft.end_time)}
                              onChange={(e) => {
                                const nextDate = e.target.value;
                                const currentTime = splitTimePart(draft.end_time, splitTimePart(draft.start_time, '09:30'));
                                handleDraftFieldChange('end_time', nextDate ? mergeDateTime(nextDate, currentTime) : '');
                              }}
                              className="form-input"
                            />
                            <input
                              type="time"
                              step="300"
                              value={splitTimePart(draft.end_time, splitTimePart(draft.start_time, '09:30'))}
                              onChange={(e) => {
                                const baseDate = splitDatePart(draft.end_time) || splitDatePart(draft.start_time) || dayjs().tz(timezone).format('YYYY-MM-DD');
                                handleDraftFieldChange('end_time', mergeDateTime(baseDate, e.target.value));
                              }}
                              className="form-input"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {detailPanel === 'category' && (
                    <div className="absolute left-2 right-2 top-12 z-20 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
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
                </div>

                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <label className="mb-1 block text-xs font-medium text-slate-500">{t('task.description')}</label>
                  <textarea
                    value={draft.description}
                    onChange={(e) => handleDraftFieldChange('description', e.target.value)}
                    rows={8}
                    className="min-h-[180px] w-full resize-none border-none bg-transparent text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400"
                    placeholder={t('task.description')}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
                <button onClick={handleDeleteSelected} className="btn-danger text-sm">
                  {t('common.delete')}
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={savingDraft || !isDraftDirty}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {savingDraft ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {modalOpen && <TaskModal task={modalTask} onClose={handleModalClose} onSaved={handleTaskSaved} />}
    </div>
  );
}

export default TaskList;
