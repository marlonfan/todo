import { tasksAPI } from '../api/client';
import { readTasks, getMeta, setMeta } from '../data/localStore';

const LOCAL_NOTIFICATION_ENABLED_KEY = 'local_notification_enabled';
const LOCAL_NOTIFICATION_STATE_KEY = 'local_notification_schedule_v1';
const LOCAL_NOTIFICATION_META_KEY = 'local_notification_schedule_v1';
const LOCAL_NOTIFICATION_INTERVAL_KEY = 'local_notification_refresh_seconds';
const DEFAULT_REFRESH_SECONDS = 120;
const MIN_REFRESH_SECONDS = 30;
const MAX_REFRESH_SECONDS = 1800;
const DEFAULT_LOOKAHEAD_DAYS = 30;
const MAX_SCHEDULED_NOTIFICATIONS = 64;
const REMINDER_GROUP = 'todo-local-reminders';
const NOTIFICATION_CHANNEL_ID = 'todo-reminders';
const ID_NAMESPACE = 0x5a170000;
const ID_MASK = 0x000fffff;

let refreshTimer = null;
let started = false;
let reconcileRunning = false;
let reconcileRequested = false;
let lastPermissionState = 'unknown';
const statusListeners = new Set();

function isBrowser() {
  return typeof window !== 'undefined';
}

export function isElectronRuntime() {
  return isBrowser() && Boolean(window.todoElectron?.notifications);
}

function isDesktopNotificationRuntime() {
  return isElectronRuntime();
}

function readBooleanSetting(key, fallback) {
  if (!isBrowser()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === '1' || raw === 'true';
  } catch {
    return fallback;
  }
}

function writeBooleanSetting(key, value) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // ignore storage write error
  }
}

export function isLocalNotificationEnabled() {
  return readBooleanSetting(LOCAL_NOTIFICATION_ENABLED_KEY, true);
}

export function setLocalNotificationEnabled(enabled) {
  writeBooleanSetting(LOCAL_NOTIFICATION_ENABLED_KEY, !!enabled);
  if (enabled) {
    scheduleLocalNotificationRefresh({ reason: 'setting-enabled', immediate: true });
  } else {
    void cancelScheduledLocalNotifications()
      .catch((error) => {
        console.error('Failed to cancel local notifications after disabling:', error);
      })
      .finally(() => emitStatus());
  }
  resetLocalNotificationRefreshTimer();
}

function clampRefreshSeconds(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_REFRESH_SECONDS;
  if (parsed === 0) return 0;
  return Math.min(MAX_REFRESH_SECONDS, Math.max(MIN_REFRESH_SECONDS, parsed));
}

function readRefreshSeconds() {
  if (!isBrowser()) return DEFAULT_REFRESH_SECONDS;
  try {
    const raw = localStorage.getItem(LOCAL_NOTIFICATION_INTERVAL_KEY);
    if (!raw) return DEFAULT_REFRESH_SECONDS;
    return clampRefreshSeconds(raw);
  } catch {
    return DEFAULT_REFRESH_SECONDS;
  }
}

export function getLocalNotificationRefreshSeconds() {
  return readRefreshSeconds();
}

export function setLocalNotificationRefreshSeconds(seconds) {
  const normalized = clampRefreshSeconds(seconds);
  if (isBrowser()) {
    try {
      localStorage.setItem(LOCAL_NOTIFICATION_INTERVAL_KEY, String(normalized));
    } catch {
      // ignore storage write error
    }
  }
  resetLocalNotificationRefreshTimer();
  if (normalized > 0) {
    scheduleLocalNotificationRefresh({ reason: 'refresh-interval-updated', immediate: true });
  }
  return normalized;
}

async function loadNotificationModule() {
  if (!isDesktopNotificationRuntime()) return null;
  const electronNotifications = window.todoElectron.notifications;
  return {
    Importance: { Default: 3 },
    Visibility: { Private: 0 },
    Schedule: {
      at: (date) => ({ at: date instanceof Date ? date.toISOString() : new Date(date).toISOString() }),
    },
    isPermissionGranted: () => electronNotifications.isPermissionGranted(),
    requestPermission: () => electronNotifications.requestPermission(),
    sendNotification: (payload) => electronNotifications.send(payload),
    cancel: (ids) => electronNotifications.cancel(ids),
  };
}

