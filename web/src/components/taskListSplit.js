// 从 TaskList.jsx 抽出的分屏布局(split)与移动端布局判定工具。
// 依赖 taskListConstants 中的常量与全局 window/localStorage。

import {
  TASK_SPLIT_STORAGE_KEY,
  TASK_SPLIT_DEFAULT_RATIO,
  TASK_COMPACT_MOBILE_BREAKPOINT,
  TASK_DETAIL_SPLIT_MIN_WIDTH,
} from './taskListConstants.js';

export function clampNumber(value, min, max) {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Math.max(safeMin, Number.isFinite(max) ? max : safeMin);
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return safeMin;
  return Math.min(Math.max(parsed, safeMin), safeMax);
}

export function readTaskSplitRatio() {
  if (typeof window === 'undefined') return TASK_SPLIT_DEFAULT_RATIO;
  const stored = window.localStorage?.getItem(TASK_SPLIT_STORAGE_KEY);
  return clampNumber(stored, 0.25, 0.75) || TASK_SPLIT_DEFAULT_RATIO;
}

export function writeTaskSplitRatio(ratio) {
  if (typeof window === 'undefined') return;
  window.localStorage?.setItem(TASK_SPLIT_STORAGE_KEY, String(clampNumber(ratio, 0.25, 0.75).toFixed(4)));
}

export function isTaskCompactMobileLayout() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < TASK_COMPACT_MOBILE_BREAKPOINT;
}

export function shouldUseTaskModalLayout(workspaceWidth) {
  if (isTaskCompactMobileLayout()) return true;
  const measuredWidth = Number(workspaceWidth || 0);
  if (measuredWidth > 0) return measuredWidth < TASK_DETAIL_SPLIT_MIN_WIDTH;
  return false;
}
