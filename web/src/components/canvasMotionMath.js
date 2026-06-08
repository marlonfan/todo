export function resolvePanDelta({
  hasPendingDelta = false,
  pendingDelta,
  currentDelta,
  fallbackDelta = 0,
}) {
  if (hasPendingDelta && Number.isFinite(pendingDelta)) return pendingDelta;
  if (Number.isFinite(currentDelta)) return currentDelta;
  if (Number.isFinite(fallbackDelta)) return fallbackDelta;
  return 0;
}

export function commitOffsetFromWheelSession(startOffset, totalDelta) {
  const base = Number.isFinite(startOffset) ? startOffset : 0;
  const delta = Number.isFinite(totalDelta) ? totalDelta : 0;
  return base + delta;
}

export function shouldCommitWheelSession(totalDelta, threshold = 0.01) {
  const safeDelta = Number.isFinite(totalDelta) ? totalDelta : 0;
  return Math.abs(safeDelta) >= threshold;
}

export function shouldOpenEventFromPointerRelease({
  eventCandidate,
  totalMoveDistance = 0,
  clickCancelDistance = 8,
  longPressTriggered = false,
}) {
  if (!eventCandidate || longPressTriggered) return false;
  const safeDistance = Number.isFinite(totalMoveDistance) ? totalMoveDistance : 0;
  const safeThreshold = Math.max(0, Number.isFinite(clickCancelDistance) ? clickCancelDistance : 8);
  return safeDistance <= safeThreshold;
}

export function resolveLeadingRenderBuffer(baseLeading = 0, snapUnitSteps = 1) {
  const leading = Math.max(0, Math.ceil(Number(baseLeading) || 0));
  const snapSpan = Math.max(1, Math.ceil(Number(snapUnitSteps) || 1));
  return Math.max(leading, snapSpan);
}
