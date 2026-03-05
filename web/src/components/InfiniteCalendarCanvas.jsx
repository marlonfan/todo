import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { flushSync } from 'react-dom';
import { commitOffsetFromWheelSession, resolvePanDelta, shouldCommitWheelSession } from './canvasMotionMath';

const HOUR_HEIGHT = 56;
const MONTH_WEEK_HEIGHT = 164;
const HEADER_HEIGHT = 36;
const TIME_AXIS_WIDTH = 46;
const COMMIT_IDLE_MS = 120;
const WHEEL_COMMIT_IDLE_MS = 72;
const WINDOW_BUFFER_LEADING = 5;
const WINDOW_BUFFER_TRAILING = 10;
const GESTURE_ACTIVATE_PX = 4;
const CLICK_CANCEL_DISTANCE_PX = 8;
const LONG_PRESS_TO_DRAG_MS = 260;
const LONG_PRESS_MOVE_TOLERANCE_PX = 14;
const HORIZONTAL_DRAG_GAIN = 1.24;
const INERTIA_MIN_VELOCITY = 0.008; // px/ms
const INERTIA_STOP_VELOCITY = 0.0025; // px/ms
const INERTIA_DECAY_PER_16MS = 0.955;

function clampDurationMinutes(start, end) {
  const s = dayjs(start);
  const e = dayjs(end || start);
  const diff = e.diff(s, 'minute');
  return Math.max(15, Number.isFinite(diff) ? diff : 30);
}

function parseEventInTimezone(value, timezone) {
  if (value == null) return dayjs('');
  if (value instanceof Date) {
    return dayjs(value).tz(timezone);
  }
  if (typeof value === 'number') {
    return dayjs(value).tz(timezone);
  }
  const raw = String(value).trim();
  if (!raw) return dayjs('');
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return dayjs.tz(raw, timezone).startOf('day');
  }
  const hasExplicitZone = /(?:[zZ]|[+\-]\d{2}:?\d{2})$/.test(raw);
  if (hasExplicitZone) {
    return dayjs(raw).tz(timezone);
  }
  return dayjs.tz(raw, timezone);
}

function isReadonlyEvent(event) {
  return !!event?.extendedProps?.readOnly || String(event?.extendedProps?.source || '') === 'caldav';
}

