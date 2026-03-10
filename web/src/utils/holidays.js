import { Solar } from 'lunar-javascript';

const cache = new Map();
const CACHE_SIZE_LIMIT = 1000;

const LUNAR_DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

const LUNAR_MONTH_NAMES = [
  '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊',
];

// 主要传统节日和公历节日白名单（使用数组而非 Set 避免压缩问题）
const MAJOR_FESTIVALS = [
  // 农历传统节日
  '春节', '元宵', '端午', '七夕', '中元', '中秋', '重阳', '冬至', '腊八', '小年', '除夕',
  // 公历节日
  '元旦', '妇女节', '劳动节', '青年节', '儿童节', '建党节', '建军节', '教师节', '国庆节',
  // 其他常见节日
  '情人节', '母亲节', '父亲节', '感恩节', '圣诞节', '万圣节', '植树节',
  // 清明既是节气也是节日
  '清明',
];

// 二十四节气（全部保留）
const SOLAR_TERMS = [
  '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
  '立冬', '小雪', '大雪', '冬至', '小寒', '大寒',
];

// 需要过滤掉的生僻节日/杂节
const EXCLUDED_FESTIVALS = [
  '春社', '秋社', '正月晦', '二月朔', '三月朔', '四月朔', '五月朔',
  '六月朔', '七月朔', '八月朔', '九月朔', '十月朔', '冬月朔', '腊月朔',
  '天贶节', '天灸日', '入梅', '出梅', '初伏', '中伏', '末伏', '三伏',
  '头九', '二九', '三九', '四九', '五九', '六九', '七九', '八九', '九九',
  '社日', '梅日',
];

function getCacheKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function manageCache() {
  if (cache.size > CACHE_SIZE_LIMIT) {
    const keysToDelete = [];
    let count = 0;
    for (const key of cache.keys()) {
      if (count >= cache.size - CACHE_SIZE_LIMIT) break;
      keysToDelete.push(key);
      count++;
    }
    for (let i = 0; i < keysToDelete.length; i++) {
      cache.delete(keysToDelete[i]);
    }
  }
}

function includesAny(str, arr) {
  if (!str) return false;
  const s = String(str);
  for (let i = 0; i < arr.length; i++) {
    if (s.indexOf(arr[i]) !== -1) return true;
  }
  return false;
}

function isInArray(str, arr) {
  if (!str) return false;
  const s = String(str);
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === s) return true;
  }
  return false;
}

function isSolarTerm(name) {
  return isInArray(name, SOLAR_TERMS);
}

function filterHolidays(holidays) {
  if (!Array.isArray(holidays)) return [];
  const result = [];
  for (let i = 0; i < holidays.length; i++) {
    const name = holidays[i];
    // 排除生僻节日
    if (includesAny(name, EXCLUDED_FESTIVALS)) continue;
    // 保留主要节日或节气
    if (includesAny(name, MAJOR_FESTIVALS) || isSolarTerm(name)) {
      result.push(name);
    }
  }
  return result;
}

/**
 * Get lunar information for a given date
 * @param {Date|string} date - JavaScript Date or date string
 * @returns {{ month: string, day: string, dayLabel: string, monthLabel: string, displayLabel: string }}
 */
export function getLunarInfo(date) {
  const key = getCacheKey(date);

  if (cache.has(key)) {
    const cached = cache.get(key);
    if (cached.lunarInfo) return cached.lunarInfo;
  }

  const d = new Date(date);
  const solar = Solar.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const lunar = solar.getLunar();

  const lunarMonth = Math.abs(lunar.getMonth());
  const lunarDay = lunar.getDay();
  const isLeapMonth = lunar.getMonth() < 0;

  const monthLabel = LUNAR_MONTH_NAMES[lunarMonth - 1] || '';
  const dayLabel = LUNAR_DAY_NAMES[lunarDay - 1] || '';

  // 如果是初一，显示月份；否则显示日期
  const displayLabel = lunarDay === 1
    ? (isLeapMonth ? '闰' : '') + monthLabel + '月'
    : dayLabel;

  const lunarInfo = {
    month: lunarMonth,
    day: lunarDay,
    dayLabel,
    monthLabel: (isLeapMonth ? '闰' : '') + monthLabel + '月',
    displayLabel,
    isLeapMonth,
    isFirstDay: lunarDay === 1,
  };

  const existing = cache.get(key) || {};
  existing.lunarInfo = lunarInfo;
  cache.set(key, existing);
  manageCache();

  return lunarInfo;
}

/**
 * Get solar term (节气) for a given date
 * @param {Date|string} date - JavaScript Date or date string
 * @returns {string|null} Solar term name or null if not a solar term day
 */
