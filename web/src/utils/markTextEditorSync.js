export function normalizeMarkTextEditorValue(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\n+$/g, '');
}

export function resolveMarkTextExternalValueAction({
  nextValue,
  currentValue,
  isFocused = false,
  hasLocalEdits = false,
  isComposing = false,
  force = false,
} = {}) {
  if (normalizeMarkTextEditorValue(nextValue) === normalizeMarkTextEditorValue(currentValue)) {
    return { action: 'acknowledge', reason: 'same_value' };
  }
  if (force) {
    return { action: 'apply', reason: 'forced' };
  }
  if (isFocused) {
    return { action: 'defer', reason: 'focused' };
  }
  if (hasLocalEdits) {
    return { action: 'defer', reason: 'local_edits' };
  }
  if (isComposing) {
    return { action: 'defer', reason: 'composing' };
  }
  return { action: 'apply', reason: 'external_update' };
}
