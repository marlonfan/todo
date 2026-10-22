import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskDraftPersistence, TASK_DRAFT_RECOVERY_PREFIX } from './taskDraftPersistence.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
function fixture(write, storage = memoryStorage(), account = 1) {
  const storageKey = TASK_DRAFT_RECOVERY_PREFIX + account;
  return { storage, storageKey, drafts: createTaskDraftPersistence({ write, storage, storageKey }) };
}

test('rejected persistence retains a backup across a reload and retry waits for the outbox', async () => {
  const { drafts, storage, storageKey } = fixture(async () => { throw new Error('quota'); });
  await assert.rejects(drafts.save(7, { title: 'Recover this' }), /quota/);
  assert.equal(drafts.getSnapshot()[0].status, 'failed');
  assert.equal(drafts.getSnapshot()[0].backupSaved, true);
  let release;
  const restored = createTaskDraftPersistence({ storage, storageKey, write: async (_id, payload, options) => {
    assert.equal(payload.title, 'Recover this');
    assert.equal(options.awaitPersist, true);
    assert.equal(options.localOnly, false);
    await new Promise((resolve) => { release = resolve; });
  } });
  assert.equal(restored.getSnapshot()[0].status, 'recovered');
  const retry = restored.retry();
  await Promise.resolve();
  assert.equal(restored.getSnapshot().length, 1);
  release();
  const results = await retry;
  assert.equal(results[0].status, 'fulfilled');
  assert.deepEqual(restored.getSnapshot(), []);
  assert.equal(storage.getItem(storageKey), null);
});

test('a staged local save is retained until the submitted payload is durably queued', async () => {
  const { drafts, storage, storageKey } = fixture(async () => ({}));
  await drafts.save(7, { title: 'Staged' }, { localOnly: true });
  assert.equal(drafts.getSnapshot()[0].status, 'staged');
  assert.ok(storage.getItem(storageKey));
  await drafts.save(7, { title: 'Staged' }, { localOnly: false });
  assert.deepEqual(drafts.getSnapshot(), []);
});

test('older failed work cannot remove or mark a newer draft as failed', async () => {
  let failOlder;
  const calls = [];
  const { drafts } = fixture(async (_id, payload) => {
    calls.push(payload.title);
    if (payload.title === 'Older') await new Promise((_resolve, reject) => { failOlder = reject; });
    return payload;
  });
  const first = drafts.save(7, { title: 'Older' });
  const failed = assert.rejects(first, /failed/);
  await Promise.resolve();
  const nextPayload = { title: 'Latest' };
  const second = drafts.save(7, nextPayload, { localOnly: true });
  nextPayload.title = 'Mutated after save';
  failOlder(new Error('failed'));
  await failed;
  await second;
  assert.deepEqual(calls, ['Older', 'Latest']);
  assert.equal(drafts.getSnapshot()[0].payload.title, 'Latest');
  assert.equal(drafts.getSnapshot()[0].status, 'staged');
});

test('drafts for different tasks and recurring occurrences recover independently', async () => {
  const { drafts } = fixture(async () => { throw new Error('offline'); });
  await Promise.allSettled([
    drafts.save(7, { description: 'Day one', occurrence_date: '2026-10-22' }),
    drafts.save(7, { description: 'Day two', occurrence_date: '2026-10-23' }),
    drafts.save(8, { title: 'Other task' }),
  ]);
  assert.equal(drafts.getSnapshot().length, 3);
});

test('unavailable backup storage preserves in-memory drafts and reports that no backup exists', async () => {
  let fail = true;
  const storage = {
    getItem: () => null,
    setItem: () => { throw new Error('storage disabled'); },
    removeItem: () => {},
  };
  const { drafts } = fixture(async () => { if (fail) throw new Error('quota'); }, storage);
  await assert.rejects(drafts.save(7, { title: 'Memory only' }), /quota/);
  assert.equal(drafts.getSnapshot()[0].backupSaved, false);
  fail = false;
  await drafts.retry();
  assert.deepEqual(drafts.getSnapshot(), []);
});

test('temporary IDs migrate before retry and account backups stay separate', async () => {
  const storage = memoryStorage();
  const { drafts, storageKey } = fixture(async () => { throw new Error('quota'); }, storage);
  await assert.rejects(drafts.save(-7, { title: 'Created offline' }), /quota/);
  drafts.remapTaskID(-7, 27);
  const restored = createTaskDraftPersistence({ storage, storageKey, write: async (id) => { assert.equal(id, 27); } });
  await restored.retry();
  assert.deepEqual(fixture(async () => {}, storage, 2).drafts.getSnapshot(), []);
});

test('logout stops queued writes, waits for active work and removes recovery data', async () => {
  let release;
  const calls = [];
  const { drafts, storage, storageKey } = fixture(async (id) => {
    calls.push(id);
    await new Promise((resolve) => { release = resolve; });
  });
  const first = drafts.save(7, { title: 'First' });
  await Promise.resolve();
  const second = drafts.save(8, { title: 'Queued' });
  const closed = drafts.close();
  release();
  await Promise.all([first, second, closed]);
  await drafts.save(9, { title: 'Late unmount callback' });
  assert.deepEqual(calls, [7]);
  assert.deepEqual(drafts.getSnapshot(), []);
  assert.equal(storage.getItem(storageKey), null);
});

test('a recovered creation retains its temporary ID and becomes an update after server remapping', async () => {
  const { drafts, storage, storageKey } = fixture(async () => { throw new Error('quota'); });
  await assert.rejects(drafts.save(-7, { title: 'New task' }, { taskCreation: true }), /quota/);
  const calls = [];
  const restored = createTaskDraftPersistence({ storage, storageKey, write: async (id, payload, options) => {
    calls.push({ id, create: options.taskCreation, title: payload.title });
  } });
  await restored.retry();
  restored.remapTaskID(-7, 27);
  await restored.save(-7, { title: 'Changed after remapping' }, { taskCreation: true });
  assert.deepEqual(calls, [
    { id: -7, create: true, title: 'New task' },
    { id: 27, create: false, title: 'Changed after remapping' },
  ]);
});

test('in-flight remapping cannot remove a more recent draft for the server ID', async () => {
  let release;
  const { drafts } = fixture(async (_id, payload) => {
    if (payload.title === 'Creating') await new Promise((resolve) => { release = resolve; });
  });
  const creating = drafts.save(-7, { title: 'Creating' }, { taskCreation: true });
  await Promise.resolve();
  drafts.remapTaskID(-7, 27);
  const editing = drafts.save(27, { title: 'Latest' }, { localOnly: true });
  release();
  await Promise.all([creating, editing]);
  assert.equal(drafts.getSnapshot().length, 1);
  assert.equal(drafts.getSnapshot()[0].taskID, 27);
  assert.equal(drafts.getSnapshot()[0].payload.title, 'Latest');
});
