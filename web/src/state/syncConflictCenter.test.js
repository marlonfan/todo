import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearSyncConflicts,
  getSyncConflicts,
  pushSyncConflict,
  removeSyncConflict,
  subscribeSyncConflicts,
} from './syncConflictCenter.js';

test('deduplicates conflicts by task id and increases count', () => {
  clearSyncConflicts();
  pushSyncConflict({
    task_id: 22,
    task_title: 'Task A',
    message: 'revision conflict',
  });
  pushSyncConflict({
    task_id: 22,
    task_title: 'Task A v2',
    message: 'revision conflict',
  });

  const list = getSyncConflicts();
  assert.equal(list.length, 1);
  assert.equal(list[0].task_id, 22);
  assert.equal(list[0].task_title, 'Task A v2');
  assert.equal(list[0].count, 2);
});

test('stores payload snapshots without external mutation', () => {
  clearSyncConflicts();
  const localPayload = { title: 'draft', priority: 1 };
  const latestTask = { id: 66, title: 'server' };
  pushSyncConflict({
    task_id: 66,
    local_payload: localPayload,
    latest_task: latestTask,
  });
  localPayload.title = 'mutated';
  latestTask.title = 'mutated';

  const list = getSyncConflicts();
  assert.equal(list.length, 1);
  assert.equal(list[0].local_payload.title, 'draft');
  assert.equal(list[0].latest_task.title, 'server');
});

test('supports remove by conflict id', () => {
  clearSyncConflicts();
  const id = pushSyncConflict({
    task_id: 33,
    task_title: 'Task B',
  });
  assert.equal(getSyncConflicts().length, 1);
  removeSyncConflict(id);
  assert.equal(getSyncConflicts().length, 0);
});

test('emits snapshot to subscribers', () => {
  clearSyncConflicts();
  const snapshots = [];
  const unsubscribe = subscribeSyncConflicts((items) => {
    snapshots.push(Array.isArray(items) ? items.length : -1);
  });
  pushSyncConflict({
    task_id: 44,
    task_title: 'Task C',
  });
  unsubscribe();
  pushSyncConflict({
    task_id: 55,
    task_title: 'Task D',
  });

  assert.deepEqual(snapshots, [0, 1]);
});
