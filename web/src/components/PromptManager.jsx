import React, { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bot, Check, Copy, Edit3, FileText, MessageSquareText, Plus, Search, Send, Square, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { promptsAPI } from '../api/client';
import { usePromptsQuery } from '../query/hooks';
import { queryKeys } from '../query/keys';
import { AI_CONFIG_REQUIRED_CODE, generateAIResponse } from '../utils/aiTaskDescription';
import { attachTransientScrollbar } from '../hooks/useTransientScrollbars';
import { TaskAIMarkdownPreview } from './TaskDescriptionAI';

const EMPTY_FORM = {
  title: '',
  content: '',
};

function normalizePromptPayload(value) {
  return {
    title: String(value?.title || '').trim(),
    content: String(value?.content || '').trim(),
  };
}

function formatUpdatedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function PromptManager() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: prompts = [], isLoading } = usePromptsQuery();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [askPrompt, setAskPrompt] = useState(null);
  const [askInput, setAskInput] = useState('');
  const [askOutput, setAskOutput] = useState('');
  const [askError, setAskError] = useState('');
  const [asking, setAsking] = useState(false);
  const [askCopied, setAskCopied] = useState(false);
  const askControllerRef = useRef(null);
  const outputScrollCleanupRef = useRef(null);
  const askCopiedTimerRef = useRef(null);

  const filteredPrompts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return prompts;
    return prompts.filter((prompt) => {
      const haystack = `${prompt?.title || ''}\n${prompt?.content || ''}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [prompts, query]);

  useEffect(() => () => {
    askControllerRef.current?.abort?.();
    outputScrollCleanupRef.current?.();
    if (askCopiedTimerRef.current) window.clearTimeout(askCopiedTimerRef.current);
  }, []);

  const bindOutputScroll = (node) => {
    outputScrollCleanupRef.current?.();
    outputScrollCleanupRef.current = node ? attachTransientScrollbar(node) : null;
  };

  const updatePromptsCache = (updater) => {
    queryClient.setQueryData(queryKeys.prompts.all, (prev) => {
      const current = Array.isArray(prev) ? prev : [];
      return updater(current);
    });
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingPrompt(null);
    setError('');
  };

  const openCreateDialog = () => {
    setForm(EMPTY_FORM);
    setEditingPrompt(null);
    setError('');
    setFormDialogOpen(true);
  };

  const closeFormDialog = () => {
    if (submitting) return;
    setFormDialogOpen(false);
    resetForm();
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const payload = normalizePromptPayload(form);
    if (!payload.title || !payload.content) {
      setError(t('prompt.formRequired'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = editingPrompt
        ? await promptsAPI.update(editingPrompt.id, payload)
        : await promptsAPI.create(payload);
      const saved = res?.data;
      if (saved?.id) {
        updatePromptsCache((current) => {
          const withoutSaved = current.filter((item) => item.id !== saved.id);
          return [saved, ...withoutSaved];
        });
      }
      setFormDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.all });
    } catch (err) {
      setError(err.response?.data?.error || t('prompt.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (prompt) => {
    setEditingPrompt(prompt);
    setForm({
      title: prompt?.title || '',
      content: prompt?.content || '',
    });
    setError('');
    setFormDialogOpen(true);
  };

  const handleDelete = async (prompt) => {
    if (!confirm(t('prompt.deleteConfirm'))) return;
    setSubmitting(true);
    setError('');
    const previous = queryClient.getQueryData(queryKeys.prompts.all);
    updatePromptsCache((current) => current.filter((item) => item.id !== prompt.id));
    try {
      await promptsAPI.delete(prompt.id);
      if (editingPrompt?.id === prompt.id) {
        setFormDialogOpen(false);
        resetForm();
      }
      if (askPrompt?.id === prompt.id) closeAskDialog();
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.all });
    } catch (err) {
      queryClient.setQueryData(queryKeys.prompts.all, previous);
      setError(err.response?.data?.error || t('prompt.deleteFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const openAskDialog = (prompt) => {
    askControllerRef.current?.abort?.();
    askControllerRef.current = null;
    setAskPrompt(prompt);
    setAskInput('');
    setAskOutput('');
    setAskError('');
    setAskCopied(false);
    setAsking(false);
  };

  const closeAskDialog = () => {
    askControllerRef.current?.abort?.();
    askControllerRef.current = null;
    setAsking(false);
    setAskPrompt(null);
    setAskInput('');
    setAskOutput('');
    setAskError('');
    setAskCopied(false);
  };

  const stopAsk = () => {
    askControllerRef.current?.abort?.();
    askControllerRef.current = null;
    setAsking(false);
  };

  const copyAskOutput = async () => {
    const text = String(askOutput || '');
    if (!text.trim()) return;
    await navigator.clipboard?.writeText(text);
    setAskCopied(true);
    if (askCopiedTimerRef.current) window.clearTimeout(askCopiedTimerRef.current);
    askCopiedTimerRef.current = window.setTimeout(() => setAskCopied(false), 1600);
  };

  const handleAsk = async (event) => {
    event.preventDefault();
    if (!askPrompt || asking) return;
    const input = askInput.trim();
    if (!input) {
      setAskError(t('prompt.askInputRequired'));
      return;
    }

    const controller = new AbortController();
    askControllerRef.current = controller;
    setAsking(true);
    setAskOutput('');
    setAskError('');
    let streamedContent = '';

    try {
      const content = await generateAIResponse({
        systemPrompt: askPrompt.content,
        userInput: input,
        signal: controller.signal,
        onDelta: (next) => {
          streamedContent = next;
          flushSync(() => {
            setAskOutput(next);
          });
        },
      });
      if (askControllerRef.current !== controller) return;
      setAskOutput(content);
    } catch (err) {
      if (err?.name === 'AbortError') {
        if (streamedContent) setAskOutput(streamedContent);
        return;
      }
      setAskError(
        err?.code === AI_CONFIG_REQUIRED_CODE
          ? t('prompt.aiConfigRequired')
          : (err?.message || t('prompt.askFailed'))
      );
    } finally {
      if (askControllerRef.current === controller) {
        askControllerRef.current = null;
        setAsking(false);
      }
    }
  };

  return (
    <div className="prompt-page h-full overflow-auto bg-white">
      <div className="prompt-page-header">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">{t('nav.prompts')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('prompt.pageHint')}</p>
          </div>
          <div className="prompt-search">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="prompt-search-input"
              placeholder={t('prompt.searchPlaceholder')}
              aria-label={t('prompt.searchPlaceholder')}
            />
          </div>
        </div>
      </div>

      <div className="p-5 pb-24 md:p-6 md:pb-24">
        <section className="min-w-0">
          {error && !formDialogOpen && (
            <div className="prompt-status prompt-status--error">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="prompt-status">
              {t('common.loading')}
            </div>
          )}

          {!isLoading && prompts.length === 0 && (
            <div className="prompt-empty">
              <FileText className="mx-auto h-10 w-10 text-blue-400" />
              <div className="mt-3 text-base font-semibold text-slate-800">{t('prompt.noPrompts')}</div>
              <div className="mt-1 text-sm text-slate-500">{t('prompt.noPromptsHint')}</div>
            </div>
          )}

          {!isLoading && prompts.length > 0 && filteredPrompts.length === 0 && (
            <div className="prompt-empty prompt-empty--compact">
              {t('prompt.noSearchResults')}
            </div>
          )}

          <div className="prompt-grid">
            {filteredPrompts.map((prompt) => (
              <article key={prompt.id} className="prompt-card">
                <div className="prompt-card-head">
                  <span className="prompt-card-icon">
                    <Bot className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="prompt-card-title">{prompt.title}</h3>
                    {formatUpdatedAt(prompt.updated_at) && (
                      <div className="prompt-card-meta">
                        {t('prompt.updatedAt', { time: formatUpdatedAt(prompt.updated_at) })}
                      </div>
                    )}
                  </div>
                </div>

                <p className="prompt-card-content">
                  {prompt.content}
                </p>

                <div className="prompt-card-actions">
                  <button
                    type="button"
                    onClick={() => openAskDialog(prompt)}
                    className="prompt-card-ask"
                  >
                    <MessageSquareText className="h-4 w-4" />
                    {t('prompt.askAction')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(prompt)}
                    className="prompt-card-tool"
                    aria-label={t('common.edit')}
                    title={t('common.edit')}
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(prompt)}
                    className="prompt-card-tool prompt-card-tool--danger"
                    aria-label={t('common.delete')}
                    title={t('common.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <button
        type="button"
        onClick={openCreateDialog}
        className="prompt-create-fab"
        aria-label={t('prompt.newPrompt')}
        title={t('prompt.newPrompt')}
      >
        <Plus className="prompt-create-fab-icon" />
      </button>

      {formDialogOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-3"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeFormDialog();
          }}
        >
          <form
            onSubmit={handleSave}
            className="prompt-editor-dialog"
          >
            <div className="prompt-dialog-header">
              <div className="flex min-w-0 items-center gap-2">
                <span className="prompt-dialog-icon">
                  {editingPrompt ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {editingPrompt ? t('prompt.editPrompt') : t('prompt.newPrompt')}
                  </div>
                  <div className="text-xs text-slate-500">{t('prompt.formDialogHint')}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeFormDialog}
                disabled={submitting}
                className="prompt-dialog-close"
                aria-label={t('common.close')}
                title={t('common.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="prompt-dialog-body">
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="prompt-field prompt-field--title">
                <label className="prompt-field-label" htmlFor="prompt-title">{t('prompt.title')}</label>
                <input
                  id="prompt-title"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="prompt-title-input"
                  placeholder={t('prompt.titlePlaceholder')}
                  autoFocus
                />
              </div>

              <div className="prompt-field prompt-field--content">
                <label className="prompt-field-label" htmlFor="prompt-content">{t('prompt.content')}</label>
                <textarea
                  id="prompt-content"
                  value={form.content}
                  onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                  className="prompt-content-input"
                  placeholder={t('prompt.contentPlaceholder')}
                />
              </div>
            </div>

            <div className="prompt-dialog-footer">
              <button
                type="button"
                onClick={closeFormDialog}
                disabled={submitting}
                className="prompt-dialog-button prompt-dialog-button--ghost"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="prompt-dialog-button prompt-dialog-button--primary"
              >
                <Check className="h-4 w-4" />
                {editingPrompt ? t('common.save') : t('common.add')}
              </button>
            </div>
          </form>
        </div>
      )}

      {askPrompt && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-3"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !asking) closeAskDialog();
          }}
        >
          <div className="prompt-ask-dialog">
            <div className="prompt-dialog-header">
              <div className="flex min-w-0 items-center gap-2">
                <span className="prompt-dialog-icon">
                  <MessageSquareText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{askPrompt.title}</div>
                  <div className="text-xs text-slate-500">{t('prompt.askDialogHint')}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAskDialog}
                disabled={asking}
                className="prompt-dialog-close"
                aria-label={t('common.close')}
                title={t('common.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAsk} className="prompt-ask-layout">
              <div className="prompt-ask-input-panel">
                <label className="prompt-field-label" htmlFor="prompt-ask-input">{t('prompt.askInput')}</label>
                <textarea
                  id="prompt-ask-input"
                  value={askInput}
                  onChange={(event) => setAskInput(event.target.value)}
                  className="prompt-ask-textarea"
                  placeholder={t('prompt.askInputPlaceholder')}
                  disabled={asking}
                />
                <div className="mt-3 flex items-center gap-2">
                  {asking ? (
                    <button
                      type="button"
                      onClick={stopAsk}
                      className="prompt-dialog-button prompt-dialog-button--ghost"
                    >
                      <Square className="h-4 w-4" />
                      {t('prompt.stopAsk')}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="prompt-dialog-button prompt-dialog-button--primary"
                      disabled={!askInput.trim()}
                    >
                      <Send className="h-4 w-4" />
                      {t('prompt.sendAsk')}
                    </button>
                  )}
                </div>
                {askError && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {askError}
                  </div>
                )}
              </div>

              <div className="prompt-output-panel">
                <div className="prompt-output-header">
                  <span className="text-sm font-semibold text-slate-800">{t('prompt.output')}</span>
                  <div className="flex items-center gap-2">
                    {asking && (
                      <span className="text-xs font-medium text-blue-600">{t('prompt.streaming')}</span>
                    )}
                    <button
                      type="button"
                      onClick={copyAskOutput}
                      disabled={!String(askOutput || '').trim()}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {askCopied ? t('prompt.copiedRaw') : t('prompt.copyRaw')}
                    </button>
                  </div>
                </div>
                <div
                  ref={bindOutputScroll}
                  className={`prompt-output-body editor-scrollbar-overlay${asking ? ' task-ai-result--streaming' : ''}`}
                >
                  <TaskAIMarkdownPreview
                    value={askOutput}
                    fallback={asking ? t('prompt.asking') : t('prompt.outputEmpty')}
                  />
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PromptManager;
