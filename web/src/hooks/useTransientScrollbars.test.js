import test from 'node:test';
import assert from 'node:assert/strict';
import { getTransientScrollbarZIndex } from './useTransientScrollbars.js';

function createNode(styles, parentElement = null) {
  const node = { parentElement };
  node.ownerDocument = parentElement?.ownerDocument || {
    defaultView: {
      getComputedStyle(element) {
        return styles.get(element) || { position: 'static', zIndex: 'auto' };
      },
    },
  };
  return node;
}

test('keeps a page scrollbar below modal layers', () => {
  const styles = new Map();
  const workspace = createNode(styles);
  styles.set(workspace, { position: 'absolute', zIndex: '10' });
  const scrollNode = createNode(styles, workspace);

  assert.equal(getTransientScrollbarZIndex(scrollNode), 11);
  assert.ok(getTransientScrollbarZIndex(scrollNode) < 70);
});

test('places a modal scrollbar directly above its own modal layer', () => {
  const styles = new Map();
  const overlay = createNode(styles);
  styles.set(overlay, { position: 'fixed', zIndex: '70' });
  const panel = createNode(styles, overlay);
  styles.set(panel, { position: 'static', zIndex: 'auto' });
  const scrollNode = createNode(styles, panel);

  assert.equal(getTransientScrollbarZIndex(scrollNode), 71);
});

test('includes the scrolling node when it defines the visible layer', () => {
  const styles = new Map();
  const scrollNode = createNode(styles);
  styles.set(scrollNode, { position: 'fixed', zIndex: '40' });

  assert.equal(getTransientScrollbarZIndex(scrollNode), 41);
});
