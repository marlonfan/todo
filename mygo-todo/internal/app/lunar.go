package app

import (
	"fmt"
	"time"
)

// Standard 1900–2100 Chinese Lunar Calendar bitmask table (201 years, base 1900-01-31).
// Bits 0..3: leap month (0 if none, 1..12 if leap month exists in that lunar year).
// Bits 4..15: month lengths for months 1..12 (1 = 30 days, 0 = 29 days).
// Bit 16: leap month length (1 = 30 days, 0 = 29 days).
var lunarInfo1900To2100 = [201]uint32{
	0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
	0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
	0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
	0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
	0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
	0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
	0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
	0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
	0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
	0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
	0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
	0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
	0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
	0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
	0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
	0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, // 2050-2059
	0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
	0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
	0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
	0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252, // 2090-2099
	0x0d520, // 2100
}

var lunarMonthNames = [12]string{
	"正月", "二月", "三月", "四月", "五月", "六月",
	"七月", "八月", "九月", "十月", "冬月", "腊月",
}

var lunarDayNames = [30]string{
	"初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
	"十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
	"廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
}

type LunarDate struct {
	Year   int
	Month  int
	Day    int
	IsLeap bool
}

func (l LunarDate) MonthLabel() string {
	if l.Month < 1 || l.Month > 12 {
		return ""
	}
	name := lunarMonthNames[l.Month-1]
	if l.IsLeap {
		return "闰" + name
	}
	return name
}

func (l LunarDate) DayLabel() string {
	if l.Day < 1 || l.Day > 30 {
		return ""
	}
	return lunarDayNames[l.Day-1]
}

// ShortCellLabel returns the month name on the 1st of a lunar month (e.g. "十月", "闰六月")
// and the lunar day name otherwise (e.g. "初七", "十五"), matching Chinese calendar conventions.
func (l LunarDate) ShortCellLabel() string {
	if l.Day == 1 {
		return l.MonthLabel()
	}
	return l.DayLabel()
}

func (l LunarDate) FullLabel() string {
	return "农历" + l.MonthLabel() + l.DayLabel()
}

func lunarYearLeapMonth(year int) int {
	if year < 1900 || year > 2100 {
		return 0
	}
	return int(lunarInfo1900To2100[year-1900] & 0xf)
}

func lunarYearLeapDays(year int) int {
	if lunarYearLeapMonth(year) == 0 {
		return 0
	}
	if lunarInfo1900To2100[year-1900]&0x10000 != 0 {
		return 30
	}
	return 29
}

func lunarMonthDays(year, month int, isLeap bool) int {
	if year < 1900 || year > 2100 || month < 1 || month > 12 {
		return 29
	}
	if isLeap {
		if lunarYearLeapMonth(year) == month {
			return lunarYearLeapDays(year)
		}
		return 0
	}
	mask := uint32(0x10000 >> month)
	if lunarInfo1900To2100[year-1900]&mask != 0 {
		return 30
	}
	return 29
}

func lunarYearTotalDays(year int) int {
	if year < 1900 || year > 2100 {
		return 354
	}
	sum := lunarYearLeapDays(year)
	info := lunarInfo1900To2100[year-1900]
	for mask := uint32(0x8000); mask > 0x8; mask >>= 1 {
		if info&mask != 0 {
			sum += 30
		} else {
			sum += 29
		}
	}
	return sum
}

