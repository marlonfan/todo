import test from 'node:test';
import assert from 'node:assert/strict';
import { getCoalescePlan } from './outboxCoalesce.js';

test('coalesces into pending create operation', () => {
  const existing = [
    {
      op_id: 'c1',
      entity_type: 'task',
      entity_id: -1,
      op_type: 'create',
      payload: { title: 'old', priority: 0 },
      created_at: 1,
    },
  ];
  const incoming = {
    op_id: 'u1',
    entity_type: 'task',
    entity_id: -1,
    op_type: 'update',
    payload: { title: 'new' },
    created_at: 2,
  };

  const plan = getCoalescePlan(existing, incoming);
  assert.equal(plan.mode, 'merge_into_create');
  assert.equal(plan.updateCreate.op_id, 'c1');
  assert.deepEqual(plan.updateCreate.payload, { title: 'new', priority: 0 });
});

test('replaces prior coalescible ops with one update op', () => {
  const existing = [
    {
      op_id: 'u1',
      entity_type: 'task',
      entity_id: 11,
      op_type: 'update',
      payload: { title: 'a', status: 'pending' },
      if_match_revision: 5,
      created_at: 1,
    },
    {
      op_id: 's1',
      entity_type: 'task',
      entity_id: 11,
      op_type: 'schedule',
      payload: { start_time: '2026-03-01T01:00:00Z' },
      if_match_revision: 6,
      created_at: 2,
    },
  ];
  const incoming = {
    op_id: 'st1',
    entity_type: 'task',
    entity_id: 11,
    op_type: 'status',
    payload: { status: 'completed' },
    if_match_revision: 7,
    created_at: 3,
  };

  const plan = getCoalescePlan(existing, incoming);
  assert.equal(plan.mode, 'replace_coalescible');
  assert.deepEqual(plan.removeOpIDs.sort(), ['s1', 'u1']);
  assert.equal(plan.normalized.op_type, 'update');
  assert.equal(plan.normalized.if_match_revision, 5);
  assert.deepEqual(plan.normalized.payload, {
    title: 'a',
    status: 'completed',
    start_time: '2026-03-01T01:00:00Z',
  });
});

test('does not coalesce coalescible ops outside 15 minute window', () => {
  const existing = [
    {
      op_id: 'u1',
      entity_type: 'task',
      entity_id: 88,
      op_type: 'update',
      payload: { title: 'old' },
      created_at: 1000,
      client_submitted_at: '2026-03-06T08:00:00.000Z',
    },
  ];
  const incoming = {
    op_id: 'u2',
    entity_type: 'task',
    entity_id: 88,
    op_type: 'update',
    payload: { title: 'new' },
    created_at: 1001,
    client_submitted_at: '2026-03-06T08:20:01.000Z',
  };

  const plan = getCoalescePlan(existing, incoming);
  assert.equal(plan.mode, 'enqueue');
  assert.deepEqual(plan.removeOpIDs, []);
});

test('does not coalesce recurring instance status operation', () => {
  const existing = [
    {
      op_id: 'u1',
      entity_type: 'task',
      entity_id: 22,
      op_type: 'update',
      payload: { title: 'a' },
      created_at: 1,
    },
  ];
  const incoming = {
    op_id: 'st2',
    entity_type: 'task',
    entity_id: 22,
    op_type: 'status',
    payload: { status: 'completed', instance_id: '22_20260301' },
    created_at: 2,
  };

  const plan = getCoalescePlan(existing, incoming);
  assert.equal(plan.mode, 'enqueue');
  assert.deepEqual(plan.removeOpIDs, []);
  assert.equal(plan.normalized.op_type, 'status');
});

test('does not coalesce recurring instance update operation', () => {
  const existing = [
    {
      op_id: 'u1',
      entity_type: 'task',
      entity_id: 33,
      op_type: 'update',
      payload: { title: 'a' },
      created_at: 1,
    },
  ];
  const incoming = {
    op_id: 'u2',
    entity_type: 'task',
    entity_id: 33,
    op_type: 'update',
    payload: { description: 'instance note', occurrence_date: '2026-03-10' },
    created_at: 2,
  };

  const plan = getCoalescePlan(existing, incoming);
  assert.equal(plan.mode, 'enqueue');
  assert.deepEqual(plan.removeOpIDs, []);
  assert.equal(plan.normalized.op_type, 'update');
});

test('delete drops pending create chain for same temp entity', () => {
  const existing = [
    {
      op_id: 'c1',
      entity_type: 'task',
      entity_id: -8,
      op_type: 'create',
      payload: { title: 'tmp' },
      created_at: 1,
    },
    {
      op_id: 'u1',
      entity_type: 'task',
      entity_id: -8,
      op_type: 'update',
      payload: { description: 'x' },
      created_at: 2,
    },
  ];
  const incoming = {
    op_id: 'd1',
    entity_type: 'task',
    entity_id: -8,
    op_type: 'delete',
    payload: {},
    created_at: 3,
  };

  const plan = getCoalescePlan(existing, incoming);
  assert.equal(plan.mode, 'drop_entity_ops');
  assert.equal(plan.normalized, null);
  assert.deepEqual(plan.removeOpIDs.sort(), ['c1', 'u1']);
});

test('delete keeps earliest if-match revision across pending ops', () => {
  const existing = [
    {
      op_id: 'u1',
      entity_type: 'task',
      entity_id: 66,
      op_type: 'update',
      payload: { title: 'x' },
      if_match_revision: 9,
      created_at: 1,
    },
    {
      op_id: 'u2',
      entity_type: 'task',
      entity_id: 66,
      op_type: 'update',
      payload: { description: 'y' },
      if_match_revision: 10,
      created_at: 2,
    },
  ];
  const incoming = {
    op_id: 'd66',
    entity_type: 'task',
    entity_id: 66,
    op_type: 'delete',
    payload: {},
    if_match_revision: 11,
    created_at: 3,
  };

  const plan = getCoalescePlan(existing, incoming);
  assert.equal(plan.mode, 'replace_with_delete');
  assert.equal(plan.normalized.if_match_revision, 9);
});
