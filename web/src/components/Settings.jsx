import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  ALLOWED_TIME_GRANULARITIES,
  getUserTimezone,
  logTimeDebug,
  normalizeTimeGranularity,
  setUserTimezone,
} from '../utils/time';
import { getShowCategoryEmoji, setShowCategoryEmoji } from '../utils/uiPrefs';
import NotificationSettings from './NotificationSettings';
import PWAInstallCard from './PWAInstallCard';
import { authAPI } from '../api/client';
import { caldavAPI } from '../api/client';
import {
  forceManualSync,
  getConfiguredSyncIntervalSeconds,
  rebuildLocalDataAndSync,
  setConfiguredSyncIntervalSeconds,
} from '../data/syncEngine';
import { clearCalendarRanges, clearTasksAndSet, getMeta, readOutbox, readTasks } from '../data/localStore';
import { queryKeys } from '../query/keys';
import { useCaldavSourcesQuery, useCategoriesQuery } from '../query/hooks';

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
const MOBILE_DEFAULT_TASK_VIEWS = ['all', 'inbox', 'today', 'upcoming'];
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

function normalizeMobileDefaultTaskView(value) {
  const normalized = String(value || '').trim();
  if (MOBILE_DEFAULT_TASK_VIEWS.includes(normalized)) return normalized;
  if (/^category:\d+$/.test(normalized)) return normalized;
  return 'all';
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
  const [mobileDefaultTaskView, setMobileDefaultTaskView] = useState(
    normalizeMobileDefaultTaskView(cachedUser.mobile_default_task_view)
  );
  const [mobileTabPreset, setMobileTabPreset] = useState(
    normalizeMobileTabPreset(cachedUser.mobile_tab_preset)
  );
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ pendingCount: 0, lastPullAt: '' });
  const [syncIntervalSeconds, setSyncIntervalSeconds] = useState(getConfiguredSyncIntervalSeconds());
  const [caldavForm, setCaldavForm] = useState({ name: '', baseURL: '', username: '', password: '' });
  const [caldavCalendars, setCaldavCalendars] = useState([]);
  const [caldavEditingSourceID, setCaldavEditingSourceID] = useState(null);
  const [caldavBusy, setCaldavBusy] = useState(false);
  const { data: caldavSources = [] } = useCaldavSourcesQuery();
  const { data: categories = [] } = useCategoriesQuery();
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
        setMobileDefaultTaskView(normalizeMobileDefaultTaskView(user.mobile_default_task_view));
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
      setMobileDefaultTaskView(normalizeMobileDefaultTaskView(user.mobile_default_task_view));
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
    logTimeDebug('settings.timezone.change.start', {
      previous_timezone: prevTimezone,
      next_timezone: tz,
    });
    setTimezone(tz);
    setUserTimezone(tz, true, 'settings');
    await persistProfile({ timezone: tz }, () => {
      setTimezone(prevTimezone);
      setUserTimezone(prevTimezone, true, 'settings');
      logTimeDebug('settings.timezone.change.rollback', {
        previous_timezone: prevTimezone,
        attempted_timezone: tz,
      });
    });
    logTimeDebug('settings.timezone.change.done', {
      next_timezone: tz,
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

  const handleMobileDefaultTaskViewChange = async (nextValue) => {
    const previous = mobileDefaultTaskView;
    const normalized = normalizeMobileDefaultTaskView(nextValue);
    setMobileDefaultTaskView(normalized);
    await persistProfile({ mobile_default_task_view: normalized }, () => {
      setMobileDefaultTaskView(previous);
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

  const handleSyncIntervalChange = (nextValue) => {
    const applied = setConfiguredSyncIntervalSeconds(nextValue);
    setSyncIntervalSeconds(applied);
    if (applied <= 0) {
      showToast('success', 'Auto sync disabled');
      return;
    }
    showToast('success', `Auto sync interval set to ${applied}s`);
  };

  const resetCaldavDraft = () => {
    setCaldavForm({ name: '', baseURL: '', username: '', password: '' });
    setCaldavCalendars([]);
    setCaldavEditingSourceID(null);
  };

  const getSelectedCalendarURLsFromSource = (source) => {
    const calendars = Array.isArray(source?.calendars) ? source.calendars : [];
    return new Set(
      calendars
        .filter((item) => item?.is_selected !== false)
        .map((item) => String(item?.calendar_url || '').trim())
        .filter(Boolean)
    );
  };

  const handleCaldavEdit = (source) => {
    if (!source) return;
    const calendars = Array.isArray(source.calendars) ? source.calendars : [];
    setCaldavEditingSourceID(source.id);
    setCaldavForm({
      name: source.name || '',
      baseURL: source.base_url || '',
      username: source.username || '',
      password: '',
    });
    setCaldavCalendars(calendars.map((item) => ({
      calendar_url: item.calendar_url,
      display_name: item.display_name || '',
      color: item.color || '',
      selected: item.is_selected !== false,
    })));
    showToast('success', t('settings.caldav.toastLoadedForEdit'));
  };

  const handleCaldavDiscover = async () => {
    setCaldavBusy(true);
    try {
      const selectedURLs = new Set(
        caldavCalendars
          .filter((item) => item.selected)
          .map((item) => String(item.calendar_url || '').trim())
          .filter(Boolean)
      );
      if (selectedURLs.size === 0 && caldavEditingSourceID) {
        const editingSource = caldavSources.find((item) => item.id === caldavEditingSourceID);
        for (const url of getSelectedCalendarURLsFromSource(editingSource)) {
          selectedURLs.add(url);
        }
      }
      const payload = {
        base_url: caldavForm.baseURL,
        username: caldavForm.username,
        password: caldavForm.password,
      };
      if (caldavEditingSourceID) {
        payload.source_id = caldavEditingSourceID;
      }
      const res = await caldavAPI.discover(payload);
      const list = Array.isArray(res.data) ? res.data : [];
      setCaldavCalendars(list.map((item) => {
        const url = String(item?.calendar_url || '').trim();
        return {
          ...item,
          selected: selectedURLs.size > 0 ? selectedURLs.has(url) : true,
        };
      }));
      showToast('success', t('settings.caldav.toastDiscovered'));
    } catch (err) {
      showToast('error', err.response?.data?.error || t('settings.caldav.toastDiscoverFailed'));
    } finally {
      setCaldavBusy(false);
    }
  };

  const handleCaldavSave = async () => {
    const selected = caldavCalendars.filter((item) => item.selected);
    if (!selected.length) {
      showToast('error', t('settings.caldav.toastSelectAtLeastOne'));
      return;
    }
    setCaldavBusy(true);
    try {
      const payload = {
        name: caldavForm.name || caldavForm.baseURL,
        base_url: caldavForm.baseURL,
        username: caldavForm.username,
        password: caldavForm.password,
        calendars: selected.map((item) => ({
          calendar_url: item.calendar_url,
          display_name: item.display_name || '',
          color: item.color || '',
        })),
        is_active: true,
      };
      if (caldavEditingSourceID) {
        await caldavAPI.updateSource(caldavEditingSourceID, payload);
      } else {
        await caldavAPI.createSource(payload);
      }
      resetCaldavDraft();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.caldav.sources }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
        queryClient.invalidateQueries({ queryKey: ['calendar'] }),
      ]);
      showToast('success', caldavEditingSourceID ? t('settings.caldav.toastUpdated') : t('settings.caldav.toastAdded'));
    } catch (err) {
      showToast(
        'error',
        err.response?.data?.error
          || (caldavEditingSourceID ? t('settings.caldav.toastUpdateFailed') : t('settings.caldav.toastCreateFailed'))
      );
    } finally {
      setCaldavBusy(false);
    }
  };

  const handleCaldavDelete = async (sourceID) => {
    if (!window.confirm(t('settings.caldav.deleteConfirm'))) return;
    setCaldavBusy(true);
    try {
      await caldavAPI.deleteSource(sourceID);
      if (sourceID === caldavEditingSourceID) {
        resetCaldavDraft();
      }
      try {
        localStorage.removeItem('caldav_tasks_cache_v1');
      } catch {
        // ignore
      }
      queryClient.setQueriesData({ queryKey: ['caldav', 'tasks'] }, []);
      queryClient.setQueryData(queryKeys.tasks.all, (prev) => {
        const list = Array.isArray(prev) ? prev : [];
        return list.filter((task) => !(task?.read_only || String(task?.source || '') === 'caldav'));
      });
      try {
        const cachedTasks = await readTasks();
        const filtered = (Array.isArray(cachedTasks) ? cachedTasks : [])
          .filter((task) => !(task?.read_only || String(task?.source || '') === 'caldav'));
        await clearTasksAndSet(filtered);
      } catch (cacheErr) {
        console.error('Failed to clear local caldav tasks cache:', cacheErr);
      }
      try {
        await clearCalendarRanges();
      } catch (cacheErr) {
        console.error('Failed to clear local calendar ranges cache:', cacheErr);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.caldav.sources }),
        queryClient.removeQueries({ queryKey: ['caldav', 'tasks'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
        queryClient.invalidateQueries({ queryKey: ['calendar'] }),
      ]);
      showToast('success', t('settings.caldav.toastDeleted'));
    } catch (err) {
      showToast('error', err.response?.data?.error || t('settings.caldav.toastDeleteFailed'));
    } finally {
      setCaldavBusy(false);
    }
  };

  const handleCaldavSync = async (sourceID) => {
    setCaldavBusy(true);
    try {
      await caldavAPI.syncSource(sourceID);
      await queryClient.invalidateQueries({ queryKey: queryKeys.caldav.sources });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.caldav.sources });
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
        queryClient.invalidateQueries({ queryKey: ['calendar'] });
      }, 3000);
      showToast('success', t('settings.caldav.toastSyncStarted'));
    } catch (err) {
      showToast('error', err.response?.data?.error || t('settings.caldav.toastSyncFailed'));
    } finally {
      setCaldavBusy(false);
    }
  };

  return (
    <div className="settings-page md-page flex h-full flex-col">
      {saveToast && (
        <div className="fixed right-4 top-4 z-[70]">
          <div
            className={`md-toast ${
              saveToast.type === 'error'
                ? 'md-toast-error'
                : 'md-toast-success'
            }`}
          >
            {saveToast.message}
          </div>
        </div>
      )}
      <div className="hidden border-b border-blue-100 bg-white/90 p-4 md:block">
        <h2 className="text-xl font-semibold">{t('settings.title')}</h2>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-5">
        <div className="w-full">
          {/* Tab Navigation */}
          <div className="settings-tabs">
            <button
              onClick={() => setActiveTab('general')}
              className={`settings-tab-btn ${
                activeTab === 'general'
                  ? 'settings-tab-btn-active'
                  : 'settings-tab-btn-idle'
              }`}
            >
              {t('settings.title')}
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`settings-tab-btn ${
                activeTab === 'notifications'
                  ? 'settings-tab-btn-active'
                  : 'settings-tab-btn-idle'
              }`}
            >
              {t('settings.notifications')}
            </button>
            <button
              onClick={() => setActiveTab('sync')}
              className={`settings-tab-btn ${
                activeTab === 'sync'
                  ? 'settings-tab-btn-active'
                  : 'settings-tab-btn-idle'
              }`}
            >
              {t('settings.syncSettings')}
            </button>
            <button
              onClick={() => setActiveTab('caldav')}
              className={`settings-tab-btn ${
                activeTab === 'caldav'
                  ? 'settings-tab-btn-active'
                  : 'settings-tab-btn-idle'
              }`}
            >
              {t('settings.caldav.tab')}
            </button>
          </div>

          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="p-6">
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
                    className="form-select"
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
                    className="form-select"
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
                    className="form-select"
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
                    className="form-input"
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
                    className="form-select"
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

                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                  <p className="mb-3 text-sm font-medium text-gray-700">{t('settings.naturalTimeDefaults')}</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('settings.defaultMorningTime')}</label>
                      <input
                        type="time"
                        value={defaultMorningTime}
                        onChange={(e) => setDefaultMorningTime(e.target.value)}
                        onBlur={() => handleNaturalTimeBlur('default_morning_time', defaultMorningTime, setDefaultMorningTime, '09:00')}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('settings.defaultNoonTime')}</label>
                      <input
                        type="time"
                        value={defaultNoonTime}
                        onChange={(e) => setDefaultNoonTime(e.target.value)}
                        onBlur={() => handleNaturalTimeBlur('default_noon_time', defaultNoonTime, setDefaultNoonTime, '12:00')}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('settings.defaultAfternoonTime')}</label>
                      <input
                        type="time"
                        value={defaultAfternoonTime}
                        onChange={(e) => setDefaultAfternoonTime(e.target.value)}
                        onBlur={() => handleNaturalTimeBlur('default_afternoon_time', defaultAfternoonTime, setDefaultAfternoonTime, '15:00')}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('settings.defaultEveningTime')}</label>
                      <input
                        type="time"
                        value={defaultEveningTime}
                        onChange={(e) => setDefaultEveningTime(e.target.value)}
                        onBlur={() => handleNaturalTimeBlur('default_evening_time', defaultEveningTime, setDefaultEveningTime, '20:00')}
                        className="form-input"
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

                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                  <p className="mb-3 text-sm font-medium text-gray-700">{t('settings.mobileNavigation')}</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('settings.mobileDefaultTab')}</label>
                      <select
                        value={mobileDefaultTab}
                        onChange={(e) => handleMobileDefaultTabChange(e.target.value)}
                        className="form-select"
                      >
                        <option value="tasks">{t('settings.mobileTabTasks')}</option>
                        <option value="calendar">{t('settings.mobileTabCalendar')}</option>
                        <option value="settings">{t('settings.mobileTabSettings')}</option>
                      </select>
                    </div>
                    {mobileDefaultTab === 'tasks' && (
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">{t('settings.mobileDefaultTaskView')}</label>
                        <select
                          value={mobileDefaultTaskView}
                          onChange={(e) => handleMobileDefaultTaskViewChange(e.target.value)}
                          className="form-select"
                        >
                          <option value="all">{t('settings.mobileDefaultTaskViewAll')}</option>
                          <option value="inbox">{t('settings.mobileDefaultTaskViewInbox')}</option>
                          <option value="today">{t('settings.mobileDefaultTaskViewToday')}</option>
                          <option value="upcoming">{t('settings.mobileDefaultTaskViewUpcoming')}</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={`category:${cat.id}`}>
                              {showCategoryEmoji && cat.emoji ? `${cat.emoji} ${cat.name}` : cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('settings.mobileTabPreset')}</label>
                      <select
                        value={mobileTabPreset}
                        onChange={(e) => handleMobileTabPresetChange(e.target.value)}
                        className="form-select"
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
            <div className="space-y-6 p-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{t('settings.syncSettings')}</h3>
                <p className="mt-1 text-sm text-gray-500">{t('settings.syncSettingsHint')}</p>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                <p className="text-sm text-gray-700">
                  {t('settings.syncPendingCount')}: <span className="font-medium">{syncStatus.pendingCount}</span>
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  {t('settings.syncLastPull')}: <span className="font-medium">{formatSyncTime(syncStatus.lastPullAt)}</span>
                </p>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                <p className="text-sm font-medium text-gray-700">Auto sync interval</p>
                <p className="mt-1 text-sm text-gray-500">Longer interval avoids overlapping slow calendar/task pulls.</p>
                <select
                  value={String(syncIntervalSeconds)}
                  onChange={(e) => handleSyncIntervalChange(e.target.value)}
                  className="form-select mt-3 max-w-xs"
                >
                  <option value="0">Disabled (manual only)</option>
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                  <option value="120">2 minutes (recommended)</option>
                  <option value="300">5 minutes</option>
                  <option value="600">10 minutes</option>
                </select>
              </div>

              <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
                <h4 className="text-sm font-semibold text-blue-900">{t('settings.syncNowTitle')}</h4>
                <p className="mt-1 text-sm text-blue-800">{t('settings.syncNowHint')}</p>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={syncBusy}
                  className="btn-primary mt-3 inline-flex items-center disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="btn-danger mt-3 inline-flex items-center disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {syncBusy ? t('settings.syncRunning') : t('settings.syncRebuild')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'caldav' && (
            <div className="space-y-4 p-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{t('settings.caldav.title')}</h3>
                <p className="mt-1 text-sm text-gray-500">{t('settings.caldav.hint')}</p>
                {caldavEditingSourceID ? (
                  <p className="mt-2 text-xs font-medium text-blue-700">
                    {t('settings.caldav.editingHint', { id: caldavEditingSourceID })}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={caldavForm.name}
                  onChange={(e) => setCaldavForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={t('settings.caldav.displayNamePlaceholder')}
                  className="form-input"
                />
                <input
                  value={caldavForm.baseURL}
                  onChange={(e) => setCaldavForm((prev) => ({ ...prev, baseURL: e.target.value }))}
                  placeholder={t('settings.caldav.serverUrlPlaceholder')}
                  className="form-input"
                />
                <input
                  value={caldavForm.username}
                  onChange={(e) => setCaldavForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder={t('settings.caldav.usernamePlaceholder')}
                  className="form-input"
                />
                <input
                  type="password"
                  value={caldavForm.password}
                  onChange={(e) => setCaldavForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder={caldavEditingSourceID ? t('settings.caldav.passwordPlaceholderEdit') : t('settings.caldav.passwordPlaceholderCreate')}
                  className="form-input"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={caldavBusy}
                  onClick={handleCaldavDiscover}
                  className="btn-secondary inline-flex items-center disabled:opacity-60"
                >
                  {t('settings.caldav.discover')}
                </button>
                <button
                  type="button"
                  disabled={caldavBusy || caldavCalendars.length === 0}
                  onClick={handleCaldavSave}
                  className="btn-primary inline-flex items-center disabled:opacity-60"
                >
                  {caldavEditingSourceID ? t('settings.caldav.updateSource') : t('settings.caldav.saveSource')}
                </button>
                {caldavEditingSourceID ? (
                  <button
                    type="button"
                    disabled={caldavBusy}
                    onClick={resetCaldavDraft}
                    className="btn-secondary inline-flex items-center disabled:opacity-60"
                  >
                    {t('settings.caldav.cancelEditing')}
                  </button>
                ) : null}
              </div>

              {caldavCalendars.length > 0 && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                  <p className="mb-2 text-sm font-medium text-gray-700">{t('settings.caldav.selectCalendars')}</p>
                  <div className="space-y-2">
                    {caldavCalendars.map((item, idx) => (
                      <label key={`${item.calendar_url}-${idx}`} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={!!item.selected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setCaldavCalendars((prev) => prev.map((entry, entryIdx) => (
                              entryIdx === idx ? { ...entry, selected: checked } : entry
                            )));
                          }}
                        />
                        <span>{item.display_name || item.calendar_url}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                <p className="mb-2 text-sm font-medium text-gray-700">{t('settings.caldav.configuredSources')}</p>
                {caldavSources.length === 0 ? (
                  <p className="text-sm text-gray-500">{t('settings.caldav.noSource')}</p>
                ) : (
                  <div className="space-y-2">
                    {caldavSources.map((source) => (
                      <div key={source.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{source.name}</div>
                          <div className="text-xs text-gray-500">{source.base_url}</div>
                          <div className="text-xs text-gray-500">
                            {t('settings.caldav.calendarConfiguredCount', {
                              count: Array.isArray(source.calendars) ? source.calendars.length : 0,
                            })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {source.last_sync_at
                              ? t('settings.caldav.lastSync', { time: new Date(source.last_sync_at).toLocaleString() })
                              : t('settings.caldav.neverSynced')}
                          </div>
                          {source.last_error ? (
                            <div className="mt-1 text-xs text-rose-600 break-all">{t('settings.caldav.errorLabel', { error: source.last_error })}</div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={caldavBusy}
                            onClick={() => handleCaldavSync(source.id)}
                            className="btn-primary px-2 py-1 text-xs disabled:opacity-60"
                          >
                            {t('settings.caldav.syncNow')}
                          </button>
                          <button
                            type="button"
                            disabled={caldavBusy}
                            onClick={() => handleCaldavEdit(source)}
                            className="btn-secondary px-2 py-1 text-xs disabled:opacity-60"
                          >
                            {t('settings.caldav.manageCalendars')}
                          </button>
                          <button
                            type="button"
                            disabled={caldavBusy}
                            onClick={() => handleCaldavDelete(source.id)}
                            className="btn-danger px-2 py-1 text-xs disabled:opacity-60"
                          >
                            {t('settings.caldav.deleteSource')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
