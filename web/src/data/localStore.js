const DB_NAME = 'todo-kimi-local-db';
const DB_VERSION = 1;

const STORE_TASKS = 'tasks';
const STORE_CATEGORIES = 'categories';
const STORE_OUTBOX = 'outbox';
const STORE_META = 'meta';
const STORE_CALENDAR_RANGES = 'calendar_ranges';

let dbPromise = null;

function toPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

async function getDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_TASKS)) {
        const store = db.createObjectStore(STORE_TASKS, { keyPath: 'id' });
        store.createIndex('updated_at', 'updated_at', { unique: false });
        store.createIndex('client_updated_at', 'client_updated_at', { unique: false });
        store.createIndex('sync_state', 'sync_state', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
        db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        const store = db.createObjectStore(STORE_OUTBOX, { keyPath: 'op_id' });
        store.createIndex('next_retry_at', 'next_retry_at', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
        store.createIndex('entity_id', 'entity_id', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(STORE_CALENDAR_RANGES)) {
        const store = db.createObjectStore(STORE_CALENDAR_RANGES, { keyPath: 'key' });
        store.createIndex('updated_at', 'updated_at', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });

  return dbPromise;
}

async function getAll(storeName) {
  const db = await getDB();
  const tx = db.transaction(storeName, 'readonly');
  const request = tx.objectStore(storeName).getAll();
  const result = await toPromise(request);
  await txDone(tx);
  return Array.isArray(result) ? result : [];
}

async function getByKey(storeName, key) {
  const db = await getDB();
  const tx = db.transaction(storeName, 'readonly');
  const request = tx.objectStore(storeName).get(key);
  const result = await toPromise(request);
  await txDone(tx);
  return result;
}

async function put(storeName, value) {
  const db = await getDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(value);
  await txDone(tx);
}

async function bulkPut(storeName, values) {
  const items = Array.isArray(values) ? values : [];
  if (items.length === 0) return;

  const db = await getDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  items.forEach((item) => store.put(item));
  await txDone(tx);
}

async function clear(storeName) {
  const db = await getDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).clear();
  await txDone(tx);
}

async function del(storeName, key) {
  const db = await getDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(key);
  await txDone(tx);
}

export function buildCalendarRangeKey(start, end, timezone) {
  return `${timezone}|${start}|${end}`;
}

export async function readTasks() {
  return getAll(STORE_TASKS);
}

export async function upsertTask(task) {
  if (!task || typeof task.id === 'undefined' || task.id === null) return;
  await put(STORE_TASKS, task);
}

export async function upsertTasks(tasks) {
  await bulkPut(STORE_TASKS, tasks);
}

export async function replaceTaskID(oldID, nextTask) {
  if (!nextTask || typeof nextTask.id === 'undefined' || nextTask.id === null) return;
  const db = await getDB();
  const tx = db.transaction([STORE_TASKS], 'readwrite');
  const store = tx.objectStore(STORE_TASKS);
  store.delete(oldID);
  store.put(nextTask);
  await txDone(tx);
}

export async function clearTasksAndSet(tasks) {
  const db = await getDB();
  const tx = db.transaction([STORE_TASKS], 'readwrite');
  const store = tx.objectStore(STORE_TASKS);
  store.clear();
  (Array.isArray(tasks) ? tasks : []).forEach((task) => store.put(task));
  await txDone(tx);
}

export async function removeTask(taskID) {
  if (typeof taskID === 'undefined' || taskID === null) return;
  await del(STORE_TASKS, taskID);
}

export async function readCategories() {
  return getAll(STORE_CATEGORIES);
}

export async function replaceCategories(categories) {
  const db = await getDB();
  const tx = db.transaction([STORE_CATEGORIES], 'readwrite');
  const store = tx.objectStore(STORE_CATEGORIES);
  store.clear();
  (Array.isArray(categories) ? categories : []).forEach((category) => store.put(category));
  await txDone(tx);
}

export async function enqueueOutbox(op) {
  if (!op || !op.op_id) return;
  await put(STORE_OUTBOX, op);
}

export async function readOutbox() {
  return getAll(STORE_OUTBOX);
}

export async function getDueOutbox(now = Date.now(), limit = 50) {
  const all = await getAll(STORE_OUTBOX);
  return all
    .filter((item) => Number(item.next_retry_at || 0) <= now)
    .sort((a, b) => Number(a.created_at || 0) - Number(b.created_at || 0))
    .slice(0, limit);
}

export async function removeOutbox(opID) {
  await del(STORE_OUTBOX, opID);
}

export async function removeOutboxByEntity(entityType, entityID) {
  const all = await getAll(STORE_OUTBOX);
  const targets = all.filter((op) => op?.entity_type === entityType && op?.entity_id === entityID);
  if (!targets.length) return;

  const db = await getDB();
  const tx = db.transaction([STORE_OUTBOX], 'readwrite');
  const store = tx.objectStore(STORE_OUTBOX);
  targets.forEach((op) => {
    if (op?.op_id) {
      store.delete(op.op_id);
    }
  });
  await txDone(tx);
}

export async function updateOutbox(opID, patch) {
  const current = await getByKey(STORE_OUTBOX, opID);
  if (!current) return;
  await put(STORE_OUTBOX, { ...current, ...patch });
}

export async function remapOutboxEntityID(fromID, toID) {
  const all = await getAll(STORE_OUTBOX);
  const needUpdate = all.filter((op) => op.entity_id === fromID);
  if (needUpdate.length === 0) return;

  const db = await getDB();
  const tx = db.transaction([STORE_OUTBOX], 'readwrite');
  const store = tx.objectStore(STORE_OUTBOX);

  needUpdate.forEach((op) => {
    const nextPayload = op.payload && typeof op.payload === 'object'
      ? { ...op.payload, task_id: toID }
      : op.payload;
    store.put({ ...op, entity_id: toID, payload: nextPayload });
  });

  await txDone(tx);
}

export async function getMeta(key, fallback = null) {
  const value = await getByKey(STORE_META, key);
  if (!value || typeof value.value === 'undefined') return fallback;
  return value.value;
}

export async function setMeta(key, value) {
  await put(STORE_META, { key, value });
}

export async function getCalendarRange(key) {
  return getByKey(STORE_CALENDAR_RANGES, key);
}

export async function putCalendarRange(entry) {
  if (!entry?.key) return;
  await put(STORE_CALENDAR_RANGES, entry);
}

export async function listCalendarRanges() {
  return getAll(STORE_CALENDAR_RANGES);
}

export async function removeCalendarRange(key) {
  if (!key) return;
  await del(STORE_CALENDAR_RANGES, key);
}

export async function removeCalendarRanges(keys) {
  const list = Array.isArray(keys) ? keys.filter(Boolean) : [];
  if (!list.length) return;
  const db = await getDB();
  const tx = db.transaction([STORE_CALENDAR_RANGES], 'readwrite');
  const store = tx.objectStore(STORE_CALENDAR_RANGES);
  list.forEach((key) => store.delete(key));
  await txDone(tx);
}

export async function invalidateCalendarRangesByTask(taskID) {
  if (!taskID) return;
  const ranges = await getAll(STORE_CALENDAR_RANGES);
  const keys = ranges
    .filter((entry) => {
      const events = Array.isArray(entry?.events) ? entry.events : [];
      return events.some((event) => Number(event?.extendedProps?.taskId) === Number(taskID));
    })
    .map((entry) => entry.key)
    .filter(Boolean);

  await removeCalendarRanges(keys);
}

export async function clearCalendarRanges() {
  await clear(STORE_CALENDAR_RANGES);
}

export async function clearAllLocalData() {
  const db = await getDB();
  const tx = db.transaction(
    [STORE_TASKS, STORE_CATEGORIES, STORE_OUTBOX, STORE_META, STORE_CALENDAR_RANGES],
    'readwrite'
  );
  tx.objectStore(STORE_TASKS).clear();
  tx.objectStore(STORE_CATEGORIES).clear();
  tx.objectStore(STORE_OUTBOX).clear();
  tx.objectStore(STORE_META).clear();
  tx.objectStore(STORE_CALENDAR_RANGES).clear();
  await txDone(tx);
}
