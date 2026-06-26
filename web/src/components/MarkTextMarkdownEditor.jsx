import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { attachTransientScrollbar } from '../hooks/useTransientScrollbars';

let markTextPluginsRegistered = false;
let markTextCorePromise = null;
const PARAGRAPH_FRONT_BUTTON_OFFSET = 4;

async function loadMarkTextCore() {
  if (!markTextCorePromise) {
    markTextCorePromise = import('@todo/vendor-marktext-muya');
  }
  return markTextCorePromise;
}

function registerMarkTextPlugins(core) {
  if (markTextPluginsRegistered) return;
  const { Muya } = core;
  [
    { plugin: core.CodeBlockLanguageSelector },
    { plugin: core.EmojiSelector },
    { plugin: core.FootnoteTool },
    { plugin: core.ImageEditTool },
    { plugin: core.ImageResizeBar },
    { plugin: core.ImageToolBar },
    { plugin: core.InlineFormatToolbar },
    { plugin: core.LinkTools },
    {
      plugin: core.ParagraphFrontButton,
      options: {
        offsetOptions: {
          mainAxis: 0,
          crossAxis: 0,
          alignmentAxis: PARAGRAPH_FRONT_BUTTON_OFFSET,
        },
      },
    },
    { plugin: core.ParagraphFrontMenu },
    { plugin: core.ParagraphQuickInsertMenu },
    { plugin: core.PreviewToolBar },
    { plugin: core.TableColumnToolbar },
    { plugin: core.TableDragBar },
    { plugin: core.TableRowColumMenu },
  ].forEach(({ plugin, options = {} }) => {
    if (!plugin) return;
    const existing = Array.isArray(Muya.plugins)
      ? Muya.plugins.find((registered) => registered?.plugin === plugin)
      : null;
    if (existing) {
      existing.options = { ...(existing.options || {}), ...options };
    } else {
      Muya.use(plugin, options);
    }
  });
  markTextPluginsRegistered = true;
}

function isDraftSwitchDebugEnabled() {
  if (typeof window === 'undefined') return false;
  return window.localStorage?.getItem('todo:draftDebug') === '1';
}

function summarizeDebugText(value) {
  const text = String(value ?? '');
  return {
    length: text.length,
    preview: text.length > 120 ? `${text.slice(0, 120)}...` : text,
    tail: text.slice(-40),
  };
}

let editorDebugSeq = 0;
function logEditorDebug(scope, payload = {}) {
  if (!isDraftSwitchDebugEnabled()) return;
  const entry = {
    seq: ++editorDebugSeq,
    scope,
    at: new Date().toISOString(),
    ms: typeof performance !== 'undefined' ? Math.round(performance.now()) : 0,
    ...payload,
  };
  console.info('[todo-draft-debug]', JSON.stringify(entry));
}

function normalize(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\n+$/g, '');
}

function buildLocale(core, language, placeholder) {
  const { en, zh } = core;
  const base = String(language || '').toLowerCase().startsWith('zh') ? zh : en;
  const resource = { ...(base?.resource || {}) };
  if (placeholder) {
    resource['Type / to insert...'] = placeholder;
  }
  return {
    name: base?.name || 'en',
    resource,
  };
}

function isMarkTextTaskCheckbox(target) {
  if (!(target instanceof Element)) return false;
  return !!(
    target.closest('li.mu-task-list-item')
    && (
      target.matches('input[type="checkbox"]')
      || target.matches('.mu-task-list-checkbox')
    )
  );
}

function isScrollableElement(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (
    element.classList.contains('task-detail-body-scroll')
    || element.classList.contains('mu-editor')
    || element.classList.contains('marktext-md-host')
  ) {
    return true;
  }
  const style = window.getComputedStyle(element);
  const scrollableY = /(auto|scroll|overlay)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
  const scrollableX = /(auto|scroll|overlay)/.test(style.overflowX) && element.scrollWidth > element.clientWidth;
  return scrollableY || scrollableX;
}

