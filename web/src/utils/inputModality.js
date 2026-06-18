const CLEANUP_KEY = '__todoInputModalityCleanup';

const KEYBOARD_FOCUS_KEYS = new Set([
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'F6',
]);

export function isKeyboardFocusIntent(event = {}) {
  const key = event.key || event.code || '';
  if (!KEYBOARD_FOCUS_KEYS.has(key)) return false;
  if (key === 'Tab') return true;
  return !(event.altKey || event.ctrlKey || event.metaKey);
}

export function initInputModality(
  doc = typeof document !== 'undefined' ? document : null,
  win = typeof window !== 'undefined' ? window : null
) {
  const root = doc?.documentElement;
  if (!root || !win?.addEventListener || !win?.removeEventListener) return () => {};
  if (typeof win[CLEANUP_KEY] === 'function') return win[CLEANUP_KEY];

  const setModality = (mode) => {
    root.dataset.inputModality = mode;
    root.classList?.toggle?.('using-keyboard', mode === 'keyboard');
    root.classList?.toggle?.('using-pointer', mode === 'pointer');
  };

  if (!root.dataset.inputModality) {
    setModality('pointer');
  }

  const handlePointerInput = () => setModality('pointer');
  const handleKeyDown = (event) => {
    if (isKeyboardFocusIntent(event)) {
      setModality('keyboard');
    }
  };

  win.addEventListener('keydown', handleKeyDown, true);
  win.addEventListener('pointerdown', handlePointerInput, true);
  win.addEventListener('mousedown', handlePointerInput, true);
  win.addEventListener('touchstart', handlePointerInput, true);

  const cleanup = () => {
    win.removeEventListener('keydown', handleKeyDown, true);
    win.removeEventListener('pointerdown', handlePointerInput, true);
    win.removeEventListener('mousedown', handlePointerInput, true);
    win.removeEventListener('touchstart', handlePointerInput, true);
    if (win[CLEANUP_KEY] === cleanup) {
      delete win[CLEANUP_KEY];
    }
  };

  win[CLEANUP_KEY] = cleanup;
  return cleanup;
}
