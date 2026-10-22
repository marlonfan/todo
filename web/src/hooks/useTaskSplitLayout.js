import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  TASK_SPLIT_DEFAULT_RATIO,
  TASK_SPLIT_DIVIDER_WIDTH,
  TASK_SPLIT_KEYBOARD_STEP,
  TASK_SPLIT_MIN_DETAIL_WIDTH,
  TASK_SPLIT_MIN_LIST_WIDTH,
} from '../components/taskListConstants.js';
import {
  clampNumber,
  getTaskSplitBounds,
  isTaskCompactMobileLayout,
  readTaskSplitRatio,
  shouldUseTaskModalLayout,
  writeTaskSplitRatio,
} from '../components/taskListSplit.js';

// Owns responsive layout, pointer/keyboard resizing and persistence. Pointer moves
// only update the grid's CSS variable; the task editor renders once on release.
export function useTaskSplitLayout() {
  const taskWorkspaceRef = useRef(null);
  const separatorRef = useRef(null);
  const dragRef = useRef(null);
  const [ratio, setRatio] = useState(readTaskSplitRatio);
  const ratioRef = useRef(ratio);
  const [isDragging, setIsDragging] = useState(false);
  const [layout, setLayout] = useState(() => ({
    width: 0,
    isCompactMobile: isTaskCompactMobileLayout(),
    isMobileViewport: shouldUseTaskModalLayout(),
  }));
  const bounds = getTaskSplitBounds(layout.width);
  const effectiveRatio = clampNumber(ratio, bounds.min, bounds.max);

  useLayoutEffect(() => {
    const element = taskWorkspaceRef.current;
    if (!element) return undefined;
    const measure = () => {
      const width = element.getBoundingClientRect().width;
      const isCompactMobile = isTaskCompactMobileLayout();
      const isMobileViewport = shouldUseTaskModalLayout(width);
      setLayout((prev) => (
        prev.width === width && prev.isCompactMobile === isCompactMobile
          && prev.isMobileViewport === isMobileViewport
          ? prev : { width, isCompactMobile, isMobileViewport }
      ));
    };
    measure();
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    ratioRef.current = effectiveRatio;
  }, [effectiveRatio]);

  const paintRatio = useCallback((nextRatio) => {
    ratioRef.current = nextRatio;
    taskWorkspaceRef.current?.style.setProperty('--task-split-ratio', nextRatio.toFixed(4));
    separatorRef.current?.setAttribute('aria-valuenow', String(Math.round(nextRatio * 100)));
  }, []);

  const commitRatio = useCallback((nextRatio) => {
    const width = taskWorkspaceRef.current?.getBoundingClientRect().width;
    const { min, max } = getTaskSplitBounds(width);
    const clamped = clampNumber(nextRatio, min, max);
    paintRatio(clamped);
    setRatio(clamped);
    writeTaskSplitRatio(clamped);
  }, [paintRatio]);

  const handlePointerDown = useCallback((event) => {
    if (layout.isMobileViewport || event.button !== 0 || dragRef.current) return;
    const width = taskWorkspaceRef.current?.getBoundingClientRect().width;
    if (!width) return;
    event.preventDefault();
    dragRef.current = {
      pointerID: event.pointerId,
      startX: event.clientX,
      startRatio: ratioRef.current,
      width,
      pendingRatio: ratioRef.current,
      frame: 0,
    };
    setIsDragging(true);
  }, [layout.isMobileViewport]);

  useEffect(() => {
    if (!isDragging) return undefined;
    const drag = dragRef.current;
    const handlePointerMove = (event) => {
      if (event.pointerId !== drag.pointerID) return;
      const { min, max } = getTaskSplitBounds(drag.width);
      drag.pendingRatio = clampNumber(
        drag.startRatio + (event.clientX - drag.startX) / (drag.width - TASK_SPLIT_DIVIDER_WIDTH),
        min, max,
      );
      if (drag.frame) return;
      drag.frame = window.requestAnimationFrame(() => {
        drag.frame = 0;
        paintRatio(drag.pendingRatio);
      });
    };
    const finish = (event) => {
      if (event?.pointerId != null && event.pointerId !== drag.pointerID) return;
      if (!dragRef.current) return;
      if (drag.frame) window.cancelAnimationFrame(drag.frame);
      drag.frame = 0;
      commitRatio(drag.pendingRatio);
      dragRef.current = null;
      setIsDragging(false);
    };
    document.body.classList.add('task-split-resizing');
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('blur', finish);
    return () => {
      if (drag.frame) window.cancelAnimationFrame(drag.frame);
      dragRef.current = null;
      document.body.classList.remove('task-split-resizing');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('blur', finish);
    };
  }, [commitRatio, isDragging, paintRatio]);

  useEffect(() => {
    if (layout.isMobileViewport) setIsDragging(false);
  }, [layout.isMobileViewport]);

  const handleKeyDown = useCallback((event) => {
    if (layout.isMobileViewport) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home'
      ? TASK_SPLIT_DEFAULT_RATIO
      : ratioRef.current + (event.key === 'ArrowLeft' ? -1 : 1) * TASK_SPLIT_KEYBOARD_STEP;
    commitRatio(next);
  }, [commitRatio, layout.isMobileViewport]);

  return {
    taskWorkspaceRef,
    isCompactMobile: layout.isCompactMobile,
    isMobileViewport: layout.isMobileViewport,
    taskSplitGridStyle: layout.isMobileViewport ? undefined : {
      '--task-split-ratio': effectiveRatio.toFixed(4),
      gridTemplateColumns: `clamp(${TASK_SPLIT_MIN_LIST_WIDTH}px, calc((100% - ${TASK_SPLIT_DIVIDER_WIDTH}px) * var(--task-split-ratio)), calc(100% - ${TASK_SPLIT_MIN_DETAIL_WIDTH + TASK_SPLIT_DIVIDER_WIDTH}px)) ${TASK_SPLIT_DIVIDER_WIDTH}px minmax(${TASK_SPLIT_MIN_DETAIL_WIDTH}px, 1fr)`,
    },
    taskSplitSeparatorProps: {
      ref: separatorRef,
      role: 'separator',
      'aria-orientation': 'vertical',
      'aria-valuemin': Math.round(bounds.min * 100),
      'aria-valuemax': Math.round(bounds.max * 100),
      'aria-valuenow': Math.round(effectiveRatio * 100),
      className: `task-split-resizer${isDragging ? ' task-split-resizer--dragging' : ''}`,
      onDoubleClick: () => commitRatio(TASK_SPLIT_DEFAULT_RATIO),
      onPointerDown: handlePointerDown,
      onKeyDown: handleKeyDown,
    },
  };
}