function parseScheduleState(raw) {
  if (!raw) return { ids: [], items: [] };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const ids = Array.isArray(parsed?.ids)
      ? parsed.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id))
      : [];
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return { ids, items };
  } catch {
    return { ids: [], items: [] };
  }
}

async function readScheduleState() {
  const localValue = isBrowser() ? localStorage.getItem(LOCAL_NOTIFICATION_STATE_KEY) : '';
  if (localValue) return parseScheduleState(localValue);
  const metaValue = await getMeta(LOCAL_NOTIFICATION_META_KEY, '');
  return parseScheduleState(metaValue);
}

async function writeScheduleState(state) {
  const value = JSON.stringify({
    updated_at: new Date().toISOString(),
    ids: Array.isArray(state?.ids) ? state.ids : [],
    items: Array.isArray(state?.items) ? state.items : [],
  });
  if (isBrowser()) {
    try {
      localStorage.setItem(LOCAL_NOTIFICATION_STATE_KEY, value);
    } catch {
      // ignore storage write error
    }
  }
  await setMeta(LOCAL_NOTIFICATION_META_KEY, value);
}

function emitStatus() {
  const status = getLocalNotificationStatus();
  statusListeners.forEach((listener) => {
    try {
      listener(status);
    } catch (error) {
      console.error('Local notification status listener failed:', error);
    }
  });
}

export function onLocalNotificationStatusChange(callback) {
  if (typeof callback !== 'function') return () => {};
  statusListeners.add(callback);
  return () => statusListeners.delete(callback);
}

export function getLocalNotificationStatus() {
  return {
    supported: isDesktopNotificationRuntime(),
    enabled: isLocalNotificationEnabled(),
    refresh_seconds: getLocalNotificationRefreshSeconds(),
    permission: lastPermissionState,
  };
}

async function ensurePermission(options = {}) {
  const { request = false } = options;
  if (!isDesktopNotificationRuntime()) {
    lastPermissionState = 'unsupported';
    return false;
  }
  const plugin = await loadNotificationModule();
  if (!plugin) {
    lastPermissionState = 'unavailable';
    return false;
  }

  try {
    if (await plugin.isPermissionGranted()) {
      lastPermissionState = 'granted';
      return true;
    }
    if (!request) {
      lastPermissionState = 'prompt';
      return false;
    }
    const permission = await plugin.requestPermission();
    lastPermissionState = permission || 'unknown';
    return permission === 'granted';
  } catch (error) {
    console.error('Failed to resolve notification permission:', error);
    lastPermissionState = 'error';
    return false;
  } finally {
    emitStatus();
  }
}

export async function requestLocalNotificationPermission() {
  return ensurePermission({ request: true });
}

export async function refreshLocalNotificationPermissionStatus() {
  return ensurePermission({ request: false });
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getCachedUser() {
  if (!isBrowser()) return {};
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user && typeof user === 'object' ? user : {};
  } catch {
    return {};
  }
}

function getDefaultReminderMinutes(user) {
  const minutes = Number(user?.default_reminder_minutes || 0);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 5;
}

function parseClock(raw, fallback = '09:00') {
  const value = String(raw || fallback).trim();
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return parseClock(fallback, '09:00');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return parseClock(fallback, '09:00');
  return { hour, minute };
}

function resolveReminderStart(baseDate, allDay, user) {
  if (!allDay) return baseDate;
  const { hour, minute } = parseClock(user?.default_morning_time || '09:00');
  const local = new Date(baseDate);
  local.setHours(hour, minute, 0, 0);
  return local;
}

