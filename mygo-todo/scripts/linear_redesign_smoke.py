#!/usr/bin/env python3
"""Real macOS acceptance for the Native Linear redesign; run EXCLUSIVELY.

Uses only a disposable backend/account/profile. Every invocation creates a new
artifact directory; report.json contains actual window geometry and PNG sizes.
This focused suite complements (does not replace) native-window-smoke business
regressions. It deliberately fails if macOS clamps a requested window width.
"""
import argparse
from datetime import datetime, timedelta
import fcntl
import json
import os
from pathlib import Path
import socket
import struct
import subprocess
import sys
import tempfile
import urllib.request
import uuid
from zoneinfo import ZoneInfo

from smoke import Native, ROOT, wait_for

PROPERTIES = ("编辑状态", "编辑开始", "编辑截止", "编辑优先级", "编辑分类", "编辑重复", "编辑提醒")


def inside(bounds, window):
    return (bounds["width"] > 0 and bounds["height"] > 0 and
            bounds["x"] >= -1 and bounds["y"] >= -1 and
            bounds["x"] + bounds["width"] <= window["width"] + 1 and
            bounds["y"] + bounds["height"] <= window["height"] + 1)


def smoke(app_binary, server_binary, artifacts):
    report = {"status": "running", "app": str(app_binary), "server": str(server_binary),
              "captures": [], "checks": [], "manual_review": [
                  "Visual token/font/icon consistency, contrast, hover/focus and IME/trackpad behavior",
                  "Physical trackpad gestures, system IME composition, and macOS text scaling beyond verified 2x Retina captures",
                  "Screenshot review for clipping, title wrapping and intentional Markdown scrolling",
                  "Run native-window-smoke separately for AI, reminders, recurrence instance actions, CalDAV and conflicts"]}
    ui = native = server = None
    with tempfile.TemporaryDirectory(prefix="todo-native-linear-") as tmp:
        work = Path(tmp)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        config = work / "server.json"
        config.write_text(json.dumps({"server": {"host": "127.0.0.1", "port": port},
                                      "database": {"driver": "sqlite", "dsn": str(work / "test.db")},
                                      "jwt": {"secret": uuid.uuid4().hex, "expire": "24h"}}))
        profile = work / "profile"
        profile.mkdir()
        size_request = work / "window-size.json"
        env = dict(os.environ, TODO_NATIVE_QA="1", TODO_API_URL=base,
                   TODO_NATIVE_QA_SIZE_FILE=str(size_request),
                   TODO_NATIVE_DATA_DIR=str(profile), MYGO_AUTOMATION=str(work / "native.sock"),
                   TODO_NATIVE_REMINDER_LOG=str(work / "reminders.jsonl"))
        token = ""
        native_log = open(work / "native.log", "wb")
        server_log = open(work / "server.log", "wb")

        def api(path, method="GET", body=None):
            request = urllib.request.Request(base + path, method=method,
                data=None if body is None else json.dumps(body).encode(),
                headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
            with urllib.request.urlopen(request, timeout=10) as response:
                value = response.read()
                return json.loads(value) if value else None

        def healthy():
            try:
                return api("/health")["status"] == "ok"
            except OSError:
                return False

        def start_server():
            nonlocal server
            process = subprocess.Popen([str(server_binary), "-config", str(config)], cwd=work,
                                       stdout=server_log, stderr=subprocess.STDOUT)
            server = process
            wait_for(healthy, "隔离后端未启动")
            return process

        def start_native():
            nonlocal native
            process = subprocess.Popen([str(app_binary)], env=env, cwd=work,
                                       stdout=native_log, stderr=subprocess.STDOUT)
            native = process
            wait_for(lambda: (work / "native.sock").exists(), "自动化接口未启动")
            connection = Native(work / "native.sock")
            wait_for(lambda: connection.call("windows").get("windows"), "原生窗口未初始化")
            connection.ready()
            return process, connection

        def checkpoint(name):
            ui.call("idle", timeout=3000)
            windows = ui.call("windows")["windows"]
            tree = ui.call("tree")
            image = artifacts / (name + ".png")
            ui.capture(image)
            png_width, png_height = struct.unpack(">II", image.read_bytes()[16:24])
            (artifacts / (name + ".json")).write_text(json.dumps(
                {"windows": windows, "tree": tree}, ensure_ascii=False, indent=2))
            report["captures"].append({"name": name, "windows": windows,
                "png": image.name, "pixels": [png_width, png_height]})
            print("CAPTURE: " + name + " " + json.dumps(windows, ensure_ascii=False), flush=True)

        def passed(message):
            report["checks"].append(message)
            print("PASS: " + message, flush=True)

        def resize(width):
            size_request.write_text(json.dumps({"Width": width, "Height": 900}))
            wait_for(lambda: abs(ui.call("windows")["windows"][0]["bounds"]["width"]-width)<=2,
                     f"原生窗口未达到请求宽度 {width}")
            ui.call("idle", timeout=3000)
            actual = ui.call("windows")["windows"][0]["bounds"]
            report.setdefault("sizes", []).append({"requested": [width, 900], "actual": actual})
            # Capture the actual frame even when the OS constrained its size.
            checkpoint(f"frame-requested-{width}")
            assert abs(actual["width"] - width) <= 2, f"macOS constrained requested {width}: {actual}"

        def shortcut(key):
            # Exercise the macOS menu accelerator rather than invoking its callback.
            subprocess.run(["osascript", "-e",
                f'tell application "System Events" to tell (first process whose unix id is {native.pid}) to set frontmost to true',
                "-e", f'tell application "System Events" to keystroke "{key}" using command down'],
                check=True, capture_output=True, text=True, timeout=15)
            ui.call("idle", timeout=3000)

        def navigate(label):
            services = {"同步": "同步", "CalDAV": "CalDAV 与订阅", "通知渠道": "通知渠道", "AI 与提示词": "AI 与提示词"}
            if label in services:
                navigate("设置")
                ui.press("button", "打开" + services[label])
                ui.ready()
                return
            if not ui.find("treeItem", label) or ui.find("button", "展开导航"):
                if ui.find("button", "展开导航"):
                    ui.press("button", "展开导航")
            ui.press("treeItem", label)
            ui.ready()

        def reveal(role, label):
            node = ui.node(role, label)
            ui.call("act", id=node["id"], action="scrollIntoView")
            ui.call("idle", timeout=3000)
            node = ui.node(role, label)
            assert inside(node["bounds"], ui.call("windows")["windows"][0]["bounds"]), (label, node)
            return node

        def clean_detail():
            ui.node("button", "编辑任务标题")
            assert not ui.find("textField", "任务标题"), "saved title still in editing mode"
            assert not ui.find("textField", "备注"), "saved Markdown still in editing mode"
            ui.assert_save_state("保存任务", enabled=False)
            assert not any(n.get("label") == "未修改" for n in ui.nodes())

        def cache():
            return json.loads((profile / "cache.json").read_text())

        try:
            server = start_server()
            username, password = "linear_" + uuid.uuid4().hex[:10], uuid.uuid4().hex
            api("/api/auth/register", "POST", {"username": username, "email": username + "@example.test", "password": password})
            token = api("/api/auth/login", "POST", {"username": username, "password": password})["token"]
            api("/api/auth/profile", "PATCH", {"timezone": "Asia/Shanghai", "default_reminder_enabled": False})
            (profile / "session.json").write_text(json.dumps({"server": base, "token": token, "user": api("/api/auth/me")}))
            day = datetime.now(ZoneInfo("Asia/Shanghai")).replace(hour=9, minute=0, second=0, microsecond=0)
            category = api("/api/categories", "POST", {"name": "跨团队产品设计与原生客户端无障碍验收的超长分类名称", "emoji": "✏️"})
            title = "长标题验收：中文 English 123 — 原生客户端信息层级、键盘导航与多窗口宽度下的任务详情应完整换行并保留所有内容"
            markdown = "## 验收清单\n\n- [ ] 中文与 English 混排\n- [x] 保留 Markdown 阅读态\n\n> 引用：不应出现巨型空白编辑器。\n\n[参考链接](https://example.test)\n\n```go\nfmt.Println(\"native\")\n```\n\n" + ("长备注段落：检查自然高度、滚动与属性区域边界。\n\n" * 18)
            normal = api("/api/tasks", "POST", {"title": title, "description": markdown, "priority": 1,
                "category_ids": [category["id"]], "start_time": day.isoformat(),
                "due_date": (day + timedelta(days=2)).isoformat(), "reminder_policy": "none"})
            rule = {"freq": "monthly", "interval": 2, "byday": ["2MO", "-1FR"], "bymonth": [1, 3, 6, 9, 12], "count": 18}
            series = api("/api/tasks", "POST", {"title": "复杂重复 · 每两月第二个周一及最后周五", "description": "只编辑备注时必须保留复杂规则和系列起点。", "start_time": day.isoformat(), "recurrence_rule": rule})
            empty = api("/api/tasks", "POST", {"title": "无描述任务", "priority": -1})
            history_titles = {}
            for name, status, page in (("完成视图验收", "completed", "已完成"), ("取消视图验收", "cancelled", "已取消"), ("跳过视图验收", "skipped", "已跳过")):
                fixture = api("/api/tasks", "POST", {"title": name})
                api(f"/api/tasks/{fixture['id']}/status", "PATCH", {"status": status})
                assert api(f"/api/tasks/{fixture['id']}")["status"] == status
                history_titles[page] = name
            native, ui = start_native()
            windows = ui.call("windows")["windows"]
            assert len(windows) == 1 and windows[0]["kind"] == "content"
            assert not any(n.get("webView") for n in ui.nodes())
            report["fixtures"] = {"normal": normal["id"], "series": series["id"], "empty": empty["id"]}

            for width in (1024, 1280, 1600, 1920):
                resize(width)
                for appearance, suffix in (("浅色", "light"), ("深色", "dark")):
                    navigate("设置")
                    ui.choose("外观", appearance)
                    checkpoint(f"{width}-{suffix}-settings")
                    navigate("日历")
                    checkpoint(f"{width}-{suffix}-calendar")
                    navigate("全部任务")
                    ui.press("button", title)
                    clean_detail()
                    checkpoint(f"{width}-{suffix}-detail-read")
                    ui.reveal_task_advanced("编辑优先级")
                    rows = sorted((ui.node("button", label) for label in PROPERTIES), key=lambda n: n["bounds"]["y"])
                    # A real vertical metadata section, never horizontal chips.
                    for before, after in zip(rows, rows[1:]):
                        assert after["bounds"]["y"] >= before["bounds"]["y"] + before["bounds"]["height"] - 1, (before, after)
                        assert abs(after["bounds"]["x"] - before["bounds"]["x"]) <= 2, (before, after)
                    for row in rows:
                        reveal("button", row["label"])
                        ui.press("button", row["label"])
                        popup = ui.node("popup", "属性选项")
                        assert inside(popup["bounds"], ui.call("windows")["windows"][0]["bounds"]), popup
                        checkpoint(f"{width}-{suffix}-{row['label']}")
                        ui.call("input", events=[{"type": "key", "key": "Escape"}])
                    ui.assert_save_state("保存任务", enabled=False)
                    reveal("button", "编辑任务标题")
                    ui.fill_task_title(title + " · 编辑草稿")
                    ui.fill_task_description(markdown + "\n草稿必须保留。")
                    reveal("button", "保存任务")
                    checkpoint(f"{width}-{suffix}-detail-edit")
                    ui.press("button", "关闭")
                    ui.node("text", "保留未保存的任务草稿？")
                    ui.press("button", "继续编辑")
                    assert ui.task_title()["value"] == title + " · 编辑草稿"
                    assert ui.task_description()["value"].endswith("草稿必须保留。")
                    if width == 1024:
                        ui.press("button", "‹ 返回任务列表")
                        ui.press("button", title)
                        assert ui.task_title()["value"] == title + " · 编辑草稿"
                        checkpoint(f"{width}-{suffix}-draft-return")
                    ui.press("button", "关闭")
                    ui.press("button", "放弃并切换")
                    passed(f"{width} {appearance}: read/edit, vertical properties, bounded popovers, protected draft")

            navigate("全部任务")
            splitters = sorted((node for node in ui.nodes() if node.get("role")=="splitter"),key=lambda node:node["bounds"]["x"])
            assert len(splitters)==2, splitters
            for index, delta in ((0,16),(1,20)):
                current = sorted((node for node in ui.nodes() if node.get("role")=="splitter"),key=lambda node:node["bounds"]["x"])[index]
                point_x=current["bounds"]["x"]+0.5
                events=[{"type":"pointerDown","x":point_x,"y":300},{"type":"pointerMove","x":point_x+delta,"y":300},{"type":"pointerUp","x":point_x+delta,"y":300}]
                ui.call("input",events=events);ui.call("idle",timeout=3000)
            saved_layout=json.loads((profile/"preferences.json").read_text())
            assert saved_layout["sidebar_width"]==244 and saved_layout["task_list_width"]==440,saved_layout
            report["splitter_preferences"]=saved_layout
            checkpoint("splitters-resized")
            ui.press("button",title)
            before = ui.node("button","编辑任务标题")["bounds"]["y"]
            ui.call("input",events=[{"type":"wheel","x":1300,"y":400,"dy":420,"precise":True}])
            ui.call("idle",timeout=3000)
            assert ui.node("button","编辑任务标题")["bounds"]["y"] < before
            checkpoint("description-precise-scroll")
            reveal("button","编辑任务标题")
            ui.press("button","关闭")
            passed("native pointer splitter dragging persists 244/440 logical units; precise wheel scrolls long Markdown")
            ui.press("button", empty["title"])
            clean_detail()
            ui.node("button", "添加描述…")
            ui.fill_task_description("## 新增描述\n\n真实 API 保存验证")
            shortcut("s")
            ui.ready()
            wait_for(lambda:api(f"/api/tasks/{empty['id']}")["description"].startswith("## 新增描述"),"新增描述没有同步至后端")
            ui.press("button", empty["title"])
            clean_detail()
            ui.press("button", "任务活动")
            checkpoint("activity-expanded")
            ui.open_task_activity()
            ui.node("button", "关闭提醒与记录")
            checkpoint("activity-records")
            ui.press("button", "关闭提醒与记录")
            ui.press("button", "关闭")
            passed("empty description enters editor; save persists; activity module expands and opens records")

            shortcut("f")
            ui.fill("搜索任务", "不存在的验收结果")
            ui.node("text", "没有匹配的任务")
            checkpoint("search-empty")
            ui.fill("搜索任务", title[:12])
            ui.node("button", "搜索结果 " + title)
            checkpoint("search-results")
            ui.call("input", events=[{"type": "key", "key": "Enter"}])
            clean_detail()
            ui.press("button", "返回搜索")
            assert ui.node("textField", "搜索任务")["value"] == title[:12]
            ui.call("input", events=[{"type": "key", "key": "Escape"}])
            if ui.find("button", "关闭"):
                ui.press("button", "关闭")
            shortcut("n")
            ui.fill("快捷添加标题", "快捷添加真实保存")
            checkpoint("quick-add")
            ui.call("act", id=ui.node("textField", "快捷添加标题")["id"], action="focus")
            ui.call("input", events=[{"type": "key", "key": "Enter"}])
            ui.ready()
            assert any(t["title"] == "快捷添加真实保存" for t in api("/api/tasks"))
            assert ui.node("textField", "快捷添加标题").get("value", "") == ""
            ui.fill("快捷添加标题", "Esc保留的快捷输入")
            ui.call("input", events=[{"type": "key", "key": "Escape"}])
            assert ui.node("textField", "快捷添加标题")["value"] == "Esc保留的快捷输入"
            # Clear deliberately after verifying protection, avoiding unrelated later drafts.
            ui.fill("快捷添加标题", "")
            passed("macOS Cmd+F/N/S; search empty/results/Enter/return/Esc and quick-add Enter/continuous input/Esc draft protection")

            for label in ("收件箱", "今天", "即将到来", "已完成", "已取消", "已跳过", "管理分类"):
                navigate(label)
                if label in history_titles:
                    ui.node("button", history_titles[label])
                checkpoint("page-" + label)
            navigate("全部任务")
            ui.press("button", series["title"])
            ui.press("button", "编辑整个系列")
            ui.fill_task_description("复杂重复规则备注保存")
            ui.press("button", "保存任务")
            ui.ready()
            saved = api(f"/api/tasks/{series['id']}")
            assert saved["recurrence_rule"] == rule and saved["start_time"] == series["start_time"]
            passed("complex recurrence and series anchor preserved by description save")
            ui.fill_task_title("被远端删除的重复任务副本")
            api(f"/api/tasks/{series['id']}","DELETE")
            ui.press("button","刷新")
            ui.ready()
            ui.node("button","另存为新任务")
            checkpoint("orphaned-series-draft")
            ui.press("button","另存为新任务")
            def recovered_series():
                items=[task for task in api("/api/tasks") if task["title"]=="被远端删除的重复任务副本"]
                return items[0] if len(items)==1 else None
            recovered=wait_for(recovered_series,"被删除的重复任务草稿没有另存成功")
            assert recovered["recurrence_rule"]==rule and recovered["start_time"]==series["start_time"],recovered
            checkpoint("orphaned-series-recovered")
            passed("remote deletion retains dirty series draft; save-as-new preserves complex recurrence and original start")

            # A validation failure must keep the title and Markdown source editable.
            ui.press("button", "＋ 新建任务")
            ui.fill_task_title("")
            ui.fill_task_description("失败后保留的备注")
            ui.press("button", "保存任务")
            ui.node("text", "任务标题应为 1–200 个字符")
            assert ui.task_description()["value"] == "失败后保留的备注"
            checkpoint("validation-error-draft")
            ui.fill_task_title("离线创建与重启持久化")
            server.terminate()
            server.wait(timeout=8)
            ui.press("button", "保存任务")
            ui.ready()
            queued = cache()["outbox"]
            assert queued and queued[-1]["method"] == "POST"
            ids = [op["id"] for op in queued]
            navigate("同步")
            assert any("等待提交" in n.get("label", "") for n in ui.nodes()), "offline queue status missing"
            assert not ui.find("text", "所有本地修改均已同步"), "offline queue presented as synchronized"
            checkpoint("offline-sync")
            native.terminate()
            native.wait(timeout=8)
            (work / "native.sock").unlink(missing_ok=True)
            native, ui = start_native()
            navigate("全部任务")
            ui.node("button", "离线创建与重启持久化")
            def restored_layout():
                nodes=sorted((node for node in ui.nodes() if node.get("role")=="splitter"),key=lambda node:node["bounds"]["x"])
                if len(nodes)!=2:return None
                sidebar=nodes[0]["bounds"]["x"]
                task_list=nodes[1]["bounds"]["x"]-sidebar-nodes[0]["bounds"]["width"]
                return nodes if abs(sidebar-244)<0.01 and abs(task_list-440)<0.01 else None
            wait_for(restored_layout,"重启没有恢复 244/440 分栏宽度")
            assert [op["id"] for op in cache()["outbox"]] == ids
            checkpoint("offline-restarted")
            ui.press("button","离线创建与重启持久化")
            ui.fill_task_description("重连期间继续编辑且保持草稿")
            checkpoint("offline-dirty-detail")
            server = start_server()
            ui.press("button", "刷新")
            ui.ready()
            wait_for(lambda: not cache().get("outbox"), "联网后队列未提交", timeout=25)
            persisted = [t for t in api("/api/tasks") if t["title"] == "离线创建与重启持久化"]
            assert len(persisted) == 1 and persisted[0]["description"] == "失败后保留的备注"
            assert ui.task_description()["value"]=="重连期间继续编辑且保持草稿"
            shortcut("s")
            wait_for(lambda:api(f"/api/tasks/{persisted[0]['id']}")["description"]=="重连期间继续编辑且保持草稿","创建确认后草稿没有使用服务器编号保存")
            assert len([task for task in api("/api/tasks") if task["title"]=="离线创建与重启持久化"])==1
            checkpoint("online-recovered")
            passed("validation preserves input; offline restart retains operation IDs and splitters; dirty draft survives ID mapping and saves exactly once")
            report["status"] = "passed"
        except Exception as error:
            report["status"], report["error"] = "failed", repr(error)
            if ui:
                try:
                    checkpoint("failure")
                except Exception as capture_error:
                    report["capture_error"] = repr(capture_error)
            raise
        finally:
            for process in (native, server):
                if process and process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=8)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=5)
            native_log.close()
            server_log.close()
            for name in ("native.log", "server.log"):
                (artifacts / name).write_bytes((work / name).read_bytes())
            (artifacts / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
            print(f"Report: {artifacts / 'report.json'} ({report['status']})", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--server", type=Path, default=ROOT.parent / "bin/todo-app")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts/linear")
    args = parser.parse_args()
    if sys.platform != "darwin":
        parser.error("This acceptance suite requires a real macOS desktop")
    if '"CGSSessionScreenIsLocked"=Yes' in subprocess.check_output(["ioreg", "-n", "Root", "-d1"], text=True):
        parser.error("Unlock macOS before running acceptance")
    for path in (args.app, args.server):
        if not path.is_file():
            parser.error("Build binary first: " + str(path))
    run = args.artifacts.resolve() / (datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6])
    run.mkdir(parents=True)
    with open(Path(tempfile.gettempdir()) / "todo-native-linear-smoke.lock", "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            parser.error("Another redesign smoke is using the desktop; run sequentially")
        smoke(args.app.resolve(), args.server.resolve(), run)
