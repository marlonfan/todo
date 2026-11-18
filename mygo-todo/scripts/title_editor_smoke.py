#!/usr/bin/env python3
"""Focused native-window title-width regression; disposable account/profile only."""
import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import socket
import struct
import subprocess
import tempfile
import urllib.request
import uuid

from designer_fixes_smoke import SettledNative
from smoke import ROOT, wait_for


def smoke(app_binary, server_binary, artifacts):
    report = {"status": "running", "checks": [], "captures": [], "geometry": []}
    native = server = ui = None
    with tempfile.TemporaryDirectory(prefix="todo-title-width-") as directory:
        work = Path(directory)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        config = work / "server.json"
        config.write_text(json.dumps({"server": {"host": "127.0.0.1", "port": port}, "database": {"driver": "sqlite", "dsn": str(work / "test.db")}, "jwt": {"secret": uuid.uuid4().hex, "expire": "24h"}}))
        profile = work / "profile"
        profile.mkdir()
        size_file = work / "size.json"
        size_file.write_text(json.dumps({"Width": 1280, "Height": 900}))
        token = ""

        def api(path, method="GET", body=None):
            request = urllib.request.Request(base + path, method=method, data=None if body is None else json.dumps(body).encode(), headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
            with urllib.request.urlopen(request, timeout=10) as response:
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
            image = artifacts / (name + ".png")
            ui.capture(image)
            pixels = struct.unpack(">II", image.read_bytes()[16:24])
            (artifacts / (name + ".json")).write_text(json.dumps({"windows": windows, "tree": ui.call("tree")}, ensure_ascii=False, indent=2))
            report["captures"].append({"name": name, "png": image.name, "pixels": pixels, "windows": windows})

        def focus_title():
            field = ui.node("textField", "任务标题")
            ui.call("act", id=field["id"], action="focus")
            wait_for(lambda: ui.call("tree").get("focus") == field["id"], "标题未获得原生焦点")
            return field

        with (artifacts / "native.log").open("w") as native_log, (artifacts / "server.log").open("w") as server_log:
            try:
                server = subprocess.Popen([str(server_binary), "-config", str(config)], cwd=work, stdout=server_log, stderr=subprocess.STDOUT)
                wait_for(healthy, "隔离后端未启动")
                username, password = "title_" + uuid.uuid4().hex[:10], uuid.uuid4().hex
                api("/api/auth/register", "POST", {"username": username, "email": username + "@example.test", "password": password})
                token = api("/api/auth/login", "POST", {"username": username, "password": password})["token"]
                api("/api/auth/profile", "PATCH", {"timezone": "Asia/Shanghai", "default_reminder_enabled": False})
                (profile / "session.json").write_text(json.dumps({"server": base, "token": token, "user": api("/api/auth/me")}))
                env = dict(os.environ, TODO_NATIVE_QA="1", TODO_API_URL=base, TODO_NATIVE_DATA_DIR=str(profile), TODO_NATIVE_QA_SIZE_FILE=str(size_file), TODO_NATIVE_REMINDER_LOG=str(work / "reminders.jsonl"), MYGO_AUTOMATION=str(work / "native.sock"))
                native = subprocess.Popen([str(app_binary)], env=env, cwd=work, stdout=native_log, stderr=subprocess.STDOUT)
                wait_for(lambda: (work / "native.sock").exists(), "原生自动化接口未启动")
                ui = SettledNative(work / "native.sock")
                wait_for(lambda: ui.call("windows").get("windows"), "原生窗口未创建")
                ui.ready()
                subprocess.run(["osascript", "-e", f'tell application "System Events" to tell (first process whose unix id is {native.pid}) to set frontmost to true'], check=True, capture_output=True, text=True, timeout=15)
                wait_for(lambda: ui.call("windows")["windows"][0]["focused"], "原生窗口未取得焦点；请确认 macOS 已解锁")
                ui.press("treeItem", "设置")
                ui.choose("外观", "浅色")
                ui.press("treeItem", "全部任务")
                for width in (1280, 1024):
                    size_file.write_text(json.dumps({"Width": width, "Height": 900}))
                    wait_for(lambda: ui.call("windows")["windows"][0]["bounds"]["width"] == width, "窗口尺寸未更新")
                    ui.call("idle", timeout=3000)
                    title = "属性空值与草稿保护 · Designer复查 · 未保存"
                    task = api("/api/tasks", "POST", {"title": title, "description": "", "reminder_policy": "none"})
                    ui.press("button", "刷新")
                    ui.ready()
                    ui.press("button", title)
                    reader = ui.node("button", "编辑任务标题")
                    if width == 1024:
                        ui.node("button", "‹ 返回任务列表")
                    else:
                        assert len([n for n in ui.nodes() if n.get("role") == "splitter"]) == 2
                    capture(f"{width}-reader-original")
                    ui.press("button", "编辑任务标题")
                    editor = focus_title()
                    read_width, edit_width = reader["bounds"]["width"], editor["bounds"]["width"]
                    assert read_width - 28 <= edit_width <= read_width, (read_width, edit_width)
                    assert editor["bounds"]["height"] < 70, editor
                    report["geometry"].append({"window_width": width, "reading": reader["bounds"], "editing": editor["bounds"], "title_length": len(title)})
                    capture(f"{width}-editor-enter")
                    maximum = "开头可见" + "标题编辑自然换行保留全部" * 16 + "末尾验证"
                    assert len(maximum) == 200
                    ui.fill_task_title(maximum)
                    editor = focus_title()
                    ui.call("act", id=editor["id"], action="selectText", **{"from": 0, "to": 0})
                    ui.call("idle", timeout=3000)
                    capture(f"{width}-editor-200-start")
                    bounds = ui.node("textField", "任务标题")["bounds"]
                    assert bounds["height"] < 180 and bounds["width"] >= read_width - 28
                    ui.call("input", events=[{"type": "wheel", "x": bounds["x"] + bounds["width"] / 2, "y": bounds["y"] + bounds["height"] / 2, "dy": 600, "precise": True}])
                    ui.call("idle", timeout=3000)
                    assert ui.node("textField", "任务标题")["bounds"] == bounds
                    capture(f"{width}-editor-200-scroll-end")
                    ui.call("act", id=editor["id"], action="selectText", **{"from": 199, "to": 200})
                    ui.call("input", events=[{"type": "text", "text": "验"}])
                    expected = maximum[:-1] + "验"
                    wait_for(lambda: ui.node("textField", "任务标题")["value"] == expected, "第200字未能原生编辑")
                    capture(f"{width}-editor-200-last-edited")
                    ui.press("button", "关闭")
                    ui.node("text", "保留未保存的任务草稿？")
                    ui.press("button", "继续编辑")
                    assert ui.node("textField", "任务标题")["value"] == expected
                    focus_title()
                    ui.call("input", events=[{"type": "key", "key": "Escape"}])
                    wait_for(lambda: not ui.find("textField", "任务标题"), "Esc 尚未返回标题阅读态")
                    assert ui.node("button", "编辑任务标题")["description"] == expected
                    assert api(f"/api/tasks/{task['id']}")["title"] == title
                    capture(f"{width}-reader-200-unsaved")
                    subprocess.run(["osascript", "-e", f'tell application "System Events" to tell (first process whose unix id is {native.pid}) to set frontmost to true', "-e", 'tell application "System Events" to keystroke "s" using command down'], check=True, capture_output=True, text=True, timeout=15)
                    ui.call("idle", timeout=3000)
                    wait_for(lambda: api(f"/api/tasks/{task['id']}")["title"] == expected, "Cmd+S 未保存完整200字标题")
                    ui.ready()
                    capture(f"{width}-reader-200-saved")
                    ui.assert_save_state("保存任务", False)
                    ui.press("button", "关闭")
                    message = f"{width}: 标题随正文伸展；200字滚动和末字原生编辑；草稿保护、Esc阅读、Cmd+S完整持久化"
                    report["checks"].append(message)
                    print("PASS: " + message, flush=True)
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
    print(f"Title editor smoke: {len(report['checks'])}/2 PASS", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--server", type=Path, default=ROOT.parent / "bin/todo-app")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts/title-editor-fix" / datetime.now().strftime("%Y%m%d-%H%M%S"))
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    if os.uname().sysname == "Darwin":
        session = subprocess.check_output(["ioreg", "-n", "Root", "-d1"], text=True)
        if '"CGSSessionScreenIsLocked"=Yes' in session:
            raise SystemExit("macOS 当前已锁屏；解锁后再运行真实标题窗口验收。尚未开始本轮窗口操作。")
    smoke(args.app.resolve(), args.server.resolve(), args.artifacts.resolve())