function buildNotificationID(key) {
  const text = String(key || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (ID_NAMESPACE | (hash & ID_MASK)) >>> 0;
}

function stripMarkdown(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#*_~>|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildReminderCandidate(source, user, options = {}) {
  const taskID = Number(source?.id || source?.task_id || source?.taskID || 0);
  if (!taskID || taskID < 0) return null;
  const status = String(source?.status || 'pending');
  if (status !== 'pending') return null;
  const startValue = source?.start_time || source?.startTime || '';
  if (!startValue) return null;
  const start = parseDate(startValue);
  if (!start) return null;
  const allDay = Boolean(source?.all_day ?? source?.allDay);
  const resolvedStart = resolveReminderStart(start, allDay, user);
  const notifyAt = new Date(resolvedStart.getTime() - getDefaultReminderMinutes(user) * 60 * 1000);
  const now = options.now || new Date();
  const horizon = options.horizon || addDays(now, DEFAULT_LOOKAHEAD_DAYS);
  if (!(notifyAt > now) || notifyAt > horizon) return null;

  const instanceID = String(source?.instance_id || source?.instanceId || '');
  const occurrenceDate = String(source?.occurrence_date || source?.occurrenceDate || source?.original_date || source?.originalDate || '');
  const key = [
    instanceID ? 'occurrence' : 'task',
    taskID,
    instanceID,
    occurrenceDate,
    notifyAt.toISOString(),
  ].join('|');

  const title = String(source?.title || '').trim() || 'Todo reminder';
  const body = stripMarkdown(source?.description || '');

  return {
    id: buildNotificationID(key),
    key,
    task_id: taskID,
    instance_id: instanceID,
    notify_at: notifyAt.toISOString(),
    title,
    body,
    all_day: allDay,
  };
}

async function fetchReminderSources() {
  const user = getCachedUser();
  if (!user?.default_reminder_enabled) {
    return [];
  }

  const localTasks = await readTasks();
  let recurringOccurrences = [];
  try {
    const res = await tasksAPI.listNextOccurrences({ from: new Date().toISOString() });
    recurringOccurrences = Array.isArray(res?.data) ? res.data : [];
  } catch (error) {
    console.error('Failed to fetch recurring occurrences for local notifications:', error);
  }

  const now = new Date();
  const horizon = addDays(now, DEFAULT_LOOKAHEAD_DAYS);
  const candidates = [
    ...(Array.isArray(localTasks) ? localTasks : []),
    ...(Array.isArray(recurringOccurrences) ? recurringOccurrences : []),
  ]
    .map((item) => buildReminderCandidate(item, user, { now, horizon }))
    .filter(Boolean)
    .sort((a, b) => {
      const timeDiff = Date.parse(a.notify_at) - Date.parse(b.notify_at);
      if (timeDiff !== 0) return timeDiff;
      return a.id - b.id;
    });

  const deduped = [];
  const seenKeys = new Set();
  for (const candidate of candidates) {
    const dedupeKey = candidate.key;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);
    deduped.push(candidate);
    if (deduped.length >= MAX_SCHEDULED_NOTIFICATIONS) break;
  }
  return deduped;
}

async function cancelIDs(ids) {
  const list = Array.isArray(ids)
    ? ids.map((id) => Number(id)).filter((id) => Number.isInteger(id))
    : [];
  if (!list.length) return;
  const plugin = await loadNotificationModule();
  if (!plugin) return;
  await plugin.cancel(list);
}

export async function cancelScheduledLocalNotifications() {
  const current = await readScheduleState();
  await cancelIDs(current.ids);
  await writeScheduleState({ ids: [], items: [] });
}

export async function sendLocalNotificationTest() {
  const plugin = await loadNotificationModule();
  if (!plugin) throw new Error('local notifications are not available');
  const granted = await ensurePermission({ request: true });
  if (!granted) throw new Error('notification permission was not granted');
  await plugin.sendNotification({
    id: buildNotificationID(`test|${Date.now()}`),
    channelId: NOTIFICATION_CHANNEL_ID,
    title: 'Todo',
    body: 'Local notifications are ready.',
    group: REMINDER_GROUP,
    autoCancel: true,
    sound: 'Ping',
    extra: {
      source: REMINDER_GROUP,
      kind: 'test',
    },
  });
}

