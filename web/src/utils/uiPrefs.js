const KEY_SHOW_CATEGORY_EMOJI = 'ui_show_category_emoji';
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
