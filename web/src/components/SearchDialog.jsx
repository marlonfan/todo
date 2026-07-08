import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconSearch } from './icons/TaskIcons';
import { useFocusTrap } from '../hooks/useFocusTrap';

function SearchDialog({ open, initialQuery, onClose }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState(initialQuery || '');
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const requestClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setKeyword(initialQuery || '');
  }, [initialQuery, open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleEscape = (event) => {
      const isEscape = event.key === 'Escape' || event.key === 'Esc' || event.code === 'Escape' || event.keyCode === 27;
      if (isEscape) {
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      }
    };
    window.addEventListener('keydown', handleEscape, true);
    window.addEventListener('keyup', handleEscape, true);
    return () => {
      window.removeEventListener('keydown', handleEscape, true);
      window.removeEventListener('keyup', handleEscape, true);
    };
  }, [open, requestClose]);

  useFocusTrap(open, dialogRef, { initialFocusRef: inputRef });

  if (!open) return null;

  const submit = () => {
    const query = keyword.trim();
    if (!query) return;
    navigate(`/search?q=${encodeURIComponent(query)}`);
    requestClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/35 p-3 pt-14 md:p-4 md:pt-20" onClick={requestClose}>
      <div
        ref={dialogRef}
        className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={t('task.searchTasks')}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDownCapture={(e) => {
          const isEscape = e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape' || e.keyCode === 27;
          if (!isEscape) return;
          e.preventDefault();
          e.stopPropagation();
          requestClose();
        }}
        onKeyUpCapture={(e) => {
          const isEscape = e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape' || e.keyCode === 27;
          if (!isEscape) return;
          e.preventDefault();
          e.stopPropagation();
          requestClose();
        }}
      >
        <div className="border-b border-border px-3 py-2.5 md:px-4 md:py-3">
          <h3 className="text-sm font-semibold text-foreground md:text-base">{t('task.searchTasks')}</h3>
        </div>
        <div className="space-y-3 p-3 md:p-4">
          <div className="md-input-row">
            <IconSearch className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              ref={inputRef}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                const isEscape = e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape' || e.keyCode === 27;
                if (isEscape) {
                  e.preventDefault();
                  e.stopPropagation();
                  requestClose();
                  return;
                }
                if (e.key === 'Enter') submit();
              }}
              onKeyUp={(e) => {
                const isEscape = e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape' || e.keyCode === 27;
                if (!isEscape) return;
                e.preventDefault();
                e.stopPropagation();
                requestClose();
              }}
              placeholder={t('task.searchPlaceholder')}
              className="w-full border-none bg-transparent text-xs outline-none placeholder:text-muted-foreground sm:text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('task.searchHint')}</p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={requestClose}
              className="btn-secondary h-9 rounded-md px-3"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!keyword.trim()}
              className="btn-primary h-9 rounded-md px-4"
            >
              {t('common.search')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SearchDialog;
