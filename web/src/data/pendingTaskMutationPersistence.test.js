import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPendingTaskMutationPersistence,
  installTaskMutationUnloadGuard,
  resetPendingTaskMutationPersistenceForTests,
  trackTaskMutationPersistence,
} from './pendingTaskMutationPersistence.js';

function createFakeWindow() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) {
        listeners.delete(type);
      }
    },
    dispatch(type, event) {
      const listener = listeners.get(type);
      return typeof listener === 'function' ? listener(event) : undefined;
    },
  };
}

test('beforeunload is blocked while task mutation persistence is pending', async () => {
  resetPendingTaskMutationPersistenceForTests();
  const fakeWindow = createFakeWindow();
  const uninstall = installTaskMutationUnloadGuard(fakeWindow);

  let resolveWork;
  const workFinished = trackTaskMutationPersistence(() => new Promise((resolve) => {
    resolveWork = resolve;
  }));
  await Promise.resolve();

  assert.equal(hasPendingTaskMutationPersistence(), true);

  let prevented = false;
  const event = {
    returnValue: undefined,
    preventDefault() {
      prevented = true;
    },
  };
  const result = fakeWindow.dispatch('beforeunload', event);

  assert.equal(prevented, true);
  assert.equal(event.returnValue, '');
  assert.equal(result, '');

  resolveWork();
  await workFinished;

  prevented = false;
  event.returnValue = undefined;
  const doneResult = fakeWindow.dispatch('beforeunload', event);
  assert.equal(prevented, false);
  assert.equal(event.returnValue, undefined);
  assert.equal(doneResult, undefined);

  uninstall();
  resetPendingTaskMutationPersistenceForTests();
});