function captureScrollSnapshot(target) {
  if (typeof document === 'undefined') return [];
  const snapshot = [];
  const seen = new Set();
  const add = (element) => {
    if (!(element instanceof HTMLElement) || seen.has(element)) return;
    if (!isScrollableElement(element) && !element.scrollTop && !element.scrollLeft) return;
    seen.add(element);
    snapshot.push({
      element,
      left: element.scrollLeft,
      top: element.scrollTop,
    });
  };

  let node = target instanceof Element ? target : null;
  while (node) {
    add(node);
    node = node.parentElement;
  }
  add(document.scrollingElement);
  return snapshot;
}

function restoreScrollSnapshot(snapshot) {
  (Array.isArray(snapshot) ? snapshot : []).forEach((item) => {
    const element = item?.element;
    if (!(element instanceof HTMLElement)) return;
    element.scrollLeft = Number(item.left || 0);
    element.scrollTop = Number(item.top || 0);
  });
}

function scheduleScrollSnapshotRestore(snapshot) {
  if (typeof window === 'undefined' || !Array.isArray(snapshot) || snapshot.length === 0) return;
  const restore = () => restoreScrollSnapshot(snapshot);
  restore();
  window.setTimeout(restore, 0);
  window.setTimeout(restore, 60);
  window.setTimeout(restore, 160);
  window.requestAnimationFrame?.(() => {
    restore();
    window.requestAnimationFrame?.(restore);
  });
}

