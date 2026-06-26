const TASK_DESCRIPTION_EDITOR_SELECTOR = '.task-description-editor-shell, .live-md-toast';
const TASK_DESCRIPTION_EDITABLE_SELECTOR = [
  '.task-description-editor-shell [contenteditable="true"]',
  '.task-description-editor-shell .mu-editor',
  '.task-description-editor-shell .vditor-ir pre.vditor-reset',
  '.task-description-editor-shell .vditor-ir .vditor-reset',
  '.live-md-toast [contenteditable="true"]',
  '.live-md-toast .mu-editor',
  '.live-md-toast .vditor-ir pre.vditor-reset',
  '.live-md-toast .vditor-ir .vditor-reset',
].join(', ');

function isElement(value) {
  return typeof Element !== 'undefined' && value instanceof Element;
}

function isHTMLElement(value) {
  return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

export function isTaskDescriptionEditorTarget(target) {
  if (!isElement(target)) return false;
  return !!target.closest(TASK_DESCRIPTION_EDITOR_SELECTOR);
}

export function getActiveTaskDescriptionEditorElement(doc = typeof document !== 'undefined' ? document : null) {
  const activeElement = doc?.activeElement;
  if (!isElement(activeElement)) return null;
  if (
    !activeElement.matches(TASK_DESCRIPTION_EDITABLE_SELECTOR)
    && !activeElement.closest(TASK_DESCRIPTION_EDITOR_SELECTOR)
  ) {
    return null;
  }
  return activeElement;
}

export function blurActiveTaskDescriptionEditor(options = {}) {
  if (typeof document === 'undefined') return false;
  const activeElement = getActiveTaskDescriptionEditorElement(document);
  if (!activeElement) return false;
  const keepSelection = !!options.keepSelection;
  if (isHTMLElement(activeElement)) {
    activeElement.blur();
  }
  if (!keepSelection && typeof window !== 'undefined') {
    try {
      window.getSelection?.()?.removeAllRanges?.();
    } catch {
      // Selection cleanup is best-effort only.
    }
  }
  return true;
}

export function blurTaskDescriptionEditorUnlessInside(target, options = {}) {
  if (isTaskDescriptionEditorTarget(target)) return false;
  return blurActiveTaskDescriptionEditor(options);
}
