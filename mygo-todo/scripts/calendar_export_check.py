#!/usr/bin/env python3
"""Independent RFC 5545 validation of fixtures from Go service/API tests.

Only development verification uses these Python libraries; the native app and
backend do not require Python or additional runtime dependencies.
"""
import argparse
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

try:
    from icalendar import Calendar
    import recurring_ical_events
except ImportError:
    raise SystemExit("缺少日历验收依赖，请在独立 venv 中安装 scripts/calendar-export-requirements.txt 后重试。")


def check(fixtures):
    count = 0

    def passed(label):
        nonlocal count
        count += 1
        print("PASS: " + label, flush=True)

    def load(name):
        path = fixtures / name
        if not path.is_file():
            raise SystemExit(f"缺少验收夹具：{path}；请先运行 Makefile 的 calendar-export-check 目标。")
        return Calendar.from_ical(path.read_bytes())

    def occurrences(calendar):
        return recurring_ical_events.of(calendar).between(
            datetime(2026, 1, 1, tzinfo=timezone.utc),
            datetime(2027, 1, 1, tzinfo=timezone.utc),
        )

    dst = load("occurrence-dst.ics")
    rows = occurrences(dst)
    assert len(rows) == 3, "单次改期后的实例数量不正确"
    moved = next(e for e in rows if e.decoded("DTSTART") == date(2026, 3, 20))
    assert moved.decoded("RECURRENCE-ID") == datetime(2026, 3, 8, 9, tzinfo=ZoneInfo("America/New_York"))
    assert str(moved.get("DESCRIPTION")) == "改期后的本次笔记"
    assert moved.decoded("DTEND") == date(2026, 3, 21)
    assert not any(isinstance(e.decoded("DTSTART"), datetime) and e.decoded("DTSTART").date() == date(2026, 3, 8) for e in rows)
    passed("跨夏令时改为全天，原位置移除、原始身份与笔记保留、结束为排他边界")

    reset = occurrences(load("occurrence-reset.ics"))
    restored = next(e for e in reset if e.decoded("RECURRENCE-ID").date() == date(2026, 3, 8))
    assert len(reset) == 3 and restored.decoded("DTSTART") == datetime(2026, 3, 8, 13, tzinfo=timezone.utc)
    assert str(restored.get("DESCRIPTION")) == "改期后的本次笔记"
    passed("恢复系列时间使用夏令时后的实际 UTC 时间，单次笔记保留")

    all_day = load("occurrence-all-day.ics")
    timed = occurrences(all_day)
    assert len(timed) == 1 and timed[0].decoded("DTSTART") == datetime(2026, 6, 2, 11, tzinfo=timezone.utc)
    assert timed[0].decoded("RECURRENCE-ID") == date(2026, 6, 20)
    raw_timed = next(e for e in all_day.walk("VEVENT") if e.get("RECURRENCE-ID"))
    assert raw_timed.get("DTEND") is None, "清除的结束时间被导出恢复"
    passed("全天实例改为定时，保留 DATE 身份并清除结束")

    cancelled = occurrences(load("occurrence-cancelled.ics"))
    assert len(cancelled) == 1 and str(cancelled[0].get("STATUS")) == "CANCELLED"
    passed("跳过实例导出为取消例外，不生成额外的有效日程")

    feed = load("occurrence-feed.ics")
    assert len(feed.walk("VEVENT")) == 4 and len(feed.walk("VTIMEZONE")) == 1
    assert len(occurrences(feed)) == 4
    passed("合并订阅保留所有单次例外，多个系列共用唯一时区定义")

    for name in ("America/New_York", "Europe/Berlin", "Australia/Lord_Howe", "Asia/Shanghai", "Africa/Casablanca"):
        calendar = load(name.replace("/", "-") + ".ics")
        zone = calendar.walk("VTIMEZONE")[0]
        # Disable the library's IANA-name shortcut: validate the observances
        # emitted by Go, rather than silently substituting the system tzdb.
        embedded = zone.to_tz(lookup_tzid=False)
        system = ZoneInfo(name)
        for year in (1900, 1990, 2026, 2038, 2040, 2050, 2088, 2099, 2105, 2150):
            for month in range(1, 13):
                instant = datetime(year, month, 15)
                assert instant.replace(tzinfo=embedded).utcoffset() == instant.replace(tzinfo=system).utcoffset(), f"{name} 的时区定义在 {instant} 不一致"
        passed(name + "：导出时区独立展开与系统 tzdb 一致，覆盖 1900–2150 年")

    months = load("month-constrained.ics")
    master = next(e for e in months.walk("VEVENT") if not e.get("RECURRENCE-ID"))
    assert list(master.decoded("RRULE")["BYMONTH"]) == [3, 11]
    expanded = recurring_ical_events.of(months).between(
        datetime(2026, 1, 1, tzinfo=timezone.utc),
        datetime(2028, 1, 1, tzinfo=timezone.utc),
    )
    ny = ZoneInfo("America/New_York")
    assert sorted(e.decoded("DTSTART") for e in expanded) == [
        datetime(2026, 3, 8, 9, tzinfo=ny),
        datetime(2026, 7, 1, 10, tzinfo=ny),
        datetime(2027, 3, 14, 9, tzinfo=ny),
    ], "限定月份、按月星期序号与次数未共同生效"
    moved = next(e for e in expanded if e.decoded("DTSTART").month == 7)
    assert moved.decoded("RECURRENCE-ID") == datetime(2026, 11, 8, 9, tzinfo=ny)
    passed("限定月份与星期序号共同展开，跨夏令时和跨年计数，单次可改至其他月份")

    lunar = load("lunar.ics")
    lunar_master = next(e for e in lunar.walk("VEVENT") if not e.get("RECURRENCE-ID"))
    assert lunar_master.get("RRULE") is None, "农历系列不能伪装成 Gregorian RRULE"
    assert lunar_master.get("X-TODO-LUNAR-RULE")
    lunar_rows = recurring_ical_events.of(lunar).between(
        datetime(2026, 1, 1, tzinfo=timezone.utc),
        datetime(2029, 1, 1, tzinfo=timezone.utc),
    )
    assert [e.decoded("DTSTART").strftime("%Y-%m-%d") for e in lunar_rows] == [
        "2026-02-17", "2027-02-06", "2028-01-26",
    ]
    passed("农历系列导出为标准 RDATE，第三方展开日期正确且保留 Todo 规则元数据")

    for path in fixtures.glob("*.ics"):
        for line in path.read_bytes().split(b"\r\n"):
            assert len(line) <= 75, f"{path} 存在超长物理行"
            line.decode("utf-8")
    passed("RFC 5545 的 75 字节折行保持 UTF-8 完整")
    print(f"Calendar export validation: {count}/{count} PASS", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixtures", type=Path, default=Path(__file__).resolve().parents[1] / "artifacts/calendar-export")
    check(parser.parse_args().fixtures)
