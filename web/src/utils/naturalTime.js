import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const WEEKDAY_MAP_MONDAY = {
  '一': 0,
  '二': 1,
  '三': 2,
  '四': 3,
  '五': 4,
  '六': 5,
  '日': 6,
  '天': 6,
  '末': 5,
};

const EN_WEEKDAY_MAP = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
};

const CN_NUM_MAP = {
  '零': 0,
  '〇': 0,
  '一': 1,
  '二': 2,
  '两': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
  '七': 7,
  '八': 8,
  '九': 9,
};

function mergeSpans(spans) {
  if (!Array.isArray(spans) || spans.length === 0) return [];
  const sorted = [...spans]
    .filter((span) => Number.isInteger(span.start) && Number.isInteger(span.end) && span.end > span.start)
    .sort((a, b) => a.start - b.start);
  if (sorted.length === 0) return [];

  const merged = [sorted[0]];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      if (!last.type && current.type) last.type = current.type;
      continue;
    }
    merged.push({ ...current });
  }
  return merged;
}

function cleanupTitleBySpans(input, spans) {
  const source = String(input || '');
  if (!source) return '';
  if (!Array.isArray(spans) || spans.length === 0) {
    return source.replace(/\s+/g, ' ').trim();
  }

  const chars = source.split('');
  mergeSpans(spans).forEach((span) => {
    for (let index = span.start; index < span.end && index < chars.length; index += 1) {
      chars[index] = ' ';
    }
  });

  return chars.join('')
    .replace(/[，,。！？!?.、；;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMatches(text, regex, builder) {
  const result = [];
  const source = String(text || '');
  const localRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  let match = localRegex.exec(source);
  while (match) {
    const start = match.index;
    const end = start + match[0].length;
    const value = typeof builder === 'function' ? builder(match) : {};
    result.push({
      text: match[0],
      start,
      end,
      ...value,
    });
    match = localRegex.exec(source);
  }
  return result;
}

function pickEarliest(matches) {
  if (!Array.isArray(matches) || matches.length === 0) return null;
  return [...matches].sort((a, b) => a.start - b.start)[0];
}

function parseChineseNumber(raw) {
  const text = String(raw || '').trim();
  if (!text) return NaN;
  if (/^\d+$/.test(text)) return parseInt(text, 10);
  if (text === '十') return 10;
  if (text.startsWith('廿')) {
    if (text.length === 1) return 20;
    const unit = CN_NUM_MAP[text[1]];
    return Number.isFinite(unit) ? 20 + unit : NaN;
  }
  if (text.startsWith('卅')) {
    if (text.length === 1) return 30;
    const unit = CN_NUM_MAP[text[1]];
    return Number.isFinite(unit) ? 30 + unit : NaN;
  }
  if (text.includes('十')) {
    const [left, right] = text.split('十');
    const tens = left ? CN_NUM_MAP[left] : 1;
    const units = right ? CN_NUM_MAP[right] : 0;
    if (!Number.isFinite(tens) || !Number.isFinite(units)) return NaN;
    return tens * 10 + units;
  }
  if (text.length === 1 && Number.isFinite(CN_NUM_MAP[text])) {
    return CN_NUM_MAP[text];
  }
  return NaN;
}

function detectPartOfDayTokens(text) {
  const cn = extractMatches(
    text,
    /(凌晨|早上|上午|早晨|今早|明早|中午|下午|晚上|傍晚|今晚|明晚)/g,
    (match) => {
      const word = match[1];
      if (/凌晨/.test(word)) return { type: 'part_of_day', part: 'late-night' };
      if (/(早上|上午|早晨|今早|明早)/.test(word)) return { type: 'part_of_day', part: 'morning' };
      if (/中午/.test(word)) return { type: 'part_of_day', part: 'noon' };
      if (/下午/.test(word)) return { type: 'part_of_day', part: 'afternoon' };
      return { type: 'part_of_day', part: 'evening' };
    }
  );
  const en = extractMatches(
    text,
    /\b(this morning|morning|noon|afternoon|evening|tonight|late night)\b/gi,
    (match) => {
      const word = String(match[1] || '').toLowerCase();
      if (word === 'morning' || word === 'this morning') return { type: 'part_of_day', part: 'morning' };
      if (word === 'noon') return { type: 'part_of_day', part: 'noon' };
      if (word === 'afternoon') return { type: 'part_of_day', part: 'afternoon' };
      if (word === 'late night') return { type: 'part_of_day', part: 'late-night' };
      return { type: 'part_of_day', part: 'evening' };
    }
  );
  return [...cn, ...en];
}

function parseHourMinuteTokens(text) {
  const tokens = [];

  tokens.push(
    ...extractMatches(text, /(\d{1,2})\s*[:：]\s*(\d{1,2})/g, (match) => ({
      type: 'time',
      hour: parseInt(match[1], 10),
      minute: parseInt(match[2], 10),
      explicit: true,
    }))
  );
  tokens.push(
    ...extractMatches(text, /(\d{1,2})\s*点\s*半/g, (match) => ({
      type: 'time',
      hour: parseInt(match[1], 10),
      minute: 30,
      explicit: true,
    }))
  );
  tokens.push(
    ...extractMatches(text, /(\d{1,2})\s*点(?:\s*(\d{1,2})\s*分?)?/g, (match) => ({
      type: 'time',
      hour: parseInt(match[1], 10),
      minute: match[2] ? parseInt(match[2], 10) : 0,
      explicit: true,
    }))
  );
  tokens.push(
    ...extractMatches(text, /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi, (match) => ({
      type: 'time',
      hour: parseInt(match[1], 10),
      minute: match[2] ? parseInt(match[2], 10) : 0,
      ampm: String(match[3] || '').toLowerCase(),
      explicit: true,
    }))
  );

  return tokens;
}

function normalizeHour(partOfDay, hour, ampm = '') {
  if (ampm === 'am') {
    return hour === 12 ? 0 : hour;
  }
  if (ampm === 'pm') {
    if (hour === 12) return 12;
    return hour + 12;
  }
  if (partOfDay === 'late-night') {
    if (hour === 12) return 0;
    return hour;
  }
  if (partOfDay === 'morning') {
    if (hour === 12) return 0;
    return hour;
  }
  if (partOfDay === 'noon') {
    if (hour >= 1 && hour <= 10) return hour + 12;
    return hour;
  }
  if (partOfDay === 'afternoon' || partOfDay === 'evening') {
    if (hour >= 1 && hour <= 11) return hour + 12;
    return hour;
  }
  return hour;
}

function defaultHourByPart(partOfDay, defaultHour) {
  switch (partOfDay) {
    case 'late-night':
      return 1;
    case 'morning':
      return 9;
    case 'noon':
      return 12;
    case 'afternoon':
      return 15;
    case 'evening':
      return 20;
    default:
      return defaultHour;
  }
}

function parseDefaultTime(value, fallback = { hour: 9, minute: 0 }) {
  const match = String(value || '').trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return fallback;
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return fallback;
  }
  return { hour, minute };
}

export function getNaturalTimeOptionsFromUser(user = {}) {
  return {
    defaultStartTime: user.default_task_start_time || '09:00',
    morningTime: user.default_morning_time || '09:00',
    noonTime: user.default_noon_time || '12:00',
    afternoonTime: user.default_afternoon_time || '15:00',
    eveningTime: user.default_evening_time || '20:00',
  };
}

function mapMarkerCountToPriority(count) {
  if (count >= 3) return 1;
  if (count === 2) return 0;
  return -1;
}

function isWhitespace(char) {
  return typeof char === 'string' && /\s/.test(char);
}

export function parsePriorityFromTitle(title) {
  const raw = String(title || '');
  if (!raw.trim()) return null;

  const matches = [];
  const regex = /[!！]{1,}/g;
  let match = regex.exec(raw);
  while (match) {
    const marker = match[0];
    const count = marker.length;
    const start = match.index;
    const end = start + marker.length;
    const prev = start > 0 ? raw[start - 1] : '';
    const next = end < raw.length ? raw[end] : '';
    const atStart = start === 0;
    const atEnd = end === raw.length;
    const standalone = (atStart || isWhitespace(prev)) && (atEnd || isWhitespace(next));
    const suffixNoSpace = atEnd && count >= 2;
    if (standalone || atStart || suffixNoSpace) {
      matches.push({ start, end, count });
    }
    match = regex.exec(raw);
  }

  if (matches.length === 0) return null;

  const strongest = matches.reduce((best, current) => (current.count > best.count ? current : best), matches[0]);
  const cleanedTitle = cleanupTitleBySpans(raw, matches).trim() || raw.trim();
  return {
    priority: mapMarkerCountToPriority(strongest.count),
    cleanedTitle,
    marker: '!'.repeat(Math.min(strongest.count, 3)),
  };
}

function resolveWeekday(now, prefix, weekdayChar) {
  const weekday = WEEKDAY_MAP_MONDAY[weekdayChar];
  if (!Number.isInteger(weekday)) return now.startOf('day');

  const mondayOffset = (now.day() + 6) % 7;
  const weekStart = now.startOf('day').subtract(mondayOffset, 'day');
  let weekShift = 0;
  if (prefix === '下') weekShift = 1;
  if (prefix === '下下') weekShift = 2;

  return weekStart.add((weekShift * 7) + weekday, 'day');
}

function resolveEnglishWeekday(now, weekdayValue, hasNextPrefix = false) {
  const targetWeekday = EN_WEEKDAY_MAP[String(weekdayValue || '').toLowerCase()];
  if (!Number.isInteger(targetWeekday)) return now.startOf('day');
  let diff = (targetWeekday - now.day() + 7) % 7;
  if (hasNextPrefix) {
    diff += 7;
  } else if (diff === 0) {
    diff = 7;
  }
  return now.startOf('day').add(diff, 'day');
}

function parseNow(timezoneName, options = {}) {
  const tz = timezoneName || 'UTC';
  if (options.now) {
    if (dayjs.isDayjs(options.now)) {
      return options.now.tz(tz);
    }
    return dayjs(options.now).tz(tz);
  }
  return dayjs().tz(tz);
}

export function parseNaturalTimeFromTitle(title, timezoneName, options = {}) {
  const raw = String(title || '').trim();
  if (!raw) return null;
  const now = parseNow(timezoneName, options);
  const { hour: defaultHour, minute: defaultMinute } = parseDefaultTime(options.defaultStartTime);
  const morningTime = parseDefaultTime(options.morningTime, { hour: 9, minute: 0 });
  const noonTime = parseDefaultTime(options.noonTime, { hour: 12, minute: 0 });
  const afternoonTime = parseDefaultTime(options.afternoonTime, { hour: 15, minute: 0 });
  const eveningTime = parseDefaultTime(options.eveningTime, { hour: 20, minute: 0 });

  const absoluteYearTokens = extractMatches(
    raw,
    /(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})[日号]?/g,
    (match) => ({
      type: 'absolute_date',
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      day: parseInt(match[3], 10),
      rule: 'absolute_year_date',
    })
  );
  const absoluteMonthDayTokens = extractMatches(
    raw,
    /(\d{1,2})月(\d{1,2})[日号]?/g,
    (match) => ({
      type: 'absolute_month_day',
      month: parseInt(match[1], 10),
      day: parseInt(match[2], 10),
      rule: 'absolute_month_day',
    })
  );
  const absoluteMonthDayChineseTokens = extractMatches(
    raw,
    /([一二三四五六七八九十两零〇廿卅]{1,3})月(\d{1,2}|[一二三四五六七八九十两零〇廿卅]{1,3})[日号]?/g,
    (match) => ({
      type: 'absolute_month_day',
      month: parseChineseNumber(match[1]),
      day: parseChineseNumber(match[2]),
      rule: 'absolute_cn_month_day',
    })
  ).filter((token) => Number.isFinite(token.month) && Number.isFinite(token.day));
  const relativeDateTokens = extractMatches(
    raw,
    /(大后天|后天|明天|今天|明早|今早|明晚|今晚|day after tomorrow|tomorrow|today|tonight|this morning)/gi,
    (match) => {
      const value = String(match[1] || '').toLowerCase();
      if (value === '大后天') return { type: 'relative_date', offset: 3, rule: 'relative_day_3' };
      if (value === '后天' || value === 'day after tomorrow') return { type: 'relative_date', offset: 2, rule: 'relative_day_2' };
      if (value === '明天' || value === '明早' || value === '明晚' || value === 'tomorrow') return { type: 'relative_date', offset: 1, rule: 'relative_day_1' };
      return { type: 'relative_date', offset: 0, rule: 'relative_day_0' };
    }
  );
  const weekTokens = extractMatches(
    raw,
    /((?:下下|下|本|这)?)(?:周|星期|礼拜)(末|[一二三四五六日天])/g,
    (match) => ({
      type: 'weekday',
      prefix: match[1] || '',
      weekday: match[2],
      rule: 'cn_weekday',
    })
  );
  const enNextWeekTokens = extractMatches(
    raw,
    /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    (match) => ({
      type: 'weekday',
      prefix: 'next',
      weekdayEn: String(match[1] || '').toLowerCase(),
      rule: 'en_next_weekday',
    })
  );
  const enWeekdayTokens = extractMatches(
    raw,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    (match) => ({
      type: 'weekday',
      prefix: '',
      weekdayEn: String(match[1] || '').toLowerCase(),
      rule: 'en_weekday',
    })
  ).filter((token) => !enNextWeekTokens.some((nextToken) => token.start >= nextToken.start && token.end <= nextToken.end));
  const partTokens = detectPartOfDayTokens(raw);
  const timeTokens = parseHourMinuteTokens(raw);

  const allTemporalTokens = [
    ...absoluteYearTokens,
    ...absoluteMonthDayTokens,
    ...absoluteMonthDayChineseTokens,
    ...relativeDateTokens,
    ...weekTokens,
    ...enNextWeekTokens,
    ...enWeekdayTokens,
    ...partTokens,
    ...timeTokens,
  ];
  if (allTemporalTokens.length === 0) return null;

  let date = now.startOf('day');
  let hasDateInfo = false;
  const appliedRules = [];

  const absoluteYearToken = pickEarliest(absoluteYearTokens);
  const absoluteMonthDayToken = pickEarliest([...absoluteMonthDayTokens, ...absoluteMonthDayChineseTokens]);
  const relativeToken = pickEarliest(relativeDateTokens);
  const weekToken = pickEarliest(weekTokens);
  const enWeekToken = pickEarliest([...enNextWeekTokens, ...enWeekdayTokens]);

  if (absoluteYearToken) {
    date = date.year(absoluteYearToken.year).month(absoluteYearToken.month - 1).date(absoluteYearToken.day);
    hasDateInfo = true;
    appliedRules.push(absoluteYearToken.rule);
  } else if (absoluteMonthDayToken) {
    let resolved = date.month(absoluteMonthDayToken.month - 1).date(absoluteMonthDayToken.day);
    if (resolved.isBefore(now.startOf('day'))) {
      resolved = resolved.add(1, 'year');
    }
    date = resolved;
    hasDateInfo = true;
    appliedRules.push(absoluteMonthDayToken.rule);
  } else if (relativeToken) {
    date = date.add(relativeToken.offset, 'day');
    hasDateInfo = true;
    appliedRules.push(relativeToken.rule);
  } else if (weekToken) {
    date = resolveWeekday(now, weekToken.prefix, weekToken.weekday);
    hasDateInfo = true;
    appliedRules.push(weekToken.rule);
  } else if (enWeekToken) {
    date = resolveEnglishWeekday(now, enWeekToken.weekdayEn, enWeekToken.prefix === 'next');
    hasDateInfo = true;
    appliedRules.push(enWeekToken.rule);
  }

  const partToken = pickEarliest(partTokens);
  const timeToken = pickEarliest(timeTokens);
  if (partToken) {
    appliedRules.push('part_of_day');
  }
  if (timeToken) {
    appliedRules.push('explicit_time');
  }

  const partOfDay = partToken?.part || '';
  let hour = defaultHour;
  let minute = defaultMinute;

  if (timeToken) {
    hour = timeToken.hour;
    minute = timeToken.minute;
    hour = normalizeHour(partOfDay, hour, timeToken.ampm || '');
  } else if (partOfDay === 'morning') {
    hour = morningTime.hour;
    minute = morningTime.minute;
  } else if (partOfDay === 'noon') {
    hour = noonTime.hour;
    minute = noonTime.minute;
  } else if (partOfDay === 'afternoon') {
    hour = afternoonTime.hour;
    minute = afternoonTime.minute;
  } else if (partOfDay === 'evening') {
    hour = eveningTime.hour;
    minute = eveningTime.minute;
  } else {
    hour = defaultHourByPart(partOfDay, defaultHour);
    minute = partOfDay ? 0 : defaultMinute;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  const parsed = date.hour(hour).minute(minute).second(0);
  const confidence = hasDateInfo ? 'high' : (timeToken || partToken ? 'medium' : 'low');
  const matchedSpans = mergeSpans(
    allTemporalTokens.map((token) => ({
      start: token.start,
      end: token.end,
      type: token.type || '',
      text: token.text || '',
    }))
  );
  const cleanedTitle = cleanupTitleBySpans(raw, matchedSpans);

  return {
    parsedAtISO: parsed.toISOString(),
    parsedAtInput: parsed.format('YYYY-MM-DDTHH:mm'),
    parsedAtDisplay: parsed.format('YYYY-MM-DD HH:mm:ss'),
    cleanedTitle: cleanedTitle || raw,
    confidence,
    matchedSpans,
    appliedRules: Array.from(new Set(appliedRules)),
    ambiguous: !hasDateInfo,
  };
}
