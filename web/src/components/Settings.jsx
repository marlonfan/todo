import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  ALLOWED_TIME_GRANULARITIES,
  getUserTimezone,
  normalizeTimeGranularity,
  setUserTimezone,
} from '../utils/time';
import { getShowCategoryEmoji, setShowCategoryEmoji } from '../utils/uiPrefs';
import NotificationSettings from './NotificationSettings';
import PWAInstallCard from './PWAInstallCard';
import { authAPI } from '../api/client';
import { forceManualSync, rebuildLocalDataAndSync } from '../data/syncEngine';
import { getMeta, readOutbox } from '../data/localStore';
import { queryKeys } from '../query/keys';

const TIMEZONES = [
  { value: 'Asia/Shanghai', label: 'China Standard Time (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (UTC+9)' },
  { value: 'Asia/Seoul', label: 'Korea Standard Time (UTC+9)' },
  { value: 'Asia/Singapore', label: 'Singapore Time (UTC+8)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong Time (UTC+8)' },
  { value: 'Asia/Taipei', label: 'Taipei Time (UTC+8)' },
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'Europe/London', label: 'Greenwich Mean Time' },
  { value: 'Europe/Paris', label: 'Central European Time' },
  { value: 'Europe/Berlin', label: 'Berlin Time' },
  { value: 'Australia/Sydney', label: 'Sydney Time' },
  { value: 'Pacific/Auckland', label: 'Auckland Time' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
];

const MOBILE_DEFAULT_TABS = ['tasks', 'calendar', 'settings'];
const MOBILE_TAB_PRESETS = [
  'tasks_calendar_settings',
  'tasks_calendar_categories_settings',
  'tasks_inbox_calendar_settings',
];
const CALENDAR_DEFAULT_VIEWS = ['dayGridMonth', 'timeGridWeek', 'timeGridDay'];

function normalizeClockValue(value, fallback) {
  return /^\d{2}:\d{2}$/.test(String(value || '')) ? String(value) : fallback;
}

function buildReminderOptions(granularity, currentValue) {
  const values = new Set([granularity, granularity * 2, granularity * 3, 15, 30, 60, 120, 1440]);
  const current = Number.parseInt(currentValue, 10);
  if (Number.isFinite(current) && current > 0) values.add(current);
  return [...values].filter((value) => value > 0 && value <= 10080).sort((a, b) => a - b);
}

function normalizeMobileDefaultTab(value) {
  return MOBILE_DEFAULT_TABS.includes(value) ? value : 'tasks';
}

function normalizeMobileTabPreset(value) {
  return MOBILE_TAB_PRESETS.includes(value) ? value : 'tasks_calendar_settings';
}

function normalizeCalendarDefaultView(value) {
  return CALENDAR_DEFAULT_VIEWS.includes(value) ? value : 'timeGridDay';
}

