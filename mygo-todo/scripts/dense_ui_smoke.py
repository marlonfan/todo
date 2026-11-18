#!/usr/bin/env python3
"""Stage snapshots and focused acceptance for the latest dense three-pane UI."""
import argparse
from datetime import datetime, timedelta
import json
import os
from pathlib import Path
import socket
import struct
import subprocess
import tempfile
import urllib.request
import uuid
from zoneinfo import ZoneInfo

from designer_fixes_smoke import SettledNative
from smoke import ROOT, wait_for


def run(app, backend, artifacts, stage):
    report = {"stage": stage, "status": "running", "captures": [], "measurements": [], "checks": []}
    native = server = ui = None
    with tempfile.TemporaryDirectory(prefix="todo-dense-ui-") as folder:
        work = Path(folder)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        config = work / "server.json"
        config.write_text(json.dumps({"server": {"host": "127.0.0.1", "port": port}, "database": {"driver": "sqlite", "dsn": str(work / "test.db")}, "jwt": {"secret": uuid.uuid4().hex, "expire": "24h"}}))
        profile = work / "profile"
        profile.mkdir()
        size = work / "size.json"
        size.write_text(json.dumps({"Width": 1280, "Height": 900}))
        token = ""

        def api(path, method="GET", body=None):
            req = urllib.request.Request(base + path, method=method, data=None if body is None else json.dumps(body).encode(), headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as response:
                data = response.read()
                return json.loads(data) if data else None

        def healthy():
            try:
                return api("/health")["status"] == "ok"
            except OSError:
                return False

        def capture(name):
            ui.call("idle", timeout=3000)
            windows = ui.call("windows")["windows"]
            path = artifacts / (name + ".png")
            ui.capture(path)
            (artifacts / (name + ".json")).write_text(json.dumps({"windows": windows, "tree": ui.call("tree")}, ensure_ascii=False, indent=2))
            report["captures"].append({"name": name, "pixels": struct.unpack(">II", path.read_bytes()[16:24]), "windows": windows})

        def passed(text):
            report["checks"].append(text)
            print("PASS: " + text, flush=True)

        with (artifacts / "server.log").open("w") as server_log, (artifacts / "native.log").open("w") as native_log:
            try:
                server = subprocess.Popen([str(backend), "-config", str(config)], cwd=work, stdout=server_log, stderr=subprocess.STDOUT)
                wait_for(healthy, "隔离后端未启动")
                username, password = "dense_" + uuid.uuid4().hex[:10], uuid.uuid4().hex
                api("/api/auth/register", "POST", {"username": username, "email": username + "@example.test", "password": password})
                token = api("/api/auth/login", "POST", {"username": username, "password": password})["token"]
                api("/api/auth/profile", "PATCH", {"timezone": "Asia/Shanghai", "default_reminder_enabled": False})
                now = datetime.now(ZoneInfo("Asia/Shanghai")).replace(hour=9, minute=0, second=0, microsecond=0)
                plain = api("/api/tasks", "POST", {"title": "普通任务 · 只有标题", "description": "## 任务内容\n\n描述应当优先于低频属性。", "reminder_policy": "none"})
                dated = api("/api/tasks", "POST", {"title": "有日期任务 · 辅助信息52", "start_time": (now + timedelta(days=1)).isoformat(), "reminder_policy": "none"})
                overdue = api("/api/tasks", "POST", {"title": "逾期任务 · 仅日期片段危险色", "start_time": (now - timedelta(days=2)).isoformat(), "all_day": True, "priority": 1, "reminder_policy": "none"})
                recurring = api("/api/tasks", "POST", {"title": "重复任务 · 本次与整个系列", "description": "## 系列描述\n\n保留真实实例范围和系列提醒。", "start_time": (now + timedelta(days=1)).isoformat(), "end_time": (now + timedelta(days=1, hours=1)).isoformat(), "recurrence_rule": {"freq": "daily", "interval": 1}, "reminder_policy": "none"})
                long = api("/api/tasks", "POST", {"title": "长标题自然排版 · 中文 English 原生多行输入与草稿保护 " * 3, "description": "## 长备注阅读\n\n" + "原生详情保留 Markdown 阅读、编辑与滚动。\n\n" * 24, "reminder_policy": "none"})
                (profile / "session.json").write_text(json.dumps({"server": base, "token": token, "user": api("/api/auth/me")}))
                env = dict(os.environ, TODO_NATIVE_QA="1", TODO_API_URL=base, TODO_NATIVE_DATA_DIR=str(profile), TODO_NATIVE_QA_SIZE_FILE=str(size), TODO_NATIVE_REMINDER_LOG=str(work / "reminders.jsonl"), MYGO_AUTOMATION=str(work / "native.sock"))
                native = subprocess.Popen([str(app)], cwd=work, env=env, stdout=native_log, stderr=subprocess.STDOUT)
                wait_for(lambda: (work / "native.sock").exists(), "原生自动化接口未启动")
                ui = SettledNative(work / "native.sock")
                wait_for(lambda: ui.call("windows").get("windows"), "原生窗口未创建")
                ui.ready()
                subprocess.run(["osascript", "-e", f'tell application "System Events" to tell (first process whose unix id is {native.pid}) to set frontmost to true'], check=True, capture_output=True, text=True, timeout=15)
                wait_for(lambda: ui.call("windows")["windows"][0]["focused"], "窗口未获得焦点，请确认系统已解锁")
                for appearance in ("浅色", "深色"):
                    ui.press("treeItem", "设置")
                    ui.choose("外观", appearance)
                    ui.press("treeItem", "全部任务")
                    for width in (1280, 1024, 1600):
                        size.write_text(json.dumps({"Width": width, "Height": 900}))
                        wait_for(lambda: ui.call("windows")["windows"][0]["bounds"]["width"] == width, "实际窗口宽度不符")
                        ui.call("idle", timeout=3000)
                        if stage != "layout" and ui.find("button", "收起快捷添加并保留草稿"):
                            ui.press("button", "收起快捷添加并保留草稿")
                        for task, height in ((plain, 44), (dated, 52), (overdue, 52), (recurring, 52)):
                            row = ui.node("group", "任务行 " + task["title"])
                            assert row["bounds"]["height"] == height, (task["title"], row)
                            for label in ("完成 " + task["title"], "更多操作 " + task["title"]):
                                target = next(n for n in ui.nodes() if n.get("label") == label)
                                assert target["bounds"]["height"] >= 32 and target["bounds"]["width"] >= 32, target
                            report["measurements"].append({"width": width, "theme": appearance, "title": task["title"], "bounds": row["bounds"]})
                        if width >= 1180:
                            sidebar = ui.node("menuButton", "账户菜单")["bounds"]["width"]
                            assert sidebar == 248, sidebar
                        name = f"{width}-{'light' if appearance == '浅色' else 'dark'}"
                        capture(name + "-list")
                        if stage == "interaction":
                            ui.call("input", events=[{"type": "pointerMove", "x": width - 20, "y": 850}])
                            capture(name + "-secondary-rest")
                            row = ui.node("group", "任务行 " + plain["title"])["bounds"]
                            ui.call("input", events=[{"type": "pointerMove", "x": row["x"] + 80, "y": row["y"] + row["height"] / 2}])
                            capture(name + "-secondary-hover")
                            ui.call("act", id=ui.node("button", plain["title"])["id"], action="focus")
                            ui.call("input", events=[{"type": "key", "key": "Tab"}])
                            ui.call("idle", timeout=3000)
                            wait_for(lambda: ui.call("tree").get("focus") == ui.node("menuButton", "更多操作 " + plain["title"])["id"], "Tab未聚焦行次操作")
                            capture(name + "-secondary-keyboard-focus")
                            ui.call("act", id=ui.node("menuButton", "更多操作 " + plain["title"])["id"], action="focus")
                            ui.call("idle", timeout=3000)
                            ui.call("input", events=[{"type": "key", "key": "Enter"}])
                            ui.call("idle", timeout=3000)
                            wait_for(lambda: any(n.get("label") == "查看与编辑" for n in ui.nodes()), "Enter未打开任务菜单")
                            capture(name + "-secondary-keyboard-menu")
                            ui.call("input", events=[{"type": "key", "key": "Down"}])
                            ui.call("input", events=[{"type": "key", "key": "Escape"}])
                            ui.call("idle", timeout=3000)
                            assert api(f"/api/tasks/{plain['id']}")["title"] == plain["title"]
                        if stage != "layout":
                            quick = ui.node("group", "快捷添加区")
                            assert 44 <= quick["bounds"]["height"] <= 48, quick
                            ui.call("act", id=ui.node("textField", "快捷添加标题")["id"], action="press")
                            ui.fill("快捷添加标题", "保留快捷草稿")
                            ui.node("button", "编辑快捷日期")
                            capture(name + "-quick-focused")
                            ui.call("input", events=[{"type": "key", "key": "Escape"}])
                            ui.call("idle", timeout=3000)
                            ui.press("button", plain["title"])
                            ui.node("text", "任务内容")
                            assert not ui.find("text", "本次实例")
                            capture(name + "-ordinary-detail")
                            ui.press("button", "关闭")
                            ui.press("button", recurring["title"])
                            ui.node("text", "本次实例")
                            capture(name + "-occurrence-detail")
                            ui.press("button", "系列高级属性")
                            ui.node("button", "编辑整个系列")
                            capture(name + "-series-expanded")
                            ui.press("button", "关闭")
                            if stage == "interaction":
                                ui.press("button", long["title"])
                                capture(name + "-long-content-read")
                                reader_width = ui.node("button", "编辑任务标题")["bounds"]["width"]
                                footer = ui.node("group", "任务底部操作")["bounds"]
                                maximum = "开头可见" + "标题编辑自然换行保留全部" * 16 + "末尾验证"
                                assert len(maximum) == 200
                                ui.fill_task_title(maximum)
                                title_field = ui.node("textField", "任务标题")
                                assert reader_width - 28 <= title_field["bounds"]["width"] <= reader_width
                                assert title_field["value"] == maximum
                                assert ui.node("group", "任务底部操作")["bounds"] == footer
                                capture(name + "-long-title-native-edit")
                                ui.press("button", "关闭")
                                ui.node("text", "保留未保存的任务草稿？")
                                ui.press("button", "继续编辑")
                                assert ui.node("textField", "任务标题")["value"] == maximum
                                ui.press("button", "关闭")
                                ui.press("button", "放弃并切换")
                                assert api(f"/api/tasks/{long['id']}")["title"] == long["title"]
                        passed(name + " 实际44/52行高、32点击区及侧栏尺寸" + ("；内容/实例/系列分组与快添" if stage != "layout" else ""))
                report["status"] = "passed"
            except Exception:
                report["status"] = "failed"
                if ui:
                    try:
                        capture("failure")
                    except Exception:
                        pass
                raise
            finally:
                (artifacts / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
                for process in (native, server):
                    if process and process.poll() is None:
                        process.terminate()
                        try:
                            process.wait(timeout=8)
                        except subprocess.TimeoutExpired:
                            process.kill()
                            process.wait(timeout=5)
    print(f"Dense UI {stage}: {len(report['checks'])}/6 PASS", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", choices=("layout", "details", "tokens", "interaction"), default="interaction")
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--server", type=Path, default=ROOT.parent / "bin/todo-app")
    parser.add_argument("--artifacts", type=Path, required=True)
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    if '"CGSSessionScreenIsLocked"=Yes' in subprocess.check_output(["ioreg", "-n", "Root", "-d1"], text=True):
        raise SystemExit("macOS 已锁屏，解锁后再继续真实窗口验收。")
    run(args.app.resolve(), args.server.resolve(), args.artifacts.resolve(), args.stage)