export function getJieQi(date) {
  const key = getCacheKey(date);

  if (cache.has(key)) {
    const cached = cache.get(key);
    if (cached.jieQi !== undefined) return cached.jieQi;
  }

  const d = new Date(date);
  const solar = Solar.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const lunar = solar.getLunar();

  // getJieQi() returns the solar term name if today is a solar term day, empty string otherwise
  const jieQi = lunar.getJieQi() || null;
  // 过滤掉非主要节气
  const filteredJieQi = isSolarTerm(jieQi) ? jieQi : null;

  const existing = cache.get(key) || {};
  existing.jieQi = filteredJieQi;
  cache.set(key, existing);
  manageCache();

  return filteredJieQi;
}

/**
 * Get holidays/festivals for a given date
 * @param {Date|string} date - JavaScript Date or date string
 * @returns {string[]} Array of holiday names
 */
export function getHolidays(date) {
  const key = getCacheKey(date);

  if (cache.has(key)) {
    const cached = cache.get(key);
    if (cached.holidays) return cached.holidays;
  }

  const d = new Date(date);
  const solar = Solar.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const lunar = solar.getLunar();

  const holidays = [];

  // Get traditional Chinese festivals (from lunar calendar)
  const festivals = lunar.getFestivals() || [];
  for (let i = 0; i < festivals.length; i++) {
    holidays.push(festivals[i]);
  }

  // Get other festivals (from solar calendar, like 国庆节, 劳动节, etc.)
  const otherFestivals = lunar.getOtherFestivals() || [];
  for (let i = 0; i < otherFestivals.length; i++) {
    holidays.push(otherFestivals[i]);
  }

  // Get solar term
  const jieQi = lunar.getJieQi();
  if (isSolarTerm(jieQi)) {
    holidays.push(jieQi);
  }

  // 过滤节日
  const filteredHolidays = filterHolidays(holidays);

  const existing = cache.get(key) || {};
  existing.holidays = filteredHolidays;
  cache.set(key, existing);
  manageCache();

  return filteredHolidays;
}

/**
 * Get comprehensive display information for a date
 * @param {Date|string} date - JavaScript Date or date string
 * @param {boolean} showHolidays - Whether to include holidays in the result
 * @returns {{
 *   lunarDay: string,
 *   lunarMonth: string,
 *   lunarDisplay: string,
 *   holidays: string[],
 *   primaryHoliday: string|null,
 *   isHoliday: boolean,
 *   isSolarTerm: boolean
 * }}
 */
export function getDayDisplayInfo(date, showHolidays) {
  const key = getCacheKey(date);

  if (cache.has(key)) {
    const cached = cache.get(key);
    if (cached.displayInfo) {
      const info = cached.displayInfo;
      if (!showHolidays) {
        return {
          lunarDay: info.lunarDay,
          lunarMonth: info.lunarMonth,
          lunarDisplay: info.lunarDisplay,
          holidays: [],
          primaryHoliday: null,
          isHoliday: false,
          isSolarTerm: false,
        };
      }
      return info;
    }
  }

  const lunarInfo = getLunarInfo(date);
  const holidays = getHolidays(date);
  const jieQi = getJieQi(date);

  // 优先显示：传统节日 > 公历节日 > 节气
  // 节气单独标记，不与其他节日混排
  const nonTermHolidays = [];
  for (let i = 0; i < holidays.length; i++) {
    if (!isSolarTerm(holidays[i])) {
      nonTermHolidays.push(holidays[i]);
    }
  }
  const primaryHoliday = nonTermHolidays[0] || jieQi || null;
  const isHoliday = nonTermHolidays.length > 0;
  const isSolarTermFlag = !!jieQi && nonTermHolidays.length === 0;

  const displayInfo = {
    lunarDay: lunarInfo.dayLabel,
    lunarMonth: lunarInfo.monthLabel,
    lunarDisplay: lunarInfo.displayLabel,
    holidays: holidays,
    primaryHoliday: primaryHoliday,
    isHoliday: isHoliday,
    isSolarTerm: isSolarTermFlag,
  };

  const existing = cache.get(key) || {};
  existing.displayInfo = displayInfo;
  cache.set(key, existing);
  manageCache();

  if (!showHolidays) {
    return {
      lunarDay: lunarInfo.dayLabel,
      lunarMonth: lunarInfo.monthLabel,
      lunarDisplay: lunarInfo.displayLabel,
      holidays: [],
      primaryHoliday: null,
      isHoliday: false,
      isSolarTerm: false,
    };
  }

  return displayInfo;
}

/**
 * Check if a date is a traditional festival (not just solar term)
 * @param {Date|string} date - JavaScript Date or date string
 * @returns {boolean}
 */
export function isTraditionalFestival(date) {
  const d = new Date(date);
  const solar = Solar.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const lunar = solar.getLunar();
  const festivals = lunar.getFestivals() || [];
  for (let i = 0; i < festivals.length; i++) {
    if (includesAny(festivals[i], MAJOR_FESTIVALS)) return true;
  }
  return false;
}

/**
 * Clear the cache (useful for testing or memory management)
 */
export function clearHolidayCache() {
  cache.clear();
}
