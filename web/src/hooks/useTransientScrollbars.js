const transientScrollbarBindings = new WeakMap();
const MIN_THUMB_SIZE = 32;
const TRACK_WIDTH = 9;
const TRACK_EDGE_OFFSET = 4;
const TRACK_PADDING = 4;

function getWindowHost(node) {
  return node?.ownerDocument?.defaultView || window;
}

function getDocumentHost(node) {
  return node?.ownerDocument || document;
}

export function getTransientScrollbarZIndex(node) {
  const windowHost = getWindowHost(node);
  let layerZIndex = 0;

  for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
    const style = windowHost.getComputedStyle?.(ancestor);
    if (!style || style.position === 'static') continue;

    const zIndex = Number.parseInt(style.zIndex, 10);
    if (Number.isFinite(zIndex)) {
      layerZIndex = Math.max(layerZIndex, zIndex);
    }
  }

  return layerZIndex + 1;
}

function isScrollable(node) {
  return node.scrollHeight - node.clientHeight > 1;
}

function shouldSkipTransientScrollbar(node) {
  const windowHost = getWindowHost(node);
  const coarsePointer = windowHost.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches === true;
  const narrowViewport = windowHost.matchMedia?.('(max-width: 767px)')?.matches === true;
  if (coarsePointer) return true;
  return narrowViewport && !!node.closest?.('.mobile-scrollbar-hidden');
}

