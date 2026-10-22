import React from 'react';
import { useTranslation } from 'react-i18next';

export default function TaskDraftRecoveryNotice({ entries, busy, onRetry }) {
  const { t } = useTranslation();
  if (!entries.length) return null;
  const backedUp = entries.every((entry) => entry.backupSaved);
  return (
    <div role="alert" className="shrink-0 border-b border-destructive/30 px-4 py-3 text-sm" data-testid="task-draft-recovery">
      <p className="font-medium text-destructive">{t('task.draftRecoveryTitle', { count: entries.length })}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t(backedUp ? 'task.draftRecoveryBackedUp' : 'task.draftRecoveryMemoryOnly')}</p>
      <button type="button" className="btn-secondary mt-2" disabled={busy} onClick={onRetry}>
        {t('common.retry')}
      </button>
    </div>
  );
}
