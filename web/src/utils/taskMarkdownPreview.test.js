import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderTaskMarkdownPreview, isSafeMarkdownURL } from './taskMarkdownPreview.js';

function flattenText(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(flattenText).join('');
  if (React.isValidElement(value)) return flattenText(value.props.children);
  return '';
}

function collectElements(value, predicate, found = []) {
  if (React.isValidElement(value) && predicate(value)) {
    found.push(value);
  }
  if (React.isValidElement(value)) {
    React.Children.forEach(value.props.children, (child) => collectElements(child, predicate, found));
  } else if (Array.isArray(value)) {
    value.forEach((child) => collectElements(child, predicate, found));
  }
  return found;
}

test('renderTaskMarkdownPreview renders common todo markdown', () => {
  const nodes = renderTaskMarkdownPreview([
    '## 下一步',
    '- [x] 梳理现状',
    '- [ ] 补测试',
    '',
    '> 保持小步提交',
    '',
    '`inline`',
  ].join('\n'));

  assert.match(flattenText(nodes), /下一步/);
  assert.match(flattenText(nodes), /梳理现状/);
  assert.match(flattenText(nodes), /补测试/);
  assert.match(flattenText(nodes), /保持小步提交/);
  assert.equal(collectElements(nodes, (node) => node.type === 'h2').length, 1);
  assert.equal(collectElements(nodes, (node) => String(node.props.className || '').split(/\s+/).includes('task-ai-check')).length, 2);
  assert.equal(collectElements(nodes, (node) => node.props.className === 'task-ai-inline-code').length, 1);
});

test('renderTaskMarkdownPreview keeps unsafe html as text', () => {
  const nodes = renderTaskMarkdownPreview('<img src=x onerror=alert(1)>\n<script>alert(1)</script>');
  const text = flattenText(nodes);

  assert.match(text, /<img src=x onerror=alert\(1\)>/);
  assert.match(text, /<script>alert\(1\)<\/script>/);
  assert.equal(collectElements(nodes, (node) => node.type === 'script').length, 0);
});

test('renderTaskMarkdownPreview drops unsafe link hrefs', () => {
  const nodes = renderTaskMarkdownPreview('[bad](javascript:alert(1)) [good](https://example.com)');
  const links = collectElements(nodes, (node) => node.type === 'a');

  assert.equal(links.length, 1);
  assert.equal(links[0].props.href, 'https://example.com');
});

test('isSafeMarkdownURL allows only safe navigation protocols', () => {
  assert.equal(isSafeMarkdownURL('https://example.com'), true);
  assert.equal(isSafeMarkdownURL('mailto:test@example.com'), true);
  assert.equal(isSafeMarkdownURL('tel:+123456789'), true);
  assert.equal(isSafeMarkdownURL('/tasks?view=all'), true);
  assert.equal(isSafeMarkdownURL('javascript:alert(1)'), false);
  assert.equal(isSafeMarkdownURL('data:text/html,<script>alert(1)</script>'), false);
});
