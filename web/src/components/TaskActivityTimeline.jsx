import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useCategoriesQuery, useTaskActivitiesQuery } from '../query/hooks';
import { getUserTimezone } from '../utils/time';

const FIELD_ORDER = [
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

const FIELD_LABEL_KEY = {
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

function sortChangeEntries(changes = {}) {
  return Object.entries(changes).sort((left, right) => {
    const leftIndex = FIELD_ORDER.indexOf(left[0]);
    const rightIndex = FIELD_ORDER.indexOf(right[0]);
    const a = leftIndex >= 0 ? leftIndex : 999;
    const b = rightIndex >= 0 ? rightIndex : 999;
    if (a !== b) return a - b;
    return left[0].localeCompare(right[0]);
  });
}

function stringifyFallback(value) {
  if (value === null || typeof value === 'undefined') return '-';
  if (typeof value === 'string') return value || '-';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatPriority(value, t) {
  const numeric = Number.parseInt(value, 10);
  if (numeric === 1) return t('task.priorityHigh');
  if (numeric === -1) return t('task.priorityLow');
  if (numeric === 0) return t('task.priorityMedium');
  return stringifyFallback(value);
}

function formatStatus(value, t) {
  const status = String(value || '').trim();
  if (status === 'pending') return t('task.statusPending');
  if (status === 'completed') return t('task.statusCompleted');
  if (status === 'cancelled') return t('task.statusCancelled');
  if (status === 'skipped') return t('task.statusSkipped');
  return stringifyFallback(value);
}

function formatDateTime(value, timezone) {
  const parsed = dayjs(value);
  if (!parsed.isValid()) return stringifyFallback(value);
  return parsed.tz(timezone).format('MM/DD HH:mm');
}

function formatAllDay(value, language) {
  const bool = !!value;
  if (language === 'zh-CN') {
    return bool ? '是' : '否';
  }
  return bool ? 'Yes' : 'No';
}

function formatCategoryIDs(value, categoriesByID) {
  const ids = Array.isArray(value) ? value : [];
  if (ids.length === 0) return '-';
  const labels = ids.map((id) => {
    const key = Number(id);
    const hit = categoriesByID.get(key);
    if (hit?.name) return hit.name;
    return String(id);
  });
  return labels.join(', ');
}

function formatRecurrenceRule(value, t) {
  if (!value || typeof value !== 'object') return t('task.repeatOff');
  const freq = String(value.freq || '').toLowerCase();
  const interval = Math.max(1, Number.parseInt(value.interval, 10) || 1);
  if (freq === 'lunar_yearly' || freq === 'lunar') {
    const month = Number.parseInt(value.lunar_month, 10) || 1;
    const day = Number.parseInt(value.lunar_day, 10) || 1;
    const leap = !!value.lunar_is_leap_month;
    return `${t('task.lunarYearly')} ${leap ? t('task.lunarLeapPrefix') : ''}${month}/${day}`;
  }
  if (freq === 'weekly' && interval === 2) return t('task.biweekly');
  if (freq === 'daily') return t('task.daily');
  if (freq === 'weekly') return t('task.weekly');
  if (freq === 'monthly') {
    const byDate = Array.isArray(value.bydate) ? Number(value.bydate[0]) : NaN;
    if (Number.isFinite(byDate) && byDate >= 1 && byDate <= 31) {
      return `${t('task.monthly')} ${byDate}`;
    }
    return t('task.monthly');
  }
  if (freq === 'yearly') return t('task.yearly');
  return stringifyFallback(value);
}

function formatFieldValue(field, value, context) {
  const { t, timezone, categoriesByID, language } = context;
  if (field === 'priority') return formatPriority(value, t);
  if (field === 'status') return formatStatus(value, t);
  if (field === 'start_time' || field === 'end_time' || field === 'due_date' || field === 'recurrence_end_date') {
    if (value === null || typeof value === 'undefined' || value === '') return '-';
    return formatDateTime(value, timezone);
  }
  if (field === 'all_day') return formatAllDay(value, language);
  if (field === 'category_ids') return formatCategoryIDs(value, categoriesByID);
  if (field === 'recurrence_rule') return formatRecurrenceRule(value, t);
  return stringifyFallback(value);
}

function TaskActivityTimeline({ taskID, className = '' }) {
  const { t, i18n } = useTranslation();
  const timezone = getUserTimezone();
  const { data: categories = [] } = useCategoriesQuery();
  const { data: activities = [], isLoading } = useTaskActivitiesQuery(taskID, { enabled: !!taskID, limit: 200 });

  const categoriesByID = useMemo(() => {
    const map = new Map();
    (Array.isArray(categories) ? categories : []).forEach((item) => {
      if (!item?.id) return;
      map.set(Number(item.id), item);
    });
    return map;
  }, [categories]);

  const formatterContext = useMemo(() => ({
    t,
    timezone,
    categoriesByID,
    language: i18n.language,
  }), [t, timezone, categoriesByID, i18n.language]);

  if (!taskID) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500 ${className}`}>
        {t('task.activityEmpty')}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-3 ${className}`}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('task.activityTitle')}</div>
      {isLoading && activities.length === 0 ? (
        <div className="py-2 text-xs text-slate-500">{t('common.loading')}</div>
      ) : activities.length === 0 ? (
        <div className="py-2 text-xs text-slate-500">{t('task.activityEmpty')}</div>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {activities.map((activity) => (
            <div key={activity.id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2">
              <div className="mb-1 text-[11px] text-slate-500">
                {dayjs(activity.occurred_at).tz(timezone).format('MM/DD HH:mm:ss')}
              </div>
              <div className="space-y-1">
                {sortChangeEntries(activity.changes).map(([field, change]) => (
                  <div key={field} className="grid grid-cols-[5rem_1fr] items-start gap-1 text-[11px]">
                    <span className="text-slate-500">{t(FIELD_LABEL_KEY[field] || field)}</span>
                    <span className="text-slate-700">
                      <span className="text-slate-500">{formatFieldValue(field, change?.from, formatterContext)}</span>
                      <span className="mx-1 text-slate-400">-&gt;</span>
                      <span>{formatFieldValue(field, change?.to, formatterContext)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TaskActivityTimeline;
