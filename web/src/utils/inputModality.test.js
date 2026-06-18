import test from 'node:test';
import assert from 'node:assert/strict';
import { initInputModality, isKeyboardFocusIntent } from './inputModality.js';

function createModalityHarness() {
  const listeners = new Map();
  const classes = new Set();
  const root = {
    dataset: {},
    classList: {
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
    },
  };
  const win = {
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.forEach((handler) => handler(event));
    },
  };

  return { classes, doc: { documentElement: root }, root, win };
}

test('detects only focus-navigation keys as keyboard modality intent', () => {
  assert.equal(isKeyboardFocusIntent({ key: 'Tab' }), true);
  assert.equal(isKeyboardFocusIntent({ key: 'ArrowDown' }), true);
  assert.equal(isKeyboardFocusIntent({ key: 'Escape' }), false);
  assert.equal(isKeyboardFocusIntent({ key: 'Enter' }), false);
  assert.equal(isKeyboardFocusIntent({ key: 'ArrowLeft', metaKey: true }), false);
});

test('tracks pointer and keyboard focus modality on the document root', () => {
  const { classes, doc, root, win } = createModalityHarness();
  const cleanup = initInputModality(doc, win);

  assert.equal(root.dataset.inputModality, 'pointer');
  assert.equal(classes.has('using-pointer'), true);

  win.dispatch('keydown', { key: 'Escape' });
  assert.equal(root.dataset.inputModality, 'pointer');

  win.dispatch('keydown', { key: 'Tab' });
  assert.equal(root.dataset.inputModality, 'keyboard');
  assert.equal(classes.has('using-keyboard'), true);

  win.dispatch('pointerdown');
  assert.equal(root.dataset.inputModality, 'pointer');
  assert.equal(classes.has('using-keyboard'), false);

  cleanup();
  win.dispatch('keydown', { key: 'Tab' });
  assert.equal(root.dataset.inputModality, 'pointer');
});
