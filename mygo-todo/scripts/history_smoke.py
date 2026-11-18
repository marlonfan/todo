#!/usr/bin/env python3
"""Real Native UI history filtering, pagination and offline restart.

Uses a disposable backend/account/profile. SQL only seeds dated historical
fixtures that the public API intentionally cannot backdate.
"""
import argparse
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import sys
import tempfile
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

    with tempfile.TemporaryDirectory(prefix="todo-native-history-") as tmp:
        work = Path(tmp)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
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

        def start_native():
            process = subprocess.Popen([str(app_binary)], env=env, cwd=work, stdout=native_log, stderr=subprocess.STDOUT)
            wait_for(lambda: (work / "native.sock").exists(), "原生窗口未创建")
            connection = Native(work / "native.sock")
            wait_for(lambda: connection.call("windows").get("windows"), "原生窗口未完成初始化")
            return process, connection

        def cache():
            return json.loads((work / "profile/cache.json").read_text())

        def text(label):
            return ui.find("text", label)

        def status_task(title, status, priority=0, categories=None):
            task = api("/api/tasks", "POST", {"title": title, "start_time": old.isoformat(), "priority": priority, "category_ids": categories or []})
            api(f"/api/tasks/{task['id']}/status", "PATCH", {"status": status})
            return task

        def date_value(value):
            return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S+00:00")

        try:
            server = subprocess.Popen([str(server_binary), "-config", str(config)], cwd=work, stdout=server_log, stderr=subprocess.STDOUT)
            wait_for(healthy, "隔离后端未启动")
            native, ui = start_native()
            assert ui.call("windows")["windows"][0]["kind"] == "content"
            username, password = "history_" + uuid.uuid4().hex[:10], uuid.uuid4().hex
            ui.press("button", "创建账户")
            ui.fill("用户名", username)
            ui.fill("邮箱", username + "@example.test")
            ui.fill("密码", password)
            ui.press("button", "注册并登录")
            ui.node("button", "＋ 新建任务")
            ui.ready()
            token = api("/api/auth/login", "POST", {"username": username, "password": password})["token"]
            user = api("/api/auth/profile", "PATCH", {"timezone": "America/New_York", "default_reminder_enabled": False})
            category = api("/api/categories", "POST", {"name": "工作", "emoji": ""})
            now = datetime.now(ZoneInfo("America/New_York"))
            today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            old = today - timedelta(days=240)
            first = status_task("今天完成的旧任务", "completed", 1, [category["id"]])
            yesterday = status_task("昨日完成的任务", "completed")
            low = status_task("无分类低优先级", "completed", -1)
            status_task("今天取消的任务", "cancelled")
            status_task("按任务时间查看跳过", "skipped")
            series = api("/api/tasks", "POST", {"title": "重复任务历史验证", "start_time": old.isoformat(), "priority": 1, "category_ids": [category["id"]], "recurrence_rule": {"freq": "daily", "count": 241}})
            with sqlite3.connect(work / "test.db", timeout=5) as db:
                db.execute("UPDATE tasks SET completed_at=? WHERE id=?", (date_value(today - timedelta(seconds=1)), yesterday["id"]))
                db.execute("UPDATE tasks SET completed_at=? WHERE id=?", (date_value(today + timedelta(minutes=2)), first["id"]))
                db.execute("UPDATE tasks SET completed_at=? WHERE id=?", (date_value(today + timedelta(minutes=1)), low["id"]))
                for i in range(205):
                    day = today - timedelta(days=i)
                    date = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
                    completed = today + timedelta(minutes=3) if i == 204 else today - timedelta(seconds=1)
                    description = "分页目标：早期实例今天完成" if i == 204 else "昨天完成的实例"
                    db.execute("INSERT INTO task_occurrences (user_id, task_id, occurrence_date, instance_id, status, completed_at, description, start_time, all_day, created_at, updated_at) VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, 0, ?, ?)", (user["id"], series["id"], date_value(date), f"{series['id']}_{day:%Y%m%d}", date_value(completed), description, date_value(day), date_value(completed), date_value(completed)))
            ui.press("button", "刷新")
            ui.ready()
            assert len(cache()["occurrence_history"]["items"]) == 200
            ui.press("treeItem", "已完成")
            ui.choose("历史日期范围", "今天")
            ui.node("button", "今天完成的旧任务")
            ui.node("button", "无分类低优先级")
            assert not ui.find("button", "昨日完成的任务")
            ui.node("text", "2 个任务")
            passed("原生日期范围按完成时间和账户时区筛选，不误用旧开始时间")

            ui.choose("历史分类", (category.get("emoji", "") + " " + category["name"]).strip())
            ui.choose("历史优先级", "高优先级")
            ui.node("text", "1 个任务")
            assert not ui.find("button", "无分类低优先级")
            ui.choose("历史分类", "无分类")
            ui.choose("历史优先级", "低优先级")
            ui.node("button", "无分类低优先级")
            passed("分类、无分类与优先级组合过滤")

            ui.press("button", "重置筛选")
            ui.choose("历史日期范围", "今天")
            ui.choose("历史时间依据", "任务时间")
            ui.node("text", "1 个任务")
            ui.node("button", "重复任务历史验证")
            assert not ui.find("button", "今天完成的旧任务")
            ui.choose("历史时间依据", "处理时间")
            ui.choose("历史排序", "最早在前")
            buttons = [n for n in ui.nodes() if n.get("role") == "button" and n.get("label") in {"今天完成的旧任务", "无分类低优先级"}]
            assert len(buttons) == 2 and buttons[0]["label"] == "无分类低优先级", buttons
            passed("切换时间依据及正反排序，未知时间不冒充完成时间")

            ui.fill("搜索任务", "分页目标")
            ui.node("text", "没有匹配的任务")
            ui.node("text", "筛选当前已加载记录；还有重复任务历史未加载。")
            ui.press("button", "加载更多重复任务历史")
            wait_for(lambda: len(cache()["occurrence_history"]["items"])==205,"历史分页没有完成")
            ui.node("button", "重复任务历史验证")
            ui.node("text", "1 个任务")
            assert len(cache()["occurrence_history"]["items"]) == 205
            passed("当前页无匹配时仍可继续分页，准确找到第 205 个历史实例")

            ui.press("button", "重复任务历史验证")
            ui.node("text", "分页目标：早期实例今天完成")
            ui.press("button", "关闭")
            ui.press("button", "刷新")
            ui.ready()
            assert len(cache()["occurrence_history"]["items"]) == 205
            ui.node("button", "重复任务历史验证")
            ui.node("text", "全部历史已加载；日期按账户时区计算。")
            ui.capture(artifacts / "native-history-filter.png")
            passed("刷新保留已读历史深度和筛选，单次详情保持原始实例身份")

            ui.press("button", "重置筛选")
            ui.choose("历史日期范围", "自定义日期")
            ui.node("popUpButton", "历史起始日期")
            ui.node("popUpButton", "历史结束日期")
            ui.node("text", "3 个任务")
            ui.capture(artifacts / "native-history-dates.png")
            passed("原生自定义日期首尾均包含当天，重置清除文本与组合筛选")
            choose_day(ui, "历史起始日期", today.replace(day=20))
            choose_day(ui, "历史结束日期", today.replace(day=10))
            ui.node("text", "结束日期不能早于开始日期")
            ui.node("text", "已加载记录中没有匹配项，可调整筛选。")
            assert not cache().get("outbox")
            choose_day(ui, "历史起始日期", today)
            choose_day(ui, "历史结束日期", today)
            ui.node("text", "3 个任务")
            passed("原生日期倒置明确报错，修正后恢复结果且不产生任务写入")

            ui.press("treeItem", "已取消")
            ui.node("button", "今天取消的任务")
            ui.press("treeItem", "已跳过")
            ui.node("text", "已跳过记录没有处理时间，按任务时间筛选。")
            assert not ui.find("button", "按任务时间查看跳过")
            ui.choose("历史日期范围", "全部时间")
            ui.node("button", "按任务时间查看跳过")
            passed("取消按取消时间、跳过按任务时间处理，切换状态页保留筛选")

            server.terminate()
            server.wait(timeout=8)
            native.terminate()
            native.wait(timeout=8)
            wait_for(lambda: not (work / "native.sock").exists(), "原生测试窗口未关闭")
            native, ui = start_native()
            ui.node("button", "＋ 新建任务")
            ui.ready()
            ui.press("treeItem", "已完成")
            ui.choose("历史日期范围", "今天")
            ui.fill("搜索任务", "分页目标")
            ui.node("button", "重复任务历史验证")
            assert len(cache()["occurrence_history"]["items"]) == 205
            ui.press("button", "关闭搜索")
            ui.press("button", "刷新")
            ui.ready()
            ui.node("button", "重复任务历史验证")
            ui.capture(artifacts / "native-history-offline.png")
            passed("真实断网重启恢复全部已读历史，刷新失败仍保留可筛选缓存")
            print(f"Native history smoke: {count}/{count} PASS", flush=True)
        except Exception:
            if ui:
                try:
                    ui.capture(artifacts / "history-failure.png")
                    (artifacts / "history-failure-tree.json").write_text(json.dumps(ui.nodes(), ensure_ascii=False, indent=2))
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
            raise SystemExit("macOS 当前已锁屏，请解锁后重跑 make history-smoke；测试尚未开始。")
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--server", type=Path, default=ROOT.parent / "bin/todo-app")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts")
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    smoke(args.app.resolve(), args.server.resolve(), args.artifacts)
