import React, { useEffect, useRef } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';

function LiveMarkdownEditor({
  value,
  onChange,
  placeholder,
  minHeight = 220,
  fill = false,
  className = '',
}) {
  const mountRef = useRef(null);
  const editorRef = useRef(null);
  const readyRef = useRef(false);
  const syncingRef = useRef(false);
  const lastInternalValueRef = useRef(String(value || ''));
  const pendingExternalValueRef = useRef(String(value || ''));
  const externalVersionRef = useRef(0);
  const appliedExternalVersionRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const mountIDRef = useRef(`vditor-${Math.random().toString(36).slice(2, 11)}`);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const resolveHeight = () => (fill ? '100%' : `${minHeight}px`);
  const normalize = (text) => String(text || '').replace(/\r\n/g, '\n').replace(/\n+$/g, '');

  useEffect(() => {
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

    const handleRedoAlias = (event) => {
      const key = String(event.key || '').toLowerCase();
      const isRedoAlias = event.ctrlKey && event.shiftKey && key === 'z';
      if (!isRedoAlias) return;
      const target = event.target;
      if (!target || typeof target.closest !== 'function' || !target.closest('.vditor')) return;
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
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(synthetic);
    };
    window.addEventListener('keydown', handleRedoAlias, true);

    return () => {
      window.removeEventListener('keydown', handleRedoAlias, true);
      readyRef.current = false;
      instance.destroy();
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

  return (
    <div className={`live-md-toast ${className}`}>
      <div ref={mountRef} id={mountIDRef.current} />
    </div>
  );
}

export default LiveMarkdownEditor;
