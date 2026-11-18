#!/usr/bin/env python3
"""Native instance rescheduling against an isolated real Todo backend."""
import argparse
import base64
from datetime import datetime, timedelta
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
import urllib.error
from urllib.parse import urlencode
import uuid
from zoneinfo import ZoneInfo

from smoke import Native, ROOT, wait_for


def choose_day(ui, field, day):
    ui.press("popUpButton", field)
    labels = [f"{day:%B} {day.day}, {day.year}", f"{day.year}年{day.month}月{day.day}日"]
    node = wait_for(lambda: next((n for n in ui.nodes() if n.get("role") == "button" and n.get("label") in labels), None), "日期选择器没有目标日期")
    ui.call("act", id=node["id"], action="press")
    ui.call("idle", timeout=3000)


def step_hour(ui, field, action):
    node = next(n for n in ui.nodes() if n.get("role") == "stepper" and field in n.get("label", "") and ("hour" in n["label"] or "小时" in n["label"]))
    ui.call("act", id=node["id"], action=action)
    ui.call("idle", timeout=3000)


def smoke(app_binary, server_binary, artifacts):
    count = 0
    def passed(label):
        nonlocal count
        count += 1
        print("PASS: " + label, flush=True)
    with tempfile.TemporaryDirectory(prefix="todo-native-schedule-") as tmp:
        work = Path(tmp)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        config = work / "server.yaml"
        config.write_text(json.dumps({"server": {"host": "127.0.0.1", "port": port}, "database": {"driver": "sqlite", "dsn": str(work / "test.db")}, "jwt": {"secret": uuid.uuid4().hex, "expire": "24h"}}))
        token = ""
        server = native = ui = None
        native_log = open(work / "native.log", "wb")
        server_log = open(work / "server.log", "wb")
        env = dict(os.environ, TODO_NATIVE_QA="1", TODO_API_URL=base, TODO_NATIVE_DATA_DIR=str(work / "profile"), TODO_NATIVE_REMINDER_LOG=str(work / "reminders.jsonl"), MYGO_AUTOMATION=str(work / "native.sock"))
        def api(path, method="GET", body=None, headers=None):
            req = urllib.request.Request(base + path, method=method, data=None if body is None else json.dumps(body).encode(), headers={"Authorization": "Bearer " + token, "Content-Type": "application/json", **(headers or {})})
            with urllib.request.urlopen(req, timeout=6) as response:
                b = response.read()
                return json.loads(b) if b else None
        def healthy():
            try:
                return api("/health")["status"] == "ok"
            except OSError:
                return False
        def start_server():
            return subprocess.Popen([str(server_binary), "-config", str(config)], cwd=work, stdout=server_log, stderr=subprocess.STDOUT)
        def start_native():
            process = subprocess.Popen([str(app_binary)], env=env, cwd=work, stdout=native_log, stderr=subprocess.STDOUT)
            wait_for(lambda: (work / "native.sock").exists(), "隔离原生窗口未启动")
            ui = Native(work / "native.sock")
            wait_for(lambda: ui.call("windows")["windows"], "原生窗口未创建")
            return process, ui
        def cache():
            return json.loads((work / "profile/cache.json").read_text())
        def next_instance():
            return next(o for o in api("/api/tasks/next-occurrences") if o["task_id"] == task["id"])
        def same_time(a, b):
            return datetime.fromisoformat(a.replace("Z", "+00:00")) == datetime.fromisoformat(b.replace("Z", "+00:00"))
        def assert_series():
            saved = api(f"/api/tasks/{task['id']}")
            assert same_time(saved["start_time"], task["start_time"]) and same_time(saved["end_time"], task["end_time"])
            assert not saved["all_day"] and saved["description"] == "系列描述不变" and saved["status"] == "pending"
        def edit_schedule():
            ui.press("button", "原生单次改期验证")
            ui.assert_save_state("保存本次描述", enabled=False)
            ui.press("button", "调整本次时间")
            ui.assert_save_state("保存本次时间", enabled=False)
        try:
            server = start_server()
            wait_for(healthy, "隔离服务未启动")
            native, ui = start_native()
            wait_for(lambda: ui.call("windows")["windows"], "原生窗口未创建")
            assert ui.call("windows")["windows"][0]["kind"] == "content"
            username, password = "schedule_" + uuid.uuid4().hex[:10], uuid.uuid4().hex
            ui.press("button", "创建账户")
            ui.fill("用户名", username)
            ui.fill("邮箱", username + "@example.test")
            ui.fill("密码", password)
            ui.press("button", "注册并登录")
            ui.node("button", "＋ 新建任务")
            ui.ready()
            token = api("/api/auth/login", "POST", {"username": username, "password": password})["token"]
            api("/api/auth/profile", "PATCH", {"timezone": "Asia/Shanghai", "default_reminder_enabled": False})
            anchor = datetime.now(ZoneInfo("Asia/Shanghai")).replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=1)
            # Avoid crossing a month in date-picker tests while retaining a future date.
            if anchor.day > 20:
                anchor = (anchor.replace(day=1) + timedelta(days=32)).replace(day=2)
            task = api("/api/tasks", "POST", {"title": "原生单次改期验证", "description": "系列描述不变", "start_time": anchor.isoformat(), "end_time": (anchor + timedelta(hours=1)).isoformat(), "recurrence_rule": {"freq": "daily", "interval": 1, "count": 1}})
            original = next_instance()
            instance_id = original["instance_id"]
            api(f"/api/tasks/{task['id']}", "PUT", {"instance_id": instance_id, "description": "原有本次笔记"})
            ui.press("button", "刷新")
            ui.ready()
            edit_schedule()
            ui.node("text", "原始实例日期：" + anchor.strftime("%Y-%m-%d"))
            step_hour(ui, "本次结束时刻", "decrement")
            step_hour(ui, "本次结束时刻", "decrement")
            ui.press("button", "保存本次时间")
            ui.node("text", "结束时间应晚于开始时间")
            assert not cache().get("outbox")
            ui.press("button", "取消本次改期")
            ui.press("button", "继续编辑")
            ui.node("button", "保存本次时间")
            ui.press("button", "取消本次改期")
            ui.press("button", "放弃并切换")
            ui.node("button", "调整本次时间")
            passed("原生本次时间编辑、无效时段保留草稿和取消；未产生错误写入")
            ui.press("button", "调整本次时间")
            moved = anchor + timedelta(days=5)
            choose_day(ui, "本次开始日期", moved)
            ui.press("checkBox", "本次结束")
            ui.press("checkBox", "本次全天")
            ui.assert_save_state("保存本次时间", enabled=True)
            ui.capture(artifacts / "native-occurrence-schedule.png")
            ui.press("button", "保存本次时间")
            ui.ready()
            changed = next_instance()
            assert changed["instance_id"] == instance_id and changed["original_date"] == original["original_date"]
            assert same_time(changed["start_time"], moved.isoformat()) and changed["all_day"] and changed.get("end_time") is None
            assert changed["description"] == "原有本次笔记" and changed["status"] == "pending"
            assert_series()
            passed("跨日改期、全天与结束清空，实例身份/描述/状态保留，系列起点不变")
            def expanded(day):
                start = day.replace(hour=0, minute=0, second=0)
                return api(f"/api/tasks/{task['id']}/instances?" + urlencode({"start": start.isoformat(), "end": (start + timedelta(days=1)).isoformat()})) or []
            assert not [o for o in expanded(anchor) if o["task_id"] == task["id"]]
            assert len([o for o in expanded(moved) if o["task_id"] == task["id"] and o["instance_id"] == instance_id]) == 1
            passed("原日不再出现，移入的日历范围准确返回唯一实例")
            ui.press("button", "原生单次改期验证")
            ui.press("button", "编辑本次描述")
            ui.fill("本次描述", "改期后补充笔记")
            ui.press("button", "保存本次描述")
            ui.ready()
            changed = next_instance()
            assert same_time(changed["start_time"], moved.isoformat()) and changed["all_day"] and changed.get("end_time") is None
            passed("后续本次描述编辑不会重置已改期时间、全天或已清除结束")
            edit_schedule()
            ui.press("button", "恢复本次系列时间")
            ui.ready()
            changed = next_instance()
            assert same_time(changed["start_time"], anchor.isoformat()) and same_time(changed["end_time"], task["end_time"]) and not changed["all_day"]
            assert changed["description"] == "改期后补充笔记"
            passed("恢复本次的系列时间，不清除本次笔记")
            edit_schedule()
            offline_day = anchor + timedelta(days=4)
            choose_day(ui, "本次开始日期", offline_day)
            ui.press("checkBox", "本次结束")
            server.terminate()
            server.wait(timeout=6)
            ui.press("button", "保存本次时间")
            ui.ready()
            queued = cache()["outbox"][0]
            assert queued["suffix"] == "/occurrences/schedule"
            assert queued["body"]["instance_id"] == instance_id
            native.terminate()
            native.wait(timeout=6)
            wait_for(lambda: not (work / "native.sock").exists(), "测试窗口未关闭")
            native, ui = start_native()
            ui.node("button", "原生单次改期验证")
            ui.ready()
            edit_schedule()
            date_value = ui.node("popUpButton", "本次开始日期")["value"]
            assert str(offline_day.day) in date_value and str(offline_day.year) in date_value
            assert cache()["outbox"][0]["id"] == queued["id"]
            ui.press("button", "取消本次改期")
            ui.press("button", "关闭")
            passed("真实断网改期持久化，离线重启恢复显示时间和固定操作编号")
            server = start_server()
            wait_for(healthy, "测试服务未恢复")
            wait_for(lambda: not cache().get("outbox"), "恢复联网后未自动同步", timeout=30)
            assert same_time(next_instance()["start_time"], offline_day.isoformat())
            assert_series()
            confirmed = api(f"/api/tasks/{task['id']}")
            replay = api(f"/api/tasks/{task['id']}/occurrences/schedule", "PATCH", queued["body"], {"X-Client-Op-Id": queued["id"], "If-Match": str(queued["revision"])})
            assert replay["revision"] == confirmed["revision"]
            passed("联网自动提交单次改期，丢失响应重放复用收据且版本不重复递增")
            ui.press("button", "原生单次改期验证")
            ui.press("button", "完成本次")
            ui.ready()
            ui.press("treeItem", "已完成")
            edit_schedule()
            step_hour(ui, "本次开始时刻", "increment")
            ui.press("button", "保存本次时间")
            ui.ready()
            history = api("/api/tasks/occurrences?status=completed")["items"]
            item = next(o for o in history if o["instance_id"] == instance_id)
            assert item["status"] == "completed" and item["description"] == "改期后补充笔记"
            assert datetime.fromisoformat(item["start_time"].replace("Z", "+00:00")) == offline_day + timedelta(hours=1)
            assert not api("/api/tasks/next-occurrences")
            assert_series()
            passed("已完成历史实例可单独改期，完成状态/描述保留且不复活后续实例")
            ui.press("button", "原生单次改期验证")
            ui.press("button", "整个系列提醒与活动记录")
            # The modal owns the accessibility tree, so the main window's
            # refresh button is intentionally unavailable while it is open.
            wait_for(lambda: (n := ui.find("button", "刷新提醒与记录")) and "disabled" not in n.get("states", []), "提醒与活动记录未加载完成")
            ui.press("radio", "活动记录")
            ui.node("text", "仅 " + anchor.strftime("%Y-%m-%d") + " 本次时间")
            ui.capture(artifacts / "native-occurrence-schedule-activity.png")
            passed("活动记录明确标注原始实例日期与单次时间变更")
            ui.press("button", "关闭提醒与记录")
            ui.press("button", "关闭")

            # Exercise the month picker and the actual DAV write path together.
            # The task stays in the disposable account/profile used above.
            year = datetime.now(ZoneInfo("Asia/Shanghai")).year + 1
            month_start = datetime(year, 3, 8, 9, tzinfo=ZoneInfo("Asia/Shanghai"))
            month_start += timedelta(days=(6 - month_start.weekday()) % 7)
            monthly = api("/api/tasks", "POST", {"title": "原生限定月份验证", "start_time": month_start.isoformat(), "recurrence_rule": {"freq": "monthly", "byday": ["2SU"], "bymonth": [3], "count": 3}})
            ui.press("treeItem", "全部任务")
            ui.press("button", "刷新")
            ui.ready()
            ui.press("button", "原生限定月份验证")
            ui.press("button", "编辑整个系列")
            ui.edit_task_recurrence()
            ui.call("act", id=ui.node("button", "切换限定月份 11月")["id"], action="scrollIntoView")
            ui.press("button", "切换限定月份 11月")
            assert ui.node("textField", "限定月份")["value"] == "3，11"
            ui.capture(artifacts / "native-lobe-recurrence-months.png")
            ui.press("button", "收起重复")
            ui.press("button", "关闭")
            ui.press("button", "继续编辑")
            ui.edit_task_recurrence()
            assert ui.node("textField", "限定月份")["value"] == "3，11"
            ui.press("button", "收起重复")
            ui.press("button", "关闭")
            ui.press("button", "放弃并切换")
            assert api(f"/api/tasks/{monthly['id']}")["recurrence_rule"]["bymonth"] == [3]
            ui.press("button", "原生限定月份验证")
            ui.press("button", "编辑整个系列")
            ui.edit_task_recurrence()
            assert ui.node("textField", "限定月份")["value"] == "3"
            ui.call("act", id=ui.node("button", "切换限定月份 11月")["id"], action="scrollIntoView")
            ui.press("button", "切换限定月份 11月")
            ui.press("button", "收起重复")
            ui.press("button", "保存任务")
            ui.ready()
            assert api(f"/api/tasks/{monthly['id']}")["recurrence_rule"]["bymonth"] == [3, 11]
            passed("真实原生月份点选与文字同步；取消保留原规则，明确保存才提交月份限制")

            auth = "Basic " + base64.b64encode((username + ":" + password).encode()).decode()
            dav_path = f"/dav/calendars/{username}/todo/task-{monthly['id']}.ics"
            def dav_request(method, body=None, match=None):
                headers = {"Authorization": auth, "Content-Type": "text/calendar"}
                if match:
                    headers["If-Match"] = match
                request = urllib.request.Request(base + dav_path, method=method, data=body, headers=headers)
                with urllib.request.urlopen(request, timeout=8) as response:
                    return response.read().decode(), response.headers.get("ETag")
            original_data, original_etag = dav_request("GET")
            assert "BYMONTH=3,11" in original_data
            moved_day = anchor + timedelta(days=2)
            child = "\r\n".join([
                "BEGIN:VEVENT", f"UID:todo-task-{monthly['id']}@todo-app",
                "RECURRENCE-ID;TZID=Asia/Shanghai:" + month_start.strftime("%Y%m%dT%H%M%S"),
                "DTSTART:" + moved_day.astimezone(ZoneInfo("UTC")).strftime("%Y%m%dT%H%M%SZ"),
                "DTEND:" + (moved_day + timedelta(hours=1)).astimezone(ZoneInfo("UTC")).strftime("%Y%m%dT%H%M%SZ"),
                "DESCRIPTION:来自 CalDAV 的本次记录", "END:VEVENT", "",
            ])
            replacement = original_data.replace("END:VCALENDAR", child + "END:VCALENDAR")
            dav_request("PUT", replacement.encode(), original_etag)
            _, changed_etag = dav_request("GET")
            assert changed_etag != original_etag
            try:
                dav_request("PUT", original_data.encode(), original_etag)
                raise AssertionError("过时的 CalDAV 资源覆盖了已改期实例")
            except urllib.error.HTTPError as error:
                assert error.code == 412
            ui.press("button", "刷新")
            ui.ready()
            ui.press("button", "原生限定月份验证")
            assert any("来自 CalDAV 的本次记录" in n.get("label", "") for n in ui.nodes())
            ui.press("button", "调整本次时间")
            ui.node("text", "原始实例日期：" + month_start.strftime("%Y-%m-%d"))
            actual_date = ui.node("popUpButton", "本次开始日期")["value"]
            assert str(moved_day.day) in actual_date and str(moved_day.year) in actual_date
            ui.capture(artifacts / "native-caldav-written-occurrence.png")
            ui.press("button", "取消本次改期")
            ui.press("button", "整个系列提醒与活动记录")
            wait_for(lambda: (n := ui.find("button", "刷新提醒与记录")) and "disabled" not in n.get("states", []), "CalDAV 活动记录未加载")
            ui.press("radio", "活动记录")
            ui.node("text", "仅 " + month_start.strftime("%Y-%m-%d") + " 本次日程（CalDAV）")
            ui.capture(artifacts / "native-caldav-written-activity.png")
            passed("实际 CalDAV PUT 改期和描述进入真实原生窗口，原始身份与活动保留，过时 ETag 返回 412")
            print(f"Native occurrence schedule smoke: {count}/{count} PASS", flush=True)
        except Exception:
            if ui:
                try:
                    ui.capture(artifacts / "occurrence-schedule-failure.png")
                    (artifacts / "occurrence-schedule-failure-tree.json").write_text(json.dumps(ui.nodes(), ensure_ascii=False, indent=2))
                except Exception:
                    pass
            native_log.flush()
            print((work / "native.log").read_text(errors="replace")[-2000:])
            raise
        finally:
            for p in (native, server):
                if p and p.poll() is None:
                    p.terminate()
                    p.wait(timeout=8)
            native_log.close()
            server_log.close()


if __name__ == "__main__":
    if sys.platform == "darwin":
        state = subprocess.check_output(["ioreg", "-n", "Root", "-d1"], text=True)
        if '"CGSSessionScreenIsLocked"=Yes' in state:
            raise SystemExit("macOS 当前已锁屏，MyGo 窗口无法继续绘制与接收操作。请解锁电脑后重跑 make occurrence-smoke；测试尚未开始。")
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--server", type=Path, default=ROOT.parent / "bin/todo-app")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts")
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    smoke(args.app.resolve(), args.server.resolve(), args.artifacts)
