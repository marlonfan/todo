import dayjs from 'dayjs';
import { LUNAR_TIMEZONE, parseLunarYearlyRule, coerceLunarSelection, buildLunarYearlyRuleFromSelection } from './lunar.js';
import { normalizeByDayList, clampMonthlyDate, clampCustomRecurrenceInterval } from './quickEditor.js';

const WEEKDAY_ONLY_RE = /^(MO|TU|WE|TH|FR|SA|SU)$/;
function parseLocalInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = dayjs(raw);
  return parsed.isValid() ? parsed : null;
}

export function parseRecurrenceRule(rawRule) {
  let rule = rawRule;
  if (typeof rule === 'string') {
    try { rule = JSON.parse(rule); } catch { return null; }
  }
  return rule && typeof rule === 'object' && !Array.isArray(rule) ? rule : null;
}

export function buildRecurrenceSummaryLabel(enabled, recurrenceType, selectedDays, t, recurrenceMeta = null) {
  if (!enabled) return t('task.repeatOff');
  if (recurrenceType === 'lunar') {
    const month = Number.parseInt(recurrenceMeta?.month, 10) || 1;
    const day = Number.parseInt(recurrenceMeta?.day, 10) || 1;
    const leap = !!recurrenceMeta?.isLeapMonth;
    return `${t('task.lunarYearly')} ${leap ? t('task.lunarLeapPrefix') : ''}${month}/${day}`;
  }
  const dayCount = Array.isArray(selectedDays) ? selectedDays.length : 0;
  if (recurrenceType === 'custom_weekly') {
    const label = t('task.customWeeklySummary', {
      count: clampCustomRecurrenceInterval(recurrenceMeta?.interval),
    });
    return dayCount > 0 ? `${label}(${dayCount})` : label;
  }
  if (recurrenceType === 'custom_monthly') {
    return t('task.customMonthlySummary', {
      count: clampCustomRecurrenceInterval(recurrenceMeta?.interval),
      date: clampMonthlyDate(recurrenceMeta?.monthDate, 1),
    });
  }
  if (recurrenceType === 'biweekly') {
    const biweeklyLabel = t('task.biweekly');
    return dayCount > 0 ? `${biweeklyLabel}(${dayCount})` : biweeklyLabel;
  }
  if (recurrenceType === 'weekly') {
    const weeklyLabel = t('task.weekly');
    return dayCount > 0 ? `${weeklyLabel}(${dayCount})` : weeklyLabel;
  }
  if (recurrenceType === 'monthly') return t('task.monthly');
  if (recurrenceType === 'yearly') return t('task.yearly');
  return t('task.daily');
}

export function getRecurrenceIntervalForType(recurrenceType, interval = 1) {
  const type = String(recurrenceType || 'daily');
  if (type === 'biweekly') return 2;
  if (type === 'custom_weekly' || type === 'custom_monthly') {
    return clampCustomRecurrenceInterval(interval);
  }
  return 1;
}

export function resolveMonthlyDateFromRule(rule, fallbackStartInput) {
  const rawByDate = Array.isArray(rule?.bydate)
    ? rule.bydate
    : Array.isArray(rule?.byDate)
      ? rule.byDate
      : Array.isArray(rule?.bymonthday)
        ? rule.bymonthday
        : [];
  for (const raw of rawByDate) {
    const value = Number.parseInt(raw, 10);
    if (Number.isFinite(value) && value >= 1 && value <= 31) {
      return value;
    }
  }
  const start = parseLocalInput(fallbackStartInput);
  if (start) return start.date();
  return 1;
}

export function parseRecurrenceSelection(rule, fallbackStartInput = '') {
  const fallbackLunar = parseLunarYearlyRule({ freq: 'lunar_yearly' }, fallbackStartInput) || {
    year: dayjs().tz(LUNAR_TIMEZONE).year(), month: 1, day: 1, isLeapMonth: false,
  };
  const freq = String(rule?.freq || 'daily').trim().toLowerCase();
  const isLunar = freq === 'lunar_yearly' || freq === 'lunar';
  const lunar = isLunar ? parseLunarYearlyRule(rule, fallbackStartInput) || fallbackLunar : fallbackLunar;
  const interval = isLunar ? 1 : Math.max(1, Number.parseInt(rule?.interval, 10) || 1);
  let type = freq || 'daily';
  if (isLunar) type = 'lunar';
  else if (freq === 'weekly' && interval === 2) type = 'biweekly';
  else if (freq === 'weekly' && interval > 2) type = 'custom_weekly';
  else if (freq === 'monthly' && interval > 1) type = 'custom_monthly';
  return {
    type,
    days: isLunar ? [] : normalizeByDayList(rule?.byday || rule?.byDay).filter((day) => WEEKDAY_ONLY_RE.test(day)),
    monthDate: rule ? resolveMonthlyDateFromRule(rule, fallbackStartInput) : 1,
    interval,
    lunarYear: lunar.year,
    lunarMonth: lunar.month,
    lunarDay: lunar.day,
    lunarIsLeapMonth: lunar.isLeapMonth,
  };
}

export function buildRecurrenceRule(selection, { enabled = true, workDayKeys = ['MO', 'TU', 'WE', 'TH', 'FR'] } = {}) {
  if (!enabled) return null;
  const type = selection.type || 'daily';
  const days = normalizeByDayList(selection.days).filter((day) => WEEKDAY_ONLY_RE.test(day));
  if (type === 'lunar') {
    return buildLunarYearlyRuleFromSelection(coerceLunarSelection({
      year: selection.lunarYear,
      month: selection.lunarMonth,
      day: selection.lunarDay,
      isLeapMonth: selection.lunarIsLeapMonth,
    }));
  }
  const rule = { freq: type, interval: getRecurrenceIntervalForType(type, selection.interval) };
  if (isCustomWeekly(type)) {
    rule.freq = 'weekly';
    rule.byday = days.length ? days : [...workDayKeys];
  } else if (type === 'custom_monthly' || type === 'monthly') {
    rule.freq = 'monthly';
    rule.bydate = [clampMonthlyDate(selection.monthDate, 1)];
  } else if (type === 'weekly' && days.length) {
    rule.byday = days;
  }
  return rule;
}

function isCustomWeekly(type) {
  return type === 'biweekly' || type === 'custom_weekly';
}
