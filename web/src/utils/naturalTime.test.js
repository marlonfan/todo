import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNaturalTimeFromTitle, parsePriorityFromTitle } from './naturalTime.js';

const BASE_OPTIONS = {
  defaultStartTime: '09:00',
  morningTime: '09:00',
  noonTime: '12:00',
  afternoonTime: '15:00',
  eveningTime: '20:00',
};

function parse(title, now = '2026-03-01T09:00:00', timezone = 'Asia/Shanghai') {
  return parseNaturalTimeFromTitle(title, timezone, {
    ...BASE_OPTIONS,
    now,
  });
}

test('parses 下周二 correctly and cleans title without leftover prefix chars', () => {
  const parsed = parse('下周二和妈妈去打麻将', '2026-03-04T09:00:00');
  assert.ok(parsed);
  assert.equal(parsed.parsedAtInput, '2026-03-10T09:00');
  assert.equal(parsed.cleanedTitle, '和妈妈去打麻将');
  assert.equal(parsed.confidence, 'high');
  assert.equal(parsed.ambiguous, false);
  assert.ok(parsed.matchedSpans.length > 0);
});

test('parses 周二 as this-week Tuesday by policy', () => {
  const parsed = parse('周二开会', '2026-03-04T09:00:00');
  assert.ok(parsed);
  assert.equal(parsed.parsedAtInput, '2026-03-03T09:00');
  assert.equal(parsed.cleanedTitle, '开会');
});

test('parses relative day + part of day', () => {
  const parsed = parse('明天早上和团队同步');
  assert.ok(parsed);
  assert.equal(parsed.parsedAtInput, '2026-03-02T09:00');
  assert.equal(parsed.cleanedTitle, '和团队同步');
});

test('parses relative day + explicit clock time', () => {
  const parsed = parse('后天下午3点见客户');
  assert.ok(parsed);
  assert.equal(parsed.parsedAtInput, '2026-03-03T15:00');
  assert.equal(parsed.cleanedTitle, '见客户');
});

test('parses tonight explicit clock', () => {
  const parsed = parse('今晚8点看球');
  assert.ok(parsed);
  assert.equal(parsed.parsedAtInput, '2026-03-01T20:00');
  assert.equal(parsed.cleanedTitle, '看球');
});

test('keeps basic english support for next Tuesday 8pm', () => {
  const parsed = parse('next Tuesday 8pm sync');
  assert.ok(parsed);
  assert.equal(parsed.parsedAtInput, '2026-03-10T20:00');
  assert.equal(parsed.cleanedTitle, 'sync');
});

test('parses priority marker ! as low priority', () => {
  const parsed = parsePriorityFromTitle('! 买牛奶');
  assert.ok(parsed);
  assert.equal(parsed.priority, -1);
  assert.equal(parsed.cleanedTitle, '买牛奶');
});

test('parses priority marker !! as medium priority', () => {
  const parsed = parsePriorityFromTitle('买牛奶 !!');
  assert.ok(parsed);
  assert.equal(parsed.priority, 0);
  assert.equal(parsed.cleanedTitle, '买牛奶');
});

test('parses priority marker !!! as high priority', () => {
  const parsed = parsePriorityFromTitle('!!! 交房租');
  assert.ok(parsed);
  assert.equal(parsed.priority, 1);
  assert.equal(parsed.cleanedTitle, '交房租');
});

test('does not parse single exclamation punctuation at end as priority', () => {
  const parsed = parsePriorityFromTitle('和妈妈去打麻将！');
  assert.equal(parsed, null);
});
