const transientScrollbarBindings = new WeakMap();

function getTimerHost() {
  if (typeof window !== 'undefined') return window;
  return globalThis;
}

export function attachTransientScrollbar(node, {
  className = 'is-scrolling',
  baseClassName = 'editor-scrollbar-overlay',
  timeout = 720,
} = {}) {
  if (!node || typeof node.addEventListener !== 'function' || !node.classList) {
    return () => {};
  }

  const existing = transientScrollbarBindings.get(node);
  if (existing) return existing.cleanup;

  const timerHost = getTimerHost();
  const hadBaseClass = baseClassName ? node.classList.contains(baseClassName) : true;
  let timer = 0;

  if (baseClassName) {
    node.classList.add(baseClassName);
  }

  const clearTimer = () => {
    if (!timer) return;
    timerHost.clearTimeout(timer);
    timer = 0;
  };

  const hideScrollbar = () => {
    node.classList.remove(className);
    timer = 0;
  };

  const showScrollbar = () => {
    node.classList.add(className);
    clearTimer();
    timer = timerHost.setTimeout(hideScrollbar, timeout);
  };

  node.addEventListener('scroll', showScrollbar, { passive: true });
  node.addEventListener('wheel', showScrollbar, { passive: true });
  node.addEventListener('touchmove', showScrollbar, { passive: true });

  const cleanup = () => {
    node.removeEventListener('scroll', showScrollbar);
    node.removeEventListener('wheel', showScrollbar);
    node.removeEventListener('touchmove', showScrollbar);
    clearTimer();
    node.classList.remove(className);
    if (baseClassName && !hadBaseClass) {
      node.classList.remove(baseClassName);
    }
    transientScrollbarBindings.delete(node);
  };

  transientScrollbarBindings.set(node, { cleanup });
  return cleanup;
}

export function detachTransientScrollbar(node) {
  const binding = node ? transientScrollbarBindings.get(node) : null;
  binding?.cleanup?.();
}
