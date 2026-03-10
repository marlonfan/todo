const KEY_SHOW_CATEGORY_EMOJI = 'ui_show_category_emoji';
const KEY_TASKLIST_SORT = 'ui_tasklist_sort_by_v1';
const KEY_TASKLIST_GROUP = 'ui_tasklist_group_by_v1';
const KEY_SHOW_CHINESE_HOLIDAYS = 'ui_show_chinese_holidays';
const EVENT_UI_PREFS_CHANGED = 'ui:prefs-changed';

export function getShowCategoryEmoji() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEY_SHOW_CATEGORY_EMOJI) === '1';
}

export function setShowCategoryEmoji(enabled) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_SHOW_CATEGORY_EMOJI, enabled ? '1' : '0');
  window.dispatchEvent(new CustomEvent(EVENT_UI_PREFS_CHANGED, { detail: { showCategoryEmoji: !!enabled } }));
}

export function onUIPrefsChanged(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT_UI_PREFS_CHANGED, handler);
  return () => window.removeEventListener(EVENT_UI_PREFS_CHANGED, handler);
}

export function getShowChineseHolidays() {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(KEY_SHOW_CHINESE_HOLIDAYS) !== '0';
}

export function setShowChineseHolidays(enabled) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_SHOW_CHINESE_HOLIDAYS, enabled ? '1' : '0');
  window.dispatchEvent(new CustomEvent(EVENT_UI_PREFS_CHANGED, {
    detail: { showChineseHolidays: !!enabled },
  }));
}

function readMap(key) {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeMap(key, value) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value || {}));
    window.dispatchEvent(new CustomEvent(EVENT_UI_PREFS_CHANGED, { detail: { key } }));
  } catch {
    // ignore persistence failures in private mode/quota exceeded
  }
}

export function getTaskListSortPref(viewKey) {
  if (!viewKey) return '';
  const map = readMap(KEY_TASKLIST_SORT);
  return typeof map[viewKey] === 'string' ? map[viewKey] : '';
}

export function setTaskListSortPref(viewKey, value) {
  if (!viewKey || !value) return;
  const map = readMap(KEY_TASKLIST_SORT);
  map[viewKey] = value;
  writeMap(KEY_TASKLIST_SORT, map);
}

export function getTaskListGroupPref(viewKey) {
  if (!viewKey) return '';
  const map = readMap(KEY_TASKLIST_GROUP);
  return typeof map[viewKey] === 'string' ? map[viewKey] : '';
}

export function setTaskListGroupPref(viewKey, value) {
  if (!viewKey || !value) return;
  const map = readMap(KEY_TASKLIST_GROUP);
  map[viewKey] = value;
  writeMap(KEY_TASKLIST_GROUP, map);
}
