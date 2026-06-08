import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasBaseTaskPatchPayload,
  patchOccurrenceDescriptionInItems,
} from './taskMutationHelpers.js';

test('occurrence-scoped description payload does not patch the base task', () => {
  assert.equal(hasBaseTaskPatchPayload({
    description: 'instance description',
    instance_id: '10_20260310',
    occurrence_date: '2026-03-10',
  }), false);
});

test('occurrence-scoped schedule payload still patches the base task', () => {
  assert.equal(hasBaseTaskPatchPayload({
    start_time: '2026-03-10T09:00:00.000Z',
    instance_id: '10_20260310',
    occurrence_date: '2026-03-10',
  }), true);
});

test('occurrence description patch only updates the matching generated instance', () => {
  const items = [
    { task_id: 10, instance_id: '10_20260310', description: '' },
    { task_id: 10, instance_id: '10_20260311', description: '' },
  ];
  const next = patchOccurrenceDescriptionInItems(
    items,
    10,
    '10_20260310',
    '2026-03-10',
    'instance description',
  );

  assert.equal(next[0].description, 'instance description');
  assert.equal(next[1].description, '');
});
