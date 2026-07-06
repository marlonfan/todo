let pendingTaskMutationPersistenceCount = 0;
const listeners = new Set();

function emitPendingTaskMutationPersistenceChange() {
  const pending = hasPendingTaskMutationPersistence();
  listeners.forEach((listener) => {
    try {
      listener(pending);
    } catch (error) {
      console.error('pending task mutation persistence listener failed:', error);
    }
  });
}

function incrementPendingTaskMutationPersistence() {
  pendingTaskMutationPersistenceCount += 1;
  emitPendingTaskMutationPersistenceChange();
}

function decrementPendingTaskMutationPersistence() {
  pendingTaskMutationPersistenceCount = Math.max(0, pendingTaskMutationPersistenceCount - 1);
  emitPendingTaskMutationPersistenceChange();
}

export function hasPendingTaskMutationPersistence() {
  return pendingTaskMutationPersistenceCount > 0;
}

export function trackTaskMutationPersistence(work) {
  incrementPendingTaskMutationPersistence();
  return Promise.resolve()
    .then(work)
    .finally(() => {
      decrementPendingTaskMutationPersistence();
    });
}

export function subscribePendingTaskMutationPersistence(callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }
  listeners.add(callback);
  callback(hasPendingTaskMutationPersistence());
  return () => {
    listeners.delete(callback);
  };
}

export function installTaskMutationUnloadGuard(targetWindow = globalThis.window) {
  if (!targetWindow || typeof targetWindow.addEventListener !== 'function') {
    return () => {};
  }

  const handleBeforeUnload = (event) => {
    if (!hasPendingTaskMutationPersistence()) return undefined;
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (event) {
      event.returnValue = '';
    }
    return '';
  };

  targetWindow.addEventListener('beforeunload', handleBeforeUnload);
  return () => {
    if (typeof targetWindow.removeEventListener === 'function') {
      targetWindow.removeEventListener('beforeunload', handleBeforeUnload);
    }
  };
}

export function resetPendingTaskMutationPersistenceForTests() {
  pendingTaskMutationPersistenceCount = 0;
  listeners.clear();
}
