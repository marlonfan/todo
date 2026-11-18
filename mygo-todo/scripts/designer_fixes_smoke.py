#!/usr/bin/env python3
"""Focused real-window acceptance for Designer's contrast/control fixes.

Run alone. Uses a disposable backend, account and profile; existing user data
and the full-redesign evidence remain intact. Complements AI/calendar smokes.
"""
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

from smoke import Native, ROOT, wait_for


class SettledNative(Native):
    def call(self, method, **args):
        result = super().call(method, **args)
        if method == "act" and args.get("action") == "scrollIntoView":
            # The following accessibility press uses the target's bounds;
            # finish scrolling before taking those bounds and clicking.
            super().call("idle", timeout=3000)
        return result


def smoke(app_binary, server_binary, artifacts):
    report = {"status": "running", "captures": [], "checks": []}
    native = server = ui = None
    with tempfile.TemporaryDirectory(prefix="todo-native-designer-fixes-") as folder:
        work = Path(folder)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        config = work / "server.json"
        config.write_text(json.dumps({"server": {"host": "127.0.0.1", "port": port}, "database": {"driver": "sqlite", "dsn": str(work / "test.db")}, "jwt": {"secret": uuid.uuid4().hex, "expire": "24h"}}))
        profile = work / "profile"
        profile.mkdir()
        size_file = work / "window-size.json"
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

        def passed(message):
            report["checks"].append(message)
            print("PASS: " + message, flush=True)

        with (artifacts / "native.log").open("w") as native_log, (artifacts / "server.log").open("w") as server_log:
            try:
                server = subprocess.Popen([str(server_binary), "-config", str(config)], cwd=work, stdout=server_log, stderr=subprocess.STDOUT)
                wait_for(healthy, "隔离后端没有启动")
                username, password = "designer_" + uuid.uuid4().hex[:10], uuid.uuid4().hex
                api("/api/auth/register", "POST", {"username": username, "email": username + "@example.test", "password": password})
                token = api("/api/auth/login", "POST", {"username": username, "password": password})["token"]
                api("/api/auth/profile", "PATCH", {"timezone": "Asia/Shanghai", "default_reminder_enabled": False})
                (profile / "session.json").write_text(json.dumps({"server": base, "token": token, "user": api("/api/auth/me")}))
                env = dict(os.environ, TODO_NATIVE_QA="1", TODO_API_URL=base, TODO_NATIVE_DATA_DIR=str(profile), TODO_NATIVE_QA_SIZE_FILE=str(size_file), TODO_NATIVE_REMINDER_LOG=str(work / "reminders.jsonl"), MYGO_AUTOMATION=str(work / "native.sock"))
                native = subprocess.Popen([str(app_binary)], env=env, cwd=work, stdout=native_log, stderr=subprocess.STDOUT)
                wait_for(lambda: (work / "native.sock").exists(), "原生自动化接口没有启动")
                ui = SettledNative(work / "native.sock")
                wait_for(lambda: ui.call("windows").get("windows"), "原生窗口未创建")
                wait_for(lambda: ui.call("windows")["windows"][0]["bounds"]["width"] == 1280, "实际窗口宽度未达到1280")
                ui.ready()
                assert ui.call("windows")["windows"][0]["kind"] == "content"
                if os.name == "posix" and os.uname().sysname == "Darwin":
                    subprocess.run(["osascript", "-e", f'tell application "System Events" to tell (first process whose unix id is {native.pid}) to set frontmost to true'], check=True, capture_output=True, text=True, timeout=15)
                    wait_for(lambda: ui.call("windows")["windows"][0]["focused"], "原生窗口没有取得焦点")
                ui.press("treeItem", "设置")
                ui.choose("外观", "浅色")
                ui.press("treeItem", "全部任务")
                ui.node("text", "暂时没有任务")
                ui.node("text", "选择一个任务")
                capture("light-empty-and-sync")
                passed("真实1280浅色空态和同步辅助文字")

                title = "属性空值与草稿保护 · Designer复查"
                task = api("/api/tasks", "POST", {"title": title, "description": "", "reminder_policy": "none"})
                ui.press("button", "刷新")
                ui.ready()
                ui.press("button", title)
                for label in ("编辑开始", "编辑截止", "编辑分类", "编辑重复", "编辑提醒"):
                    ui.node("button", label)
                capture("light-empty-properties")
                ui.press("button", "编辑开始")
                ui.node("popup", "属性选项")
                capture("light-property-popover")
                ui.call("input", events=[{"type": "key", "key": "Escape"}])
                assert not ui.find("button", "保存任务")
                ui.task_description()
                capture("light-native-placeholder")
                ui.fill_task_title(title + " · 未保存")
                ui.fill_task_description("中文 English：保留原生编辑及未保存输入。")
                ui.press("treeItem", "日历")
                ui.node("text", "保留未保存的任务草稿？")
                ui.press("button", "继续编辑")
                assert ui.task_title()["value"] == title + " · 未保存"
                assert ui.task_description()["value"] == "中文 English：保留原生编辑及未保存输入。"
                capture("light-native-draft")
                ui.press("button", "关闭")
                ui.press("button", "放弃并切换")
                assert api(f"/api/tasks/{task['id']}")["title"] == title
                assert api(f"/api/tasks/{task['id']}")["description"] == ""
                passed("浅色空属性、原生标题/描述编辑和导航草稿保护；未发生隐式写入")

                api("/api/prompts", "POST", {"title": "设计复查提示词", "content": "保留现有业务，核对分段与搜索状态。"})
                ui.press("treeItem", "设置")
                ui.choose("外观", "深色")
                ui.press("button", "打开AI 与提示词")
                ui.ready()
                ui.node("radio", "提示词")
                ui.node("textField", "搜索提示词或历史")
                ui.node("button", "使用提示词 设计复查提示词")
                capture("dark-ai-segment-and-search")
                ui.fill("搜索提示词或历史", "没有匹配的关键词")
                ui.call("act", id=ui.node("textField", "搜索提示词或历史")["id"], action="focus")
                ui.node("text", "没有匹配的内容")
                capture("dark-ai-search-focus")
                ui.press("button", "清除")
                assert ui.node("textField", "搜索提示词或历史").get("value", "") == ""
                assert ui.call("tree").get("focus") == ui.node("textField", "搜索提示词或历史")["id"]
                ui.node("button", "使用提示词 设计复查提示词")
                ui.press("radio", "问答历史")
                ui.node("text", "还没有问答历史")
                capture("dark-ai-selected-history")
                radio = ui.node("radio", "问答历史")
                ui.call("act", id=radio["id"], action="focus")
                wait_for(lambda: ui.call("tree").get("focus") == radio["id"], "分段控件没有取得键盘焦点")
                ui.call("input", events=[{"type": "key", "key": "Left"}])
                ui.node("button", "使用提示词 设计复查提示词")
                passed("深色AI分段、搜索、空结果、清除后聚焦、历史切换及原生左键选择")

                ui.press("treeItem", "日历")
                ui.ready()
                ui.press("radio", "周")
                ui.ready()
                ui.node("radio", "周")
                capture("dark-calendar-shared-segments")
                ui.press("radio", "月")
                ui.ready()
                capture("dark-calendar-month")
                passed("深色日历同类分段切换与月视图保持原生行为")
                report["status"] = "passed"
            except Exception:
                report["status"] = "failed"
                if ui is not None:
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
    print(f"Designer fixes smoke: {len(report['checks'])}/{len(report['checks'])} PASS", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--server", type=Path, default=ROOT.parent / "bin/todo-app")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts/designer-fixes" / datetime.now().strftime("%Y%m%d-%H%M%S"))
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    smoke(args.app.resolve(), args.server.resolve(), args.artifacts.resolve())
