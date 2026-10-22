import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { getTaskDraftPersistence } from '../data/taskDraftPersistence.js';
import { createTaskLocal, updateTaskLocal } from '../data/taskMutations';
import { onTaskIDRemapped } from '../data/syncEngine';

export function useTaskDraftPersistence(queryClient) {
  const persistence = useMemo(() => {
    let accountID = '';
    let storage = null;
    try {
      storage = window.localStorage;
      accountID = JSON.parse(storage.getItem('user') || '{}')?.id || '';
    } catch { /* Editing still works without Web Storage. */ }
    return getTaskDraftPersistence(accountID, {
      storage, write: (taskID, payload, options) => options.taskCreation
        ? createTaskLocal(queryClient, payload, { ...options, tempTaskID: taskID })
        : updateTaskLocal(queryClient, taskID, payload, options),
    });
  }, [queryClient]);
  const entries = useSyncExternalStore(persistence.subscribe, persistence.getSnapshot);

  useEffect(() => onTaskIDRemapped(({ fromID, toID }) => {
    persistence.remapTaskID(fromID, toID);
  }), [persistence]);

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!persistence.getSnapshot().length) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [persistence]);

  return {
    persistDraft: persistence.save,
    retryDrafts: persistence.retry,
    recoveryEntries: entries,
    failedDrafts: entries.filter((entry) => entry.status === 'failed' || entry.status === 'recovered'),
  };
}
