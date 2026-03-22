import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeServerAndLocalTasks } from './taskMerge.js';

test('mergeServerAndLocalTasks keeps unsynced local task when server does not have it', () => {
  const merged = mergeServerAndLocalTasks(
    [],
    [{ id: 10, title: 'local', sync_state: 'pending', client_updated_at: '2026-03-02T08:00:00.000Z' }]
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 10);
});

test('mergeServerAndLocalTasks filters server task that is pending delete in outbox', () => {
  const merged = mergeServerAndLocalTasks(
    [{ id: 11, title: 'server task', updated_at: '2026-03-02T08:00:00.000Z' }],
    [],
    { pendingDeleteIDs: new Set([11]) }
  );

  assert.equal(merged.length, 0);
});

test('mergeServerAndLocalTasks drops stale synced local task that no longer exists on server', () => {
  const merged = mergeServerAndLocalTasks(
    [{ id: 21, title: 'server task', updated_at: '2026-03-12T01:00:00.000Z' }],
    [
      { id: 21, title: 'server task local', sync_state: 'synced', updated_at: '2026-03-12T01:00:00.000Z' },
      { id: 22, title: 'ghost local', sync_state: 'synced', updated_at: '2026-03-10T01:00:00.000Z' },
    ],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 21);
});
