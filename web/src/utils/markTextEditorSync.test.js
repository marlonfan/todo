import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMarkTextEditorValue,
  resolveMarkTextExternalValueAction,
} from './markTextEditorSync.js';

test('normalizes platform newlines and trailing markdown newlines', () => {
  assert.equal(normalizeMarkTextEditorValue('hello\r\nworld\n\n'), 'hello\nworld');
});

test('acknowledges parent values that already match the editor', () => {
  assert.deepEqual(resolveMarkTextExternalValueAction({
    nextValue: 'hello\n',
    currentValue: 'hello',
    isFocused: true,
    hasLocalEdits: true,
  }), { action: 'acknowledge', reason: 'same_value' });
});

test('defers external values while the editor is active', () => {
  assert.deepEqual(resolveMarkTextExternalValueAction({
    nextValue: 'old parent value',
    currentValue: 'new local value',
    isFocused: true,
  }), { action: 'defer', reason: 'focused' });
});

test('defers external values while local edits have not been acknowledged', () => {
  assert.deepEqual(resolveMarkTextExternalValueAction({
    nextValue: 'old parent value',
    currentValue: 'new local value',
    hasLocalEdits: true,
  }), { action: 'defer', reason: 'local_edits' });
});

test('applies clean external updates when the editor is idle', () => {
  assert.deepEqual(resolveMarkTextExternalValueAction({
    nextValue: 'remote update',
    currentValue: 'current value',
  }), { action: 'apply', reason: 'external_update' });
});

test('allows imperative updates to bypass the active-editor guard', () => {
  assert.deepEqual(resolveMarkTextExternalValueAction({
    nextValue: 'ai rewrite',
    currentValue: 'draft text',
    isFocused: true,
    hasLocalEdits: true,
    force: true,
  }), { action: 'apply', reason: 'forced' });
});
