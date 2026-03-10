import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import { Lunar, LunarMonth, LunarYear, Solar } from 'lunar-javascript';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export const LUNAR_TIMEZONE = 'Asia/Shanghai';
const LOCAL_PARSE_LAYOUTS = [
  'YYYY-MM-DD HH:mm:ss',
  'YYYY-MM-DD HH:mm',
  'YYYY-MM-DD',
];

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function resolveTimePart(value, fallbackTime = '09:00') {
  const fallback = /^\d{2}:\d{2}$/.test(String(fallbackTime || '')) ? String(fallbackTime) : '09:00';
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const token = raw.includes('T')
    ? raw.split('T')[1]
    : raw.includes(' ')
      ? raw.split(' ')[1]
      : '';
  const match = String(token || '').match(/^(\d{2}):(\d{2})/);
  if (!match) return fallback;
  return `${match[1]}:${match[2]}`;
}

function parseLocalInput(value, allDay = false, timezoneName = LUNAR_TIMEZONE) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^invalid date$/i.test(raw)) return null;
  const hasExplicitOffset = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  if (hasExplicitOffset) {
    try {
      const direct = dayjs(raw);
      if (direct.isValid()) {
        return direct.tz(timezoneName);
      }
    } catch {
      // ignore and fallback to formatted parsing
    }
  }
  const normalized = raw.replace('T', ' ');
  const layouts = allDay ? ['YYYY-MM-DD'] : LOCAL_PARSE_LAYOUTS;
  for (const layout of layouts) {
    try {
      const parsed = dayjs.tz(normalized, layout, timezoneName);
      if (parsed.isValid()) return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

function normalizeSelection(selection, fallbackYear = dayjs().tz(LUNAR_TIMEZONE).year()) {
  const year = clampInt(selection?.year, 1900, 2100, fallbackYear);
  const month = clampInt(selection?.month, 1, 12, 1);
  const isLeapMonth = !!selection?.isLeapMonth;
  const maxDay = getLunarDayCount(year, month, isLeapMonth);
  const day = clampInt(selection?.day, 1, maxDay, 1);
  return { year, month, day, isLeapMonth };
}

export function coerceLunarSelection(selection, fallbackYear = dayjs().tz(LUNAR_TIMEZONE).year()) {
  const normalized = normalizeSelection(selection, fallbackYear);
  const monthOptions = getLunarMonthOptions(normalized.year);
  if (monthOptions.length === 0) {
    return normalized;
  }
  let monthOption = monthOptions.find(
    (item) => item.month === normalized.month && item.isLeapMonth === normalized.isLeapMonth,
  );
  if (!monthOption) {
    monthOption = monthOptions.find(
      (item) => item.month === normalized.month && item.isLeapMonth === false,
    ) || monthOptions[0];
  }
  const dayOptions = getLunarDayOptions(
    normalized.year,
    monthOption.month,
    monthOption.isLeapMonth,
  );
  const maxDay = dayOptions[dayOptions.length - 1] || 30;
  return {
    year: normalized.year,
    month: monthOption.month,
    day: clampInt(normalized.day, 1, maxDay, 1),
    isLeapMonth: monthOption.isLeapMonth,
  };
}

export function getLunarMonthOptions(yearValue) {
  const year = clampInt(yearValue, 1900, 2100, dayjs().tz(LUNAR_TIMEZONE).year());
  let months = [];
  try {
    months = LunarYear.fromYear(year).getMonthsInYear() || [];
  } catch {
    months = [];
  }
  return months.map((monthItem) => {
    const token = Number(monthItem?.getMonth?.() || 0);
    const isLeapMonth = token < 0;
    const month = Math.abs(token);
    const dayCount = Number(monthItem?.getDayCount?.() || 30);
    return {
      year,
      month,
      isLeapMonth,
      dayCount,
      label: `${isLeapMonth ? '闰' : ''}${month}月`,
    };
  });
}

export function getLunarDayCount(yearValue, monthValue, isLeapMonth = false) {
  const year = clampInt(yearValue, 1900, 2100, dayjs().tz(LUNAR_TIMEZONE).year());
  const month = clampInt(monthValue, 1, 12, 1);
  const token = isLeapMonth ? -month : month;
  try {
    let monthObj = LunarMonth.fromYm(year, token);
    if (!monthObj && isLeapMonth) {
      monthObj = LunarMonth.fromYm(year, month);
    }
    const dayCount = Number(monthObj?.getDayCount?.() || 30);
    if (Number.isFinite(dayCount) && dayCount >= 29 && dayCount <= 30) return dayCount;
  } catch {
    // ignore and fallback
  }
  return 30;
}

export function getLunarDayOptions(yearValue, monthValue, isLeapMonth = false) {
  const count = getLunarDayCount(yearValue, monthValue, isLeapMonth);
  return Array.from({ length: count }, (_, index) => index + 1);
}

export function lunarSelectionFromLocalInput(value, allDay = false, timezoneName = LUNAR_TIMEZONE) {
  const parsed = parseLocalInput(value, allDay, timezoneName);
  if (!parsed) return null;
  try {
    const solar = Solar.fromYmd(parsed.year(), parsed.month() + 1, parsed.date());
    const lunar = solar.getLunar();
    const rawMonth = Number(lunar?.getMonth?.() || 0);
    if (!rawMonth) return null;
    return {
      year: Number(lunar?.getYear?.() || parsed.year()),
      month: Math.abs(rawMonth),
      day: Number(lunar?.getDay?.() || parsed.date()),
      isLeapMonth: rawMonth < 0,
    };
  } catch {
    return null;
  }
}

export function solarDateFromLunarSelection(selection) {
  const normalized = normalizeSelection(selection);
  const monthToken = normalized.isLeapMonth ? -normalized.month : normalized.month;
  try {
    let monthObj = LunarMonth.fromYm(normalized.year, monthToken);
    let effectiveToken = monthToken;
    if (!monthObj && normalized.isLeapMonth) {
      monthObj = LunarMonth.fromYm(normalized.year, normalized.month);
      effectiveToken = normalized.month;
    }
    if (!monthObj) return '';
    const maxDay = Number(monthObj.getDayCount() || 30);
    const day = Math.min(normalized.day, maxDay);
    const lunar = Lunar.fromYmd(normalized.year, effectiveToken, day);
    const solar = lunar.getSolar();
    if (!solar) return '';
    return `${solar.getYear()}-${pad2(solar.getMonth())}-${pad2(solar.getDay())}`;
  } catch {
    return '';
  }
}

export function localInputFromLunarSelection(
  selection,
  currentValue,
  allDay = false,
  fallbackTime = '09:00'
) {
  const solarDate = solarDateFromLunarSelection(coerceLunarSelection(selection));
  if (!solarDate) return '';
  if (allDay) return solarDate;
  const current = String(currentValue || '').trim();
  const timePart = current.includes('T') ? current.split('T')[1] : '';
  const normalizedTime = /^\d{2}:\d{2}/.test(timePart) ? timePart.slice(0, 5) : fallbackTime;
  return `${solarDate}T${normalizedTime}`;
}

export function nextLocalInputFromLunarSelection(
  selection,
  options = {}
) {
  const allDay = !!options?.allDay;
  const timezoneName = String(options?.timezoneName || LUNAR_TIMEZONE);
  const fallbackTime = resolveTimePart('', options?.fallbackTime || '09:00');
  const currentValue = String(options?.currentValue || '').trim();
  const fromValue = String(options?.fromValue || '').trim();
  const searchYears = Math.max(1, Number.parseInt(options?.searchYears, 10) || 8);

  const now = parseLocalInput(fromValue, allDay, timezoneName) || dayjs().tz(timezoneName);
  const reference = allDay ? now.startOf('day') : now.startOf('minute');
  const normalized = normalizeSelection({
    year: reference.year(),
    month: selection?.month,
    day: selection?.day,
    isLeapMonth: selection?.isLeapMonth,
  }, reference.year());

  for (let offset = 0; offset <= searchYears; offset += 1) {
    const year = reference.year() + offset;
    const withYear = coerceLunarSelection({
      year,
      month: normalized.month,
      day: normalized.day,
      isLeapMonth: normalized.isLeapMonth,
    }, year);
    const candidateInput = localInputFromLunarSelection(
      withYear,
      currentValue,
      allDay,
      fallbackTime,
    );
    if (!candidateInput) continue;
    const candidate = parseLocalInput(candidateInput, allDay, timezoneName);
    if (!candidate || candidate.isBefore(reference)) continue;
    return candidateInput;
  }

  const fallbackSelection = coerceLunarSelection({
    year: reference.year(),
    month: normalized.month,
    day: normalized.day,
    isLeapMonth: normalized.isLeapMonth,
  }, reference.year());
  return localInputFromLunarSelection(
    fallbackSelection,
    currentValue,
    allDay,
    fallbackTime,
  );
}

export function buildLunarYearlyRuleFromSelection(selection) {
  const normalized = normalizeSelection(selection);
  return {
    freq: 'lunar_yearly',
    interval: 1,
    lunar_month: normalized.month,
    lunar_day: normalized.day,
    lunar_is_leap_month: normalized.isLeapMonth,
  };
}

export function parseLunarYearlyRule(rule, fallbackLocalInput = '') {
  const freq = String(rule?.freq || '').trim().toLowerCase();
  const isLunar = freq === 'lunar_yearly' || freq === 'lunar';
  if (!isLunar) return null;
  const fallback = lunarSelectionFromLocalInput(fallbackLocalInput, false, LUNAR_TIMEZONE);
  return normalizeSelection({
    year: fallback?.year,
    month: Number.parseInt(rule?.lunar_month, 10) || fallback?.month || 1,
    day: Number.parseInt(rule?.lunar_day, 10) || fallback?.day || 1,
    isLeapMonth: !!rule?.lunar_is_leap_month,
  });
}

export function buildLunarYearlyOccurrenceStarts({
  anchorISO,
  rangeStartISO,
  rangeEndISO,
  recurrenceRule,
  recurrenceEndISO = '',
}) {
  const rule = recurrenceRule || {};
  const anchor = dayjs(anchorISO || '');
  const rangeStart = dayjs(rangeStartISO || '');
  const rangeEnd = dayjs(rangeEndISO || '');
  if (!anchor.isValid() || !rangeStart.isValid() || !rangeEnd.isValid()) return [];

  const anchorLocal = anchor.tz(LUNAR_TIMEZONE);
  const anchorSolar = Solar.fromYmd(anchorLocal.year(), anchorLocal.month() + 1, anchorLocal.date());
  const anchorLunar = anchorSolar.getLunar();
  const anchorLunarYear = Number(anchorLunar?.getYear?.() || anchorLocal.year());
  const anchorRawMonth = Number(anchorLunar?.getMonth?.() || 1);
  const anchorMonth = Math.abs(anchorRawMonth);
  const anchorDay = Number(anchorLunar?.getDay?.() || anchorLocal.date());

  const month = clampInt(rule?.lunar_month, 1, 12, anchorMonth);
  const day = clampInt(rule?.lunar_day, 1, 30, anchorDay);
  const preferLeapMonth = !!rule?.lunar_is_leap_month;
  const interval = Math.max(1, Number.parseInt(rule?.interval, 10) || 1);
  const count = Math.max(0, Number.parseInt(rule?.count, 10) || 0);

  const until = dayjs(recurrenceEndISO || '');
  const hasUntil = until.isValid();
  const fromUTC = rangeStart.utc();
  const toUTC = rangeEnd.utc();
  const maxRangeYear = toUTC.tz(LUNAR_TIMEZONE).year() + 2;
  let maxYear = maxRangeYear;
  if (hasUntil) {
    maxYear = Math.min(maxYear, until.utc().tz(LUNAR_TIMEZONE).year() + 1);
  }
  if (count > 0) {
    maxYear = Math.min(maxYear, anchorLunarYear + ((count + 1) * interval));
  }

  const seen = new Set();
  const starts = [];
  let sequence = 0;
  for (let year = anchorLunarYear; year <= maxYear; year += interval) {
    const monthOptions = getLunarMonthOptions(year);
    let monthOption = monthOptions.find((item) => item.month === month && item.isLeapMonth === preferLeapMonth);
    if (!monthOption && preferLeapMonth) {
      monthOption = monthOptions.find((item) => item.month === month && !item.isLeapMonth);
    }
    if (!monthOption) continue;

    const effectiveDay = Math.min(day, monthOption.dayCount || 30);
    const monthToken = monthOption.isLeapMonth ? -monthOption.month : monthOption.month;
    let solar;
    try {
      solar = Lunar.fromYmd(year, monthToken, effectiveDay).getSolar();
    } catch {
      solar = null;
    }
    if (!solar) continue;

    const local = dayjs.tz(
      `${solar.getYear()}-${pad2(solar.getMonth())}-${pad2(solar.getDay())} ${anchorLocal.format('HH:mm:ss')}`,
      'YYYY-MM-DD HH:mm:ss',
      LUNAR_TIMEZONE
    );
    if (!local.isValid()) continue;
    const utcValue = local.utc();
    if (utcValue.isBefore(anchor.utc())) continue;
    if (hasUntil && utcValue.isAfter(until.utc())) break;

    sequence += 1;
    if (count > 0 && sequence > count) break;

    if (utcValue.isBefore(fromUTC) || utcValue.isAfter(toUTC)) continue;
    const iso = utcValue.toISOString();
    if (seen.has(iso)) continue;
    seen.add(iso);
    starts.push(iso);
  }

  return starts.sort((left, right) => left.localeCompare(right));
}