export function attachTransientScrollbar(node, {
  className = 'is-scrolling',
  baseClassName = 'editor-scrollbar-overlay',
  timeout = 720,
} = {}) {
  if (!node || typeof node.addEventListener !== 'function' || !node.classList) {
    return () => {};
  }
  if (shouldSkipTransientScrollbar(node)) {
    return () => {};
  }

  const existing = transientScrollbarBindings.get(node);
  if (existing) return existing.cleanup;

  const windowHost = getWindowHost(node);
  const documentHost = getDocumentHost(node);
  const hadBaseClass = baseClassName ? node.classList.contains(baseClassName) : true;
  const track = documentHost.createElement('div');
  const thumb = documentHost.createElement('div');
  let timer = 0;
  let raf = 0;
  let resizeObserver = null;
  let mutationObserver = null;
  let dragging = false;
  let dragStartY = 0;
  let dragStartScrollTop = 0;

  if (baseClassName) {
    node.classList.add(baseClassName);
  }

  track.className = 'editor-scrollbar-track';
  thumb.className = 'editor-scrollbar-thumb';
  track.setAttribute('aria-hidden', 'true');
  track.appendChild(thumb);
  documentHost.body?.appendChild(track);

  const clearFrame = () => {
    if (!raf) return;
    windowHost.cancelAnimationFrame(raf);
    raf = 0;
  };

  const clearTimer = () => {
    if (!timer) return;
    windowHost.clearTimeout(timer);
    timer = 0;
  };

  const hideScrollbar = () => {
    if (dragging) return;
    node.classList.remove(className);
    track.classList.remove('is-visible');
    timer = 0;
  };

  const updateScrollbar = () => {
    raf = 0;
    const scrollable = isScrollable(node);
    node.classList.toggle('has-custom-scrollbar', scrollable);
    track.classList.toggle('has-custom-scrollbar', scrollable);
    if (!scrollable) {
      track.style.height = '0px';
      thumb.style.height = '0px';
      thumb.style.transform = 'translate3d(0, 0, 0)';
      return;
    }

    const rect = node.getBoundingClientRect();
    const trackHeight = Math.max(0, rect.height - TRACK_PADDING * 2);
    const thumbHeight = Math.max(MIN_THUMB_SIZE, Math.round((node.clientHeight / node.scrollHeight) * trackHeight));
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    const maxScrollTop = Math.max(1, node.scrollHeight - node.clientHeight);
    const thumbTop = Math.round((node.scrollTop / maxScrollTop) * maxThumbTop);
    const left = Math.max(0, rect.right - TRACK_WIDTH - TRACK_EDGE_OFFSET);
    const top = Math.max(0, rect.top);
    track.style.zIndex = String(getTransientScrollbarZIndex(node));
    track.style.height = `${Math.max(0, rect.height)}px`;
    track.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    thumb.style.height = `${Math.min(trackHeight, thumbHeight)}px`;
    thumb.style.transform = `translate3d(0, ${TRACK_PADDING + thumbTop}px, 0)`;
  };

  const requestUpdate = () => {
    if (raf) return;
    raf = windowHost.requestAnimationFrame(updateScrollbar);
  };

  const showScrollbar = ({ persist = false } = {}) => {
    requestUpdate();
    if (!isScrollable(node)) return;
    node.classList.add(className);
    track.classList.add('is-visible');
    clearTimer();
    if (!persist) {
      timer = windowHost.setTimeout(hideScrollbar, timeout);
    }
  };

  const handlePointerMove = (event) => {
    if (!dragging) return;
    event.preventDefault();
    const rect = node.getBoundingClientRect();
    const trackHeight = Math.max(0, rect.height - TRACK_PADDING * 2);
    const thumbHeight = thumb.offsetHeight || MIN_THUMB_SIZE;
    const maxThumbTop = Math.max(1, trackHeight - thumbHeight);
    const maxScrollTop = Math.max(0, node.scrollHeight - node.clientHeight);
    const delta = event.clientY - dragStartY;
    node.scrollTop = dragStartScrollTop + (delta / maxThumbTop) * maxScrollTop;
    showScrollbar({ persist: true });
  };

  const handlePointerUp = () => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('is-dragging');
    documentHost.removeEventListener('pointermove', handlePointerMove);
    documentHost.removeEventListener('pointerup', handlePointerUp);
    showScrollbar();
  };

  const handleThumbPointerDown = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    dragStartY = event.clientY;
    dragStartScrollTop = node.scrollTop;
    track.classList.add('is-dragging');
    clearTimer();
    showScrollbar({ persist: true });
    documentHost.addEventListener('pointermove', handlePointerMove);
    documentHost.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  const handleTrackPointerDown = (event) => {
    if (event.button !== 0 || event.target !== track) return;
    event.preventDefault();
    const rect = track.getBoundingClientRect();
    const thumbHeight = thumb.offsetHeight || MIN_THUMB_SIZE;
    const targetTop = event.clientY - rect.top - thumbHeight / 2 - TRACK_PADDING;
    const trackHeight = Math.max(0, node.clientHeight - TRACK_PADDING * 2);
    const maxThumbTop = Math.max(1, trackHeight - thumbHeight);
    const maxScrollTop = Math.max(0, node.scrollHeight - node.clientHeight);
    node.scrollTop = (Math.min(maxThumbTop, Math.max(0, targetTop)) / maxThumbTop) * maxScrollTop;
    showScrollbar();
  };

  node.addEventListener('scroll', showScrollbar, { passive: true });
  node.addEventListener('wheel', showScrollbar, { passive: true });
  node.addEventListener('touchmove', showScrollbar, { passive: true });
  node.addEventListener('pointerenter', showScrollbar, { passive: true });
  thumb.addEventListener('pointerdown', handleThumbPointerDown);
  track.addEventListener('pointerdown', handleTrackPointerDown);
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(requestUpdate);
    resizeObserver.observe(node);
  }
  if (typeof MutationObserver !== 'undefined') {
    mutationObserver = new MutationObserver(requestUpdate);
    mutationObserver.observe(node, { childList: true, subtree: true });
  }
  windowHost.addEventListener?.('resize', requestUpdate, { passive: true });
  windowHost.addEventListener?.('scroll', requestUpdate, { passive: true });
  requestUpdate();

  const cleanup = () => {
    node.removeEventListener('scroll', showScrollbar);
    node.removeEventListener('wheel', showScrollbar);
    node.removeEventListener('touchmove', showScrollbar);
    node.removeEventListener('pointerenter', showScrollbar);
    thumb.removeEventListener('pointerdown', handleThumbPointerDown);
    track.removeEventListener('pointerdown', handleTrackPointerDown);
    documentHost.removeEventListener('pointermove', handlePointerMove);
    documentHost.removeEventListener('pointerup', handlePointerUp);
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    windowHost.removeEventListener?.('resize', requestUpdate);
    windowHost.removeEventListener?.('scroll', requestUpdate);
    track.remove();
    clearFrame();
    clearTimer();
    node.classList.remove(className);
    node.classList.remove('has-custom-scrollbar');
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
