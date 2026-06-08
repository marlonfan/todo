import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTaskListSelection } from './taskListSelection.js';

test('keeps selected task when a save moves it out of the current filtered list', () => {
  const result = resolveTaskListSelection({
    selectedTaskID: 42,
    filteredTaskIDs: [7, 9],
    allTaskIDs: [7, 9, 42],
    preserveCurrent: true,
  });

  assert.deepEqual(result, { action: 'keep', selectedTaskID: 42 });
});

test('selects first filtered task when current selection is outside list without preservation', () => {
  const result = resolveTaskListSelection({
    selectedTaskID: 42,
    filteredTaskIDs: [7, 9],
    allTaskIDs: [7, 9, 42],
    preserveCurrent: false,
  });

  assert.deepEqual(result, { action: 'select', selectedTaskID: 7 });
});

test('clears selection for an empty list unless saving the selected task', () => {
  assert.deepEqual(resolveTaskListSelection({
    selectedTaskID: 42,
    filteredTaskIDs: [],
    allTaskIDs: [42],
    preserveCurrent: false,
  }), { action: 'clear', selectedTaskID: 0 });

  assert.deepEqual(resolveTaskListSelection({
    selectedTaskID: 42,
    filteredTaskIDs: [],
    allTaskIDs: [42],
    preserveCurrent: true,
  }), { action: 'keep', selectedTaskID: 42 });
});

test('keeps temporary local task ids while waiting for remap', () => {
  const result = resolveTaskListSelection({
    selectedTaskID: -3,
    filteredTaskIDs: [7, 9],
    allTaskIDs: [7, 9],
    preserveCurrent: false,
  });

  assert.deepEqual(result, { action: 'keep', selectedTaskID: -3 });
});

test('selects an equivalent virtual occurrence when the saved task becomes recurring', () => {
  const result = resolveTaskListSelection({
    selectedTaskID: 42,
    filteredTaskIDs: ['occ_42_20260608', 7],
    allTaskIDs: [7, 'occ_42_20260608', 42],
    equivalentTaskID: 'occ_42_20260608',
    preserveCurrent: false,
  });

  assert.deepEqual(result, { action: 'select', selectedTaskID: 'occ_42_20260608' });
});

test('keeps the selected task during a save while its replacement occurrence is not loaded yet', () => {
  const result = resolveTaskListSelection({
    selectedTaskID: 42,
    filteredTaskIDs: [7, 9],
    allTaskIDs: [7, 9, 42],
    preserveCurrent: true,
  });

  assert.deepEqual(result, { action: 'keep', selectedTaskID: 42 });
});
