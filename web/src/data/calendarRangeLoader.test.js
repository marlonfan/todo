import test from 'node:test';
import assert from 'node:assert/strict';
import { createCalendarRangeLoader, CALENDAR_CACHE_SCHEMA_VERSION } from './calendarRangeLoader.js';

const range = { start: '2026-01-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z', timezone: 'UTC' };

function fixture(overrides = {}) {
  const entries = new Map();
  const calls = [];
  let time = 1_000_000;
  const loader = createCalendarRangeLoader({
    readRange: async (key) => entries.get(key),
    writeRange: async (entry) => { entries.set(entry.key, entry); },
    fetchEvents: async (params) => { calls.push(params); return []; },
    now: () => time,
    ...overrides,
  });
  return { loader, entries, calls, advance: (ms) => { time += ms; } };
}

test('partial refresh preserves failed missing segments and retries only those segments', async () => {
  const calls = [];
  let failedStart;
  let fail = true;
  const { loader } = fixture({ fetchEvents: async ({ start }) => {
    calls.push(start);
    if (fail && start === failedStart) throw new Error('offline');
    return [];
  } });
  const local = await loader.load(range.start, range.end, range.timezone);
  assert.equal(local.missingSegments.length, 3);
  failedStart = local.missingSegments[1].start;
  const partial = await loader.refresh(local);
  assert.equal(partial.segments.length, 2);
  assert.deepEqual(partial.missingSegments, [local.missingSegments[1]]);
  assert.deepEqual(partial.staleSegments, []);
  calls.length = 0;
  fail = false;
  const completed = await loader.refresh(partial);
  assert.deepEqual(calls, [failedStart]);
  assert.equal(completed.segments.length, 3);
  assert.deepEqual(completed.missingSegments, []);
});

test('failed stale segments retain cached events while successful segments refresh', async () => {
  let fail = false;
  let failedStart;
  const { loader, advance } = fixture({ fetchEvents: async ({ start }) => {
    if (fail && start === failedStart) throw new Error('offline');
    return [{ id: start, title: fail ? 'Updated' : 'Cached', start }];
  } });
  await loader.refresh(await loader.load(range.start, range.end, range.timezone));
  advance(600_001);
  const stale = await loader.load(range.start, range.end, range.timezone);
  assert.equal(stale.staleSegments.length, 3);
  failedStart = stale.staleSegments[0].start;
  fail = true;
  const partial = await loader.refresh(stale);
  assert.deepEqual(partial.staleSegments, [stale.staleSegments[0]]);
  assert.equal(partial.segments.find((item) => item.start === failedStart).events[0].title, 'Cached');
  assert.equal(partial.segments.find((item) => item.start !== failedStart).events[0].title, 'Updated');
});

test('concurrent refresh consumers share requests and both receive the result', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  const { loader } = fixture({ fetchEvents: async () => { calls += 1; await gate; return []; } });
  const local = await loader.load(range.start, range.end, range.timezone);
  const first = loader.refresh(local);
  const second = loader.refresh(local);
  assert.equal(calls, 3);
  release();
  for (const result of await Promise.all([first, second])) {
    assert.equal(result.segments.length, 3);
    assert.deepEqual(result.missingSegments, []);
  }
});

test('fully cached and fresh ranges avoid network requests, and midnight end is exclusive', async () => {
  const { loader, calls, entries } = fixture();
  const local = await loader.load('2026-10-22T00:00:00Z', '2026-10-23T00:00:00Z', 'UTC');
  assert.equal(local.missingSegments.length, 1);
  assert.equal(local.missingSegments[0].end, '2026-10-23T00:00:00.000Z');
  await loader.refresh(local);
  assert.equal([...entries.values()][0].cache_version, CALENDAR_CACHE_SCHEMA_VERSION);
  const fresh = await loader.load('2026-10-22T00:00:00Z', '2026-10-23T00:00:00Z', 'UTC');
  assert.equal(fresh.segments.length, 1);
  assert.equal(await loader.refresh(fresh), fresh);
  assert.equal(calls.length, 1);
});

test('all failed requests keep the same snapshot without discarding cached data', async () => {
  const { loader } = fixture({ fetchEvents: async () => { throw new Error('offline'); } });
  const local = await loader.load(range.start, range.end, range.timezone);
  assert.equal(await loader.refresh(local), local);
  assert.equal(local.missingSegments.length, 3);
});

test('unavailable IndexedDB does not prevent displaying server events', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { loader } = fixture({
    readRange: async () => { throw new Error('Storage unavailable'); },
    writeRange: async () => { throw new Error('Quota exceeded'); },
    fetchEvents: async ({ start }) => [{ id: 'online', title: 'Online event', start }],
  });
  const local = await loader.load('2026-10-22T00:00:00Z', '2026-10-23T00:00:00Z', 'UTC');
  const refreshed = await loader.refresh(local);
  assert.deepEqual(refreshed.missingSegments, []);
  assert.equal(refreshed.segments[0].eventsByDate['2026-10-22'][0].title, 'Online event');
});

test('cache entries from an incompatible schema are refetched', async () => {
  const { loader, entries } = fixture();
  await loader.refresh(await loader.load(range.start, range.end, range.timezone));
  const entry = [...entries.values()][0];
  entries.set(entry.key, { ...entry, cache_version: CALENDAR_CACHE_SCHEMA_VERSION - 1 });
  const loaded = await loader.load(range.start, range.end, range.timezone);
  assert.equal(loaded.missingSegments.length, 1);
  assert.equal(loaded.segments.length, 2);
});