const MarkTextMarkdownEditor = React.forwardRef(function MarkTextMarkdownEditor({
  value,
  onChange,
  onSaveShortcut,
  placeholder,
  minHeight = 220,
  fill = false,
  className = '',
}, ref) {
  const { i18n } = useTranslation();
  const hostRef = useRef(null);
  const editorRef = useRef(null);
  const editorScrollCleanupRef = useRef(null);
  const readyRef = useRef(false);
  const syncingRef = useRef(false);
  const lastInternalValueRef = useRef(String(value || ''));
  const pendingExternalValueRef = useRef(String(value || ''));
  const fastInputVersionRef = useRef(0);
  const externalVersionRef = useRef(0);
  const appliedExternalVersionRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const onSaveShortcutRef = useRef(onSaveShortcut);
  const taskCheckboxScrollSnapshotRef = useRef(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSaveShortcutRef.current = onSaveShortcut;
  }, [onSaveShortcut]);

  const resolveHeight = () => (fill ? '100%' : `${minHeight}px`);

  const getCurrentValue = () => {
    const editor = editorRef.current;
    if (editor && typeof editor.getMarkdown === 'function') {
      try {
        return String(editor.getMarkdown() || '');
      } catch {
        // Fall back to the cached value if Muya is midway through teardown.
      }
    }
    return String(lastInternalValueRef.current ?? pendingExternalValueRef.current ?? '');
  };

  const applyEditorValue = (nextValue, source = 'imperative') => {
    const text = String(nextValue || '');
    pendingExternalValueRef.current = text;
    externalVersionRef.current += 1;
    const currentExternalVersion = externalVersionRef.current;

    const editor = editorRef.current;
    if (readyRef.current && editor && typeof editor.setContent === 'function') {
      syncingRef.current = true;
      try {
        editor.setContent(text, false);
      } finally {
        syncingRef.current = false;
      }
    }

    lastInternalValueRef.current = text;
    fastInputVersionRef.current += 1;
    appliedExternalVersionRef.current = currentExternalVersion;
    logEditorDebug('editor.marktext.value.applied', {
      source,
      external_version: currentExternalVersion,
      applied_external_version: appliedExternalVersionRef.current,
      fast_input_version: fastInputVersionRef.current,
      next_value: summarizeDebugText(text),
    });
    return text;
  };

  const blurEditor = () => {
    try {
      const activeElement = document.activeElement;
      if (
        activeElement
        && hostRef.current
        && typeof hostRef.current.contains === 'function'
        && hostRef.current.contains(activeElement)
        && typeof activeElement.blur === 'function'
      ) {
        activeElement.blur();
      }
      window.getSelection?.()?.removeAllRanges?.();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let disposed = false;
    let instance = null;
    let placeholderNode = null;
    let scrollNode = null;

    const host = hostRef.current;
    if (!host) return undefined;
    host.style.height = resolveHeight();
    host.textContent = '';

    const handleContentChange = (event = {}) => {
      if (disposed || syncingRef.current || !instance) return;
      const nextValue = String(instance.getMarkdown?.() || '');
      lastInternalValueRef.current = nextValue;
      fastInputVersionRef.current += 1;
      logEditorDebug('editor.marktext.input', {
        source: event?.source || '',
        fast_input_version: fastInputVersionRef.current,
        current_value: summarizeDebugText(nextValue),
      });
      if (typeof onChangeRef.current === 'function') {
        onChangeRef.current(nextValue);
      }
    };

    const preserveTaskCheckboxScroll = (event, options = {}) => {
      if (!isMarkTextTaskCheckbox(event.target)) return;
      const snapshot = captureScrollSnapshot(event.target);
      taskCheckboxScrollSnapshotRef.current = {
        at: Date.now(),
        snapshot,
      };
      if (options.preventFocus && event.cancelable) {
        event.preventDefault();
      }
      scheduleScrollSnapshotRestore(snapshot);
      logEditorDebug('editor.marktext.taskCheckbox.scrollPreserve', {
        event_type: event.type,
        snapshot_count: snapshot.length,
        prevent_focus: !!options.preventFocus,
      });
    };

    const handleTaskCheckboxMouseDown = (event) => {
      preserveTaskCheckboxScroll(event, { preventFocus: true });
    };

    const handleTaskCheckboxClick = (event) => {
      preserveTaskCheckboxScroll(event);
    };

    const handleEditorShortcuts = (event) => {
      const target = event.target && typeof event.target.closest === 'function'
        ? event.target
        : document.activeElement;
      const isInsideCurrentEditor = !!(
        target
        && hostRef.current
        && typeof hostRef.current.contains === 'function'
        && hostRef.current.contains(target)
      );
      if (!isInsideCurrentEditor) return;

      const key = String(event.key || '').toLowerCase();
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && key === 's';
      if (isSaveShortcut) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof onSaveShortcutRef.current === 'function') {
          onSaveShortcutRef.current();
        }
        return;
      }

      const isRedoAlias = ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'z')
        || ((event.ctrlKey || event.metaKey) && key === 'y');
      if (!isRedoAlias) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        instance?.redo?.();
      } catch {
        // Redo is best-effort; Muya owns the actual history stack.
      }
    };
    window.addEventListener('keydown', handleEditorShortcuts, true);

    const initEditor = async () => {
      const core = await loadMarkTextCore();
      if (disposed || !hostRef.current) return;
      registerMarkTextPlugins(core);
      const { Muya } = core;

      placeholderNode = document.createElement('div');
      hostRef.current.textContent = '';
      hostRef.current.appendChild(placeholderNode);

      instance = new Muya(placeholderNode, {
        markdown: String(pendingExternalValueRef.current || ''),
        hideQuickInsertHint: false,
        spellcheckEnabled: false,
        codeBlockLineNumbers: false,
        math: false,
        frontMatter: false,
        footnote: true,
        superSubScript: false,
        autoPairBracket: true,
        autoPairMarkdownSyntax: true,
        autoPairQuote: true,
        disableHtml: false,
        locale: buildLocale(core, i18n?.language, placeholder),
      });

      editorRef.current = instance;
      instance.on('json-change', handleContentChange);
      instance.init();
      if (disposed) {
        instance?.destroy?.();
        return;
      }

      readyRef.current = true;
      lastInternalValueRef.current = String(instance.getMarkdown?.() || pendingExternalValueRef.current || '');

      scrollNode = instance.domNode || hostRef.current.querySelector('.mu-editor');
      editorScrollCleanupRef.current?.();
      editorScrollCleanupRef.current = scrollNode ? attachTransientScrollbar(scrollNode) : null;
      scrollNode?.addEventListener('mousedown', handleTaskCheckboxMouseDown, true);
      scrollNode?.addEventListener('click', handleTaskCheckboxClick, true);
      window.setTimeout(() => {
        if (!disposed) blurEditor();
      }, 0);
    };

    initEditor().catch((error) => {
      console.error('Failed to initialize MarkText editor:', error);
    });

    return () => {
      disposed = true;
      window.removeEventListener('keydown', handleEditorShortcuts, true);
      scrollNode?.removeEventListener('mousedown', handleTaskCheckboxMouseDown, true);
      scrollNode?.removeEventListener('click', handleTaskCheckboxClick, true);
      readyRef.current = false;
      try {
        instance?.off?.('json-change', handleContentChange);
        instance?.destroy?.();
      } catch {
        // Ignore non-critical destroy races from async UI tools.
      }
      editorRef.current = null;
      editorScrollCleanupRef.current?.();
      editorScrollCleanupRef.current = null;
      if (hostRef.current) {
        hostRef.current.textContent = '';
      }
    };
  }, []);

  useEffect(() => {
    if (hostRef.current) {
      hostRef.current.style.height = resolveHeight();
    }
  }, [fill, minHeight]);

  useEffect(() => {
    pendingExternalValueRef.current = String(value || '');
    externalVersionRef.current += 1;
    const currentExternalVersion = externalVersionRef.current;
    if (!readyRef.current) return;
    const editor = editorRef.current;
    if (!editor || typeof editor.getMarkdown !== 'function' || typeof editor.setContent !== 'function') return;

    const nextValue = String(value || '');
    if (normalize(nextValue) === normalize(lastInternalValueRef.current)) return;

    syncingRef.current = true;
    try {
      editor.setContent(nextValue, false);
      lastInternalValueRef.current = nextValue;
      fastInputVersionRef.current += 1;
      appliedExternalVersionRef.current = currentExternalVersion;
      logEditorDebug('editor.marktext.externalValue.applied', {
        external_version: currentExternalVersion,
        applied_external_version: appliedExternalVersionRef.current,
        fast_input_version: fastInputVersionRef.current,
        next_value: summarizeDebugText(nextValue),
      });
    } finally {
      syncingRef.current = false;
    }
  }, [value]);

  useImperativeHandle(ref, () => ({
    getValue: getCurrentValue,
    setValue: (nextValue) => applyEditorValue(nextValue, 'imperative'),
    getCachedValue: () => {
      const currentValue = getCurrentValue();
      logEditorDebug('editor.marktext.getCachedValue', {
        fast_input_version: fastInputVersionRef.current,
        current_value: summarizeDebugText(currentValue),
        last_internal: summarizeDebugText(lastInternalValueRef.current),
        pending_external: summarizeDebugText(pendingExternalValueRef.current),
      });
      return currentValue;
    },
    getDebugSnapshot: () => ({
      ready: !!readyRef.current,
      syncing: !!syncingRef.current,
      fast_input_version: fastInputVersionRef.current,
      external_version: externalVersionRef.current,
      applied_external_version: appliedExternalVersionRef.current,
      current_value: summarizeDebugText(getCurrentValue()),
      last_internal: summarizeDebugText(lastInternalValueRef.current),
      pending_external: summarizeDebugText(pendingExternalValueRef.current),
    }),
    focus: () => {
      try {
        editorRef.current?.focus?.();
      } catch {
        // ignore
      }
    },
    blur: blurEditor,
  }), []);

  return (
    <div className={`live-md-toast live-md-toast--marktext ${className}`}>
      <div ref={hostRef} className="marktext-md-host editor-scrollbar-overlay" />
    </div>
  );
});

MarkTextMarkdownEditor.displayName = 'MarkTextMarkdownEditor';

export default MarkTextMarkdownEditor;
