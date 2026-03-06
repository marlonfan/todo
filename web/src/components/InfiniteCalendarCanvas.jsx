import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { flushSync } from 'react-dom';
import { commitOffsetFromWheelSession, resolvePanDelta, shouldCommitWheelSession } from './canvasMotionMath';

const HOUR_HEIGHT = 56;
const MONTH_WEEK_HEIGHT = 164;
const MONTH_NATIVE_WEEKS_BEFORE = 24;
const MONTH_NATIVE_WEEKS_AFTER = 36;
const MONTH_HEADER_HEIGHT = 36;
const TIMEGRID_HEADER_HEIGHT = 60;
const TIMEGRID_BODY_GAP = 8;
const TIMEGRID_BODY_TOP = TIMEGRID_HEADER_HEIGHT + TIMEGRID_BODY_GAP;
const TIMEGRID_BODY_HEIGHT = 24 * HOUR_HEIGHT;
const TIME_AXIS_WIDTH = 46;
const TIMELINE_BOTTOM_SPACER_DESKTOP = 24;
const TIMELINE_BOTTOM_SPACER_MOBILE = 100;
const COMMIT_IDLE_MS = 120;
const WHEEL_COMMIT_IDLE_MS = 72;
const WINDOW_BUFFER_LEADING = 5;
const WINDOW_BUFFER_TRAILING = 10;
const GESTURE_ACTIVATE_PX = 4;
const CLICK_CANCEL_DISTANCE_PX = 8;
const LONG_PRESS_TO_DRAG_MS = 260;
const LONG_PRESS_MOVE_TOLERANCE_PX = 14;
const HORIZONTAL_DRAG_GAIN = 1.24;
const NON_MONTH_SMALL_DRAG_BOOST = 0.42;
const INERTIA_MIN_VELOCITY = 0.008; // px/ms
const INERTIA_STOP_VELOCITY = 0.0025; // px/ms
const INERTIA_DECAY_PER_16MS = 0.955;
const SNAP_TRANSITION_MS = 110;
const NON_MONTH_MIN_SWITCH_PX = 22;

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

