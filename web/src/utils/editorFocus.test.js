import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blurActiveTaskDescriptionEditor,
  blurTaskDescriptionEditorUnlessInside,
  getActiveTaskDescriptionEditorElement,
  isTaskDescriptionEditorTarget,
} from './editorFocus.js';

function installDomStub({ activeElement, selection } = {}) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousElement = globalThis.Element;
  const previousHTMLElement = globalThis.HTMLElement;

  class FakeElement {
    constructor({ matches = false, insideEditor = false } = {}) {
      this.matchesResult = matches;
      this.insideEditor = insideEditor;
      this.blurCount = 0;
    }

    matches() {
      return this.matchesResult;
    }

    closest() {
      return this.insideEditor ? this : null;
    }

    blur() {
      this.blurCount += 1;
    }
  }

  globalThis.Element = FakeElement;
  globalThis.HTMLElement = FakeElement;
  globalThis.document = { activeElement };
  globalThis.window = {
    getSelection: () => selection || null,
  };

  return {
    FakeElement,
    restore() {
      globalThis.document = previousDocument;
      globalThis.window = previousWindow;
      globalThis.Element = previousElement;
      globalThis.HTMLElement = previousHTMLElement;
    },
  };
}

test('detects task description editor targets', () => {
  const { FakeElement, restore } = installDomStub();
  try {
    assert.equal(isTaskDescriptionEditorTarget(new FakeElement({ insideEditor: true })), true);
    assert.equal(isTaskDescriptionEditorTarget(new FakeElement({ insideEditor: false })), false);
  } finally {
    restore();
  }
});

test('blurs active task description editor and clears selection', () => {
  const activeElement = {};
  const selection = { clearCount: 0, removeAllRanges() { this.clearCount += 1; } };
  const { FakeElement, restore } = installDomStub({ activeElement, selection });
  Object.setPrototypeOf(activeElement, FakeElement.prototype);
  activeElement.matchesResult = true;
  activeElement.insideEditor = true;
  activeElement.blurCount = 0;

  try {
    assert.equal(getActiveTaskDescriptionEditorElement(), activeElement);
    assert.equal(blurActiveTaskDescriptionEditor(), true);
    assert.equal(activeElement.blurCount, 1);
    assert.equal(selection.clearCount, 1);
  } finally {
    restore();
  }
});

test('does not blur when pointer starts inside the editor', () => {
  const activeElement = {};
  const target = {};
  const { FakeElement, restore } = installDomStub({ activeElement });
  Object.setPrototypeOf(activeElement, FakeElement.prototype);
  activeElement.matchesResult = true;
  activeElement.insideEditor = true;
  activeElement.blurCount = 0;
  Object.setPrototypeOf(target, FakeElement.prototype);
  target.matchesResult = false;
  target.insideEditor = true;

  try {
    assert.equal(blurTaskDescriptionEditorUnlessInside(target), false);
    assert.equal(activeElement.blurCount, 0);
  } finally {
    restore();
  }
});
