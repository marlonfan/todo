import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearSyncFailures,
  getSyncFailures,
  pushSyncFailure,
  removeSyncFailure,
} from './syncFailureCenter.js';

test('keeps the server validation message visible by task', () => {
  clearSyncFailures();
  pushSyncFailure({
    task_id: 71,
    task_title: '准备 Oken 资料',
    message: 'explicit reminder time must be in the future',
  });

  const failures = getSyncFailures();
  assert.equal(failures.length, 1);
  assert.equal(failures[0].task_id, 71);
  assert.equal(failures[0].message, 'explicit reminder time must be in the future');

  removeSyncFailure(failures[0].id);
  assert.equal(getSyncFailures().length, 0);
});