function Settings() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  let cachedUser = {};
  try {
    cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    cachedUser = {};
  }
  const [language, setLanguage] = useState(i18n.language || 'zh-CN');
  const [timezone, setTimezone] = useState(getUserTimezone());
  const [defaultReminderEnabled, setDefaultReminderEnabled] = useState(!!cachedUser.default_reminder_enabled);
  const [defaultReminderMinutes, setDefaultReminderMinutes] = useState(
    String(cachedUser.default_reminder_minutes > 0 ? cachedUser.default_reminder_minutes : 5)
  );
  const [defaultTaskStartTime, setDefaultTaskStartTime] = useState(
    typeof cachedUser.default_task_start_time === 'string' && cachedUser.default_task_start_time.length === 5
      ? cachedUser.default_task_start_time
      : '09:00'
  );
  const [defaultTimeGranularity, setDefaultTimeGranularity] = useState(
    normalizeTimeGranularity(cachedUser.default_time_granularity, 15)
  );
  const [defaultMorningTime, setDefaultMorningTime] = useState(
    typeof cachedUser.default_morning_time === 'string' && cachedUser.default_morning_time.length === 5
      ? cachedUser.default_morning_time
      : '09:00'
  );
  const [defaultNoonTime, setDefaultNoonTime] = useState(
    typeof cachedUser.default_noon_time === 'string' && cachedUser.default_noon_time.length === 5
      ? cachedUser.default_noon_time
      : '12:00'
  );
  const [defaultAfternoonTime, setDefaultAfternoonTime] = useState(
    typeof cachedUser.default_afternoon_time === 'string' && cachedUser.default_afternoon_time.length === 5
      ? cachedUser.default_afternoon_time
      : '15:00'
  );
  const [defaultEveningTime, setDefaultEveningTime] = useState(
    typeof cachedUser.default_evening_time === 'string' && cachedUser.default_evening_time.length === 5
      ? cachedUser.default_evening_time
      : '20:00'
  );
  const [showCategoryEmoji, setShowCategoryEmojiState] = useState(getShowCategoryEmoji());
  const [activeTab, setActiveTab] = useState('general');
  const [calendarDefaultView, setCalendarDefaultView] = useState(
    normalizeCalendarDefaultView(cachedUser.calendar_default_view)
  );
  const [mobileDefaultTab, setMobileDefaultTab] = useState(
    normalizeMobileDefaultTab(cachedUser.mobile_default_tab)
  );
  const [mobileTabPreset, setMobileTabPreset] = useState(
    normalizeMobileTabPreset(cachedUser.mobile_tab_preset)
  );
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ pendingCount: 0, lastPullAt: '' });
  const [saveToast, setSaveToast] = useState(null);
  const toastTimerRef = useRef(null);
  const defaultReminderOptions = buildReminderOptions(defaultTimeGranularity, defaultReminderMinutes);

  const showToast = (type, message) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setSaveToast({ type, message });
    toastTimerRef.current = setTimeout(() => {
      setSaveToast(null);
      toastTimerRef.current = null;
    }, 2500);
  };

  const formatSyncTime = (value) => {
    if (!value) return t('settings.syncNever');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  };

  const refreshSyncStatus = async () => {
    const [outbox, lastPullFromDB] = await Promise.all([
      readOutbox(),
      getMeta('last_pull_at', ''),
    ]);

    const lastPullFromCache = queryClient.getQueryData(queryKeys.sync.lastPull) || '';
    setSyncStatus({
      pendingCount: Array.isArray(outbox) ? outbox.length : 0,
      lastPullAt: String(lastPullFromCache || lastPullFromDB || ''),
    });
  };

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'sync') return undefined;
    let active = true;

    const load = async () => {
      try {
        await refreshSyncStatus();
      } catch {
        // ignore sync status load errors in settings
      }
    };

    load();
    const timer = setInterval(() => {
      if (!active) return;
      load();
    }, 3000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [activeTab]);

  useEffect(() => {
    let active = true;
    authAPI.me()
      .then((res) => {
        if (!active) return;
        const user = res.data || {};
        localStorage.setItem('user', JSON.stringify(user));
        if (user.timezone) {
          setTimezone(user.timezone);
          setUserTimezone(user.timezone, true, 'settings');
        }
        setCalendarDefaultView(normalizeCalendarDefaultView(user.calendar_default_view));
        setDefaultReminderEnabled(!!user.default_reminder_enabled);
        setDefaultReminderMinutes(String(user.default_reminder_minutes > 0 ? user.default_reminder_minutes : 5));
        setDefaultTimeGranularity(normalizeTimeGranularity(user.default_time_granularity, 15));
        setDefaultTaskStartTime(
          typeof user.default_task_start_time === 'string' && user.default_task_start_time.length === 5
            ? user.default_task_start_time
            : '09:00'
        );
        setDefaultMorningTime(
          typeof user.default_morning_time === 'string' && user.default_morning_time.length === 5
            ? user.default_morning_time
            : '09:00'
        );
        setDefaultNoonTime(
          typeof user.default_noon_time === 'string' && user.default_noon_time.length === 5
            ? user.default_noon_time
            : '12:00'
        );
        setDefaultAfternoonTime(
          typeof user.default_afternoon_time === 'string' && user.default_afternoon_time.length === 5
            ? user.default_afternoon_time
            : '15:00'
        );
        setDefaultEveningTime(
          typeof user.default_evening_time === 'string' && user.default_evening_time.length === 5
            ? user.default_evening_time
            : '20:00'
        );
        setMobileDefaultTab(normalizeMobileDefaultTab(user.mobile_default_tab));
        setMobileTabPreset(normalizeMobileTabPreset(user.mobile_tab_preset));
      })
      .catch(() => {
        // ignore loading errors in settings page
      });

    return () => {
      active = false;
    };
  }, []);

  const persistProfile = async (payload, rollback) => {
    setSaveToast(null);
    try {
      const res = await authAPI.updateProfile(payload);
      const user = res.data || {};
      localStorage.setItem('user', JSON.stringify(user));
      window.dispatchEvent(new CustomEvent('user:profile-updated', { detail: user }));
      if (user.timezone) {
        setUserTimezone(user.timezone, true, 'settings');
      }
      setCalendarDefaultView(normalizeCalendarDefaultView(user.calendar_default_view));
      setDefaultReminderEnabled(!!user.default_reminder_enabled);
      setDefaultReminderMinutes(String(user.default_reminder_minutes > 0 ? user.default_reminder_minutes : 5));
      setDefaultTimeGranularity(normalizeTimeGranularity(user.default_time_granularity, 15));
      setDefaultTaskStartTime(
        typeof user.default_task_start_time === 'string' && user.default_task_start_time.length === 5
          ? user.default_task_start_time
          : '09:00'
      );
      setDefaultMorningTime(
        typeof user.default_morning_time === 'string' && user.default_morning_time.length === 5
          ? user.default_morning_time
          : '09:00'
      );
      setDefaultNoonTime(
        typeof user.default_noon_time === 'string' && user.default_noon_time.length === 5
          ? user.default_noon_time
          : '12:00'
      );
      setDefaultAfternoonTime(
        typeof user.default_afternoon_time === 'string' && user.default_afternoon_time.length === 5
          ? user.default_afternoon_time
          : '15:00'
      );
      setDefaultEveningTime(
        typeof user.default_evening_time === 'string' && user.default_evening_time.length === 5
          ? user.default_evening_time
          : '20:00'
      );
      setMobileDefaultTab(normalizeMobileDefaultTab(user.mobile_default_tab));
      setMobileTabPreset(normalizeMobileTabPreset(user.mobile_tab_preset));
      showToast('success', t('settings.saveSuccess'));
    } catch (err) {
      if (typeof rollback === 'function') rollback();
      showToast('error', err.response?.data?.error || t('settings.saveFailed'));
    }
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('i18nextLng', lang);
  };

  const handleTimezoneChange = async (tz) => {
    const prevTimezone = timezone;
    setTimezone(tz);
    setUserTimezone(tz, true, 'settings');
    await persistProfile({ timezone: tz }, () => {
      setTimezone(prevTimezone);
      setUserTimezone(prevTimezone, true, 'settings');
    });
  };

  const handleDefaultReminderToggle = async (enabled) => {
    const prev = defaultReminderEnabled;
    setDefaultReminderEnabled(enabled);
    await persistProfile({ default_reminder_enabled: enabled }, () => {
      setDefaultReminderEnabled(prev);
    });
  };

  const handleDefaultReminderMinutesChange = async (nextValue) => {
    const previous = defaultReminderMinutes;
    let minutes = Number.parseInt(nextValue, 10);
    if (!Number.isFinite(minutes) || minutes < 1) {
      minutes = 5;
    }
    setDefaultReminderMinutes(String(minutes));
    await persistProfile({ default_reminder_minutes: minutes }, () => {
      setDefaultReminderMinutes(previous);
    });
  };

  const handleDefaultTaskStartTimeBlur = async () => {
    const prev = defaultTaskStartTime;
    const next = normalizeClockValue(defaultTaskStartTime, '09:00');
    setDefaultTaskStartTime(next);
    await persistProfile({ default_task_start_time: next }, () => {
      setDefaultTaskStartTime(prev);
    });
  };

  const handleTimeGranularityChange = async (nextValue) => {
    const previous = defaultTimeGranularity;
    const normalized = normalizeTimeGranularity(nextValue, 15);
    setDefaultTimeGranularity(normalized);
    await persistProfile({ default_time_granularity: normalized }, () => {
      setDefaultTimeGranularity(previous);
    });
  };

  const handleNaturalTimeBlur = async (key, value, setter, fallback) => {
    const prev = value;
    const next = normalizeClockValue(value, fallback);
    setter(next);
    await persistProfile({ [key]: next }, () => setter(prev));
  };

  const handleShowCategoryEmojiToggle = (enabled) => {
    setShowCategoryEmojiState(enabled);
    setShowCategoryEmoji(enabled);
  };

  const handleMobileDefaultTabChange = async (nextValue) => {
    const previous = mobileDefaultTab;
    const normalized = normalizeMobileDefaultTab(nextValue);
    setMobileDefaultTab(normalized);
    await persistProfile({ mobile_default_tab: normalized }, () => {
      setMobileDefaultTab(previous);
    });
  };

  const handleCalendarDefaultViewChange = async (nextValue) => {
    const previous = calendarDefaultView;
    const normalized = normalizeCalendarDefaultView(nextValue);
    setCalendarDefaultView(normalized);
    await persistProfile({ calendar_default_view: normalized }, () => {
      setCalendarDefaultView(previous);
    });
  };

  const handleMobileTabPresetChange = async (nextValue) => {
    const previous = mobileTabPreset;
    const normalized = normalizeMobileTabPreset(nextValue);
    setMobileTabPreset(normalized);
    await persistProfile({ mobile_tab_preset: normalized }, () => {
      setMobileTabPreset(previous);
    });
  };

  const handleManualSync = async () => {
    setSyncBusy(true);
    try {
      await forceManualSync();
      await refreshSyncStatus();
      showToast('success', t('settings.syncNowSuccess'));
    } catch (err) {
      showToast('error', err?.message || t('settings.syncNowFailed'));
    } finally {
      setSyncBusy(false);
    }
  };

  const handleRebuildSync = async () => {
    if (!window.confirm(t('settings.syncRebuildConfirm'))) return;

    setSyncBusy(true);
    try {
      await rebuildLocalDataAndSync();
      await refreshSyncStatus();
      showToast('success', t('settings.syncRebuildSuccess'));
    } catch (err) {
      showToast('error', err?.message || t('settings.syncRebuildFailed'));
    } finally {
      setSyncBusy(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {saveToast && (
        <div className="fixed right-4 top-4 z-[70]">
          <div
            className={`rounded-lg border px-4 py-2 text-sm shadow-lg ${
              saveToast.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {saveToast.message}
          </div>
        </div>
      )}
      <div className="hidden border-b border-gray-200 bg-white p-4 md:block">
        <h2 className="text-xl font-semibold">{t('settings.title')}</h2>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'general'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {t('settings.title')}
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'notifications'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {t('settings.notifications')}
            </button>
            <button
              onClick={() => setActiveTab('sync')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'sync'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {t('settings.syncSettings')}
            </button>
          </div>

          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="bg-white border border-gray-200 p-6">
              <h3 className="text-lg font-medium mb-4">{t('settings.title')}</h3>

              <div className="space-y-6">
                <PWAInstallCard />

                {/* Language */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.language')}
                  </label>
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="zh-CN">简体中文</option>
                    <option value="en-US">English</option>
                  </select>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.timezone')}
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => handleTimezoneChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('settings.timezoneHint')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.calendarDefaultView')}
                  </label>
                  <select
                    value={calendarDefaultView}
                    onChange={(e) => handleCalendarDefaultViewChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="dayGridMonth">{t('settings.calendarViewMonth')}</option>
                    <option value="timeGridWeek">{t('settings.calendarViewWeek')}</option>
                    <option value="timeGridDay">{t('settings.calendarViewDay')}</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={defaultReminderEnabled}
                      onChange={(e) => handleDefaultReminderToggle(e.target.checked)}
                    />
                    {t('settings.defaultReminderEnabled')}
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.defaultReminderMinutes')}
                  </label>
                  <select
                    value={defaultReminderMinutes}
                    onChange={(e) => handleDefaultReminderMinutesChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {defaultReminderOptions.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} {t('task.minutes')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.defaultTaskStartTime')}
                  </label>
                  <input
                    type="time"
                    value={defaultTaskStartTime}
                    onChange={(e) => setDefaultTaskStartTime(e.target.value)}
                    onBlur={handleDefaultTaskStartTimeBlur}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.defaultTimeGranularity')}
                  </label>
                  <select
                    value={defaultTimeGranularity}
                    onChange={(e) => handleTimeGranularityChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ALLOWED_TIME_GRANULARITIES.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} {t('task.minutes')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-md border border-gray-200 p-3">
                  <p className="mb-3 text-sm font-medium text-gray-700">{t('settings.naturalTimeDefaults')}</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('settings.defaultMorningTime')}</label>
                      <input
                        type="time"
                        value={defaultMorningTime}
                        onChange={(e) => setDefaultMorningTime(e.target.value)}
                        onBlur={() => handleNaturalTimeBlur('default_morning_time', defaultMorningTime, setDefaultMorningTime, '09:00')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('settings.defaultNoonTime')}</label>
                      <input
                        type="time"
                        value={defaultNoonTime}
                        onChange={(e) => setDefaultNoonTime(e.target.value)}
                        onBlur={() => handleNaturalTimeBlur('default_noon_time', defaultNoonTime, setDefaultNoonTime, '12:00')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('settings.defaultAfternoonTime')}</label>
                      <input
                        type="time"
                        value={defaultAfternoonTime}
                        onChange={(e) => setDefaultAfternoonTime(e.target.value)}
                        onBlur={() => handleNaturalTimeBlur('default_afternoon_time', defaultAfternoonTime, setDefaultAfternoonTime, '15:00')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('settings.defaultEveningTime')}</label>
                      <input
                        type="time"
                        value={defaultEveningTime}
                        onChange={(e) => setDefaultEveningTime(e.target.value)}
                        onBlur={() => handleNaturalTimeBlur('default_evening_time', defaultEveningTime, setDefaultEveningTime, '20:00')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={showCategoryEmoji}
                      onChange={(e) => handleShowCategoryEmojiToggle(e.target.checked)}
                    />
                    {t('settings.showCategoryEmoji')}
                  </label>
                </div>

                <div className="rounded-md border border-gray-200 p-3">
                  <p className="mb-3 text-sm font-medium text-gray-700">{t('settings.mobileNavigation')}</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('settings.mobileDefaultTab')}</label>
                      <select
                        value={mobileDefaultTab}
                        onChange={(e) => handleMobileDefaultTabChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="tasks">{t('settings.mobileTabTasks')}</option>
                        <option value="calendar">{t('settings.mobileTabCalendar')}</option>
                        <option value="settings">{t('settings.mobileTabSettings')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('settings.mobileTabPreset')}</label>
                      <select
                        value={mobileTabPreset}
                        onChange={(e) => handleMobileTabPresetChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="tasks_calendar_settings">{t('settings.mobilePresetBasic')}</option>
                        <option value="tasks_calendar_categories_settings">{t('settings.mobilePresetWithCategories')}</option>
                        <option value="tasks_inbox_calendar_settings">{t('settings.mobilePresetInbox')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && <NotificationSettings />}

          {/* Sync Settings */}
          {activeTab === 'sync' && (
            <div className="bg-white border border-gray-200 p-6 space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{t('settings.syncSettings')}</h3>
                <p className="mt-1 text-sm text-gray-500">{t('settings.syncSettingsHint')}</p>
              </div>

              <div className="rounded-md border border-gray-200 p-4">
                <p className="text-sm text-gray-700">
                  {t('settings.syncPendingCount')}: <span className="font-medium">{syncStatus.pendingCount}</span>
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  {t('settings.syncLastPull')}: <span className="font-medium">{formatSyncTime(syncStatus.lastPullAt)}</span>
                </p>
              </div>

              <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
                <h4 className="text-sm font-semibold text-blue-900">{t('settings.syncNowTitle')}</h4>
                <p className="mt-1 text-sm text-blue-800">{t('settings.syncNowHint')}</p>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={syncBusy}
                  className="mt-3 inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 hover:bg-blue-700"
                >
                  {syncBusy ? t('settings.syncRunning') : t('settings.syncNow')}
                </button>
              </div>

              <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
                <h4 className="text-sm font-semibold text-rose-900">{t('settings.syncRebuildTitle')}</h4>
                <p className="mt-1 text-sm text-rose-800">{t('settings.syncRebuildHint')}</p>
                <button
                  type="button"
                  onClick={handleRebuildSync}
                  disabled={syncBusy}
                  className="mt-3 inline-flex items-center rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 hover:bg-rose-700"
                >
                  {syncBusy ? t('settings.syncRunning') : t('settings.syncRebuild')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
