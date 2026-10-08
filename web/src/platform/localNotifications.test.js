import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createServer } from 'vite';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function fixture() {
  const values = new Map([['user', JSON.stringify({ id: 1, default_reminder_enabled: false })]]);
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  globalThis.indexedDB = new IDBFactory();
  const canceled = [];
  const sent = [];
  const bridge = { isPermissionGranted: async () => true, send: async (payload) => sent.push(payload), cancel: async (ids) => canceled.push(...ids) };
  globalThis.window = { localStorage, todoElectron: { notifications: bridge }, addEventListener() {}, removeEventListener() {} };
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: null, hmr: false }, appType: 'custom' });
  const store = await server.ssrLoadModule('/src/data/localStore.js');
  await store.upsertTask({ id: 1, title: 'offset reminder', start_time: new Date(Date.now() + 3600000).toISOString(), reminder_policy: 'offset', reminder_minutes_before: 0 });
  const client = await server.ssrLoadModule('/src/api/client.js');
  client.tasksAPI.listNextOccurrences = async () => ({ data: [] });
  const notifications = await server.ssrLoadModule('/src/platform/localNotifications.js');
  return { server, store, client, notifications, bridge, canceled, sent };
}

test('desktop reminder obeys explicit offset when account defaults are disabled', async () => {
  const f = await fixture();
  try {
    const result = await f.notifications.reconcileLocalNotifications();
    assert.equal(result.scheduled, 1);
    assert.equal(f.sent[0].title, 'offset reminder');
    await f.notifications.clearLocalNotificationsForLogout();
    assert.deepEqual(f.canceled, [f.sent[0].id]);
    assert.deepEqual(JSON.parse(await f.store.getMeta('local_notification_schedule_v1')).ids, []);
  } finally { await f.server.close(); }
});

test('logout invalidates a reconciliation waiting for recurring tasks', async () => {
  const f = await fixture();
  try {
    const entered = deferred(); const pending = deferred();
    f.client.tasksAPI.listNextOccurrences = () => { entered.resolve(); return pending.promise; };
    const reconcile = f.notifications.reconcileLocalNotifications();
    await entered.promise;
    const logout = f.notifications.clearLocalNotificationsForLogout();
    pending.resolve({ data: [] });
    await Promise.all([logout, reconcile]);
    assert.equal(f.sent.length, 0);
    assert.deepEqual(JSON.parse(await f.store.getMeta('local_notification_schedule_v1')).ids, []);
  } finally { await f.server.close(); }
});

test('logout waits for an in-flight Electron send then cancels its ID before deleting data', async () => {
  const f = await fixture();
  try {
    const entered = deferred(); const pending = deferred();
    f.bridge.send = (payload) => { f.sent.push(payload); entered.resolve(); return pending.promise; };
    const reconcile = f.notifications.reconcileLocalNotifications();
    await entered.promise;
    const engine = await f.server.ssrLoadModule('/src/data/syncEngine.js');
    const logout = engine.clearAuthenticatedLocalState();
    pending.resolve();
    await Promise.all([logout, reconcile]);
    assert.deepEqual(f.canceled, [f.sent[0].id]);
    assert.deepEqual(await f.store.readTasks(), []);
    assert.equal(await f.store.getMeta('local_notification_schedule_v1'), null);
  } finally { await f.server.close(); }
});

test('stopping scheduler cancels delayed callbacks', async () => {
  const f = await fixture();
  try {
    f.notifications.startLocalNotificationScheduler();
    f.notifications.scheduleLocalNotificationRefresh();
    await f.notifications.clearLocalNotificationsForLogout();
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.equal(f.sent.length, 0);
  } finally { await f.server.close(); }
});
