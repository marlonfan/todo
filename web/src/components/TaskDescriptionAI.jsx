import React, { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Bot, Check, Copy, Wand2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AI_CONFIG_REQUIRED_CODE,
  cleanGeneratedTaskDescription,
  generateTaskDescriptionDraft,
} from '../utils/aiTaskDescription';

let vditorLuteScriptPromise = null;
let vditorMarkdownRuntimePromise = null;

function ensureVditorLuteScript(vditorLuteUrl) {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return Promise.resolve();
  }
  if (window.Lute) {
    if (!document.getElementById('vditorLuteScript')) {
      const marker = document.createElement('script');
      marker.id = 'vditorLuteScript';
      marker.type = 'text/javascript';
      document.head.appendChild(marker);
    }
    return Promise.resolve();
  }
  if (vditorLuteScriptPromise) return vditorLuteScriptPromise;

  const staleScript = document.getElementById('vditorLuteScript');
  if (staleScript && !window.Lute) {
    staleScript.remove();
  }

  vditorLuteScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'vditorLuteScript';
    script.src = vditorLuteUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return vditorLuteScriptPromise;
}

async function loadVditorMarkdownRuntime() {
  if (!vditorMarkdownRuntimePromise) {
    vditorMarkdownRuntimePromise = Promise.all([
      import('vditor'),
      import('vditor/dist/index.css'),
      import('vditor/dist/js/lute/lute.min.js?url'),
    ]).then(async ([vditorModule, , luteModule]) => {
      await ensureVditorLuteScript(luteModule.default);
      return vditorModule.default;
    });
  }
  return vditorMarkdownRuntimePromise;
}

const TASK_AI_MARKDOWN_OPTIONS = {
  cdn: '',
  emojiPath: '',
  anchor: 0,
  markdown: {
    codeBlockPreview: false,
    gfmAutoLink: true,
    listStyle: true,
    mathBlockPreview: false,
    sanitize: true,
  },
};

export function TaskAIMarkdownPreview({ value, fallback }) {
  const previewRef = useRef(null);
  const renderIDRef = useRef(0);
  const frameRef = useRef(0);
  const text = cleanGeneratedTaskDescription(value).trimEnd();

  useEffect(() => {
    const node = previewRef.current;
    if (!node) return undefined;

    if (!text.trim()) {
      node.innerHTML = '';
      return undefined;
    }

    const renderID = renderIDRef.current + 1;
    renderIDRef.current = renderID;
    let cancelled = false;

    const renderMarkdown = async () => {
      try {
        const Vditor = await loadVditorMarkdownRuntime();
        const html = await Vditor.md2html(text, TASK_AI_MARKDOWN_OPTIONS);
        if (cancelled || renderIDRef.current !== renderID || !previewRef.current) return;
        previewRef.current.innerHTML = html;
        previewRef.current.classList.remove('task-ai-markdown-fallback');
        previewRef.current.classList.add('vditor-reset');
      } catch {
        if (cancelled || renderIDRef.current !== renderID || !previewRef.current) return;
        previewRef.current.textContent = text;
        previewRef.current.classList.add('task-ai-markdown-fallback');
      }
    };

    frameRef.current = window.requestAnimationFrame(renderMarkdown);

    return () => {
      cancelled = true;
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
    };
  }, [text]);

  if (!text.trim()) {
    return <p className="task-ai-empty">{fallback}</p>;
  }

  return (
    <div className="task-ai-markdown live-md-toast">
      <div ref={previewRef} className="task-ai-markdown-preview vditor-reset" />
    </div>
  );
}

export function TaskAIRawPreview({ value, fallback }) {
  const text = String(value ?? '');
  if (!text.trim()) {
    return <p className="task-ai-empty">{fallback}</p>;
  }
  return <pre className="task-ai-raw">{text}</pre>;
}

function TaskDescriptionAI({
  task,
  allTasks = [],
  categories = [],
  getCurrentDescription,
  onApply,
  disabled = false,
  compact = false,
}) {
  const { t, i18n } = useTranslation();
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const requestRef = useRef(null);
  const copiedTimerRef = useRef(null);

  useEffect(() => () => {
    requestRef.current?.abort?.();
    requestRef.current = null;
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
  }, []);

  const stopGeneration = () => {
    requestRef.current?.abort?.();
    requestRef.current = null;
    setGenerating(false);
  };

  const closePopover = () => {
    stopGeneration();
    setOpen(false);
  };

  const handleGenerate = async () => {
    if (generating) {
      stopGeneration();
      return;
    }
    if (!task || disabled) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setGenerating(true);
    setOpen(true);
    setGenerated('');
    setError('');
    setCopied(false);
    let streamedContent = '';
    try {
      const next = await generateTaskDescriptionDraft({
        task,
        currentDescription: typeof getCurrentDescription === 'function'
          ? getCurrentDescription()
          : task?.description || '',
        allTasks,
        categories,
        language: i18n.language || 'zh-CN',
        signal: controller.signal,
        onDelta: (content) => {
          streamedContent = content;
          flushSync(() => {
            setGenerated(content);
          });
        },
      });
      if (requestRef.current !== controller) return;
      setGenerated(next);
    } catch (err) {
      if (err?.name === 'AbortError') {
        if (streamedContent) {
          setGenerated(streamedContent);
        }
        return;
      }
      setError(
        err?.code === AI_CONFIG_REQUIRED_CODE
          ? t('task.aiDescriptionConfigRequired')
          : (err?.message || t('task.aiDescriptionFailed'))
      );
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setGenerating(false);
      }
    }
  };

  const handleApply = () => {
    const text = cleanGeneratedTaskDescription(generated);
    if (!text) return;
    onApply?.(text);
    setOpen(false);
  };

  const handleCopyRaw = async () => {
    const text = String(generated || '');
    if (!text.trim()) return;
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      className={`task-ai-description ${compact ? 'task-ai-description--compact' : ''}`}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!generating && (disabled || !task)}
        className="task-ai-trigger"
        title={generating ? t('task.aiDescriptionStop') : t('task.aiDescriptionTitle')}
        aria-label={generating ? t('task.aiDescriptionStop') : t('task.aiDescriptionAction')}
      >
        {generating ? <X className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
        <span>{generating ? t('task.aiDescriptionStop') : t('task.aiDescriptionAction')}</span>
      </button>

      {open && (
        <div className="task-ai-popover">
          <div className="task-ai-popover-header">
            <div className="flex min-w-0 items-center gap-2">
              <span className="task-ai-icon">
                <Bot className="h-4 w-4" />
              </span>
              <span className="truncate text-sm font-semibold text-foreground">{t('task.aiDescriptionTitle')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyRaw}
                disabled={!String(generated || '').trim()}
                className="task-ai-copy"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{copied ? t('prompt.copiedRaw') : t('prompt.copyRaw')}</span>
              </button>
              <button
                type="button"
                onClick={closePopover}
                className="task-ai-close"
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {error ? (
            <div className="task-ai-error">{error}</div>
          ) : (
            <div
              className={`task-ai-result${generating ? ' task-ai-result--streaming' : ''}`}
            >
              <TaskAIMarkdownPreview
                value={generated}
                fallback={generating ? t('task.aiDescriptionGenerating') : t('task.aiDescriptionEmpty')}
              />
            </div>
          )}

          <div className="task-ai-actions">
            <button
              type="button"
              onClick={closePopover}
              className="task-ai-action task-ai-action--ghost"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!String(generated || '').trim() || !!error}
              className="task-ai-action task-ai-action--primary"
            >
              <Check className="h-4 w-4" />
              {t('task.aiDescriptionApply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskDescriptionAI;