function buildEventInstanceBaseKey(event) {
  const ext = event?.extendedProps || {};
  return [
    String(event?.id || ''),
    String(event?.start || ''),
    String(event?.end || ''),
    event?.allDay ? '1' : '0',
    String(ext?.instanceId || ''),
    String(ext?.externalId || ''),
    String(ext?.segmentDate || ''),
  ].join('|');
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
  const monthScrollRef = useRef(null);
  const longPressTimerRef = useRef(0);
  const userSelectPrevRef = useRef('');
  const commitTimerRef = useRef(0);
  const wheelCommitTimerRef = useRef(0);
  const lastCommitRef = useRef({ rangeStart: '', rangeEnd: '', centerDate: '' });
  const emitCommittedViewportRef = useRef(() => {});
  const wheelSessionRef = useRef({ active: false, startOffset: 0, delta: 0 });
  const offsetPxRef = useRef(0);
  const panLayerRef = useRef(null);
  const timeGridHeaderPanLayerRef = useRef(null);
  const timeGridSwipeMaskRef = useRef(null);
  const panSnapTimerRef = useRef(0);
  const panSnapFinishRef = useRef(null);
  const panFrameRef = useRef(0);
  const monthScrollFrameRef = useRef(0);
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
    suppressShortSnap: false,
    ignoreClickTarget: false,
    captured: false,
  });
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }));
  const [offsetPx, setOffsetPx] = useState(0);
  const [dragVisual, setDragVisual] = useState(null);
  const [eventGestureLocked, setEventGestureLocked] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
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
  const snapUnitSteps = view === 'timeGridWeek' ? 7 : (view === 'timeGridThreeDay' ? 3 : 1);
  const isMonthView = view === 'dayGridMonth';
  const isMobileViewport = (viewportSize.width || 0) <= 768;
  const timelineBottomSpacer = isMobileViewport ? TIMELINE_BOTTOM_SPACER_MOBILE : TIMELINE_BOTTOM_SPACER_DESKTOP;
  const timelineHeight = TIMEGRID_BODY_TOP + TIMEGRID_BODY_HEIGHT;
  const timelineScrollableHeight = timelineHeight + timelineBottomSpacer;
  const snapMinutes = Math.max(5, Number.parseInt(timeGranularity, 10) || 30);
  const todayDateKey = useMemo(
    () => dayjs(nowTick).tz(timezone).format('YYYY-MM-DD'),
    [nowTick, timezone],
  );
  const eventEntries = useMemo(() => {
    const list = Array.isArray(events) ? events : [];
    const seen = new Map();
    return list.map((event) => {
      const baseKey = buildEventInstanceBaseKey(event);
      const duplicateIndex = seen.get(baseKey) || 0;
      seen.set(baseKey, duplicateIndex + 1);
      const key = duplicateIndex === 0 ? baseKey : `${baseKey}#${duplicateIndex}`;
      return { key, event };
    });
  }, [events]);
  const eventByKey = useMemo(() => {
    const index = new Map();
    eventEntries.forEach((entry) => {
      index.set(entry.key, entry.event);
    });
    return index;
  }, [eventEntries]);

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

  const flushPanSnapAnimation = useCallback(() => {
    const finish = panSnapFinishRef.current;
    if (!finish) return false;
    panSnapFinishRef.current = null;
    if (panSnapTimerRef.current) {
      window.clearTimeout(panSnapTimerRef.current);
      panSnapTimerRef.current = 0;
    }
    finish();
    return true;
  }, []);

  const mapHorizontalGestureDelta = useCallback((dx) => {
    const base = (Number.isFinite(dx) ? dx : 0) * HORIZONTAL_DRAG_GAIN;
    if (isMonthView) return base;
    const boostWindowPx = Math.max(28, Math.min(72, stepPx * 0.55));
    const absDx = Math.abs(dx || 0);
    if (absDx >= boostWindowPx) return base;
    const boost = 1 + (((boostWindowPx - absDx) / boostWindowPx) * NON_MONTH_SMALL_DRAG_BOOST);
    return base * boost;
  }, [isMonthView, stepPx]);

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
    if (panSnapTimerRef.current) {
      window.clearTimeout(panSnapTimerRef.current);
      panSnapTimerRef.current = 0;
    }
    panSnapFinishRef.current = null;
    if (monthScrollFrameRef.current) {
      window.cancelAnimationFrame(monthScrollFrameRef.current);
      monthScrollFrameRef.current = 0;
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
      layer.style.transition = 'none';
      layer.style.transform = 'translate3d(0, 0, 0)';
    }
    const headerLayer = timeGridHeaderPanLayerRef.current;
    if (headerLayer) {
      headerLayer.style.transition = 'none';
      headerLayer.style.transform = 'translate3d(0, 0, 0)';
    }
    const mask = timeGridSwipeMaskRef.current;
    if (mask) {
      mask.style.opacity = '0';
    }
  }, [clearLongPressTimer, clearWheelCommitTimer, unlockTextSelection]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const commitOffsetPx = useCallback((nextOffset) => {
    if (!Number.isFinite(nextOffset)) return;
    offsetPxRef.current = nextOffset;
    setOffsetPx((prev) => (Math.abs(prev - nextOffset) < 0.01 ? prev : nextOffset));
  }, []);

  const flushPanLayer = useCallback((delta = 0) => {
    const layer = panLayerRef.current;
    if (!layer) return;
    const headerLayer = timeGridHeaderPanLayerRef.current;
    const mask = timeGridSwipeMaskRef.current;
    const rawDelta = Number.isFinite(delta) ? delta : 0;
    const moveDelta = isMonthView ? rawDelta : Math.round(rawDelta);
    currentPanDeltaRef.current = moveDelta;
    if (Math.abs(moveDelta) < 0.01) {
      layer.style.transform = 'translate3d(0, 0, 0)';
      if (headerLayer) headerLayer.style.transform = 'translate3d(0, 0, 0)';
      if (mask) mask.style.opacity = '0';
      return;
    }
    if (isMonthView) {
      layer.style.transform = `translate3d(0, ${moveDelta}px, 0)`;
      if (headerLayer) headerLayer.style.transform = 'translate3d(0, 0, 0)';
      if (mask) mask.style.opacity = '0';
    } else {
      layer.style.transform = `translate3d(${moveDelta}px, 0, 0)`;
      if (headerLayer) headerLayer.style.transform = `translate3d(${moveDelta}px, 0, 0)`;
      if (mask) mask.style.opacity = '0';
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
    if (panSnapTimerRef.current) {
      window.clearTimeout(panSnapTimerRef.current);
      panSnapTimerRef.current = 0;
    }
    panSnapFinishRef.current = null;
    const layer = panLayerRef.current;
    if (layer) layer.style.transition = 'none';
    const headerLayer = timeGridHeaderPanLayerRef.current;
    if (headerLayer) headerLayer.style.transition = 'none';
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

  const animatePanLayerTo = useCallback((targetDelta, durationMs, onDone) => {
    const layer = panLayerRef.current;
    const headerLayer = timeGridHeaderPanLayerRef.current;
    if (!layer || durationMs <= 0) {
      flushPanLayer(targetDelta);
      onDone?.();
      return;
    }
    if (panSnapTimerRef.current) {
      window.clearTimeout(panSnapTimerRef.current);
      panSnapTimerRef.current = 0;
    }
    const transition = `transform ${durationMs}ms cubic-bezier(0.16, 1, 0.3, 1)`;
    panSnapFinishRef.current = () => {
      if (layer) layer.style.transition = 'none';
      if (headerLayer) headerLayer.style.transition = 'none';
      onDone?.();
    };
    layer.style.transition = transition;
    if (headerLayer) headerLayer.style.transition = transition;
    flushPanLayer(targetDelta);
    panSnapTimerRef.current = window.setTimeout(() => {
      panSnapTimerRef.current = 0;
      const finish = panSnapFinishRef.current;
      panSnapFinishRef.current = null;
      finish?.();
    }, durationMs + 20);
  }, [flushPanLayer]);

  const commitOffsetAfterGesture = useCallback((startOffset, fallbackDelta, withSnapAnimation = false) => {
    const finalDelta = flushPendingPanDelta(fallbackDelta);
    if (isMonthView) {
      flushSync(() => {
        commitOffsetPx(startOffset - finalDelta);
      });
      resetPanLayer();
      emitCommittedViewportRef.current?.();
      return;
    }

    const rawOffset = startOffset - finalDelta;
    const unitPx = Math.max(1, stepPx * snapUnitSteps);
    const startUnit = Math.round(startOffset / unitPx);
    let snappedUnit = Math.round(rawOffset / unitPx);
    if (snappedUnit === startUnit && Math.abs(finalDelta) >= NON_MONTH_MIN_SWITCH_PX) {
      snappedUnit = startUnit + (finalDelta > 0 ? -1 : 1);
    }
    const snappedOffset = snappedUnit * unitPx;
    const snapDelta = startOffset - snappedOffset;
    const finish = () => {
      flushSync(() => {
        commitOffsetPx(snappedOffset);
      });
      resetPanLayer();
      emitCommittedViewportRef.current?.();
    };
    if (withSnapAnimation && Math.abs(snapDelta - finalDelta) > 0.6) {
      animatePanLayerTo(snapDelta, SNAP_TRANSITION_MS, finish);
      return;
    }
    finish();
  }, [animatePanLayerTo, commitOffsetPx, flushPendingPanDelta, isMonthView, resetPanLayer, snapUnitSteps, stepPx]);

  const settleInertia = useCallback((commit = true) => {
    const snapshot = { ...inertiaRef.current };
    if (!snapshot.active && !snapshot.mode) return;
    cancelInertia();
    if (!commit) return;
    if (snapshot.mode === 'offset') {
      commitOffsetAfterGesture(snapshot.startOffset, snapshot.delta, false);
      return;
    }
    if (snapshot.mode === 'scroll') {
      const scroller = timeGridScrollRef.current;
      if (scroller) {
        scroller.scrollTop = Math.max(0, snapshot.startScrollTop - snapshot.delta);
      }
      emitCommittedViewportRef.current?.();
    }
  }, [cancelInertia, commitOffsetAfterGesture]);

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
        commitOffsetAfterGesture(startOffset, initialDelta, !isMonthView);
      } else {
        const scroller = timeGridScrollRef.current;
        if (scroller) {
          scroller.scrollTop = Math.max(0, startScrollTop - initialDelta);
        }
      }
      if (mode !== 'offset') {
        emitCommittedViewportRef.current?.();
      }
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
        if (!isMonthView) {
          const maxVisualDelta = stepPx * Math.max(3, WINDOW_BUFFER_LEADING - 1);
          if (Math.abs(state.delta) > maxVisualDelta) {
            const overflow = state.delta > 0
              ? (state.delta - maxVisualDelta)
              : (state.delta + maxVisualDelta);
            const shiftSteps = overflow > 0
              ? Math.floor(overflow / stepPx)
              : Math.ceil(overflow / stepPx);
            if (shiftSteps) {
              const shiftPx = shiftSteps * stepPx;
              state.startOffset -= shiftPx;
              state.delta -= shiftPx;
              commitOffsetPx(state.startOffset);
            }
          }
        }
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
  }, [commitOffsetAfterGesture, commitOffsetPx, flushPanLayer, isMonthView, settleInertia, stepPx]);

  const reference = useMemo(() => {
    const base = anchorDate ? dayjs(anchorDate).tz(timezone) : dayjs().tz(timezone);
    if (view === 'dayGridMonth') return base.startOf('week');
    if (view === 'timeGridWeek') return base.startOf('week');
    return base.startOf('day');
  }, [anchorDate, timezone, view]);
  const monthNativeStartWeek = useMemo(
    () => reference.subtract(MONTH_NATIVE_WEEKS_BEFORE, 'week').startOf('week'),
    [reference],
  );
  const monthNativeWeeksCount = MONTH_NATIVE_WEEKS_BEFORE + MONTH_NATIVE_WEEKS_AFTER + 1;

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

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    setViewportSize((prev) => {
      if (Math.abs(prev.width - rect.width) < 0.5 && Math.abs(prev.height - rect.height) < 0.5) {
        return prev;
      }
      return { width: rect.width, height: rect.height };
    });
  }, [view]);

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
  emitCommittedViewportRef.current = emitCommittedViewport;

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

  const emitMonthViewportFromScroll = useCallback((scrollTopValue = Number.NaN) => {
    if (!isMonthView) return;
    const scroller = monthScrollRef.current;
    if (!scroller) return;

    const rawScrollTop = Number.isFinite(scrollTopValue) ? scrollTopValue : scroller.scrollTop;
    const topInRows = Math.max(0, rawScrollTop - MONTH_HEADER_HEIGHT);
    const rowsViewportHeight = Math.max(1, (scroller.clientHeight || 1) - MONTH_HEADER_HEIGHT);
    const startWeekOffset = Math.max(0, Math.min(
      monthNativeWeeksCount - 1,
      Math.floor(topInRows / MONTH_WEEK_HEIGHT),
    ));
    const visibleWeeks = Math.max(1, Math.ceil(rowsViewportHeight / MONTH_WEEK_HEIGHT));
    const rangeStartOffset = Math.max(0, startWeekOffset - WINDOW_BUFFER_LEADING);
    const rangeEndOffset = Math.min(
      monthNativeWeeksCount - 1,
      startWeekOffset + visibleWeeks + WINDOW_BUFFER_TRAILING,
    );
    const rangeStart = monthNativeStartWeek.add(rangeStartOffset, 'week').startOf('week');
    const rangeEnd = monthNativeStartWeek.add(rangeEndOffset, 'week').endOf('week');
    const displayStart = monthNativeStartWeek.add(startWeekOffset, 'week').startOf('week');
    const displayEnd = displayStart.add(42, 'day').endOf('day');
    const rangeStartISO = rangeStart.toISOString();
    const rangeEndISO = rangeEnd.toISOString();

    if (onRangeChange) {
      const sameRange = lastCommitRef.current.rangeStart === rangeStartISO
        && lastCommitRef.current.rangeEnd === rangeEndISO;
      if (!sameRange) {
        onRangeChange(rangeStartISO, rangeEndISO, {
          displayStart: displayStart.toISOString(),
          displayEnd: displayEnd.toISOString(),
          phase: 'commit',
        });
        lastCommitRef.current.rangeStart = rangeStartISO;
        lastCommitRef.current.rangeEnd = rangeEndISO;
      }
    }

    const centerInRows = Math.max(0, topInRows + (rowsViewportHeight / 2));
    const centerWeekOffset = Math.max(0, Math.min(
      monthNativeWeeksCount - 1,
      Math.floor(centerInRows / MONTH_WEEK_HEIGHT),
    ));
    const centerDate = monthNativeStartWeek.add(centerWeekOffset, 'week').add(3, 'day').format('YYYY-MM-DD');
    if (onCenterDateChange && lastCommitRef.current.centerDate !== centerDate) {
      onCenterDateChange(centerDate);
      lastCommitRef.current.centerDate = centerDate;
    }
  }, [isMonthView, monthNativeStartWeek, monthNativeWeeksCount, onCenterDateChange, onRangeChange]);

  const handleMonthScroll = useCallback(() => {
    if (!isMonthView) return;
    if (monthScrollFrameRef.current) return;
    monthScrollFrameRef.current = window.requestAnimationFrame(() => {
      monthScrollFrameRef.current = 0;
      emitMonthViewportFromScroll();
    });
  }, [emitMonthViewportFromScroll, isMonthView]);

  useEffect(() => {
    if (isMonthView) return undefined;
    if (!onRangeChange && !onCenterDateChange) return undefined;
    if (commitTimerRef.current) {
      window.clearTimeout(commitTimerRef.current);
    }
    commitTimerRef.current = window.setTimeout(() => {
      commitTimerRef.current = 0;
      emitCommittedViewportRef.current?.();
    }, COMMIT_IDLE_MS);

    return () => {
      if (commitTimerRef.current) {
        window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = 0;
      }
    };
  }, [cameraSteps, emitCommittedViewport, isMonthView, onCenterDateChange, onRangeChange]);

  useEffect(() => {
    if (!isMonthView) return;
    const scroller = monthScrollRef.current;
    if (scroller) {
      // Keep the target week just below the sticky weekday header.
      scroller.scrollTop = Math.max(0, (MONTH_NATIVE_WEEKS_BEFORE * MONTH_WEEK_HEIGHT) - 6);
    }
    const raf = window.requestAnimationFrame(() => {
      emitMonthViewportFromScroll(scroller?.scrollTop);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [
    emitMonthViewportFromScroll,
    isMonthView,
    monthNativeStartWeek,
    monthNativeWeeksCount,
    todayJumpToken,
  ]);

  useEffect(() => {
    if (isMonthView) return;
    const scroller = timeGridScrollRef.current;
    if (!scroller) return;
    const nowLocal = dayjs().tz(timezone);
    const targetMinute = nowLocal.hour() * 60 + nowLocal.minute();
    const targetTop = Math.max(0, TIMEGRID_BODY_TOP + (targetMinute / 60) * HOUR_HEIGHT - (HOUR_HEIGHT * 2));
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
    const minuteRaw = Math.max(0, Math.min(23 * 60 + 59, Math.round(((localY - TIMEGRID_BODY_TOP) / HOUR_HEIGHT) * 60)));
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
    flushPanSnapAnimation();
    if (event.target.closest('.canvas-ui-action')) return;
    const existingDrag = dragRef.current;
    if (existingDrag.active && existingDrag.pointerId !== event.pointerId) {
      return;
    }
    const hadInertiaOffset = !isMonthView
      && inertiaRef.current.active
      && inertiaRef.current.mode === 'offset';
    if (finalizeWheelSession(true)) {
      emitCommittedViewportRef.current?.();
    }
    settleInertia(true);
    const eventNode = event.target.closest('.canvas-event');
    const eventKey = eventNode ? eventNode.getAttribute('data-event-key') : null;
    const targetEvent = eventKey ? (eventByKey.get(eventKey) || null) : null;
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
      eventCandidate: eventKey,
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
      suppressShortSnap: hadInertiaOffset,
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
  }, [clearLongPressTimer, eventByKey, finalizeWheelSession, flushPanSnapAnimation, isMonthView, lockTextSelection, settleInertia]);

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
      if (!isMonthView && absY >= absX * 0.9) {
        clearLongPressTimer();
        drag.mode = 'navigate';
        drag.dragEvent = null;
        drag.eventCandidate = null;
        drag.axis = 'y-native';
        drag.moved = true;
        drag.ignoreClickTarget = true;
        setEventGestureLocked(false);
        return;
      }
      // Keep waiting long-press for event drag on non-month views.
      return;
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
          eventKey: drag.eventCandidate,
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
      } else if (absX > GESTURE_ACTIVATE_PX || absY > GESTURE_ACTIVATE_PX) {
        if (absX >= absY * 0.92) {
          drag.moved = true;
          drag.axis = 'x';
          drag.ignoreClickTarget = true;
          lockTextSelection();
        } else if (absY > absX * 0.92) {
          drag.moved = true;
          drag.axis = 'y-native';
          drag.ignoreClickTarget = true;
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
        // Keep native vertical scroll for time-grid body.
        return;
      }
      const axisDelta = drag.axis === 'x'
        ? mapHorizontalGestureDelta(dx)
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
  }, [clearLongPressTimer, isMonthView, lockTextSelection, mapHorizontalGestureDelta, schedulePanLayer]);

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
        const targetEvent = eventByKey.get(eventCandidate) || null;
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
        emitCommittedViewportRef.current?.();
        return;
      }
      const gestureDelta = drag.axis === 'x'
        ? mapHorizontalGestureDelta(endX - drag.startX)
        : (endY - drag.startY);
      if (drag.axis === 'x' || isMonthView) {
        if (!isMonthView && drag.axis === 'x') {
          if (drag.suppressShortSnap) {
            resetPanLayer();
            emitCommittedViewportRef.current?.();
            return;
          }
          commitOffsetAfterGesture(drag.startOffset, gestureDelta, true);
          return;
        }
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
    emitCommittedViewportRef.current?.();
  }, [
    computeDragRange,
    eventByKey,
    isMonthView,
    onMoveEvent,
    onOpenEvent,
    openCreateAtPoint,
    commitOffsetAfterGesture,
    mapHorizontalGestureDelta,
    startInertia,
    unlockTextSelection,
    clearLongPressTimer,
  ]);

  const handleWheel = useCallback((event) => {
    if (!isMonthView) return;
    const axis = isMonthView ? 'y' : 'x';
    const absX = Math.abs(event.deltaX || 0);
    const absY = Math.abs(event.deltaY || 0);
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
        emitCommittedViewportRef.current?.();
      }
    }, WHEEL_COMMIT_IDLE_MS);
  }, [clearWheelCommitTimer, finalizeWheelSession, isMonthView, schedulePanLayer, settleInertia]);

  const weekDayLabels = ['日', '一', '二', '三', '四', '五', '六'];

  const renderTimeGrid = () => {
    const startIndex = visibleWindow.startIndex;
    const endIndex = visibleWindow.endIndex;
    const columns = [];
    for (let i = startIndex; i < endIndex; i += 1) {
      const x = TIME_AXIS_WIDTH + (i - cameraSteps) * dayWidth;
      columns.push(
        <div
          key={`day-${i}`}
          className="pointer-events-none absolute bottom-0 border-l border-blue-100"
          style={{ left: x, width: dayWidth, top: TIMEGRID_BODY_TOP }}
        />
      );
    }

    const hourLines = [];
    for (let h = 1; h <= 24; h += 1) {
      const y = TIMEGRID_BODY_TOP + h * HOUR_HEIGHT;
      hourLines.push(
        <div key={`h-${h}`} className="pointer-events-none absolute left-0 right-0 border-t border-blue-100" style={{ top: y }} />
      );
    }

    const timeAxis = [];
    for (let h = 0; h < 24; h += 1) {
      const y = TIMEGRID_BODY_TOP + h * HOUR_HEIGHT;
      timeAxis.push(
        <div key={`t-${h}`} className="pointer-events-none absolute left-0 z-40 flex items-start justify-end pr-2 text-[11px] font-semibold text-blue-500" style={{ top: y + 2, width: TIME_AXIS_WIDTH }}>
          {String(h).padStart(2, '0')}:00
        </div>
      );
    }

    const nowLocal = dayjs(nowTick).tz(timezone);
    const displayStart = reference.add(Math.floor(cameraSteps), 'day').startOf('day');
    const displayEndExclusive = displayStart.add(dayColumns, 'day');
    const showNowLine = (nowLocal.isAfter(displayStart) || nowLocal.isSame(displayStart))
      && nowLocal.isBefore(displayEndExclusive);
    const nowMinuteOfDay = nowLocal.hour() * 60 + nowLocal.minute() + (nowLocal.second() / 60);
    const nowLineY = TIMEGRID_BODY_TOP + (nowMinuteOfDay / 60) * HOUR_HEIGHT;
    const nowDayIndex = nowLocal.startOf('day').diff(reference, 'day');
    const nowDotX = TIME_AXIS_WIDTH + (nowDayIndex - cameraSteps) * dayWidth;
    const currentTimeLabel = nowLocal.format('HH:mm');

    const timedByDay = new Map();
    eventEntries.forEach(({ key: eventKey, event }) => {
      const start = parseEventInTimezone(event?.start, timezone);
      if (!start.isValid() || event?.allDay) return;
      const dayKey = start.format('YYYY-MM-DD');
      const list = timedByDay.get(dayKey) || [];
      const end = event?.end ? parseEventInTimezone(event.end, timezone) : start.add(30, 'minute');
      list.push({
        eventKey,
        event,
        start,
        end: end.isAfter(start) ? end : start.add(30, 'minute'),
      });
      timedByDay.set(dayKey, list);
    });

    const layoutByEventKey = new Map();
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
          layoutByEventKey.set(String(item.eventKey), { col: item.col, cols: clusterMaxCols });
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

    const blocks = eventEntries.flatMap(({ key: eventKey, event }) => {
      const start = parseEventInTimezone(event?.start, timezone);
      if (!start.isValid()) return [];
      const allDay = !!event?.allDay;
      const dayIndex = start.startOf('day').diff(reference, 'day');
      const columnBaseLeft = TIME_AXIS_WIDTH + (dayIndex - cameraSteps) * dayWidth + 2;
      const slotWidth = Math.max(20, dayWidth - 6);
      const layout = allDay ? { col: 0, cols: 1 } : (layoutByEventKey.get(String(eventKey)) || { col: 0, cols: 1 });
      const cols = Math.max(1, layout.cols || 1);
      const col = Math.max(0, Math.min(cols - 1, layout.col || 0));
      const colWidth = slotWidth / cols;
      const x = columnBaseLeft + col * colWidth;
      const width = Math.max(18, colWidth - 2);
      const minuteOfDay = allDay ? 0 : (start.hour() * 60 + start.minute());
      const y = allDay
        ? TIMEGRID_BODY_TOP + 2
        : (TIMEGRID_BODY_TOP + (minuteOfDay / 60) * HOUR_HEIGHT + 1);
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
        eventKey,
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
          className="pointer-events-none absolute left-0 top-0 bottom-0 z-30 bg-white"
          style={{ width: TIME_AXIS_WIDTH }}
        />
        {hourLines}
        {timeAxis}
        <div
          ref={panLayerRef}
          className="absolute inset-0 will-change-transform"
        >
          {columns}
          {showNowLine && (
            <>
              <div
                className="pointer-events-none absolute border-t border-rose-500/85"
                style={{
                  left: TIME_AXIS_WIDTH,
                  right: 0,
                  top: nowLineY,
                  zIndex: 112,
                  boxShadow: '0 0 8px rgba(244,63,94,0.45)',
                }}
              />
              <div
                className="pointer-events-none absolute h-2.5 w-2.5 rounded-full border border-white bg-rose-500 shadow"
                style={{
                  left: nowDotX - 5,
                  top: nowLineY - 5,
                  zIndex: 113,
                  boxShadow: '0 0 0 3px rgba(244,63,94,0.2)',
                }}
              />
            </>
          )}
          {blocks.map(({ eventKey, event, style, className, titleStyle }) => {
            const isDraggingThis = dragVisual && String(dragVisual.eventKey) === String(eventKey);
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
              key={eventKey}
              data-event-key={eventKey}
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
        {showNowLine && (
          <div
            className="pointer-events-none absolute left-0"
            style={{ top: nowLineY - 10, width: TIME_AXIS_WIDTH - 4, zIndex: 114 }}
          >
            <span className="inline-flex h-5 items-center rounded-r-full bg-rose-500 px-2 text-[10px] font-semibold text-white shadow-sm">
              {currentTimeLabel}
            </span>
          </div>
        )}
      </>
    );
  };

  const renderTimeGridHeader = () => {
    const startIndex = visibleWindow.startIndex;
    const endIndex = visibleWindow.endIndex;
    const cells = [];
    for (let i = startIndex; i < endIndex; i += 1) {
      const day = reference.add(i, 'day');
      const x = TIME_AXIS_WIDTH + (i - cameraSteps) * dayWidth;
      const isTodayColumn = day.format('YYYY-MM-DD') === todayDateKey;
      cells.push(
        <div
          key={`hdr-${i}`}
          className="pointer-events-none absolute top-0 flex flex-col items-center justify-center border-b border-l border-blue-100 bg-white px-1 text-center"
          style={{ left: x, width: dayWidth, height: TIMEGRID_BODY_TOP }}
        >
          <span className={`text-[10px] font-semibold tracking-[0.08em] ${
            isTodayColumn ? 'text-blue-700' : 'text-slate-500'
          }`}
          >
            周{weekDayLabels[day.day()]}
          </span>
          <span className={`mt-1.5 inline-flex min-w-[40px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            isTodayColumn
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700'
          }`}
          >
            {day.format('M/D')}
          </span>
        </div>
      );
    }
    return (
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-[72] overflow-hidden" style={{ height: TIMEGRID_BODY_TOP }}>
        <div className="absolute inset-0 bg-white" />
        <div
          className="absolute left-0 top-0 bottom-0 z-20 border-b border-blue-100 bg-white"
          style={{ width: TIME_AXIS_WIDTH }}
        />
        <div
          ref={timeGridHeaderPanLayerRef}
          className="absolute inset-0 z-10 will-change-transform"
          style={{ transform: 'translate3d(0, 0, 0)' }}
        >
          {cells}
        </div>
      </div>
    );
  };

  const renderMonthGrid = () => {
    const dayCellWidth = monthDayCellWidth;
    const dayCellPercent = 100 / 7;
    const rows = [];

    for (let w = 0; w < monthNativeWeeksCount; w += 1) {
      const weekStart = monthNativeStartWeek.add(w, 'week');
      const y = w * MONTH_WEEK_HEIGHT;
      rows.push(
        <div key={`w-${w}`} className="absolute left-0 right-0 border-t border-blue-100" style={{ top: y, height: MONTH_WEEK_HEIGHT }}>
          {Array.from({ length: 7 }).map((_, d) => {
            const day = weekStart.add(d, 'day');
            const dayKey = day.format('YYYY-MM-DD');
            const isToday = dayKey === todayDateKey;
            return (
              <button
                key={`${w}-${d}`}
                type="button"
                className={`absolute flex items-start justify-start border-0 border-l border-blue-100 p-0 text-left focus:outline-none focus-visible:outline-none ${
                  isToday ? 'bg-blue-50/55' : 'bg-transparent'
                }`}
                style={{
                  top: 0,
                  left: `${d * dayCellPercent}%`,
                  width: `${dayCellPercent}%`,
                  height: MONTH_WEEK_HEIGHT,
                  outline: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.blur();
                  onCreateRange?.({
                    allDay: true,
                    start: day.startOf('day').toISOString(),
                    end: day.endOf('day').toISOString(),
                  });
                }}
              >
                <span
                  className={`pointer-events-none absolute left-1.5 top-1 inline-flex items-center rounded-full text-xs font-semibold ${
                    isToday
                      ? 'bg-blue-600 px-2 py-0.5 text-white shadow-sm'
                      : 'px-0 text-slate-700'
                  }`}
                >
                  {day.format('M/D')}
                </span>
                {isToday && (
                  <span
                    className="pointer-events-none absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500/90 shadow"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      );
    }

    const byCell = new Map();
    eventEntries.forEach(({ key: eventKey, event }) => {
      const start = parseEventInTimezone(event?.start, timezone);
      if (!start.isValid()) return;
      const weekIndex = start.startOf('week').diff(monthNativeStartWeek, 'week');
      if (weekIndex < 0 || weekIndex >= monthNativeWeeksCount) return;
      const day = start.day();
      const key = `${weekIndex}|${day}`;
      const list = byCell.get(key) || [];
      list.push({ eventKey, event, start });
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
        const y = (weekIndex * MONTH_WEEK_HEIGHT) + 28 + slotIndex * 19;
        const x = `calc(${day * dayCellPercent}% + 2px)`;
        const readonly = isReadonlyEvent(item.event);
        monthEvents.push(
          <button
            key={item.eventKey}
            type="button"
            data-event-key={item.eventKey}
            data-event-id={item.event.id}
            className={`canvas-event absolute h-5 overflow-hidden rounded border-0 px-1 text-left text-[10px] focus:outline-none focus-visible:outline-none ${
              readonly ? 'bg-slate-500/85 text-white' : 'bg-blue-600/80 text-white'
            }`}
            style={{
              left: x,
              top: y,
              width: `calc(${dayCellPercent}% - 5px)`,
              outline: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.blur();
              onOpenEvent?.(item.event);
            }}
          >
            {item.event.title || 'Untitled'}
          </button>
        );
      });

      if (hidden.length > 0) {
        const dayDate = monthNativeStartWeek.add(weekIndex, 'week').add(day, 'day');
        const y = (weekIndex * MONTH_WEEK_HEIGHT) + 28 + 6 * 19;
        const x = `calc(${day * dayCellPercent}% + 2px)`;
        moreIndicators.push(
          <button
            key={`more-${key}`}
            type="button"
            className="canvas-ui-action absolute h-5 rounded px-1 text-left text-[10px] font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:outline-none"
            style={{
              left: x,
              top: y,
              width: `calc(${dayCellPercent}% - 5px)`,
              outline: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.blur();
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
        <div
          className="pointer-events-none sticky top-0 z-20 grid grid-cols-7 border-b border-blue-100 bg-white/95 text-xs font-semibold text-slate-600 backdrop-blur"
          style={{ height: MONTH_HEADER_HEIGHT }}
        >
          {weekDayLabels.map((label) => (
            <div key={label} className="pointer-events-none flex items-center justify-center border-l border-blue-100">
              周{label}
            </div>
          ))}
        </div>
        <div
          className="relative"
          style={{ height: monthNativeWeeksCount * MONTH_WEEK_HEIGHT }}
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
      onWheel={isMonthView ? undefined : handleWheel}
      onPointerDown={isMonthView ? undefined : handlePointerDown}
      onPointerMove={isMonthView ? undefined : handlePointerMove}
      onPointerUp={isMonthView ? undefined : handlePointerUp}
      onPointerCancel={isMonthView ? undefined : handlePointerUp}
      style={{
        touchAction: isMonthView ? 'pan-y' : (eventGestureLocked ? 'none' : 'pan-y'),
        overscrollBehaviorX: 'none',
        overscrollBehaviorY: 'contain',
      }}
    >
      {isMonthView ? (
        <div
          ref={monthScrollRef}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          onScroll={handleMonthScroll}
        >
          {renderMonthGrid()}
        </div>
      ) : (
        <>
          {renderTimeGridHeader()}
          <div
            ref={timeGridSwipeMaskRef}
            className="pointer-events-none absolute bottom-0 top-0 z-[18]"
            style={{
              left: TIME_AXIS_WIDTH,
              right: 0,
              opacity: 0,
            }}
          />
          <div
            ref={timeGridScrollRef}
            className="absolute inset-0 overflow-y-auto overflow-x-hidden"
            style={{
              touchAction: eventGestureLocked ? 'none' : 'pan-y',
              overscrollBehaviorY: 'none',
            }}
          >
            <div className="relative" style={{ height: timelineScrollableHeight }}>
              {renderTimeGrid()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
