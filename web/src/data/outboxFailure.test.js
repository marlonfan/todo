import test from 'node:test';
import assert from 'node:assert/strict';
import { getRejectedMutationTaskPatch } from './outboxFailure.js';

test('400 rejection restores the last server-confirmed revision for the next edit', () => {
  const patch = getRejectedMutationTaskPatch({
    op_type: 'update',
    if_match_revision: 1,
  }, 'explicit reminder time must be in the future');

  assert.deepEqual(patch, {
    revision: 1,
    sync_state: 'error',
    last_error: 'explicit reminder time must be in the future',
  });
});

test('rejection without an If-Match revision does not invent one', () => {
  const patch = getRejectedMutationTaskPatch({
    op_type: 'update',
  }, 'validation failed');

  assert.deepEqual(patch, {
    sync_state: 'error',
    last_error: 'validation failed',
  });
});