// solarToLunar converts a solar date to its Chinese Lunar date.
func solarToLunar(t time.Time) (LunarDate, bool) {
	base := time.Date(1900, 1, 31, 0, 0, 0, 0, time.UTC)
	target := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
	offset := int(target.Sub(base).Hours() / 24)
	if offset < 0 {
		return LunarDate{}, false
	}

	year := 1900
	for year <= 2100 {
		daysInYear := lunarYearTotalDays(year)
		if offset < daysInYear {
			break
		}
		offset -= daysInYear
		year++
	}
	if year > 2100 {
		return LunarDate{}, false
	}

	leapMonth := lunarYearLeapMonth(year)
	isLeap := false
	month := 1
	for month <= 12 {
		var daysInMonth int
		if leapMonth > 0 && month == leapMonth+1 && !isLeap {
			month--
			isLeap = true
			daysInMonth = lunarYearLeapDays(year)
		} else {
			daysInMonth = lunarMonthDays(year, month, false)
		}

		if offset < daysInMonth {
			break
		}
		offset -= daysInMonth
		if isLeap && month == leapMonth {
			isLeap = false
		}
		month++
	}
	return LunarDate{
		Year:   year,
		Month:  month,
		Day:    offset + 1,
		IsLeap: isLeap,
	}, true
}

// lunarToSolar converts a Chinese Lunar date to a solar time.Time in loc.
func lunarToSolar(year, month, day int, isLeap bool, loc *time.Location) (time.Time, bool) {
	if year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 {
		return time.Time{}, false
	}
	if loc == nil {
		loc = time.UTC
	}
	leapMonth := lunarYearLeapMonth(year)
	effectiveLeap := isLeap && leapMonth == month
	maxDay := lunarMonthDays(year, month, effectiveLeap)
	if day > maxDay {
		day = maxDay
	}

	offset := 0
	for y := 1900; y < year; y++ {
		offset += lunarYearTotalDays(y)
	}
	for m := 1; m < month; m++ {
		offset += lunarMonthDays(year, m, false)
		if leapMonth == m {
			offset += lunarYearLeapDays(year)
		}
	}
	if effectiveLeap {
		offset += lunarMonthDays(year, month, false)
	}
	offset += day - 1

	base := time.Date(1900, 1, 31, 0, 0, 0, 0, loc)
	return base.AddDate(0, 0, offset), true
}

// nextSolarFromLunar finds the next upcoming solar date on or after `from` matching
// the given lunar month/day (falling back to non-leap month when the year lacks that leap month).
func nextSolarFromLunar(month, day int, preferLeap bool, from time.Time) (time.Time, bool) {
	if month < 1 || month > 12 || day < 1 || day > 30 {
		return time.Time{}, false
	}
	loc := from.Location()
	fromDay := dayStart(from)
	curLunar, ok := solarToLunar(fromDay)
	startYear := fromDay.Year()
	if ok {
		startYear = curLunar.Year
	}
	for y := startYear; y <= min(2100, startYear+8); y++ {
		solar, ok := lunarToSolar(y, month, day, preferLeap, loc)
		if !ok {
			continue
		}
		cand := time.Date(solar.Year(), solar.Month(), solar.Day(), from.Hour(), from.Minute(), from.Second(), 0, loc)
		if !dayStart(cand).Before(fromDay) {
			return cand, true
		}
	}
	return time.Time{}, false
}

func shiftLunarMonth(year, month int, isLeap bool, delta int) (int, int, bool) {
	if delta == 0 {
		return year, month, isLeap
	}
	step := 1
	if delta < 0 {
		step = -1
		delta = -delta
	}
	for i := 0; i < delta; i++ {
		leap := lunarYearLeapMonth(year)
		if step > 0 {
			if leap == month && !isLeap {
				isLeap = true
			} else {
				isLeap = false
				month++
				if month > 12 {
					month = 1
					year++
				}
			}
		} else {
			if isLeap {
				isLeap = false
			} else {
				month--
				if month < 1 {
					month = 12
					year--
					leap = lunarYearLeapMonth(year)
				}
				if leap == month {
					isLeap = true
				}
			}
		}
	}
	return max(1900, min(2100, year)), month, isLeap
}

func formatLunarYearMonthTitle(year, month int, isLeap bool) string {
	l := LunarDate{Year: year, Month: month, Day: 1, IsLeap: isLeap}
	return fmt.Sprintf("%d年 %s", year, l.MonthLabel())
}
