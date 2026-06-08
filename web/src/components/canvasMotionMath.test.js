import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commitOffsetFromWheelSession,
  resolveLeadingRenderBuffer,
  resolvePanDelta,
  shouldCommitWheelSession,
} from './canvasMotionMath.js';

test('resolvePanDelta prefers pending delta when available', () => {
  const got = resolvePanDelta({
    hasPendingDelta: true,
    pendingDelta: -48,
    currentDelta: -36,
    fallbackDelta: -12,
  });
  assert.equal(got, -48);
});

test('resolvePanDelta falls back from current to fallback delta', () => {
  const ignoresInactivePending = resolvePanDelta({
    hasPendingDelta: false,
    pendingDelta: 0,
    currentDelta: 22,
    fallbackDelta: 7,
  });
  assert.equal(ignoresInactivePending, 22);

  const fromCurrent = resolvePanDelta({
    hasPendingDelta: true,
    pendingDelta: Number.NaN,
    currentDelta: 22,
    fallbackDelta: 7,
  });
  assert.equal(fromCurrent, 22);

  const fromFallback = resolvePanDelta({
    hasPendingDelta: true,
    pendingDelta: Number.NaN,
    currentDelta: Number.NaN,
    fallbackDelta: -9,
  });
  assert.equal(fromFallback, -9);
});

test('commitOffsetFromWheelSession applies cumulative wheel delta to start offset', () => {
  const got = commitOffsetFromWheelSession(320, -84.5);
  assert.equal(got, 235.5);
});

test('shouldCommitWheelSession ignores tiny noise and accepts real deltas', () => {
  assert.equal(shouldCommitWheelSession(0.009), false);
  assert.equal(shouldCommitWheelSession(-0.011), true);
});

test('resolveLeadingRenderBuffer covers the full snap span for week view', () => {
  assert.equal(resolveLeadingRenderBuffer(5, 7), 7);
  assert.equal(resolveLeadingRenderBuffer(5, 3), 5);
  assert.equal(resolveLeadingRenderBuffer(2, 3), 3);
});
