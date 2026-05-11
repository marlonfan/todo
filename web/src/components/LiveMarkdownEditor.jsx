import React, { useEffect, useImperativeHandle, useRef } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';

const LiveMarkdownEditor = React.forwardRef(function LiveMarkdownEditor({
  value,
  onChange,
  onSaveShortcut,
  placeholder,
  minHeight = 220,
  fill = false,
  className = '',
}, ref) {
  const mountRef = useRef(null);
  const editorRef = useRef(null);
  const readyRef = useRef(false);
  const syncingRef = useRef(false);
  const lastInternalValueRef = useRef(String(value || ''));
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
    const mountID = mountIDRef.current;
    if (mountRef.current) {
      mountRef.current.style.height = resolveHeight();
    }
    const instance = new Vditor(mountID, {
      mode: 'ir',
      value: value || '',
      height: resolveHeight(),
      cache: { enable: false },
      toolbar: [],
      counter: { enable: false },
      typewriterMode: false,
      placeholder: placeholder || '',
      image: { isPreview: true },
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
        lastInternalValueRef.current = String(currentValue || '');
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
        const pendingValue = String(pendingExternalValueRef.current || '');
        if (typeof instance.getValue === 'function' && typeof instance.setValue === 'function') {
          if (normalize(instance.getValue()) !== normalize(pendingValue)) {
            syncingRef.current = true;
            try {
              instance.setValue(pendingValue, false);
              lastInternalValueRef.current = pendingValue;
            } finally {
              syncingRef.current = false;
            }
          }
        }
      },
    });

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
      readyRef.current = false;
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
      appliedExternalVersionRef.current = currentExternalVersion;
    } finally {
      syncingRef.current = false;
    }
  }, [value]);

  useImperativeHandle(ref, () => ({
    getValue: getCurrentValue,
    getCachedValue: () => String(lastInternalValueRef.current || pendingExternalValueRef.current || ''),
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