export default function InfiniteCalendarCanvas({
  view,
  timezone,
  anchorDate,
  timeGranularity = 30,
  nudgeDirection = 0,
  onNudgeConsumed,
  events,
  onRangeChange,
  onCenterDateChange,
  onCreateRange,
  onOpenEvent,
  onOpenMore,
  onMoveEvent,
  todayJumpToken = 0,
}) {
  const viewportRef = useRef(null);
  const timeGridScrollRef = useRef(null);
  const longPressTimerRef = useRef(0);
  const userSelectPrevRef = useRef('');
  const commitTimerRef = useRef(0);
  const wheelCommitTimerRef = useRef(0);
  const lastCommitRef = useRef({ rangeStart: '', rangeEnd: '', centerDate: '' });
  const wheelSessionRef = useRef({ active: false, startOffset: 0, delta: 0 });
  const offsetPxRef = useRef(0);
  const panLayerRef = useRef(null);
  const panFrameRef = useRef(0);
  const pendingPanDeltaRef = useRef(Number.NaN);
  const currentPanDeltaRef = useRef(0);
  const inertiaFrameRef = useRef(0);
  const inertiaRef = useRef({
    active: false,
    mode: '',
    delta: 0,
    velocity: 0,
    startOffset: 0,
    startScrollTop: 0,
    lastTs: 0,
  });
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    startOffset: 0,
    axis: '',
    pointerId: null,
    mode: 'navigate',
    eventCandidate: null,
    dragEvent: null,
    lastClientX: 0,
    lastClientY: 0,
    startScrollTop: 0,
    velocity: 0,
    lastInstantVelocity: 0,
    lastMoveTs: 0,
    lastAxisDelta: 0,
    requiresLongPress: false,
    longPressTriggered: false,
    ignoreClickTarget: false,
    captured: false,
  });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [offsetPx, setOffsetPx] = useState(0);
  const [dragVisual, setDragVisual] = useState(null);
  const [eventGestureLocked, setEventGestureLocked] = useState(false);
  const dayColumns = view === 'timeGridWeek' ? 7 : (view === 'timeGridThreeDay' ? 3 : 1);
  const monthDayCellWidth = useMemo(
    () => Math.max(1, (viewportSize.width || 700) / 7),
    [viewportSize.width],
  );
  const dayWidth = useMemo(() => {
    const usable = Math.max(240, (viewportSize.width || 700) - TIME_AXIS_WIDTH);
    return Math.max(84, usable / dayColumns);
  }, [dayColumns, viewportSize.width]);
  const stepPx = view === 'dayGridMonth' ? MONTH_WEEK_HEIGHT : dayWidth;
  const isMonthView = view === 'dayGridMonth';
  const timelineHeight = HEADER_HEIGHT + (24 * HOUR_HEIGHT) + 8;
  const snapMinutes = Math.max(5, Number.parseInt(timeGranularity, 10) || 30);

  const lockTextSelection = useCallback(() => {
    const root = document.documentElement;
    if (!root) return;
    if (!userSelectPrevRef.current) {
      userSelectPrevRef.current = root.style.userSelect || '';
    }
    root.style.userSelect = 'none';
  }, []);

  const unlockTextSelection = useCallback(() => {
    const root = document.documentElement;
    if (!root) return;
    root.style.userSelect = userSelectPrevRef.current || '';
    userSelectPrevRef.current = '';
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = 0;
    }
  }, []);

  const clearWheelCommitTimer = useCallback(() => {
    if (wheelCommitTimerRef.current) {
      window.clearTimeout(wheelCommitTimerRef.current);
      wheelCommitTimerRef.current = 0;
    }
  }, []);

  const abortWheelSession = useCallback(() => {
    clearWheelCommitTimer();
    wheelSessionRef.current.active = false;
    wheelSessionRef.current.startOffset = offsetPxRef.current;
    wheelSessionRef.current.delta = 0;
  }, [clearWheelCommitTimer]);

  useEffect(() => () => {
    unlockTextSelection();
    clearLongPressTimer();
    clearWheelCommitTimer();
    if (commitTimerRef.current) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = 0;
    }
    if (panFrameRef.current) {
      window.cancelAnimationFrame(panFrameRef.current);
      panFrameRef.current = 0;
    }
    if (inertiaFrameRef.current) {
      window.cancelAnimationFrame(inertiaFrameRef.current);
      inertiaFrameRef.current = 0;
    }
    pendingPanDeltaRef.current = Number.NaN;
    currentPanDeltaRef.current = 0;
    wheelSessionRef.current.active = false;
    wheelSessionRef.current.startOffset = offsetPxRef.current;
    wheelSessionRef.current.delta = 0;
    inertiaRef.current.active = false;
    inertiaRef.current.mode = '';
    inertiaRef.current.delta = 0;
    inertiaRef.current.velocity = 0;
    inertiaRef.current.startOffset = 0;
    inertiaRef.current.startScrollTop = 0;
    inertiaRef.current.lastTs = 0;
    const layer = panLayerRef.current;
    if (layer) {
      layer.style.transform = 'translate3d(0, 0, 0)';
    }
  }, [clearLongPressTimer, clearWheelCommitTimer, unlockTextSelection]);

  const commitOffsetPx = useCallback((nextOffset) => {
    if (!Number.isFinite(nextOffset)) return;
    offsetPxRef.current = nextOffset;
    setOffsetPx((prev) => (Math.abs(prev - nextOffset) < 0.01 ? prev : nextOffset));
  }, []);

  const flushPanLayer = useCallback((delta = 0) => {
    const layer = panLayerRef.current;
    if (!layer) return;
    const moveDelta = Number.isFinite(delta) ? delta : 0;
    currentPanDeltaRef.current = moveDelta;
    if (Math.abs(moveDelta) < 0.01) {
      layer.style.transform = 'translate3d(0, 0, 0)';
      return;
    }
    if (isMonthView) {
      layer.style.transform = `translate3d(0, ${moveDelta}px, 0)`;
    } else {
      layer.style.transform = `translate3d(${moveDelta}px, 0, 0)`;
    }
  }, [isMonthView]);

  const schedulePanLayer = useCallback((delta) => {
    pendingPanDeltaRef.current = Number.isFinite(delta) ? delta : 0;
    if (panFrameRef.current) return;
    panFrameRef.current = window.requestAnimationFrame(() => {
      panFrameRef.current = 0;
      flushPanLayer(pendingPanDeltaRef.current);
      pendingPanDeltaRef.current = Number.NaN;
    });
  }, [flushPanLayer]);

  const resetPanLayer = useCallback(() => {
    pendingPanDeltaRef.current = Number.NaN;
    currentPanDeltaRef.current = 0;
    if (panFrameRef.current) {
      window.cancelAnimationFrame(panFrameRef.current);
      panFrameRef.current = 0;
    }
    flushPanLayer(0);
  }, [flushPanLayer]);

  const flushPendingPanDelta = useCallback((fallbackDelta = 0) => {
    const hasPendingDelta = panFrameRef.current !== 0;
    if (panFrameRef.current) {
      window.cancelAnimationFrame(panFrameRef.current);
      panFrameRef.current = 0;
    }
    const pending = pendingPanDeltaRef.current;
    pendingPanDeltaRef.current = Number.NaN;
    const nextDelta = resolvePanDelta({
      hasPendingDelta,
      pendingDelta: hasPendingDelta ? pending : Number.NaN,
      currentDelta: currentPanDeltaRef.current,
      fallbackDelta,
    });
    flushPanLayer(nextDelta);
    return nextDelta;
  }, [flushPanLayer]);

  const cancelInertia = useCallback(() => {
    inertiaRef.current.active = false;
    inertiaRef.current.mode = '';
    inertiaRef.current.delta = 0;
    inertiaRef.current.velocity = 0;
    inertiaRef.current.startOffset = 0;
    inertiaRef.current.startScrollTop = 0;
    inertiaRef.current.lastTs = 0;
    if (inertiaFrameRef.current) {
      window.cancelAnimationFrame(inertiaFrameRef.current);
      inertiaFrameRef.current = 0;
    }
  }, []);

  const settleInertia = useCallback((commit = true) => {
    const snapshot = { ...inertiaRef.current };
    if (!snapshot.active && !snapshot.mode) return;
    cancelInertia();
    if (!commit) return;
    if (snapshot.mode === 'offset') {
      const finalDelta = flushPendingPanDelta(snapshot.delta);
      flushSync(() => {
        commitOffsetPx(snapshot.startOffset - finalDelta);
      });
      resetPanLayer();
      emitCommittedViewport();
      return;
    }
    if (snapshot.mode === 'scroll') {
      const scroller = timeGridScrollRef.current;
      if (scroller) {
        scroller.scrollTop = Math.max(0, snapshot.startScrollTop - snapshot.delta);
      }
      emitCommittedViewport();
    }
  }, [cancelInertia, commitOffsetPx, flushPendingPanDelta, resetPanLayer]);

  const startInertia = useCallback(({
    mode,
    startDelta,
    velocity,
    startOffset,
    startScrollTop,
  }) => {
    const initialDelta = Number.isFinite(startDelta) ? startDelta : 0;
    const initialVelocity = Number.isFinite(velocity) ? velocity : 0;

    if (Math.abs(initialVelocity) < INERTIA_MIN_VELOCITY) {
      if (mode === 'offset') {
        const finalDelta = flushPendingPanDelta(initialDelta);
        flushSync(() => {
          commitOffsetPx(startOffset - finalDelta);
        });
        resetPanLayer();
      } else {
        const scroller = timeGridScrollRef.current;
        if (scroller) {
          scroller.scrollTop = Math.max(0, startScrollTop - initialDelta);
        }
      }
      emitCommittedViewport();
      return;
    }

    settleInertia(false);
    inertiaRef.current = {
      active: true,
      mode,
      delta: initialDelta,
      velocity: initialVelocity,
      startOffset,
      startScrollTop,
      lastTs: 0,
    };

    const tick = (ts) => {
      const state = inertiaRef.current;
      if (!state.active) return;
      if (!state.lastTs) {
        state.lastTs = ts;
        inertiaFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(40, Math.max(8, ts - state.lastTs));
      state.lastTs = ts;
      state.delta += state.velocity * dt;
      state.velocity *= Math.pow(INERTIA_DECAY_PER_16MS, dt / 16);

      if (state.mode === 'offset') {
        flushPanLayer(state.delta);
      } else {
        const scroller = timeGridScrollRef.current;
        if (scroller) {
          scroller.scrollTop = Math.max(0, state.startScrollTop - state.delta);
        }
      }

      if (Math.abs(state.velocity) <= INERTIA_STOP_VELOCITY) {
        settleInertia(true);
        return;
      }
      inertiaFrameRef.current = window.requestAnimationFrame(tick);
    };

    inertiaFrameRef.current = window.requestAnimationFrame(tick);
  }, [commitOffsetPx, flushPanLayer, flushPendingPanDelta, resetPanLayer, settleInertia]);

  const reference = useMemo(() => {
    const base = anchorDate ? dayjs(anchorDate).tz(timezone) : dayjs().tz(timezone);
    if (view === 'dayGridMonth') return base.startOf('week');
    return base.startOf('day');
  }, [anchorDate, timezone, view]);

  useEffect(() => {
    offsetPxRef.current = offsetPx;
  }, [offsetPx]);

  useEffect(() => {
    setOffsetPx(0);
    abortWheelSession();
    cancelInertia();
    resetPanLayer();
  }, [abortWheelSession, anchorDate, cancelInertia, resetPanLayer, view, timezone]);

  useEffect(() => {
    if (!todayJumpToken) return;
    setOffsetPx(0);
    abortWheelSession();
    cancelInertia();
    resetPanLayer();
  }, [abortWheelSession, cancelInertia, resetPanLayer, todayJumpToken]);

  useEffect(() => {
    if (!nudgeDirection) return;
    setOffsetPx((prev) => prev + (nudgeDirection * stepPx));
    abortWheelSession();
    cancelInertia();
    resetPanLayer();
    onNudgeConsumed?.();
  }, [abortWheelSession, cancelInertia, nudgeDirection, onNudgeConsumed, resetPanLayer, stepPx]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setViewportSize({ width: rect.width, height: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cameraSteps = offsetPx / stepPx;

  const visibleWindow = useMemo(() => {
    if (view === 'dayGridMonth') {
      const visibleWeeks = Math.max(6, Math.ceil((viewportSize.height || 1) / MONTH_WEEK_HEIGHT) + 2);
      const startIndex = Math.floor(cameraSteps) - WINDOW_BUFFER_LEADING;
      const endIndex = startIndex + visibleWeeks + WINDOW_BUFFER_LEADING + WINDOW_BUFFER_TRAILING;
      const start = reference.add(startIndex, 'week');
      const end = reference.add(endIndex, 'week').endOf('week');
      return { start, end, startIndex, endIndex };
    }
    const visibleDays = Math.max(dayColumns, Math.ceil(((viewportSize.width || 1) - TIME_AXIS_WIDTH) / dayWidth) + 2);
    const startIndex = Math.floor(cameraSteps) - WINDOW_BUFFER_LEADING;
    const endIndex = startIndex + visibleDays + WINDOW_BUFFER_LEADING + WINDOW_BUFFER_TRAILING;
    const start = reference.add(startIndex, 'day').startOf('day');
    const end = reference.add(endIndex, 'day').endOf('day');
    return { start, end, startIndex, endIndex };
  }, [cameraSteps, dayColumns, dayWidth, reference, view, viewportSize.height, viewportSize.width]);

  const emitCommittedViewport = useCallback(() => {
    const currentStart = view === 'dayGridMonth'
      ? reference.add(Math.floor(cameraSteps), 'week').startOf('week')
      : reference.add(Math.floor(cameraSteps), 'day').startOf('day');
    const spanDays = view === 'dayGridMonth' ? 42 : dayColumns;
    const currentEnd = currentStart.add(spanDays, 'day').endOf('day');
    const rangeStart = visibleWindow.start.toISOString();
    const rangeEnd = visibleWindow.end.toISOString();
    const centerDate = view === 'dayGridMonth'
      ? reference.add(cameraSteps, 'week').format('YYYY-MM-DD')
      : reference.add(cameraSteps, 'day').format('YYYY-MM-DD');

    if (onRangeChange) {
      const sameRange = lastCommitRef.current.rangeStart === rangeStart && lastCommitRef.current.rangeEnd === rangeEnd;
      if (!sameRange) {
        onRangeChange(rangeStart, rangeEnd, {
          displayStart: currentStart.toISOString(),
          displayEnd: currentEnd.toISOString(),
          phase: 'commit',
        });
        lastCommitRef.current.rangeStart = rangeStart;
        lastCommitRef.current.rangeEnd = rangeEnd;
      }
    }

    if (onCenterDateChange && lastCommitRef.current.centerDate !== centerDate) {
      onCenterDateChange(centerDate);
      lastCommitRef.current.centerDate = centerDate;
    }
  }, [cameraSteps, dayColumns, onCenterDateChange, onRangeChange, reference, view, visibleWindow.end, visibleWindow.start]);

  const finalizeWheelSession = useCallback((commit = true) => {
    clearWheelCommitTimer();
    const session = wheelSessionRef.current;
    if (!session.active) return false;
    const startOffset = Number.isFinite(session.startOffset) ? session.startOffset : offsetPxRef.current;
    const totalDelta = Number.isFinite(session.delta) ? session.delta : 0;
    session.active = false;
    session.startOffset = offsetPxRef.current;
    session.delta = 0;
    if (!commit || !shouldCommitWheelSession(totalDelta)) {
      resetPanLayer();
      return false;
    }
    flushSync(() => {
      commitOffsetPx(commitOffsetFromWheelSession(startOffset, totalDelta));
    });
    resetPanLayer();
    return true;
  }, [clearWheelCommitTimer, commitOffsetPx, resetPanLayer]);

  useEffect(() => {
    if (!onRangeChange && !onCenterDateChange) return undefined;
    if (commitTimerRef.current) {
      window.clearTimeout(commitTimerRef.current);
    }
    commitTimerRef.current = window.setTimeout(() => {
      commitTimerRef.current = 0;
      emitCommittedViewport();
    }, COMMIT_IDLE_MS);

    return () => {
      if (commitTimerRef.current) {
        window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = 0;
      }
    };
  }, [cameraSteps, emitCommittedViewport, onCenterDateChange, onRangeChange]);

  useEffect(() => {
    if (isMonthView) return;
    const scroller = timeGridScrollRef.current;
    if (!scroller) return;
    const nowLocal = dayjs().tz(timezone);
    const targetMinute = nowLocal.hour() * 60 + nowLocal.minute();
    const targetTop = Math.max(0, HEADER_HEIGHT + (targetMinute / 60) * HOUR_HEIGHT - (HOUR_HEIGHT * 2));
    scroller.scrollTop = targetTop;
  }, [isMonthView, timezone, todayJumpToken]);

  const openCreateAtPoint = useCallback((clientX, clientY) => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const localX = clientX - rect.left;
    const scrollTop = isMonthView ? 0 : (timeGridScrollRef.current?.scrollTop || 0);
    const localY = clientY - rect.top + scrollTop;
    if (isMonthView) {
      const dayInWeek = Math.max(0, Math.min(6, Math.floor(localX / monthDayCellWidth)));
      const weekIndex = Math.floor((localY / MONTH_WEEK_HEIGHT) + cameraSteps);
      const day = reference.add(weekIndex, 'week').add(dayInWeek, 'day').startOf('day');
      onCreateRange?.({ allDay: true, start: day.toISOString(), end: day.endOf('day').toISOString() });
      return;
    }
    const dayFloat = (localX - TIME_AXIS_WIDTH) / dayWidth + cameraSteps;
    const dayIndex = Math.floor(dayFloat);
    const date = reference.add(dayIndex, 'day').startOf('day');
    const minuteRaw = Math.max(0, Math.min(23 * 60 + 59, Math.round(((localY - HEADER_HEIGHT) / HOUR_HEIGHT) * 60)));
    const minute = Math.floor(minuteRaw / snapMinutes) * snapMinutes;
    const start = date.add(minute, 'minute');
    const end = start.add(snapMinutes, 'minute');
    onCreateRange?.({ allDay: false, start: start.toISOString(), end: end.toISOString() });
  }, [cameraSteps, dayWidth, isMonthView, monthDayCellWidth, onCreateRange, reference, snapMinutes]);

  const computeDragRange = useCallback((drag, clientX, clientY) => {
    if (!drag?.dragEvent) return null;
    const start = parseEventInTimezone(drag.dragEvent.start, timezone);
    if (!start.isValid()) return null;
    const end = drag.dragEvent.end ? parseEventInTimezone(drag.dragEvent.end, timezone) : null;
    const dx = clientX - drag.startX;
    const dy = clientY - drag.startY;
    const dayThreshold = dayWidth * 0.15;
    const dayDelta = dx >= 0
      ? Math.floor((dx + dayThreshold) / dayWidth)
      : Math.ceil((dx - dayThreshold) / dayWidth);
    const minuteDeltaRaw = Math.round((dy / HOUR_HEIGHT) * 60);
    const minuteDelta = Math.round(minuteDeltaRaw / snapMinutes) * snapMinutes;
    if (drag.mode === 'event') {
      let movedStart = start.add(dayDelta, 'day');
      if (!drag.dragEvent.allDay) {
        movedStart = movedStart.add(minuteDelta, 'minute');
      }
      const movedEnd = end
        ? end.add(dayDelta, 'day').add(drag.dragEvent.allDay ? 0 : minuteDelta, 'minute')
        : null;
      return {
        start: movedStart.toISOString(),
        end: movedEnd ? movedEnd.toISOString() : null,
      };
    }
    if (drag.mode === 'resize') {
      if (drag.dragEvent.allDay) return null;
      const baseEnd = end && end.isAfter(start) ? end : start.add(snapMinutes, 'minute');
      let resizedEnd = baseEnd.add(minuteDelta, 'minute');
      const minEnd = start.add(snapMinutes, 'minute');
      if (!resizedEnd.isAfter(minEnd)) {
        resizedEnd = minEnd;
      }
      return {
        start: start.toISOString(),
        end: resizedEnd.toISOString(),
      };
    }
    return null;
  }, [dayWidth, snapMinutes, timezone]);

  const handlePointerDown = useCallback((event) => {
    if (event.button !== 0) return;
    if (event.target.closest('.canvas-ui-action')) return;
    const existingDrag = dragRef.current;
    if (existingDrag.active && existingDrag.pointerId !== event.pointerId) {
      return;
    }
    if (finalizeWheelSession(true)) {
      emitCommittedViewport();
    }
    settleInertia(true);
    const eventNode = event.target.closest('.canvas-event');
    const eventId = eventNode ? eventNode.getAttribute('data-event-id') : null;
    const targetEvent = eventId ? (events || []).find((item) => String(item.id) === String(eventId)) : null;
    const resizeHandle = event.target.closest('.canvas-event-resize');
    const isReadonly = targetEvent ? isReadonlyEvent(targetEvent) : false;
    const dragMode = targetEvent && !isReadonly ? (resizeHandle ? 'resize' : 'event') : 'navigate';
    const requiresLongPress = (dragMode === 'event' || dragMode === 'resize')
      && (event.pointerType === 'touch' || event.pointerType === 'pen');
    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: offsetPxRef.current,
      axis: isMonthView ? 'y' : 'x',
      pointerId: event.pointerId,
      mode: dragMode,
      eventCandidate: eventId,
      dragEvent: targetEvent || null,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      startScrollTop: timeGridScrollRef.current?.scrollTop || 0,
      velocity: 0,
      lastInstantVelocity: 0,
      lastMoveTs: Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now(),
      lastAxisDelta: 0,
      requiresLongPress,
      longPressTriggered: false,
      ignoreClickTarget: false,
      captured: false,
    };
    if (requiresLongPress) {
      clearLongPressTimer();
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = 0;
        const activeDrag = dragRef.current;
        if (!activeDrag.active) return;
        if (activeDrag.pointerId !== event.pointerId) return;
        if (activeDrag.mode !== 'event' && activeDrag.mode !== 'resize') return;
        activeDrag.longPressTriggered = true;
        activeDrag.moved = true;
        activeDrag.ignoreClickTarget = true;
        lockTextSelection();
        if (!activeDrag.captured) {
          viewportRef.current?.setPointerCapture?.(activeDrag.pointerId);
          activeDrag.captured = true;
        }
        setEventGestureLocked(true);
      }, LONG_PRESS_TO_DRAG_MS);
    } else {
      setEventGestureLocked(false);
    }
    if (targetEvent && !isReadonly) {
      dragRef.current.ignoreClickTarget = false;
    }
  }, [clearLongPressTimer, emitCommittedViewport, events, finalizeWheelSession, isMonthView, lockTextSelection, settleInertia]);

  const handlePointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    if (drag.pointerId !== event.pointerId) return;
    drag.lastClientX = event.clientX;
    drag.lastClientY = event.clientY;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (!drag.ignoreClickTarget && (absX > CLICK_CANCEL_DISTANCE_PX || absY > CLICK_CANCEL_DISTANCE_PX)) {
      drag.ignoreClickTarget = true;
    }
    if ((drag.mode === 'event' || drag.mode === 'resize') && drag.requiresLongPress && !drag.longPressTriggered) {
      if (absX <= LONG_PRESS_MOVE_TOLERANCE_PX && absY <= LONG_PRESS_MOVE_TOLERANCE_PX) {
        return;
      }
      clearLongPressTimer();
      if (!isMonthView && absY >= absX * 0.9) {
        drag.mode = 'navigate';
        drag.dragEvent = null;
        drag.eventCandidate = null;
        drag.axis = 'y-manual';
        drag.moved = true;
        drag.ignoreClickTarget = true;
        lockTextSelection();
        if (!drag.captured) {
          event.currentTarget.setPointerCapture?.(drag.pointerId);
          drag.captured = true;
        }
        setEventGestureLocked(false);
        return;
      }
      if (drag.mode === 'event' && absX > absY * 1.35) {
        drag.mode = 'navigate';
        drag.dragEvent = null;
        drag.eventCandidate = null;
        drag.axis = 'x';
        drag.moved = true;
        drag.ignoreClickTarget = true;
        lockTextSelection();
        if (!drag.captured) {
          event.currentTarget.setPointerCapture?.(drag.pointerId);
          drag.captured = true;
        }
        setEventGestureLocked(false);
      } else {
        return;
      }
    }
    if (drag.mode === 'event' || drag.mode === 'resize') {
      // On editable cards, prioritize horizontal swipe navigation over event drag.
      if (
        drag.mode === 'event'
        && !drag.moved
        && absX > GESTURE_ACTIVATE_PX
        && absX > absY * 1.35
      ) {
        clearLongPressTimer();
        drag.mode = 'navigate';
        drag.dragEvent = null;
        drag.eventCandidate = null;
        setEventGestureLocked(false);
      }
    }
    if (drag.mode === 'event' || drag.mode === 'resize') {
      if (!drag.moved && (absX > GESTURE_ACTIVATE_PX || absY > GESTURE_ACTIVATE_PX)) {
        drag.moved = true;
        lockTextSelection();
        if (!drag.captured) {
          event.currentTarget.setPointerCapture?.(drag.pointerId);
          drag.captured = true;
        }
      }
      if (drag.moved) {
        setEventGestureLocked(true);
        setDragVisual({
          eventId: drag.dragEvent?.id,
          mode: drag.mode,
          dx,
          dy,
        });
        event.preventDefault();
      }
      return;
    }
    if (!drag.moved) {
      if (isMonthView) {
        if (absY > GESTURE_ACTIVATE_PX && absY >= absX * 0.72) {
          drag.moved = true;
          drag.axis = 'y';
          lockTextSelection();
        }
      } else {
        const hasIntent = absX > GESTURE_ACTIVATE_PX || absY > GESTURE_ACTIVATE_PX;
        if (hasIntent) {
          if (absX >= absY * 0.92) {
            drag.moved = true;
            drag.axis = 'x';
            lockTextSelection();
          } else if (absY > absX * 1.1) {
            // Let native vertical scroll handle this gesture in time-grid views.
            drag.moved = true;
            drag.axis = 'y-native';
            drag.ignoreClickTarget = true;
          }
        }
      }
      if (drag.moved && !drag.captured && (isMonthView || drag.axis === 'x')) {
        event.currentTarget.setPointerCapture?.(drag.pointerId);
        drag.captured = true;
      }
    }
    if (!drag.moved) return;
    if (drag.mode === 'navigate') {
      if (!isMonthView && drag.axis === 'y-native') {
        // Let browser native scrolling/inertia run on vertical gestures.
        return;
      }
      const axisDelta = drag.axis === 'x'
        ? (dx * HORIZONTAL_DRAG_GAIN)
        : dy;
      const nowTs = Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now();
      const dt = Math.max(1, nowTs - (drag.lastMoveTs || nowTs));
      const instantVelocity = (axisDelta - (drag.lastAxisDelta || 0)) / dt;
      drag.lastInstantVelocity = instantVelocity;
      drag.velocity = drag.velocity
        ? (drag.velocity * 0.55) + (instantVelocity * 0.45)
        : instantVelocity;
      drag.lastMoveTs = nowTs;
      drag.lastAxisDelta = axisDelta;

      if (drag.axis === 'x' || isMonthView) {
        schedulePanLayer(axisDelta);
      } else {
        const scroller = timeGridScrollRef.current;
        if (scroller) {
          scroller.scrollTop = Math.max(0, drag.startScrollTop - dy);
        }
      }
      if (event.cancelable) event.preventDefault();
    }
  }, [clearLongPressTimer, isMonthView, lockTextSelection, schedulePanLayer]);

  const handlePointerUp = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    if (drag.pointerId !== event.pointerId) return;
    clearLongPressTimer();
    setEventGestureLocked(false);
    const wasMoved = !!drag.moved;
    const eventCandidate = drag.eventCandidate;
    const pointerId = drag.pointerId;
    const endX = drag.lastClientX || event.clientX;
    const endY = drag.lastClientY || event.clientY;
    dragRef.current.active = false;
    unlockTextSelection();
    setDragVisual(null);
    if (drag.captured && event.currentTarget.hasPointerCapture?.(pointerId)) {
      event.currentTarget.releasePointerCapture(pointerId);
    }
    drag.captured = false;
    if (!wasMoved) {
      resetPanLayer();
      if (drag.ignoreClickTarget) {
        return;
      }
      if (eventCandidate) {
        const targetEvent = (events || []).find((item) => String(item.id) === String(eventCandidate));
        if (targetEvent) {
          onOpenEvent?.(targetEvent);
          return;
        }
      }
      openCreateAtPoint(endX, endY);
      return;
    }

    const totalMoveDistance = Math.hypot(endX - drag.startX, endY - drag.startY);
    if (
      (drag.mode === 'event' || drag.mode === 'resize')
      && drag.dragEvent
      && onMoveEvent
      && totalMoveDistance > 2
    ) {
      const range = computeDragRange(drag, endX, endY);
      if (range) {
        if (drag.mode === 'event') {
        onMoveEvent({
          type: 'move',
          event: drag.dragEvent,
          start: range.start,
          end: range.end,
          allDay: !!drag.dragEvent.allDay,
        });
        } else {
        onMoveEvent({
          type: 'resize',
          event: drag.dragEvent,
          start: range.start,
          end: range.end,
          allDay: false,
        });
        }
      }
    }
    if (drag.mode === 'navigate') {
      if (!isMonthView && drag.axis === 'y-native') {
        resetPanLayer();
        emitCommittedViewport();
        return;
      }
      const gestureDelta = drag.axis === 'x'
        ? ((endX - drag.startX) * HORIZONTAL_DRAG_GAIN)
        : (endY - drag.startY);
      if (drag.axis === 'x' || isMonthView) {
        const releaseVelocity = Math.abs(drag.lastInstantVelocity || 0) > Math.abs(drag.velocity || 0)
          ? (drag.lastInstantVelocity || 0)
          : (drag.velocity || 0);
        startInertia({
          mode: 'offset',
          startDelta: gestureDelta,
          velocity: releaseVelocity,
          startOffset: drag.startOffset,
          startScrollTop: drag.startScrollTop,
        });
      } else {
        startInertia({
          mode: 'scroll',
          startDelta: gestureDelta,
          velocity: drag.velocity || 0,
          startOffset: offsetPxRef.current,
          startScrollTop: drag.startScrollTop,
        });
      }
      return;
    }
    emitCommittedViewport();
  }, [
    computeDragRange,
    emitCommittedViewport,
    events,
    isMonthView,
    onMoveEvent,
    onOpenEvent,
    openCreateAtPoint,
    startInertia,
    unlockTextSelection,
    clearLongPressTimer,
  ]);

  const handleWheel = useCallback((event) => {
    const axis = isMonthView ? 'y' : 'x';
    if (!isMonthView) {
      const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey;
      if (!horizontalIntent) {
        return;
      }
    }
    const delta = axis === 'y'
      ? event.deltaY
      : (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : (event.shiftKey ? event.deltaY : 0));
    if (!delta) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();

    const session = wheelSessionRef.current;
    if (!session.active) {
      settleInertia(true);
      session.active = true;
      session.startOffset = offsetPxRef.current;
      session.delta = 0;
    }
    session.delta += delta;
    schedulePanLayer(-session.delta);
    clearWheelCommitTimer();
    wheelCommitTimerRef.current = window.setTimeout(() => {
      wheelCommitTimerRef.current = 0;
      if (finalizeWheelSession(true)) {
        emitCommittedViewport();
      }
    }, WHEEL_COMMIT_IDLE_MS);
  }, [clearWheelCommitTimer, emitCommittedViewport, finalizeWheelSession, isMonthView, schedulePanLayer, settleInertia]);

  const weekDayLabels = ['日', '一', '二', '三', '四', '五', '六'];

  const renderTimeGrid = () => {
    const startIndex = visibleWindow.startIndex;
    const endIndex = visibleWindow.endIndex;
    const columns = [];
    for (let i = startIndex; i < endIndex; i += 1) {
      const day = reference.add(i, 'day');
      const x = TIME_AXIS_WIDTH + (i - cameraSteps) * dayWidth;
      columns.push(
        <div key={`day-${i}`} className="pointer-events-none absolute top-0 bottom-0 border-l border-blue-100" style={{ left: x, width: dayWidth }}>
          <div className="pointer-events-none sticky top-0 z-50 flex h-9 items-center justify-center border-b border-blue-100 bg-white/95 px-1 text-center text-xs font-semibold text-slate-700 backdrop-blur" style={{ zIndex: 70 }}>
            {day.format('M/D')} / 周{weekDayLabels[day.day()]}
          </div>
        </div>
      );
    }

    const hourLines = [];
    for (let h = 0; h <= 24; h += 1) {
      const y = HEADER_HEIGHT + h * HOUR_HEIGHT;
      hourLines.push(
        <div key={`h-${h}`} className="pointer-events-none absolute left-0 right-0 border-t border-blue-100" style={{ top: y }} />
      );
    }

    const timeAxis = [];
    for (let h = 0; h < 24; h += 1) {
      const y = HEADER_HEIGHT + h * HOUR_HEIGHT;
      timeAxis.push(
        <div key={`t-${h}`} className="pointer-events-none absolute left-0 z-40 flex items-start justify-end pr-2 text-[11px] font-semibold text-blue-500" style={{ top: y + 2, width: TIME_AXIS_WIDTH }}>
          {String(h).padStart(2, '0')}:00
        </div>
      );
    }

    const timedByDay = new Map();
    (events || []).forEach((event) => {
      const start = parseEventInTimezone(event?.start, timezone);
      if (!start.isValid() || event?.allDay) return;
      const dayKey = start.format('YYYY-MM-DD');
      const list = timedByDay.get(dayKey) || [];
      const end = event?.end ? parseEventInTimezone(event.end, timezone) : start.add(30, 'minute');
      list.push({
        event,
        start,
        end: end.isAfter(start) ? end : start.add(30, 'minute'),
      });
      timedByDay.set(dayKey, list);
    });

    const layoutByEventId = new Map();
    timedByDay.forEach((list) => {
      const sorted = [...list].sort((a, b) => {
        const diff = a.start.valueOf() - b.start.valueOf();
        if (diff !== 0) return diff;
        return a.end.valueOf() - b.end.valueOf();
      });
      const active = [];
      const clusterItems = [];
      let clusterMaxCols = 0;

      const finalizeCluster = () => {
        if (!clusterItems.length) return;
        clusterItems.forEach((item) => {
          layoutByEventId.set(String(item.event.id), { col: item.col, cols: clusterMaxCols });
        });
        clusterItems.length = 0;
        clusterMaxCols = 0;
      };

      sorted.forEach((item) => {
        for (let i = active.length - 1; i >= 0; i -= 1) {
          if (!active[i].end.isAfter(item.start)) active.splice(i, 1);
        }
        if (active.length === 0) {
          finalizeCluster();
        }
        const used = new Set(active.map((entry) => entry.col));
        let col = 0;
        while (used.has(col)) col += 1;
        const placed = { ...item, col };
        active.push(placed);
        clusterItems.push(placed);
        clusterMaxCols = Math.max(clusterMaxCols, active.length, col + 1);
      });
      finalizeCluster();
    });

    const blocks = (events || []).flatMap((event) => {
      const start = parseEventInTimezone(event?.start, timezone);
      if (!start.isValid()) return [];
      const allDay = !!event?.allDay;
      const dayIndex = start.startOf('day').diff(reference, 'day');
      const columnBaseLeft = TIME_AXIS_WIDTH + (dayIndex - cameraSteps) * dayWidth + 2;
      const slotWidth = Math.max(20, dayWidth - 6);
      const layout = allDay ? { col: 0, cols: 1 } : (layoutByEventId.get(String(event.id)) || { col: 0, cols: 1 });
      const cols = Math.max(1, layout.cols || 1);
      const col = Math.max(0, Math.min(cols - 1, layout.col || 0));
      const colWidth = slotWidth / cols;
      const x = columnBaseLeft + col * colWidth;
      const width = Math.max(18, colWidth - 2);
      const minuteOfDay = allDay ? 0 : (start.hour() * 60 + start.minute());
      const y = allDay ? HEADER_HEIGHT + 2 : (HEADER_HEIGHT + (minuteOfDay / 60) * HOUR_HEIGHT + 1);
      const durationMin = allDay ? 30 : clampDurationMinutes(event.start, event.end);
      const h = Math.max(18, (durationMin / 60) * HOUR_HEIGHT - 2);
      const contentHeight = Math.max(12, h - 4);
      const lineHeight = 14;
      const maxLines = Math.max(1, Math.floor(contentHeight / lineHeight));
      const titleStyle = maxLines <= 1
        ? {
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            lineHeight: `${lineHeight}px`,
          }
        : {
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: maxLines,
            overflow: 'hidden',
            whiteSpace: 'normal',
            lineHeight: `${lineHeight}px`,
            wordBreak: 'break-word',
          };
      const status = event?.extendedProps?.status || 'pending';
      const readonly = isReadonlyEvent(event);
      return [{
        event,
        style: {
          left: x,
          top: y,
          width,
          height: h,
        },
        className: `canvas-event absolute z-20 overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] ${
          readonly
            ? 'bg-slate-500/85 text-white'
            : status === 'completed'
              ? 'bg-emerald-500/80 text-white line-through'
              : 'bg-blue-600/80 text-white'
        }`,
        titleStyle,
      }];
    });

    return (
      <>
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 z-30 border-r border-blue-100 bg-white/95"
          style={{ width: TIME_AXIS_WIDTH }}
        />
        {hourLines}
        {timeAxis}
        <div
          ref={panLayerRef}
          className="absolute inset-0 will-change-transform"
        >
          {columns}
          {blocks.map(({ event, style, className, titleStyle }) => {
            const isDraggingThis = dragVisual && String(dragVisual.eventId) === String(event.id);
            const readonly = isReadonlyEvent(event);
            const visualStyle = isDraggingThis
              ? {
                  ...style,
                  transform: `translate3d(${dragVisual.mode === 'event' ? dragVisual.dx : 0}px, ${dragVisual.mode === 'event' ? dragVisual.dy : 0}px, 0)`,
                  height: dragVisual.mode === 'resize'
                    ? Math.max(18, (style.height || 18) + dragVisual.dy)
                    : style.height,
                  zIndex: 90,
                }
              : style;
            return (
            <div
              key={event.id}
              data-event-id={event.id}
              className={`${className} ${readonly ? '' : 'cursor-grab active:cursor-grabbing'} ${isDraggingThis ? 'shadow-lg' : ''}`}
              style={{
                ...visualStyle,
                touchAction: isMonthView ? 'none' : (readonly ? 'pan-y' : 'none'),
                WebkitUserSelect: 'none',
              }}
            >
              <span className="block" style={titleStyle}>{event.title || 'Untitled'}</span>
              {!readonly && !event?.allDay && (
                <span
                  className="canvas-event-resize absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize"
                  style={{ touchAction: 'none' }}
                />
              )}
            </div>
            );
          })}
        </div>
      </>
    );
  };

  const renderMonthGrid = () => {
    const startIndex = visibleWindow.startIndex;
    const endIndex = visibleWindow.endIndex;
    const dayCellWidth = monthDayCellWidth;
    const rows = [];

    for (let w = startIndex; w < endIndex; w += 1) {
      const weekStart = reference.add(w, 'week');
      const y = HEADER_HEIGHT + (w - cameraSteps) * MONTH_WEEK_HEIGHT;
      rows.push(
        <div key={`w-${w}`} className="pointer-events-none absolute left-0 right-0 border-t border-blue-100" style={{ top: y, height: MONTH_WEEK_HEIGHT }}>
          {Array.from({ length: 7 }).map((_, d) => {
            const day = weekStart.add(d, 'day');
            return (
              <div
                key={`${w}-${d}`}
                className="pointer-events-none absolute border-l border-blue-100 text-left"
                style={{ left: d * dayCellWidth, width: dayCellWidth, height: MONTH_WEEK_HEIGHT }}
              >
                <span className="pointer-events-none block px-1.5 pt-1 text-xs font-semibold text-slate-700">{day.format('M/D')}</span>
              </div>
            );
          })}
        </div>
      );
    }

    const byCell = new Map();
    (events || []).forEach((event) => {
      const start = parseEventInTimezone(event?.start, timezone);
      if (!start.isValid()) return;
      const weekIndex = start.startOf('week').diff(reference, 'week');
      const day = start.day();
      const key = `${weekIndex}|${day}`;
      const list = byCell.get(key) || [];
      list.push({ event, start });
      byCell.set(key, list);
    });

    const monthEvents = [];
    const moreIndicators = [];
    byCell.forEach((list, key) => {
      const [weekPart, dayPart] = key.split('|');
      const weekIndex = Number.parseInt(weekPart, 10);
      const day = Number.parseInt(dayPart, 10);
      if (!Number.isFinite(weekIndex) || !Number.isFinite(day)) return;
      const sorted = [...list].sort((a, b) => a.start.valueOf() - b.start.valueOf());
      const visible = sorted.slice(0, 6);
      const hidden = sorted.slice(6);

      visible.forEach((item, slotIndex) => {
        const y = HEADER_HEIGHT + (weekIndex - cameraSteps) * MONTH_WEEK_HEIGHT + 22 + slotIndex * 19;
        const x = day * dayCellWidth + 2;
        const readonly = isReadonlyEvent(item.event);
        monthEvents.push(
          <div
            key={item.event.id}
            data-event-id={item.event.id}
            className={`canvas-event absolute h-5 overflow-hidden rounded px-1 text-[10px] ${
              readonly ? 'bg-slate-500/85 text-white' : 'bg-blue-600/80 text-white'
            }`}
            style={{ left: x, top: y, width: dayCellWidth - 5 }}
          >
            {item.event.title || 'Untitled'}
          </div>
        );
      });

      if (hidden.length > 0) {
        const dayDate = reference.add(weekIndex, 'week').add(day, 'day');
        const y = HEADER_HEIGHT + (weekIndex - cameraSteps) * MONTH_WEEK_HEIGHT + 22 + 6 * 19;
        const x = day * dayCellWidth + 2;
        moreIndicators.push(
          <button
            key={`more-${key}`}
            type="button"
            className="canvas-ui-action absolute h-5 rounded px-1 text-left text-[10px] font-semibold text-blue-700 hover:bg-blue-50"
            style={{ left: x, top: y, width: dayCellWidth - 5 }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenMore?.({
                date: dayDate.toISOString(),
                events: sorted.map((item) => item.event),
              });
            }}
          >
            +{hidden.length} more
          </button>
        );
      }
    });

    return (
      <>
        <div className="pointer-events-none sticky top-0 z-20 flex h-9 border-b border-blue-100 bg-white/95 text-xs font-semibold text-slate-600 backdrop-blur">
          {weekDayLabels.map((label) => (
            <div key={label} className="pointer-events-none flex items-center justify-center border-l border-blue-100" style={{ width: dayCellWidth }}>
              周{label}
            </div>
          ))}
        </div>
        <div
          ref={panLayerRef}
          className="absolute inset-x-0 top-0 bottom-0 will-change-transform"
        >
          {rows}
          {monthEvents}
          {moreIndicators}
        </div>
      </>
    );
  };

  return (
    <div
      ref={viewportRef}
      className="relative h-full overflow-hidden bg-white"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        touchAction: isMonthView ? 'none' : (eventGestureLocked ? 'none' : 'pan-y'),
        overscrollBehaviorX: 'none',
        overscrollBehaviorY: isMonthView ? 'none' : 'contain',
      }}
    >
      {isMonthView ? (
        <div className="absolute inset-0">
          {renderMonthGrid()}
        </div>
      ) : (
        <div
          ref={timeGridScrollRef}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden"
          style={{ touchAction: eventGestureLocked ? 'none' : 'pan-y' }}
        >
          <div className="relative" style={{ height: timelineHeight }}>
            {renderTimeGrid()}
          </div>
        </div>
      )}
    </div>
  );
}
