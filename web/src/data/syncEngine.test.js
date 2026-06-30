import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeIncomingTasksWithLocal, mergeServerAndLocalTasks } from './taskMerge.js';
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

test('mergeServerAndLocalTasks keeps newer staged local edit before outbox enqueue completes', () => {
  const merged = mergeServerAndLocalTasks(
    [{ id: 14, title: 'server old title', revision: 3, updated_at: '2026-03-02T09:00:00.000Z' }],
    [{ id: 14, title: 'local new title', sync_state: 'staged', client_updated_at: '2026-03-02T10:00:00.000Z' }],
    { outboxOps: [] }
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 14);
  assert.equal(merged[0].title, 'local new title');
  assert.equal(merged[0].sync_state, 'staged');
  assert.equal(merged[0].updated_at, '2026-03-02T09:00:00.000Z');
});

test('mergeServerAndLocalTasks keeps newer pending local edit with queued mutation', () => {
  const merged = mergeServerAndLocalTasks(
    [{ id: 16, title: 'server old title', revision: 3, updated_at: '2026-03-02T09:00:00.000Z' }],
    [{ id: 16, title: 'local new title', sync_state: 'pending', client_updated_at: '2026-03-02T10:00:00.000Z' }],
    { outboxOps: [{ entity_type: 'task', entity_id: 16, op_type: 'update' }] }
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 16);
  assert.equal(merged[0].title, 'local new title');
  assert.equal(merged[0].sync_state, 'pending');
  assert.equal(merged[0].updated_at, '2026-03-02T09:00:00.000Z');
});

test('mergeIncomingTasksWithLocal keeps edit made after sync request started', () => {
  const merged = mergeIncomingTasksWithLocal(
    [{ id: 17, title: 'server old title', sync_state: 'synced', updated_at: '2026-03-02T09:00:00.000Z' }],
    [{ id: 17, title: 'local new title', sync_state: 'pending', client_updated_at: '2026-03-02T10:00:00.000Z' }],
    { preserveLocalChangedAfter: Date.parse('2026-03-02T09:30:00.000Z') }
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 17);
  assert.equal(merged[0].title, 'local new title');
  assert.equal(merged[0].sync_state, 'pending');
});

test('mergeIncomingTasksWithLocal accepts server ack for locally submitted revision', () => {
  const merged = mergeIncomingTasksWithLocal(
    [{ id: 18, title: 'server accepted title', revision: 4, sync_state: 'synced', updated_at: '2026-03-02T09:00:01.000Z' }],
    [{ id: 18, title: 'local pending title', revision: 4, sync_state: 'syncing', client_updated_at: '2026-03-02T09:00:00.000Z' }],
    { preferIncomingRevisionAtLeastLocal: true }
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 18);
  assert.equal(merged[0].title, 'server accepted title');
  assert.equal(merged[0].sync_state, 'synced');
});

test('mergeIncomingTasksWithLocal keeps newer local edit over earlier server ack', () => {
  const merged = mergeIncomingTasksWithLocal(
    [{ id: 19, title: 'server ack for earlier edit', revision: 4, sync_state: 'synced', updated_at: '2026-03-02T09:00:01.000Z' }],
    [{ id: 19, title: 'new local edit after submit', revision: 5, sync_state: 'staged', client_updated_at: '2026-03-02T09:00:03.000Z' }],
    {
      preserveLocalChangedAfter: Date.parse('2026-03-02T09:00:02.000Z'),
      preferIncomingRevisionAtLeastLocal: true,
    }
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 19);
  assert.equal(merged[0].title, 'new local edit after submit');
  assert.equal(merged[0].sync_state, 'staged');
});

test('mergeIncomingTasksWithLocal does not preserve synced local cache just because it changed after pull started', () => {
  const merged = mergeIncomingTasksWithLocal(
    [{ id: 20, title: 'server title', revision: 6, sync_state: 'synced', updated_at: '2026-03-02T09:00:02.000Z' }],
    [{ id: 20, title: 'synced local cache', revision: 5, sync_state: 'synced', client_updated_at: '2026-03-02T09:00:03.000Z' }],
    { preserveLocalChangedAfter: Date.parse('2026-03-02T09:00:01.000Z') }
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 20);
  assert.equal(merged[0].title, 'server title');
  assert.equal(merged[0].revision, 6);
});

test('mergeServerAndLocalTasks accepts server over older staged local edit', () => {
  const merged = mergeServerAndLocalTasks(
    [{ id: 15, title: 'server new title', revision: 4, updated_at: '2026-03-02T11:00:00.000Z' }],
    [{ id: 15, title: 'local old title', sync_state: 'staged', client_updated_at: '2026-03-02T10:00:00.000Z' }],
    { outboxOps: [] }
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 15);
  assert.equal(merged[0].title, 'server new title');
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
