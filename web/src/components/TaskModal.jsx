import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { tasksAPI, categoriesAPI } from '../api/client';
import dayjs from 'dayjs';
import { getUserTimeGranularity, toInputFormat, toISOString, getUserTimezone } from '../utils/time';
import { getNaturalTimeOptionsFromUser, parseNaturalTimeFromTitle } from '../utils/naturalTime';
import { getShowCategoryEmoji, onUIPrefsChanged } from '../utils/uiPrefs';
import { IconClock, IconFlag, IconRepeat, IconTag } from './icons/TaskIcons';
import LiveMarkdownEditor from './LiveMarkdownEditor';

const DEFAULT_TASK_START_TIME = '09:00';

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

function getDefaultStartParts() {
  const start = normalizeTaskStartTime(getStoredUser().default_task_start_time);
  const [hour, minute] = start.split(':').map((v) => Number.parseInt(v, 10));
  return { hour: Number.isFinite(hour) ? hour : 9, minute: Number.isFinite(minute) ? minute : 0 };
}

function TaskModal({ task, initialRange, onClose, onSaved }) {
  const { t } = useTranslation();
  const { register, handleSubmit, watch, setValue, getValues } = useForm();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('daily');
  const [selectedDays, setSelectedDays] = useState([]);
  const [timeTouched, setTimeTouched] = useState(false);
  const [parsePreview, setParsePreview] = useState('');
  const [basicPanel, setBasicPanel] = useState('');
  const [showCategoryEmoji, setShowCategoryEmoji] = useState(getShowCategoryEmoji());
  const basicPanelRef = useRef(null);
  const timeGranularity = getUserTimeGranularity();
  const timeInputStepSeconds = timeGranularity * 60;

  const isEditing = !!task;
  const isAllDay = watch('all_day');
  const priorityValue = watch('priority') || '0';
  const startInputValue = watch('start_time');
  const endInputValue = watch('end_time');
  const descriptionValue = watch('description') || '';
  const watchedCategoryIDs = watch('category_ids');
  const selectedCategoryValues = Array.isArray(watchedCategoryIDs)
    ? watchedCategoryIDs.map((id) => String(id))
      : watchedCategoryIDs
      ? [String(watchedCategoryIDs)]
      : [];
  useEffect(() => onUIPrefsChanged(() => setShowCategoryEmoji(getShowCategoryEmoji())), []);

  useEffect(() => {
    if (!basicPanel) return undefined;
    const handlePointerDown = (event) => {
      if (!basicPanelRef.current) return;
      if (!basicPanelRef.current.contains(event.target)) {
        setBasicPanel('');
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [basicPanel]);

  const applyQuickDatePreset = (preset) => {
    if (preset === 'clear') {
      setValue('start_time', '');
      setValue('end_time', '');
      return;
    }

    const now = dayjs().tz(getUserTimezone());
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
      setValue('end_time', '');
      return;
    }

    setValue('start_time', target.hour(hour).minute(minute).second(0).format('YYYY-MM-DDTHH:mm'));
    setTimeTouched(true);
  };

  const splitDatePart = (value) => (value && value.includes('T') ? value.split('T')[0] : value || '');

  useEffect(() => {
    fetchCategories();
    setTimeTouched(false);
    setParsePreview('');
    
    if (task) {
      // 编辑模式：填充表单数据
      setValue('title', task.title || '');
      setValue('description', task.description || '');
      setValue('priority', task.priority?.toString() || '0');
      setValue('status', task.status || 'pending');
      
      // 处理时间字段（支持 snake_case 和 camelCase）
      const startTime = task.start_time || task.startTime;
      const endTime = task.end_time || task.endTime;
      const allDay = task.all_day || task.allDay;
      const recurrenceRule = parseRecurrenceRule(task.recurrence_rule || task.recurrenceRule);
      
      if (startTime) {
        setValue('start_time', toInputFormat(startTime, null, allDay));
      }
      if (endTime) {
        setValue('end_time', toInputFormat(endTime, null, allDay));
      }
      setValue('all_day', allDay || false);
      
      // 处理重复规则
      setShowRecurrence(false);
      setRecurrenceType('daily');
      setSelectedDays([]);
      if (recurrenceRule) {
        setShowRecurrence(true);
        if (recurrenceRule.freq) {
          setRecurrenceType(recurrenceRule.freq || 'daily');
        }
        const byDay = recurrenceRule.byday || recurrenceRule.byDay;
        if (Array.isArray(byDay)) {
          setSelectedDays(byDay);
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
      if (initialRange?.start) {
        setValue('all_day', !!initialRange.allDay);
        setValue('start_time', initialRange.start);
        setValue('end_time', initialRange.end || '');
      } else {
        const timezone = getUserTimezone();
        setValue('start_time', getDefaultStartInputValue(timezone));
        setValue('end_time', '');
        setValue('all_day', false);
      }
      setValue('priority', '0');
      setValue('category_ids', []);
    }
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

    if (startTime && !startTime.includes('T')) {
      setValue('start_time', `${startTime}T00:00`);
    }
    if (endTime && !endTime.includes('T')) {
      setValue('end_time', `${endTime}T23:59`);
    }
  }, [isAllDay, getValues, setValue]);

  const fetchCategories = async () => {
    try {
      const res = await categoriesAPI.list();
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const applyNaturalTimeFromTitle = (titleValue, shouldUpdateTime) => {
    const parsed = parseNaturalTimeFromTitle(titleValue, getUserTimezone(), getNaturalTimeOptionsFromUser(getStoredUser()));
    if (!parsed) {
      setParsePreview('');
      return null;
    }

    if (parsed.cleanedTitle && parsed.cleanedTitle !== titleValue) {
      setValue('title', parsed.cleanedTitle);
    }
    if (shouldUpdateTime) {
      setValue('start_time', parsed.parsedAtInput);
    }
    setParsePreview(`${t('task.timeParsedHint')}: ${parsed.parsedAtDisplay}`);
    return parsed;
  };

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');

    try {
      const clientTimezone = getUserTimezone();
      const rawTitle = (data.title || '').trim();
      const parsedNaturalTime = applyNaturalTimeFromTitle(rawTitle, !timeTouched);
      const normalizedTitle = parsedNaturalTime?.cleanedTitle?.trim() || rawTitle;

      const payload = {
        title: normalizedTitle,
        description: data.description || '',
        priority: parseInt(data.priority),
        all_day: !!data.all_day,
        client_timezone: clientTimezone,
      };
      
      if (isEditing) {
        payload.status = data.status || task.status || 'pending';
      }

      // 处理日期时间
      if (data.all_day) {
        payload.start_time = data.start_time ? toISOString(`${data.start_time} 00:00:00`) : null;
        payload.end_time = data.end_time ? toISOString(`${data.end_time} 23:59:59`) : null;
      } else {
        if (parsedNaturalTime && !timeTouched) {
          data.start_time = parsedNaturalTime.parsedAtInput;
        }
        if (!isEditing && !data.start_time) {
          data.start_time = getDefaultStartInputValue(clientTimezone);
        }
        payload.start_time = data.start_time ? toISOString(data.start_time) : null;
        payload.end_time = data.end_time ? toISOString(data.end_time) : null;
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

      // 处理重复规则
      if (showRecurrence) {
        const rule = { freq: recurrenceType, interval: 1 };
        if (recurrenceType === 'weekly' && selectedDays.length > 0) {
          rule.byday = selectedDays;
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

      let savedTask;
      if (isEditing) {
        const res = await tasksAPI.update(task.id, payload);
        savedTask = res.data;
      } else {
        const res = await tasksAPI.create(payload);
        savedTask = res.data;
      }

      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || t('task.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing) return;
    
    if (!confirm(t('task.deleteConfirm'))) return;

    setLoading(true);
    try {
      await tasksAPI.updateStatus(task.id, 'cancelled');
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || t('task.deleteFailed'));
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

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content task-modal-shell" onClick={e => e.stopPropagation()}>
        <div className="flex h-[86vh] flex-col">
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {isEditing ? t('task.editTask') : t('task.newTask')}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {isEditing ? t('task.advancedEditHint') : t('task.quickCreateHint')}
                </p>
              </div>
              <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                ✕
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-6">
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                  {error}
                </div>
              )}

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <label className="form-label">{t('task.title')} *</label>
                <input
                  {...register('title', { required: true })}
                  type="text"
                  className="form-input text-lg font-medium"
                  placeholder={t('task.title')}
                  autoFocus
                  onBlur={(e) => applyNaturalTimeFromTitle(e.target.value, !timeTouched)}
                />
                <p className="mt-1 text-xs text-slate-500">{t('task.titleNaturalHint')}</p>
                {parsePreview && <p className="mt-1 text-xs text-emerald-600">{parsePreview}</p>}

                <div className="mt-4 border-t border-slate-200 pt-3">
                  <input type="hidden" {...register('description')} />
                  <label className="mb-1 block text-xs font-medium text-slate-500">{t('task.description')}</label>
                  <LiveMarkdownEditor
                    value={descriptionValue}
                    onChange={(nextValue) => setValue('description', nextValue, { shouldDirty: true })}
                    placeholder={t('task.description')}
                    minHeight={380}
                  />
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <input type="hidden" {...register('priority')} />
                {isEditing && <input type="hidden" {...register('status')} />}
                <input type="checkbox" {...register('all_day')} className="hidden" />
                <input type="hidden" {...register('start_time')} />
                <input type="hidden" {...register('end_time')} />
                <div ref={basicPanelRef} className="relative flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => setBasicPanel(basicPanel === 'priority' ? '' : 'priority')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${
                        basicPanel === 'priority'
                          ? 'bg-amber-100 text-amber-700'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                      title={t('task.priority')}
                    >
                      <IconFlag className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBasicPanel(basicPanel === 'time' ? '' : 'time')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${
                        basicPanel === 'time'
                          ? 'bg-rose-100 text-rose-700'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                      title={t('task.startTime')}
                    >
                      <IconClock className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBasicPanel(basicPanel === 'category' ? '' : 'category')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${
                        basicPanel === 'category'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                      title={t('task.categories')}
                    >
                      <IconTag className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBasicPanel(basicPanel === 'recurrence' ? '' : 'recurrence')}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm ${
                        basicPanel === 'recurrence' || showRecurrence
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                      title={t('task.repeat')}
                    >
                      <IconRepeat className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setValue('all_day', !isAllDay)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      isAllDay
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    {t('task.allDay')}
                  </button>

                  {basicPanel === 'priority' && (
                    <div className="absolute left-0 right-0 top-12 z-20 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
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
                              setValue('priority', priorityOption.value);
                              setBasicPanel('');
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
                    <div className="absolute left-0 right-0 top-12 z-20 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
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
                      {isAllDay ? (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label className="form-label">{t('task.startTime')}</label>
                            <input
                              type="date"
                              value={splitDatePart(startInputValue)}
                              onChange={(e) => setValue('start_time', e.target.value)}
                              className="form-input"
                            />
                          </div>
                          <div>
                            <label className="form-label">{t('task.endTime')}</label>
                            <input
                              type="date"
                              value={splitDatePart(endInputValue)}
                              onChange={(e) => setValue('end_time', e.target.value)}
                              className="form-input"
                            />
                            <p className="mt-1 text-xs text-slate-500">{t('task.endTimeHint')}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="form-label">{t('task.startTime')}</label>
                            <input
                              type="datetime-local"
                              step={timeInputStepSeconds}
                              value={startInputValue || ''}
                              onChange={(e) => {
                                setValue('start_time', e.target.value || '');
                                setTimeTouched(true);
                              }}
                              className="form-input"
                            />
                          </div>
                          <div>
                            <label className="form-label">{t('task.endTime')}</label>
                            <input
                              type="datetime-local"
                              step={timeInputStepSeconds}
                              value={endInputValue || ''}
                              onChange={(e) => {
                                setValue('end_time', e.target.value || '');
                                setTimeTouched(true);
                              }}
                              className="form-input"
                            />
                          </div>
                          <p className="text-xs text-slate-500">{t('task.endTimeHint')}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {basicPanel === 'category' && (
                    <div className="absolute left-0 right-0 top-12 z-20 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                      <div className="mb-2 flex items-center justify-between">
                        <label className="form-label mb-0">{t('task.categories')}</label>
                        <span className="text-xs text-slate-400">{selectedCategoryValues.length}</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {categories.map(cat => {
                          const active = selectedCategoryValues.includes(String(cat.id));
                          return (
                            <label
                              key={cat.id}
                              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition ${
                                active
                                  ? 'border-indigo-300 bg-indigo-50'
                                  : 'border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                {...register('category_ids')}
                                type="checkbox"
                                value={cat.id}
                                className="rounded"
                              />
                              <span
                                className="h-3.5 w-3.5 rounded"
                                style={{ backgroundColor: cat.color }}
                              />
                              {showCategoryEmoji && cat.emoji ? (
                                <span className="text-base leading-none">{cat.emoji}</span>
                              ) : null}
                              <span className="text-sm text-slate-700">{cat.name}</span>
                            </label>
                          );
                        })}
                      </div>
                      {categories.length === 0 && (
                        <p className="text-sm text-slate-500">{t('category.noCategories')}</p>
                      )}
                    </div>
                  )}

                  {basicPanel === 'recurrence' && (
                    <div className="absolute left-0 right-0 top-12 z-20 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                      <div className="mb-2 flex items-center justify-between">
                        <label htmlFor="recurrence-inline" className="text-sm font-medium text-slate-700">
                          {t('task.repeat')}
                        </label>
                        <input
                          type="checkbox"
                          id="recurrence-inline"
                          checked={showRecurrence}
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            setShowRecurrence(enabled);
                            if (!enabled) {
                              setSelectedDays([]);
                              setRecurrenceType('daily');
                            }
                          }}
                        />
                      </div>

                      {showRecurrence && (
                        <div className="space-y-3">
                          <select
                            value={recurrenceType}
                            onChange={(e) => setRecurrenceType(e.target.value)}
                            className="form-select"
                          >
                            <option value="daily">{t('task.daily')}</option>
                            <option value="weekly">{t('task.weekly')}</option>
                            <option value="monthly">{t('task.monthly')}</option>
                            <option value="yearly">{t('task.yearly')}</option>
                          </select>

                          {recurrenceType === 'weekly' && (
                            <div>
                              <p className="mb-2 text-sm text-slate-600">{t('task.selectWeekdays')}</p>
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
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {startInputValue ? `${t('task.startTime')}: ${startInputValue}` : t('task.noDate')}
                </div>
              </section>

            </div>

            <div className="sticky bottom-0 z-20 flex items-center justify-between border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
              <div>
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="btn-danger"
                  >
                    {t('common.delete')}
                  </button>
                )}
              </div>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={onClose}
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
      </div>
    </div>
  );
}

export default TaskModal;
