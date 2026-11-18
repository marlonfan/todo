#!/usr/bin/env python3
"""Mouse-driven Native calendar changes against a disposable real backend."""
import argparse
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
import uuid
from zoneinfo import ZoneInfo

from smoke import Native, ROOT, wait_for
from occurrence_schedule_smoke import choose_day


def smoke(app_binary, server_binary, artifacts):
    count = 0
    def passed(label):
        nonlocal count
        count += 1
        print("PASS: " + label, flush=True)

    with tempfile.TemporaryDirectory(prefix="todo-native-calendar-drag-") as tmp:
        work = Path(tmp)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        config = work / "server.yaml"
        config.write_text(json.dumps({"server": {"host": "127.0.0.1", "port": port}, "database": {"driver": "sqlite", "dsn": str(work / "test.db")}, "jwt": {"secret": uuid.uuid4().hex, "expire": "24h"}}))
        token = ""
        native = server = ui = None
        native_log = open(work / "native.log", "wb")
        server_log = open(work / "server.log", "wb")
        env = dict(os.environ, TODO_NATIVE_QA="1", TODO_API_URL=base, TODO_NATIVE_DATA_DIR=str(work / "profile"), TODO_NATIVE_REMINDER_LOG=str(work / "reminders.jsonl"), MYGO_AUTOMATION=str(work / "native.sock"))

        def api(path, method="GET", body=None):
            req = urllib.request.Request(base + path, method=method, data=None if body is None else json.dumps(body).encode(), headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as response:
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
            try:
                wait_for(lambda: (work / "native.sock").exists(), "原生窗口未创建")
                connection = Native(work / "native.sock")
                wait_for(lambda: connection.call("windows").get("windows"), "原生窗口未完成初始化")
                return process, connection
            except Exception:
                process.terminate()
                process.wait(timeout=8)
                raise

        def cache():
            return json.loads((work / "profile/cache.json").read_text())

        def bounds(role, label):
            return ui.node(role, label)["bounds"]

        def move(label, target_day, hour=None, resize=False, cancel=False, capture=None):
            source_node = ui.node("button", label)
            ui.call("act", id=source_node["id"], action="scrollIntoView")
            wait_for(lambda: "offscreen" not in ui.node("button", label).get("states", []), "拖动源未进入日历可视区域")
            if hour is not None:
                slot_label = f"在 {target_day:%Y-%m-%d} {int(hour):02d}:00 添加日程"
                ui.call("act", id=ui.node("button", slot_label)["id"], action="scrollIntoView")
                wait_for(lambda: "offscreen" not in ui.node("button", slot_label).get("states", []), "拖动目标未进入日历可视区域")
            source = bounds("button", label)
            x, y = source["x"] + source["width"] / 2, source["y"] + (source["height"] / 2 if resize else 10)
            if hour is None:
                target = bounds("group", f"日历日期 {target_day:%Y-%m-%d}")
                tx, ty = target["x"] + target["width"] / 2, target["y"] + 115
            else:
                target = bounds("button", f"在 {target_day:%Y-%m-%d} {int(hour):02d}:00 添加日程")
                tx = target["x"] + target["width"] / 2
                ty = target["y"] + (hour % 1) * target["height"] + (0 if resize else 10)
            ui.call("input", events=[{"type": "pointerDown", "x": x, "y": y}])
            ui.call("tree")
            time.sleep(0.05)
            for i in range(1, 6):
                ui.call("input", events=[{"type": "pointerMove", "x": x + (tx-x)*i/5, "y": y + (ty-y)*i/5}])
                # Held-pointer auto-scroll/offline animation may keep drawing;
                # allow a frame without demanding global idle mid-drag.
                ui.call("tree")
                time.sleep(0.05)
            if capture:
                ui.capture(artifacts / capture)
            if cancel:
                ui.call("input", events=[{"type": "key", "key": "Escape"}])
                ui.call("tree")
            ui.call("input", events=[{"type": "pointerUp", "x": tx, "y": ty}])
            ui.ready()

        def task(id):
            return api(f"/api/tasks/{id}")

        def parsed(raw):
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(ZoneInfo("Asia/Shanghai"))

        def label(day, title, resize=False):
            return ("调整结束" if resize else "日程") + f" {day:%Y-%m-%d} " + title

        try:
            server = start_server()
            wait_for(healthy, "隔离后端未启动")
            native, ui = start_native()
            assert ui.call("windows")["windows"][0]["kind"] == "content"
            username, password = "drag_" + uuid.uuid4().hex[:10], uuid.uuid4().hex
            ui.press("button", "创建账户")
            ui.fill("用户名", username)
            ui.fill("邮箱", username + "@example.test")
            ui.fill("密码", password)
            ui.press("button", "注册并登录")
            ui.node("button", "＋ 新建任务")
            ui.ready()
            token = api("/api/auth/login", "POST", {"username": username, "password": password})["token"]
            api("/api/auth/profile", "PATCH", {"timezone": "Asia/Shanghai", "default_reminder_enabled": False, "default_time_granularity": 30})
            anchor = datetime.now(ZoneInfo("Asia/Shanghai")).replace(day=1, hour=9, minute=0, second=0, microsecond=0)
            anchor += timedelta(days=(-anchor.weekday()) % 7)
            normal = api("/api/tasks", "POST", {"title": "产品设计评审", "description": "保留原任务描述", "start_time": anchor.isoformat(), "end_time": (anchor+timedelta(hours=1)).isoformat()})
            series = api("/api/tasks", "POST", {"title": "每周项目复盘", "description": "系列描述", "start_time": anchor.isoformat(), "end_time": (anchor+timedelta(hours=1)).isoformat(), "recurrence_rule": {"freq": "weekly", "count": 1}})
            all_day = api("/api/tasks", "POST", {"title": "整理本周计划", "all_day": True, "start_time": anchor.replace(hour=0).isoformat(), "end_time": (anchor+timedelta(days=1)).replace(hour=0).isoformat()})
            ui.press("button", "刷新")
            ui.ready()
            ui.press("treeItem", "日历")
            ui.ready()
            choose_day(ui, "日历定位日期", anchor)
            ui.ready()
            ui.press("radio", "月")
            ui.ready()
            ui.capture(artifacts / "native-lobe-calendar-month.png")
            move(label(anchor, normal["title"]), anchor+timedelta(days=1))
            changed = task(normal["id"])
            assert parsed(changed["start_time"]) == anchor+timedelta(days=1) and parsed(changed["end_time"]) == anchor+timedelta(days=1, hours=1)
            assert changed["description"] == normal["description"]
            passed("真实鼠标跨月格改期，保留时刻、时长与其他任务字段")

            target = anchor+timedelta(days=1)
            ui.press("button", f"查看 {target:%Y-%m-%d}")
            ui.ready()
            move(label(target, normal["title"], True), target, 11.5, resize=True)
            changed = task(normal["id"])
            assert parsed(changed["start_time"]) == target and parsed(changed["end_time"]) == target.replace(hour=11, minute=30)
            passed("日视图独立结束手柄调整时长，不移动开始时间")

            ui.press("radio", "周")
            ui.ready()
            move(label(target, normal["title"]), anchor+timedelta(days=2), 12.5)
            changed = task(normal["id"])
            assert parsed(changed["start_time"]) == (anchor+timedelta(days=2)).replace(hour=12, minute=30), changed
            assert parsed(changed["end_time"]) - parsed(changed["start_time"]) == timedelta(hours=2, minutes=30)
            passed("周时间轴跨日与时刻移动，按账户半小时吸附并保留抓取偏移")

            moved_series_day = anchor+timedelta(days=3)
            move(label(anchor, series["title"]), moved_series_day, 10.5)
            occurrences = api("/api/tasks/next-occurrences")
            occurrence = next(o for o in occurrences if o["task_id"] == series["id"])
            assert parsed(occurrence["start_time"]) == moved_series_day.replace(hour=10, minute=30)
            assert occurrence["instance_id"] == f"{series['id']}_{anchor:%Y%m%d}"
            persisted = task(series["id"])
            assert persisted["start_time"] == series["start_time"] and persisted["recurrence_rule"] == series["recurrence_rule"] and persisted["description"] == series["description"]
            passed("重复实例使用单次改期接口，保留系列起点、规则和原始实例身份")

            revision = task(series["id"])["revision"]
            move(label(moved_series_day, series["title"]), anchor+timedelta(days=4), 12, cancel=True, capture="native-lobe-calendar-drag.png")
            assert task(series["id"])["revision"] == revision and not cache().get("outbox")
            move(label(moved_series_day, series["title"], True), moved_series_day, 9, resize=True)
            ui.node("text", "结束时间应晚于开始时间，未修改日程")
            assert task(series["id"])["revision"] == revision
            passed("Esc 取消不写入，拖到开始之前明确报错且保留原日程")

            ui.press("radio", "月")
            ui.ready()
            move(label(anchor, all_day["title"]), anchor+timedelta(days=4))
            move(label(anchor+timedelta(days=4), all_day["title"], True), anchor+timedelta(days=5), resize=True)
            changed = task(all_day["id"])
            assert changed["all_day"] and parsed(changed["start_time"]) == (anchor+timedelta(days=4)).replace(hour=0)
            assert parsed(changed["end_time"]) == (anchor+timedelta(days=6)).replace(hour=0)
            passed("全天任务拖动与末日延长，结束日期保持排他边界")

            ui.press("radio", "周")
            ui.ready()
            ui.capture(artifacts / "native-lobe-calendar-week.png")
            server.terminate()
            server.wait(timeout=8)
            # Adopt the visible offline state before measuring target slots;
            # its status strip changes timeline geometry.
            ui.press("button", "刷新")
            ui.ready()
            move(label(anchor+timedelta(days=2), normal["title"]), anchor+timedelta(days=3), 13)
            queued = wait_for(lambda: next(iter(cache().get("outbox",[])),None),"离线拖拽没有写入本地队列")
            assert queued["task_id"] == normal["id"]
            native.terminate()
            native.wait(timeout=8)
            wait_for(lambda: not (work / "native.sock").exists(), "测试窗口未关闭")
            native, ui = start_native()
            ui.node("button", "＋ 新建任务")
            ui.ready()
            ui.press("treeItem", "日历")
            ui.ready()
            choose_day(ui, "日历定位日期", anchor)
            ui.ready()
            ui.node("button", label(anchor+timedelta(days=3), normal["title"]))
            assert cache()["outbox"][0]["id"] == queued["id"]
            passed("真实断网拖拽写入持久队列，重启恢复日历位置与固定操作编号")

            server = start_server()
            wait_for(healthy, "隔离后端未恢复")
            ui.press("button", "刷新")
            ui.ready()
            wait_for(lambda: not cache().get("outbox"), "离线拖拽未同步")
            changed = task(normal["id"])
            assert parsed(changed["start_time"]) == (anchor+timedelta(days=3)).replace(hour=13), {"task": changed, "queued": queued}
            ui.capture(artifacts / "native-lobe-calendar-synced.png")
            passed("恢复联网后自动提交离线改期，服务器与原生日历保持一致")
            print(f"Native calendar drag smoke: {count}/{count} PASS", flush=True)
        except Exception:
            if ui:
                try:
                    ui.capture(artifacts / "calendar-drag-failure.png")
                    (artifacts / "calendar-drag-failure-tree.json").write_text(json.dumps(ui.nodes(), ensure_ascii=False, indent=2))
                except Exception:
                    pass
            native_log.flush()
            print((work / "native.log").read_text(errors="replace")[-2000:])
            raise
        finally:
            for process in (native, server):
                if process and process.poll() is None:
                    process.terminate()
                    process.wait(timeout=8)
            native_log.close()
            server_log.close()


if __name__ == "__main__":
    if sys.platform == "darwin":
        state = subprocess.check_output(["ioreg", "-n", "Root", "-d1"], text=True)
        if '"CGSSessionScreenIsLocked"=Yes' in state:
            raise SystemExit("macOS 当前已锁屏，请解锁后重跑 make calendar-drag-smoke；测试尚未开始。")
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--server", type=Path, default=ROOT.parent / "bin/todo-app")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts")
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    smoke(args.app.resolve(), args.server.resolve(), args.artifacts)
