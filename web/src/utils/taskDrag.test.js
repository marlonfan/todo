import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearCurrentDraggedTaskID,
  getCurrentDraggedTaskID,
  readTaskDragTaskID,
  resolveTaskDragTaskID,
  setCurrentDraggedTaskID,
  shouldSelectTaskRowFromPointerRelease,
  TASK_DRAG_TASK_ID_MIME,
  writeTaskDragData,
} from './taskDrag.js';

function createDataTransferStub() {
  const values = new Map();
  return {
    effectAllowed: '',
    getData(type) {
      return values.get(type) || '';
    },
    setData(type, value) {
      values.set(type, value);
    },
  };
}

test('resolveTaskDragTaskID prefers recurring source task id', () => {
  assert.equal(resolveTaskDragTaskID({
    id: 'occ_42_20260608',
    source_task_id: 42,
    task_id: 41,
  }), 42);
});

test('writeTaskDragData writes custom and plain text ids', () => {
  const dataTransfer = createDataTransferStub();
  const taskID = writeTaskDragData(dataTransfer, { id: 12 });

  assert.equal(taskID, 12);
  assert.equal(dataTransfer.getData(TASK_DRAG_TASK_ID_MIME), '12');
  assert.equal(dataTransfer.getData('text/task-id'), '12');
  assert.equal(dataTransfer.getData('text/plain'), '12');
  assert.equal(dataTransfer.effectAllowed, 'move');
  assert.equal(getCurrentDraggedTaskID(), 12);
  clearCurrentDraggedTaskID();
});

test('readTaskDragTaskID falls back to same-window dragged id', () => {
  const dataTransfer = createDataTransferStub();
  setCurrentDraggedTaskID(77);

  assert.equal(readTaskDragTaskID(dataTransfer, getCurrentDraggedTaskID()), 77);
  clearCurrentDraggedTaskID(77);
});

test('readTaskDragTaskID supports text/plain fallback', () => {
  const dataTransfer = createDataTransferStub();
  dataTransfer.setData('text/plain', '88');

  assert.equal(readTaskDragTaskID(dataTransfer), 88);
});

test('shouldSelectTaskRowFromPointerRelease allows jitter but rejects drag intent', () => {
  assert.equal(shouldSelectTaskRowFromPointerRelease({
    startX: 10,
    startY: 10,
    endX: 15,
    endY: 14,
    clickDistance: 8,
  }), true);
  assert.equal(shouldSelectTaskRowFromPointerRelease({
    startX: 10,
    startY: 10,
    endX: 22,
    endY: 10,
    clickDistance: 8,
  }), false);
  assert.equal(shouldSelectTaskRowFromPointerRelease({
    startX: 10,
    startY: 10,
    endX: 12,
    endY: 12,
    dragStarted: true,
  }), false);
  assert.equal(shouldSelectTaskRowFromPointerRelease({
    startX: 10,
    startY: 10,
    endX: 12,
    endY: 12,
    dragStarted: true,
    allowStartedDrag: true,
  }), true);
});
