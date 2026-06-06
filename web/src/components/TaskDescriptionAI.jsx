import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Check, Wand2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AI_CONFIG_REQUIRED_CODE,
  cleanGeneratedTaskDescription,
  generateTaskDescriptionDraft,
} from '../utils/aiTaskDescription';
import { attachTransientScrollbar } from '../hooks/useTransientScrollbars';

function renderInlineMarkdown(text, keyPrefix) {
  const source = String(text || '');
  const nodes = [];
  const tokenPattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__)/g;
  let lastIndex = 0;
  let index = 0;
  let match = tokenPattern.exec(source);

  while (match) {
    if (match.index > lastIndex) {
      nodes.push(source.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(
        <code key={`${keyPrefix}-code-${index}`} className="task-ai-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${index}`}>
          {token.slice(2, -2)}
        </strong>
      );
    }

    lastIndex = match.index + token.length;
    index += 1;
    match = tokenPattern.exec(source);
  }

  if (lastIndex < source.length) {
    nodes.push(source.slice(lastIndex));
  }

  return nodes;
}

function flushListBlock(blocks, pendingList) {
  if (!pendingList) return null;
  const ListTag = pendingList.ordered ? 'ol' : 'ul';
  blocks.push(
    <ListTag key={`list-${blocks.length}`} className="task-ai-list">
      {pendingList.items.map((item, index) => (
        <li key={`item-${index}`} className={item.checked !== null ? 'task-ai-check-item' : ''}>
          {item.checked !== null && (
            <span className={`task-ai-check ${item.checked ? 'task-ai-check--checked' : ''}`} aria-hidden="true">
              {item.checked ? <Check className="h-3 w-3" /> : null}
            </span>
          )}
          <span>{renderInlineMarkdown(item.text, `list-${blocks.length}-${index}`)}</span>
        </li>
      ))}
    </ListTag>
  );
  return null;
}

function TaskAIMarkdownPreview({ value, fallback }) {
  const text = cleanGeneratedTaskDescription(value).trimEnd();
  if (!text.trim()) {
    return <p className="task-ai-empty">{fallback}</p>;
  }

  const blocks = [];
  const paragraphLines = [];
  let pendingList = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const paragraph = paragraphLines.join(' ');
    blocks.push(
      <p key={`p-${blocks.length}`}>
        {renderInlineMarkdown(paragraph, `p-${blocks.length}`)}
      </p>
    );
    paragraphLines.length = 0;
  };

  const closeList = () => {
    pendingList = flushListBlock(blocks, pendingList);
  };

  text.replace(/\r\n/g, '\n').split('\n').forEach((rawLine) => {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      closeList();
      return;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(heading[1].length, 4);
      const HeadingTag = `h${level + 2}`;
      blocks.push(
        <HeadingTag key={`h-${blocks.length}`}>
          {renderInlineMarkdown(heading[2], `h-${blocks.length}`)}
        </HeadingTag>
      );
      return;
    }

    if (/^([-*_])\s*\1\s*\1\s*$/.test(trimmed)) {
      flushParagraph();
      closeList();
      blocks.push(<hr key={`hr-${blocks.length}`} />);
      return;
    }

    const quote = /^>\s*(.+)$/.exec(trimmed);
    if (quote) {
      flushParagraph();
      closeList();
      blocks.push(
        <blockquote key={`quote-${blocks.length}`}>
          {renderInlineMarkdown(quote[1], `quote-${blocks.length}`)}
        </blockquote>
      );
      return;
    }

    const taskItem = /^[-*+]\s+\[([ xX])\]\s+(.+)$/.exec(trimmed);
    const unorderedItem = /^[-*+]\s+(.+)$/.exec(trimmed);
    const orderedItem = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (taskItem || unorderedItem || orderedItem) {
      flushParagraph();
      const ordered = !!orderedItem;
      if (!pendingList || pendingList.ordered !== ordered) {
        closeList();
        pendingList = { ordered, items: [] };
      }
      pendingList.items.push({
        checked: taskItem ? taskItem[1].toLowerCase() === 'x' : null,
        text: taskItem ? taskItem[2] : (orderedItem ? orderedItem[1] : unorderedItem[1]),
      });
      return;
    }

    closeList();
    paragraphLines.push(trimmed);
  });

  flushParagraph();
  closeList();

  return <div className="task-ai-markdown">{blocks}</div>;
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
  const requestRef = useRef(null);
  const resultScrollCleanupRef = useRef(null);

  const bindResultScroll = useCallback((node) => {
    resultScrollCleanupRef.current?.();
    resultScrollCleanupRef.current = node ? attachTransientScrollbar(node) : null;
  }, []);

  useEffect(() => () => {
    requestRef.current?.abort?.();
    requestRef.current = null;
    resultScrollCleanupRef.current?.();
    resultScrollCleanupRef.current = null;
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
          setGenerated(content);
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
              <span className="truncate text-sm font-semibold text-slate-900">{t('task.aiDescriptionTitle')}</span>
            </div>
            <button
              type="button"
              onClick={closePopover}
              className="task-ai-close"
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {error ? (
            <div className="task-ai-error">{error}</div>
          ) : (
            <div
              ref={bindResultScroll}
              className={`task-ai-result editor-scrollbar-overlay${generating ? ' task-ai-result--streaming' : ''}`}
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