export async function reconcileLocalNotifications(options = {}) {
  if (!isLocalNotificationEnabled()) {
    await cancelScheduledLocalNotifications();
    lastPermissionState = isDesktopNotificationRuntime() ? lastPermissionState : 'unsupported';
    emitStatus();
    return { scheduled: 0, supported: isDesktopNotificationRuntime(), enabled: false };
  }
  if (!isDesktopNotificationRuntime()) {
    lastPermissionState = 'unsupported';
    emitStatus();
    return { scheduled: 0, supported: false, enabled: true };
  }

  const plugin = await loadNotificationModule();
  if (!plugin) {
    lastPermissionState = 'unavailable';
    emitStatus();
    return { scheduled: 0, supported: true, enabled: true };
  }
  const granted = await ensurePermission({ request: !!options.requestPermission });
  if (!granted) {
    return { scheduled: 0, supported: true, enabled: true, permission: lastPermissionState };
  }

  const current = await readScheduleState();
  const candidates = await fetchReminderSources();
  const nextIDs = candidates.map((item) => item.id);
  const nextIDSet = new Set(nextIDs);
  const removedIDs = current.ids.filter((id) => !nextIDSet.has(Number(id)));
  if (removedIDs.length) {
    await cancelIDs(removedIDs);
  }

  const previousItemsByID = new Map(
    current.items.map((item) => [Number(item?.id), String(item?.notify_at || '')]),
  );
  for (const candidate of candidates) {
    const previousNotifyAt = previousItemsByID.get(candidate.id);
    if (previousNotifyAt && previousNotifyAt !== candidate.notify_at) {
      await cancelIDs([candidate.id]);
    } else if (previousNotifyAt === candidate.notify_at) {
      continue;
    }

    plugin.sendNotification({
      id: candidate.id,
      channelId: NOTIFICATION_CHANNEL_ID,
      title: candidate.title,
      body: candidate.body || 'Task reminder',
      schedule: plugin.Schedule.at(new Date(candidate.notify_at), false, true),
      group: REMINDER_GROUP,
      autoCancel: true,
      sound: 'Ping',
      extra: {
        source: REMINDER_GROUP,
        taskId: String(candidate.task_id),
        instanceId: candidate.instance_id || '',
      },
    });
  }

  await writeScheduleState({
    ids: nextIDs,
    items: candidates,
  });
  emitStatus();
  return {
    scheduled: candidates.length,
    supported: true,
    enabled: true,
    permission: 'granted',
  };
}

async function runQueuedReconcile(options = {}) {
  if (reconcileRunning) {
    reconcileRequested = true;
    return;
  }
  reconcileRunning = true;
  try {
    await reconcileLocalNotifications(options);
  } catch (error) {
    console.error('Local notification refresh failed:', error);
  } finally {
    reconcileRunning = false;
    if (reconcileRequested) {
      reconcileRequested = false;
      setTimeout(() => {
        void runQueuedReconcile({ reason: 'queued' });
      }, 0);
    }
  }
}

export function scheduleLocalNotificationRefresh(options = {}) {
  if (!isDesktopNotificationRuntime()) return;
  const delay = options.immediate ? 0 : 300;
  setTimeout(() => {
    void runQueuedReconcile(options);
  }, delay);
}

export function resetLocalNotificationRefreshTimer() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (!isDesktopNotificationRuntime()) return;
  if (!isLocalNotificationEnabled()) return;
  const seconds = getLocalNotificationRefreshSeconds();
  if (seconds <= 0) return;
  refreshTimer = setInterval(() => {
    scheduleLocalNotificationRefresh({ reason: 'interval', immediate: true });
  }, seconds * 1000);
}

export function startLocalNotificationScheduler() {
  if (started) return;
  started = true;
  void refreshLocalNotificationPermissionStatus();
  resetLocalNotificationRefreshTimer();
  scheduleLocalNotificationRefresh({ reason: 'start', immediate: true });
}

export function stopLocalNotificationScheduler() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  started = false;
  reconcileRunning = false;
  reconcileRequested = false;
}
