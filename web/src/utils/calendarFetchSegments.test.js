import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMissingDatesSignature, buildMissingRangeSegments } from './calendarFetchSegments.js';

test('buildMissingDatesSignature returns stable compact signature', () => {
  const signature = buildMissingDatesSignature([
    '2026-03-03',
    '2026-03-01',
    '2026-03-02',
    '2026-03-02',
  ]);
  assert.equal(signature, '2026-03-01:2026-03-03:3');
});

test('buildMissingRangeSegments merges consecutive days into one segment', () => {
  const segments = buildMissingRangeSegments(
    ['2026-03-01', '2026-03-02', '2026-03-03'],
    'UTC',
    45,
  );
  assert.equal(segments.length, 1);
  assert.equal(segments[0].start, '2026-03-01T00:00:00.000Z');
  assert.equal(segments[0].end, '2026-03-04T00:00:00.000Z');
  assert.equal(segments[0].dayCount, 3);
});

test('buildMissingRangeSegments splits by gaps and max segment size', () => {
  const segments = buildMissingRangeSegments(
    ['2026-03-01', '2026-03-02', '2026-03-04', '2026-03-05'],
    'UTC',
    1,
  );
  assert.equal(segments.length, 4);
  assert.equal(segments[0].start, '2026-03-01T00:00:00.000Z');
  assert.equal(segments[0].end, '2026-03-02T00:00:00.000Z');
  assert.equal(segments[1].start, '2026-03-02T00:00:00.000Z');
  assert.equal(segments[1].end, '2026-03-03T00:00:00.000Z');
  assert.equal(segments[2].start, '2026-03-04T00:00:00.000Z');
  assert.equal(segments[2].end, '2026-03-05T00:00:00.000Z');
  assert.equal(segments[3].start, '2026-03-05T00:00:00.000Z');
  assert.equal(segments[3].end, '2026-03-06T00:00:00.000Z');
});

