import { TASK_ROW_COMPLETE_EXIT_MS } from './taskListConstants.js';

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function getTaskCompletionStageDelay() {
  return prefersReducedMotion() ? 0 : TASK_ROW_COMPLETE_EXIT_MS;
}
