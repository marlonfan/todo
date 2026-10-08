import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createServer } from 'vite';

test('IndexedDB open failure preserves offline tasks and queued mutations', async () => {
  const factory = new IDBFactory();
  globalThis.indexedDB = factory;
  let connection;
  const open = factory.open.bind(factory);
  factory.open = (...args) => {
    const request = open(...args);
    request.addEventListener('success', () => { connection = request.result; });
    return request;
  };
  let deletes = 0;
  factory.deleteDatabase = () => { deletes += 1; throw new Error('must not delete'); };
  const store = await import('./localStore.js');
  await store.upsertTask({ id: -1, title: 'offline edit', sync_state: 'pending' });
  await store.enqueueOutbox({ op_id: 'offline-op', entity_id: -1, op_type: 'create' });
  connection.onversionchange();
  factory.open = () => {
    const request = { error: new DOMException('temporary open failure', 'UnknownError') };
    queueMicrotask(() => request.onerror());
    return request;
  };
  await assert.rejects(store.readTasks(), /temporary open failure/);
  assert.equal(deletes, 0);
  factory.open = open;
  assert.equal((await store.readTasks())[0].title, 'offline edit');
  assert.equal((await store.readOutbox())[0].op_id, 'offline-op');
});

test('blocked IndexedDB upgrade reports a retry and closes a late connection', async () => {
  let closed = false;
  globalThis.indexedDB = {
    open() {
      const request = { result: { close: () => { closed = true; } } };
      queueMicrotask(() => { request.onblocked(); request.onsuccess(); });
      return request;
    },
  };
  const store = await import('./localStore.js?blocked');
  await assert.rejects(store.readTasks(), /其他窗口/);
  assert.equal(closed, true);
});

test('manual rebuild refuses to discard pending offline operations', async () => {
  globalThis.indexedDB = new IDBFactory();
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  globalThis.window = { localStorage, addEventListener() {}, removeEventListener() {} };
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: null, hmr: false }, appType: 'custom' });
  try {
    const store = await server.ssrLoadModule('/src/data/localStore.js');
    await store.upsertTask({ id: -2, title: 'keep me' });
    await store.enqueueOutbox({ op_id: 'keep-op', entity_id: -2, op_type: 'create' });
    const engine = await server.ssrLoadModule('/src/data/syncEngine.js');
    await assert.rejects(engine.rebuildLocalDataAndSync(), /未同步/);
    assert.equal((await store.readTasks())[0].title, 'keep me');
    assert.equal((await store.readOutbox())[0].op_id, 'keep-op');
  } finally { await server.close(); delete globalThis.window; }
});

import { calendarRangeEntryContainsTask } from './localStore.js';

function makeEvent(taskID) {
  return {
    extendedProps: {
      taskId: taskID,
    },
  };
}

test('calendarRangeEntryContainsTask checks events_by_date cache entries', () => {
  const entry = {
    events_by_date: {
      '2026-03-01': [makeEvent(12)],
      '2026-03-02': [],
    },
  };

  assert.equal(calendarRangeEntryContainsTask(entry, 12), true);
  assert.equal(calendarRangeEntryContainsTask(entry, 99), false);
});


test('sync stops before replacing cache when the offline queue cannot be read', async () => {
  const factory = new IDBFactory();
  globalThis.indexedDB = factory;
  const values = new Map([['token', 'test']]);
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  globalThis.window = {
    localStorage,
    __todoPlatform: { setInterval: () => () => {}, onOnline: () => () => {}, onVisibilityChange: () => () => {}, isVisible: () => false },
  };
  let connection;
  const originalOpen = factory.open.bind(factory);
  factory.open = (...args) => {
    const request = originalOpen(...args);
    request.addEventListener('success', () => { connection = request.result; });
    return request;
  };
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: null, hmr: false }, appType: 'custom' });
  let engine;
  let queryClient;
  try {
    const { QueryClient } = await import('@tanstack/react-query');
    const client = await server.ssrLoadModule('/src/api/client.js');
    let pulls = 0;
    client.categoriesAPI.list = async () => ({ data: [] });
    client.tasksAPI.list = async () => { pulls += 1; return { data: [] }; };
    client.tasksAPI.sync = async () => { pulls += 1; return { data: { tasks: [], deleted: [], next_cursor: 'v1:0' } }; };
    client.tasksAPI.create = () => assert.fail('must not send while queue is unreadable');
    engine = await server.ssrLoadModule('/src/data/syncEngine.js');
    const initialSync = new Promise((resolve) => engine.onSyncCycleFinished(resolve));
    queryClient = new QueryClient();
    engine.initializeSyncEngine(queryClient);
    await initialSync;
    const store = await server.ssrLoadModule('/src/data/localStore.js');
    await store.upsertTask({ id: -3, title: 'pending offline task', sync_state: 'pending' });
    await store.enqueueOutbox({ op_id: 'read-failure-op', entity_id: -3, entity_type: 'task', op_type: 'create', payload: { title: 'pending offline task' } });
    connection.onversionchange();
    factory.open = () => {
      const request = { error: new DOMException('queue unavailable', 'UnknownError') };
      queueMicrotask(() => request.onerror());
      return request;
    };
    const before = pulls;
    await assert.rejects(engine.forceManualSync(), /queue unavailable/);
    assert.equal(pulls, before);
    factory.open = originalOpen;
    assert.equal((await store.readOutbox())[0].op_id, 'read-failure-op');
    assert.equal((await store.readTasks())[0].title, 'pending offline task');
  } finally {
    engine?.stopSyncEngine();
    queryClient?.clear();
    await server.close();
    delete globalThis.window;
  }
});
