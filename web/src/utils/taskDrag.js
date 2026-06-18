export const TASK_DRAG_TASK_ID_MIME = 'application/x-todo-task-id';
export const TASK_CATEGORY_DROP_EVENT = 'todo:task-category-drop';

let currentDraggedTaskID = 0;

function normalizeTaskID(value) {
  const taskID = Number(value);
  return Number.isFinite(taskID) && taskID !== 0 ? taskID : 0;
}

export function resolveTaskDragTaskID(task) {
  if (!task || typeof task !== 'object') return 0;
  const candidates = [
    task.source_task_id,
    task.sourceTaskID,
    task.task_id,
    task.taskID,
    task.id,
  ];
  for (const candidate of candidates) {
    const taskID = normalizeTaskID(candidate);
    if (taskID) return taskID;
  }
  return 0;
}

export function setCurrentDraggedTaskID(taskID) {
  currentDraggedTaskID = normalizeTaskID(taskID);
}

export function getCurrentDraggedTaskID() {
  return currentDraggedTaskID;
}

export function clearCurrentDraggedTaskID(taskID = 0) {
  const normalized = normalizeTaskID(taskID);
  if (!normalized || normalized === currentDraggedTaskID) {
    currentDraggedTaskID = 0;
  }
}

export function writeTaskDragData(dataTransfer, task) {
  const taskID = resolveTaskDragTaskID(task);
  if (!taskID) return 0;
  setCurrentDraggedTaskID(taskID);
  const value = String(taskID);
  [
    TASK_DRAG_TASK_ID_MIME,
    'text/task-id',
    'text/plain',
  ].forEach((type) => {
    try {
      dataTransfer?.setData?.(type, value);
    } catch {
      // Some embedded webviews reject custom drag MIME types.
    }
  });
  try {
    dataTransfer.effectAllowed = 'move';
  } catch {
    // Ignore webview-specific DataTransfer restrictions.
  }
  return taskID;
}

export function readTaskDragTaskID(dataTransfer, fallbackTaskID = 0) {
  const fallback = normalizeTaskID(fallbackTaskID);
  if (fallback) return fallback;
  for (const type of [TASK_DRAG_TASK_ID_MIME, 'text/task-id', 'text/plain']) {
    try {
      const taskID = normalizeTaskID(dataTransfer?.getData?.(type));
      if (taskID) return taskID;
    } catch {
      // Keep trying the other representations.
    }
  }
  return 0;
}

export function shouldTreatPointerReleaseAsClick({
  ignoreTarget = false,
  dragStarted = false,
  allowStartedDrag = false,
  startX = 0,
  startY = 0,
  endX = 0,
  endY = 0,
  clickDistance,
  pointerType = '',
}) {
  if (ignoreTarget || (dragStarted && !allowStartedDrag)) return false;
  const sx = Number.isFinite(startX) ? startX : 0;
  const sy = Number.isFinite(startY) ? startY : 0;
  const ex = Number.isFinite(endX) ? endX : sx;
  const ey = Number.isFinite(endY) ? endY : sy;
  const defaultDistance = String(pointerType || '').toLowerCase() === 'touch' ? 14 : 8;
  const threshold = Math.max(0, Number.isFinite(clickDistance) ? clickDistance : defaultDistance);
  return Math.hypot(ex - sx, ey - sy) <= threshold;
}

export function shouldSelectTaskRowFromPointerRelease(options = {}) {
  return shouldTreatPointerReleaseAsClick(options);
}

export function emitTaskCategoryDrop({ taskID, categoryID }) {
  const normalizedTaskID = normalizeTaskID(taskID);
  const normalizedCategoryID = normalizeTaskID(categoryID);
  if (!normalizedTaskID || !normalizedCategoryID || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TASK_CATEGORY_DROP_EVENT, {
    detail: {
      taskID: normalizedTaskID,
      categoryID: normalizedCategoryID,
    },
  }));
}
