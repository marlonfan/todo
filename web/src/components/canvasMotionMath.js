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
