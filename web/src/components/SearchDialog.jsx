import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconSearch } from './icons/TaskIcons';

function SearchDialog({ open, initialQuery, onClose }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState(initialQuery || '');

  useEffect(() => {
    if (!open) return;
    setKeyword(initialQuery || '');
  }, [initialQuery, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const submit = () => {
    const query = keyword.trim();
    if (!query) return;
    navigate(`/search?q=${encodeURIComponent(query)}`);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/40 p-3 pt-14 md:p-4 md:pt-20" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-3 py-2.5 md:px-4 md:py-3">
          <h3 className="text-sm font-semibold text-slate-800 md:text-base">{t('task.searchTasks')}</h3>
        </div>
        <div className="space-y-3 p-3 md:p-4">
          <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
            <IconSearch className="h-3.5 w-3.5 text-slate-400" />
            <input
              autoFocus
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder={t('task.searchPlaceholder')}
              className="w-full border-none bg-transparent text-xs outline-none placeholder:text-slate-400 sm:text-sm"
            />
          </div>
          <p className="text-xs text-slate-500">{t('task.searchHint')}</p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-100"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!keyword.trim()}
              className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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
