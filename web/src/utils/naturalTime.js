import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const WEEKDAY_MAP = {
  '日': 0,
  '天': 0,
  '一': 1,
  '二': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
};

const MARKER_REGEX =
  /(今天|明天|后天|大后天|今晚|明晚|今早|明早|早上|上午|中午|下午|晚上|傍晚|凌晨|下周|这周|本周|周[一二三四五六日天]|星期[一二三四五六日天]|\d{1,4}[年/-]\d{1,2}[月/-]\d{1,2}[日号]?|\d{1,2}月\d{1,2}[日号]?|[一二三四五六七八九十两零〇廿卅]{1,3}月(?:\d{1,2}|[一二三四五六七八九十两零〇廿卅]{1,3})[日号]?|\d{1,2}\s*[:：]\s*\d{1,2}|\d{1,2}\s*点)/;

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

function detectPartOfDay(text) {
  if (/(凌晨)/.test(text)) return 'late-night';
  if (/(早上|上午|早晨|今早|明早)/.test(text)) return 'morning';
  if (/(中午)/.test(text)) return 'noon';
  if (/(下午)/.test(text)) return 'afternoon';
  if (/(晚上|今晚|明晚|傍晚)/.test(text)) return 'evening';
  return '';
}

function parseHourMinute(text) {
  const colonMatch = text.match(/(\d{1,2})\s*[:：]\s*(\d{1,2})/);
  if (colonMatch) {
    return {
      hour: parseInt(colonMatch[1], 10),
      minute: parseInt(colonMatch[2], 10),
      matched: true,
    };
  }

  const halfMatch = text.match(/(\d{1,2})\s*点\s*半/);
  if (halfMatch) {
    return {
      hour: parseInt(halfMatch[1], 10),
      minute: 30,
      matched: true,
    };
  }

  const fullMatch = text.match(/(\d{1,2})\s*点(?:\s*(\d{1,2})\s*分?)?/);
  if (fullMatch) {
    return {
      hour: parseInt(fullMatch[1], 10),
      minute: fullMatch[2] ? parseInt(fullMatch[2], 10) : 0,
      matched: true,
    };
  }

  return { hour: 9, minute: 0, matched: false };
}

function normalizeHour(partOfDay, hour) {
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

function resolveWeekday(now, prefix, weekday) {
  const today = now.startOf('day');
  const todayWeekday = today.day();
  let diff = (weekday - todayWeekday + 7) % 7;

  if (prefix === '下周') diff += 7;
  if (prefix === '下下周') diff += 14;
  return today.add(diff, 'day');
}

function resolveDate(text, now) {
  const withYear = text.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})[日号]?/);
  if (withYear) {
    const year = parseInt(withYear[1], 10);
    const month = parseInt(withYear[2], 10);
    const day = parseInt(withYear[3], 10);
    return now.year(year).month(month - 1).date(day).startOf('day');
  }

  const monthDay = text.match(/(\d{1,2})月(\d{1,2})[日号]?/);
  if (monthDay) {
    const month = parseInt(monthDay[1], 10);
    const day = parseInt(monthDay[2], 10);
    let resolved = now.month(month - 1).date(day).startOf('day');
    if (resolved.isBefore(now.startOf('day'))) {
      resolved = resolved.add(1, 'year');
    }
    return resolved;
  }

  const chineseMonthDay = text.match(/([一二三四五六七八九十两零〇廿卅]{1,3})月(\d{1,2}|[一二三四五六七八九十两零〇廿卅]{1,3})[日号]?/);
  if (chineseMonthDay) {
    const month = parseChineseNumber(chineseMonthDay[1]);
    const day = parseChineseNumber(chineseMonthDay[2]);
    if (Number.isFinite(month) && Number.isFinite(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let resolved = now.month(month - 1).date(day).startOf('day');
      if (resolved.isBefore(now.startOf('day'))) {
        resolved = resolved.add(1, 'year');
      }
      return resolved;
    }
  }

  if (/大后天/.test(text)) return now.startOf('day').add(3, 'day');
  if (/后天/.test(text)) return now.startOf('day').add(2, 'day');
  if (/(明天|明早|明晚)/.test(text)) return now.startOf('day').add(1, 'day');
  if (/(今天|今早|今晚)/.test(text)) return now.startOf('day');

  const weekdayMatch = text.match(/(下下周|下周|这周|本周)?(?:周|星期)([一二三四五六日天])/);
  if (weekdayMatch) {
    const prefix = weekdayMatch[1] || '';
    const weekday = WEEKDAY_MAP[weekdayMatch[2]];
    return resolveWeekday(now, prefix, weekday);
  }

  return now.startOf('day');
}

function cleanupTitle(input) {
  const patterns = [
    /(今天|明天|后天|大后天|今晚|明晚|今早|明早|早上|上午|中午|下午|晚上|傍晚|凌晨)/g,
    /(下下周|下周|这周|本周)?(?:周|星期)[一二三四五六日天]/g,
    /\d{1,4}[年/-]\d{1,2}[月/-]\d{1,2}[日号]?/g,
    /\d{1,2}月\d{1,2}[日号]?/g,
    /[一二三四五六七八九十两零〇廿卅]{1,3}月(?:\d{1,2}|[一二三四五六七八九十两零〇廿卅]{1,3})[日号]?/g,
    /\d{1,2}\s*[:：]\s*\d{1,2}/g,
    /\d{1,2}\s*点\s*半/g,
    /\d{1,2}\s*点(?:\s*\d{1,2}\s*分?)?/g,
  ];

  let cleaned = input;
  patterns.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, ' ');
  });

  cleaned = cleaned
    .replace(/[，,。！？!?.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

export function parseNaturalTimeFromTitle(title, timezoneName, options = {}) {
  const raw = String(title || '').trim();
  if (!raw) return null;
  if (!MARKER_REGEX.test(raw)) return null;

  const now = dayjs().tz(timezoneName || 'UTC');
  const { hour: defaultHour, minute: defaultMinute } = parseDefaultTime(options.defaultStartTime);
  const morningTime = parseDefaultTime(options.morningTime, { hour: 9, minute: 0 });
  const noonTime = parseDefaultTime(options.noonTime, { hour: 12, minute: 0 });
  const afternoonTime = parseDefaultTime(options.afternoonTime, { hour: 15, minute: 0 });
  const eveningTime = parseDefaultTime(options.eveningTime, { hour: 20, minute: 0 });
  const partOfDay = detectPartOfDay(raw);
  const date = resolveDate(raw, now);
  const parsedTime = parseHourMinute(raw);

  let hour = parsedTime.hour;
  let minute = parsedTime.minute;
  if (!parsedTime.matched) {
    if (partOfDay === 'morning') {
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
  }
  hour = normalizeHour(partOfDay, hour);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  const parsed = date.hour(hour).minute(minute).second(0);

  const cleanedTitle = cleanupTitle(raw);
  return {
    parsedAtISO: parsed.toISOString(),
    parsedAtInput: parsed.format('YYYY-MM-DDTHH:mm'),
    parsedAtDisplay: parsed.format('YYYY-MM-DD HH:mm:ss'),
    cleanedTitle: cleanedTitle || raw,
  };
}
