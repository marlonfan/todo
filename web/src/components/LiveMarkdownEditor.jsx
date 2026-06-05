import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import vditorLuteUrl from 'vditor/dist/js/lute/lute.min.js?url';

async function loadVditorI18n(language) {
  if (String(language || '').toLowerCase().startsWith('zh')) {
    await import('vditor/dist/js/i18n/zh_CN.js');
    return window.VditorI18n;
  }
  await import('vditor/dist/js/i18n/en_US.js');
  return window.VditorI18n;
}

function removeStaleVditorScript(id, globalName) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (globalName && window[globalName]) return;
  const script = document.getElementById(id);
  if (script) {
    script.remove();
  }
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

const LiveMarkdownEditor = React.forwardRef(function LiveMarkdownEditor({
  value,
  onChange,
  onSaveShortcut,
  placeholder,
  minHeight = 220,
  fill = false,
  className = '',
}, ref) {
  const { i18n } = useTranslation();
  const mountRef = useRef(null);
  const editorRef = useRef(null);
  const initializingRef = useRef(true);
  const readyRef = useRef(false);
  const syncingRef = useRef(false);
  const lastInternalValueRef = useRef(String(value || ''));
  const fastInputValueRef = useRef(String(value || ''));
  const fastInputVersionRef = useRef(0);
  const markdownInputVersionRef = useRef(0);
  const pendingExternalValueRef = useRef(String(value || ''));
  const externalVersionRef = useRef(0);
  const appliedExternalVersionRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const onSaveShortcutRef = useRef(onSaveShortcut);
  const mountIDRef = useRef(`vditor-${Math.random().toString(36).slice(2, 11)}`);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSaveShortcutRef.current = onSaveShortcut;
  }, [onSaveShortcut]);

  const resolveHeight = () => (fill ? '100%' : `${minHeight}px`);
  const normalize = (text) => String(text || '').replace(/\r\n/g, '\n').replace(/\n+$/g, '');
  const readFastInputValue = () => {
    const root = mountRef.current;
    const editable = root?.querySelector('.vditor-ir pre.vditor-reset, .vditor-ir .vditor-reset, [contenteditable="true"]');
    if (!editable) return '';
    return String(editable.textContent || '').replace(/\u200b/g, '').replace(/\u00a0/g, ' ');
  };
  const captureFastInputValue = (eventType = '') => {
    const nextValue = readFastInputValue();
    if (nextValue === fastInputValueRef.current) return;
    fastInputValueRef.current = nextValue;
    fastInputVersionRef.current += 1;
    logEditorDebug('editor.fastInput.changed', {
      event_type: eventType,
      fast_input_version: fastInputVersionRef.current,
      markdown_input_version: markdownInputVersionRef.current,
      fast_input: summarizeDebugText(nextValue),
      last_internal: summarizeDebugText(lastInternalValueRef.current),
    });
  };
  const getCurrentValue = () => {
    const editor = editorRef.current;
    if (editor && typeof editor.getValue === 'function') {
      try {
        return String(editor.getValue() || '');
      } catch {
        return String(lastInternalValueRef.current || pendingExternalValueRef.current || '');
      }
    }
    return String(lastInternalValueRef.current || pendingExternalValueRef.current || '');
  };
  const safeDestroy = (instance) => {
    if (!instance || typeof instance.destroy !== 'function') return;
    if (!instance.vditor || !instance.vditor.element) return;
    if (instance.isDestroyed) return;
    try {
      instance.destroy();
    } catch {
      // Ignore non-critical destroy race from async editor init.
    }
  };

  useEffect(() => {
    let disposed = false;
    let unbindFastInput = null;
    let instance = null;
    const mountID = mountIDRef.current;
    if (mountRef.current) {
      mountRef.current.style.height = resolveHeight();
    }
    const editableElement = () => (
      mountRef.current?.querySelector('.vditor-ir pre.vditor-reset, .vditor-ir .vditor-reset, [contenteditable="true"]')
    );
    const handleFastInput = (event) => {
      captureFastInputValue(event?.type || '');
    };
    const bindFastInput = () => {
      if (unbindFastInput) return;
      const editable = editableElement();
      if (!editable) return;
      editable.addEventListener('beforeinput', handleFastInput, true);
      editable.addEventListener('input', handleFastInput, true);
      editable.addEventListener('keyup', handleFastInput, true);
      editable.addEventListener('compositionend', handleFastInput, true);
      unbindFastInput = () => {
        editable.removeEventListener('beforeinput', handleFastInput, true);
        editable.removeEventListener('input', handleFastInput, true);
        editable.removeEventListener('keyup', handleFastInput, true);
        editable.removeEventListener('compositionend', handleFastInput, true);
      };
    };
    const initEditor = async () => {
      let vditorI18n = null;
      try {
        vditorI18n = await loadVditorI18n(i18n?.language);
      } catch {
        vditorI18n = window.VditorI18n || null;
      }
      if (disposed || !mountRef.current) return;
      removeStaleVditorScript('vditorLuteScript', 'Lute');
      removeStaleVditorScript('vditorIconScript');

      instance = new Vditor(mountRef.current, {
        mode: 'ir',
        value: value || '',
        height: resolveHeight(),
        cache: { enable: false },
        toolbar: [],
        counter: { enable: false },
        typewriterMode: false,
        placeholder: placeholder || '',
        image: { isPreview: true },
        lang: String(i18n?.language || '').toLowerCase().startsWith('zh') ? 'zh_CN' : 'en_US',
        i18n: vditorI18n || undefined,
        _lutePath: vditorLuteUrl,
        icon: '',
        preview: {
          mode: 'editor',
          delay: 0,
          render: {
            media: {
              enable: true,
            },
          },
          markdown: {
            codeBlockPreview: true,
            listStyle: true,
            sanitize: false,
          },
        },
        input: (currentValue) => {
          if (initializingRef.current) {
            logEditorDebug('editor.inputSkipInitializing', {
              current_value: summarizeDebugText(currentValue),
              pending_external: summarizeDebugText(pendingExternalValueRef.current),
            });
            return;
          }
          lastInternalValueRef.current = String(currentValue || '');
          markdownInputVersionRef.current = fastInputVersionRef.current;
          logEditorDebug('editor.markdownInput', {
            syncing: !!syncingRef.current,
            fast_input_version: fastInputVersionRef.current,
            markdown_input_version: markdownInputVersionRef.current,
            current_value: summarizeDebugText(currentValue),
          });
          if (syncingRef.current) return;
          if (typeof onChangeRef.current === 'function') {
            onChangeRef.current(currentValue);
          }
        },
        after: () => {
          if (disposed) {
            safeDestroy(instance);
            return;
          }
          readyRef.current = true;
          editorRef.current = instance;
          bindFastInput();
          const pendingValue = String(pendingExternalValueRef.current || '');
          if (typeof instance?.getValue === 'function' && typeof instance?.setValue === 'function') {
            if (normalize(instance.getValue()) !== normalize(pendingValue)) {
              syncingRef.current = true;
              try {
                instance.setValue(pendingValue, false);
                lastInternalValueRef.current = pendingValue;
                fastInputValueRef.current = pendingValue;
                fastInputVersionRef.current += 1;
                markdownInputVersionRef.current = fastInputVersionRef.current;
                logEditorDebug('editor.after.applyPending', {
                  fast_input_version: fastInputVersionRef.current,
                  markdown_input_version: markdownInputVersionRef.current,
                  pending_value: summarizeDebugText(pendingValue),
                });
              } finally {
                syncingRef.current = false;
              }
            }
          }
          initializingRef.current = false;
        },
      });
    };
    initEditor();
    window.setTimeout(() => {
      if (disposed) return;
      bindFastInput();
    }, 0);

    const handleEditorShortcuts = (event) => {
      const target = event.target && typeof event.target.closest === 'function'
        ? event.target
        : document.activeElement;
      const isInsideCurrentEditor = !!(
        target
        && mountRef.current
        && typeof mountRef.current.contains === 'function'
        && mountRef.current.contains(target)
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
        const core = instance?.vditor;
        if (core?.undo?.redo && typeof core.undo.redo === 'function') {
          core.undo.redo(core);
          return;
        }
      } catch {
        // Fall through to synthetic Ctrl+Y when internal redo API is unavailable.
      }
      const synthetic = new KeyboardEvent('keydown', {
        key: 'y',
        code: 'KeyY',
        ctrlKey: !event.metaKey,
        metaKey: !!event.metaKey,
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(synthetic);
    };
    window.addEventListener('keydown', handleEditorShortcuts, true);

    return () => {
      disposed = true;
      window.removeEventListener('keydown', handleEditorShortcuts, true);
      if (unbindFastInput) {
        unbindFastInput();
        unbindFastInput = null;
      }
      readyRef.current = false;
      initializingRef.current = true;
      safeDestroy(instance);
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mountRef.current) {
      mountRef.current.style.height = resolveHeight();
    }
  }, [fill, minHeight]);

  useEffect(() => {
    pendingExternalValueRef.current = String(value || '');
    externalVersionRef.current += 1;
    const currentExternalVersion = externalVersionRef.current;
    if (!readyRef.current) return;
    const editor = editorRef.current;
    if (!editor || typeof editor.getValue !== 'function' || typeof editor.setValue !== 'function') return;

    const nextValue = String(value || '');
    const normalizedNext = normalize(nextValue);
    if (normalizedNext === normalize(lastInternalValueRef.current)) return;
    if (normalize(editor.getValue()) === normalizedNext) return;

    syncingRef.current = true;
    try {
      editor.setValue(nextValue, false);
      lastInternalValueRef.current = nextValue;
      fastInputValueRef.current = nextValue;
      fastInputVersionRef.current += 1;
      markdownInputVersionRef.current = fastInputVersionRef.current;
      appliedExternalVersionRef.current = currentExternalVersion;
      logEditorDebug('editor.externalValue.applied', {
        external_version: currentExternalVersion,
        applied_external_version: appliedExternalVersionRef.current,
        fast_input_version: fastInputVersionRef.current,
        markdown_input_version: markdownInputVersionRef.current,
        next_value: summarizeDebugText(nextValue),
      });
    } finally {
      syncingRef.current = false;
    }
  }, [value]);

  useImperativeHandle(ref, () => ({
    getValue: getCurrentValue,
    getCachedValue: () => {
      captureFastInputValue('imperative.getCachedValue');
      logEditorDebug('editor.getCachedValue.markdown', {
        fast_input_version: fastInputVersionRef.current,
        markdown_input_version: markdownInputVersionRef.current,
        fast_input: summarizeDebugText(fastInputValueRef.current),
        last_internal: summarizeDebugText(lastInternalValueRef.current),
        pending_external: summarizeDebugText(pendingExternalValueRef.current),
      });
      return String(lastInternalValueRef.current ?? pendingExternalValueRef.current ?? '');
    },
    getPendingDOMValue: () => {
      captureFastInputValue('imperative.getPendingDOMValue');
      if (fastInputVersionRef.current > markdownInputVersionRef.current) {
        logEditorDebug('editor.getPendingDOMValue.fast', {
          fast_input_version: fastInputVersionRef.current,
          markdown_input_version: markdownInputVersionRef.current,
          fast_input: summarizeDebugText(fastInputValueRef.current),
          last_internal: summarizeDebugText(lastInternalValueRef.current),
        });
        return String(fastInputValueRef.current ?? '');
      }
      logEditorDebug('editor.getPendingDOMValue.none', {
        fast_input_version: fastInputVersionRef.current,
        markdown_input_version: markdownInputVersionRef.current,
        fast_input: summarizeDebugText(fastInputValueRef.current),
        last_internal: summarizeDebugText(lastInternalValueRef.current),
      });
      return '';
    },
    getDebugSnapshot: () => {
      const fastDOMValue = readFastInputValue();
      return {
        ready: !!readyRef.current,
        syncing: !!syncingRef.current,
        fast_input_version: fastInputVersionRef.current,
        markdown_input_version: markdownInputVersionRef.current,
        external_version: externalVersionRef.current,
        applied_external_version: appliedExternalVersionRef.current,
        fast_input: summarizeDebugText(fastInputValueRef.current),
        fast_dom: summarizeDebugText(fastDOMValue),
        last_internal: summarizeDebugText(lastInternalValueRef.current),
        pending_external: summarizeDebugText(pendingExternalValueRef.current),
      };
    },
    focus: () => {
      try {
        const el = mountRef.current?.querySelector('.vditor-ir pre.vditor-reset, .vditor-ir .vditor-reset');
        if (el) {
          el.focus();
        } else {
          editorRef.current?.focus?.();
        }
      } catch {
        // ignore
      }
    },
  }), []);

  return (
    <div className={`live-md-toast ${className}`}>
      <div ref={mountRef} id={mountIDRef.current} />
    </div>
  );
});

LiveMarkdownEditor.displayName = 'LiveMarkdownEditor';

export default LiveMarkdownEditor;
