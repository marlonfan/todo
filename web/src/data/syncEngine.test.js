import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeServerAndLocalTasks } from './taskMerge.js';
import { isPayloadAlreadyAppliedOnLatest } from './conflictApplyCheck.js';

test('mergeServerAndLocalTasks keeps unsynced local task when server does not have it and outbox has mutation', () => {
  const merged = mergeServerAndLocalTasks(
    [],
    [{ id: 10, title: 'local', sync_state: 'pending', client_updated_at: '2026-03-02T08:00:00.000Z' }],
    {
      outboxOps: [{ entity_type: 'task', entity_id: 10, op_type: 'update' }],
    }
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 10);
});

test('mergeServerAndLocalTasks discards orphan pending local draft without outbox mutation', () => {
  const merged = mergeServerAndLocalTasks(
    [{ id: 12, title: 'server', revision: 3, updated_at: '2026-03-02T09:00:00.000Z' }],
    [{ id: 12, title: 'discarded local draft', sync_state: 'pending', client_updated_at: '2026-03-02T10:00:00.000Z' }],
    { outboxOps: [] }
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 12);
  assert.equal(merged[0].title, 'server');
  assert.equal(merged[0].sync_state, 'synced');
});

test('mergeServerAndLocalTasks drops orphan pending local task missing on server', () => {
  const merged = mergeServerAndLocalTasks(
    [],
    [{ id: 13, title: 'orphan local draft', sync_state: 'pending', client_updated_at: '2026-03-02T10:00:00.000Z' }],
    { outboxOps: [] }
  );

  assert.equal(merged.length, 0);
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

test('isPayloadAlreadyAppliedOnLatest returns true when latest already contains payload', () => {
  const ok = isPayloadAlreadyAppliedOnLatest(
    {
      op_type: 'update',
      payload: {
        title: 'B',
        description: 'hello',
        priority: 1,
        category_ids: [2, 1],
      },
    },
    {
      id: 1,
      title: 'B',
      description: 'hello',
      priority: 1,
      categories: [{ id: 1 }, { id: 2 }],
    },
  );
  assert.equal(ok, true);
});

test('isPayloadAlreadyAppliedOnLatest returns false for occurrence-scoped payload', () => {
  const ok = isPayloadAlreadyAppliedOnLatest(
    {
      op_type: 'update',
      payload: {
        title: 'B',
        instance_id: '12_20260322',
      },
    },
    {
      id: 12,
      title: 'B',
    },
  );
  assert.equal(ok, false);
});
