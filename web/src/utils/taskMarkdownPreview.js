import React from 'react';
import { lexer } from 'marked';

const MARKDOWN_LEXER_OPTIONS = {
  async: false,
  breaks: true,
  gfm: true,
};

function isRenderable(value) {
  return value !== null && value !== undefined && value !== false;
}

function compactChildren(children) {
  return (Array.isArray(children) ? children : [children]).flat().filter(isRenderable);
}

function readText(token) {
  return String(token?.text ?? token?.raw ?? '');
}

export function isSafeMarkdownURL(value) {
  const href = String(value || '').trim();
  if (!href || /[\u0000-\u001f\u007f]/.test(href)) return false;
  try {
    const base = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost';
    const url = new URL(href, base);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function renderInlineTokens(tokens = [], keyPrefix = 'inline') {
  return compactChildren(tokens.map((token, index) => renderInlineToken(token, `${keyPrefix}-${index}`)));
}

function renderInlineToken(token, key) {
  if (!token) return null;

  switch (token.type) {
    case 'text':
      if (Array.isArray(token.tokens) && token.tokens.length) {
        return renderInlineTokens(token.tokens, key);
      }
      return readText(token);
    case 'escape':
      return readText(token);
    case 'br':
      return React.createElement('br', { key });
    case 'strong':
      return React.createElement('strong', { key }, renderInlineTokens(token.tokens, key));
    case 'em':
      return React.createElement('em', { key }, renderInlineTokens(token.tokens, key));
    case 'del':
      return React.createElement('del', { key }, renderInlineTokens(token.tokens, key));
    case 'codespan':
      return React.createElement('code', { key, className: 'task-ai-inline-code' }, readText(token));
    case 'link': {
      const children = renderInlineTokens(token.tokens, key);
      if (!isSafeMarkdownURL(token.href)) {
        return React.createElement('span', { key }, children);
      }
      return React.createElement(
        'a',
        {
          key,
          href: String(token.href || ''),
          title: token.title || undefined,
          target: '_blank',
          rel: 'noreferrer noopener',
        },
        children
      );
    }
    case 'image':
      if (!isSafeMarkdownURL(token.href)) return readText(token);
      return React.createElement('img', {
        key,
        src: String(token.href || ''),
        alt: readText(token),
        title: token.title || undefined,
        className: 'task-ai-image',
        loading: 'lazy',
      });
    case 'html':
      return String(token.raw || token.text || '');
    default:
      if (Array.isArray(token.tokens) && token.tokens.length) {
        return renderInlineTokens(token.tokens, key);
      }
      return readText(token);
  }
}

function renderListItem(item, key) {
  const content = renderListItemContent(item, key);
  if (item?.task) {
    return React.createElement(
      'li',
      { key, className: 'task-ai-check-item' },
      React.createElement('span', {
        className: `task-ai-check${item.checked ? ' task-ai-check--checked' : ''}`,
        'aria-hidden': 'true',
      }),
      React.createElement('div', { className: 'task-ai-check-content' }, content)
    );
  }
  return React.createElement('li', { key }, content);
}

function renderListItemContent(item, keyPrefix) {
  const tokens = Array.isArray(item?.tokens) ? item.tokens : [];
  if (!tokens.length) return readText(item);

  return compactChildren(tokens.map((token, index) => {
    const key = `${keyPrefix}-content-${index}`;
    if (token.type === 'text') {
      if (Array.isArray(token.tokens) && token.tokens.length) {
        return renderInlineTokens(token.tokens, key);
      }
      return readText(token);
    }
    return renderBlockToken(token, key);
  }));
}

function renderTableCell(cell, tagName, key) {
  const style = cell?.align ? { textAlign: cell.align } : undefined;
  return React.createElement(
    tagName,
    { key, style },
    renderInlineTokens(cell?.tokens || [{ type: 'text', text: readText(cell) }], key)
  );
}

function renderBlockTokens(tokens = [], keyPrefix = 'block') {
  return compactChildren(tokens.map((token, index) => renderBlockToken(token, `${keyPrefix}-${index}`)));
}

function renderBlockToken(token, key) {
  if (!token) return null;

  switch (token.type) {
    case 'space':
      return null;
    case 'hr':
      return React.createElement('hr', { key });
    case 'heading': {
      const depth = Math.min(6, Math.max(1, Number(token.depth) || 3));
      return React.createElement(
        `h${depth}`,
        { key },
        renderInlineTokens(token.tokens || [{ type: 'text', text: readText(token) }], key)
      );
    }
    case 'paragraph':
      return React.createElement(
        'p',
        { key },
        renderInlineTokens(token.tokens || [{ type: 'text', text: readText(token) }], key)
      );
    case 'text':
      return React.createElement(
        'p',
        { key },
        Array.isArray(token.tokens) && token.tokens.length
          ? renderInlineTokens(token.tokens, key)
          : readText(token)
      );
    case 'blockquote':
      return React.createElement('blockquote', { key }, renderBlockTokens(token.tokens, key));
    case 'list': {
      const tagName = token.ordered ? 'ol' : 'ul';
      const start = Number(token.start);
      const props = {
        key,
        className: 'task-ai-list',
        ...(token.ordered && Number.isFinite(start) && start > 1 ? { start } : {}),
      };
      return React.createElement(
        tagName,
        props,
        (token.items || []).map((item, index) => renderListItem(item, `${key}-item-${index}`))
      );
    }
    case 'code':
      return React.createElement(
        'pre',
        { key, className: 'task-ai-code-block' },
        React.createElement('code', null, String(token.text || ''))
      );
    case 'table':
      return React.createElement(
        'div',
        { key, className: 'task-ai-table-wrap' },
        React.createElement(
          'table',
          { className: 'task-ai-table' },
          React.createElement(
            'thead',
            null,
            React.createElement(
              'tr',
              null,
              (token.header || []).map((cell, index) => renderTableCell(cell, 'th', `${key}-head-${index}`))
            )
          ),
          React.createElement(
            'tbody',
            null,
            (token.rows || []).map((row, rowIndex) => React.createElement(
              'tr',
              { key: `${key}-row-${rowIndex}` },
              row.map((cell, cellIndex) => renderTableCell(cell, 'td', `${key}-cell-${rowIndex}-${cellIndex}`))
            ))
          )
        )
      );
    case 'html':
      return React.createElement('p', { key, className: 'task-ai-html-text' }, String(token.raw || token.text || ''));
    default:
      if (Array.isArray(token.tokens) && token.tokens.length) {
        return renderBlockTokens(token.tokens, key);
      }
      return readText(token)
        ? React.createElement('p', { key }, readText(token))
        : null;
  }
}

export function renderTaskMarkdownPreview(value) {
  const text = String(value || '').trimEnd();
  if (!text.trim()) return [];

  try {
    return renderBlockTokens(lexer(text, MARKDOWN_LEXER_OPTIONS), 'task-md');
  } catch {
    return [
      React.createElement(
        'pre',
        { key: 'task-md-fallback', className: 'task-ai-raw task-ai-markdown-fallback' },
        text
      ),
    ];
  }
}
