#!/usr/bin/env python3
"""Lobe native task menus/editor against a disposable backend/account/profile."""
import argparse
from datetime import datetime, timedelta
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import urllib.request
import uuid
from zoneinfo import ZoneInfo

from smoke import Native, ROOT, wait_for


def smoke(app_binary, server_binary, artifacts, polish_only=False):
    count = 0
    def passed(label):
        nonlocal count
        count += 1
        print("PASS: " + label, flush=True)

    with tempfile.TemporaryDirectory(prefix="todo-native-task-actions-") as tmp:
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
            wait_for(lambda: (work / "native.sock").exists(), "原生窗口未创建")
            connection = Native(work / "native.sock")
            wait_for(lambda: connection.call("windows").get("windows"), "原生窗口未完成初始化")
            return process, connection

        def cache():
            return json.loads((work / "profile/cache.json").read_text())

        def task(id):
            return api(f"/api/tasks/{id}")

        def press_label(label):
            node = wait_for(lambda: next((n for n in ui.nodes() if n.get("label") == label and "press" in n.get("actions", []) and "disabled" not in n.get("states", [])), None), "原生操作不可用：" + label)
            ui.call("act", id=node["id"], action="press")
            ui.call("idle", timeout=3000)

        def menu(title, action=None):
            press_label("更多操作 " + title)
            wait_for(lambda: any(n.get("role") == "menu" for n in ui.nodes()), "任务操作菜单未打开")
            if action:
                ui.press("menuItem", action)
                if action in ("完成任务", "取消任务", "恢复任务待办", "跳过本次", "恢复本次待办", "取消本次"):
                    ui.ready()

        try:
            server = start_server()
            wait_for(healthy, "隔离后端未启动")
            username, password = "actions_" + uuid.uuid4().hex[:10], uuid.uuid4().hex
            if polish_only:
                # The focused visual suite starts with a disposable session;
                # registration itself belongs to the broader account suite.
                api("/api/auth/register", "POST", {"username": username, "email": username + "@example.test", "password": password})
                token = api("/api/auth/login", "POST", {"username": username, "password": password})["token"]
                user = api("/api/auth/me")
                profile = work / "profile"
                profile.mkdir()
                (profile / "session.json").write_text(json.dumps({"server": base, "token": token, "user": user}))
            native, ui = start_native()
            assert ui.call("windows")["windows"][0]["kind"] == "content"
            wait_for(lambda: subprocess.run(["osascript", "-e", f'tell application "System Events" to set size of window 1 of (first process whose unix id is {native.pid}) to {{1340, 820}}'], capture_output=True, text=True, timeout=15).returncode == 0, "等待原生窗口可调整大小超时")
            wait_for(lambda: ui.call("windows")["windows"][0]["bounds"]["width"] >= 1200, "测试窗口未展开")
            if not polish_only:
                ui.press("button", "创建账户")
                ui.fill("用户名", username)
                ui.fill("邮箱", username + "@example.test")
                ui.fill("密码", password)
                ui.press("button", "注册并登录")
            ui.node("button", "＋ 新建任务")
            ui.ready()
            if not polish_only:
                token = api("/api/auth/login", "POST", {"username": username, "password": password})["token"]
            api("/api/auth/profile", "PATCH", {"timezone": "Asia/Shanghai", "default_reminder_enabled": False})
            day = datetime.now(ZoneInfo("Asia/Shanghai")).replace(hour=9, minute=0, second=0, microsecond=0)
            category = api("/api/categories", "POST", {"name": "产品设计", "emoji": "✏️"})
            normal = api("/api/tasks", "POST", {"title": "完善原生客户端交互", "description": "核对任务操作、键盘导航和离线体验", "priority": 1, "category_ids": [category["id"]], "start_time": day.isoformat(), "end_time": (day+timedelta(hours=1)).isoformat()})
            series = api("/api/tasks", "POST", {"title": "每周设计复盘", "description": "系列原始描述", "start_time": day.isoformat(), "end_time": (day+timedelta(hours=1)).isoformat(), "recurrence_rule": {"freq": "weekly", "count": 3}})
            if polish_only:
                for index in range(1, 20):
                    api("/api/tasks", "POST", {"title": f"搜索滚动验证 {index:02d}", "priority": -1})
            api("/api/tasks", "POST", {"title": "整理设计参考", "priority": -1})
            ui.press("button", "刷新")
            ui.ready()
            ui.node("button", "整理设计参考")
            assert task(next(t["id"] for t in api("/api/tasks") if t["title"] == "整理设计参考"))["priority"] == -1
            ui.capture(artifacts / "native-lobe-task-list.png")
            ui.call("menu", path=["任务", "搜索任务"])
            ui.fill("搜索任务", "没有这个任务")
            ui.node("text", "没有匹配的任务")
            ui.capture(artifacts / "native-review-search-empty.png")
            empty_height = ui.node("scroll", "搜索结果列表")["bounds"]["height"]
            ui.press("button", "清除搜索")
            ui.node("button", "搜索结果 " + normal["title"])
            if polish_only:
                ui.fill("搜索任务", "搜索滚动验证")
                search_input = ui.node("textField", "搜索任务")
                ui.call("act", id=search_input["id"], action="focus")
                ui.call("idle", timeout=3000)
                wait_for(lambda: ui.call("tree").get("focus") == search_input["id"], "搜索输入未获得键盘焦点")
                viewport = ui.node("scroll", "搜索结果列表")["bounds"]
                help_before = ui.node("text", "↑ ↓ 选择 · Enter 打开详情 · Esc 关闭")["bounds"]
                for _ in range(18):
                    ui.call("input", events=[{"type": "key", "key": "Down"}])
                    ui.call("idle", timeout=3000)
                last = ui.node("button", "搜索结果 搜索滚动验证 01")["bounds"]
                assert last["y"] >= viewport["y"] and last["y"] + last["height"] <= viewport["y"] + viewport["height"] + 1, (last, viewport)
                assert ui.node("text", "↑ ↓ 选择 · Enter 打开详情 · Esc 关闭")["bounds"] == help_before
                ui.capture(artifacts / "native-polish-search-many.png")
            ui.fill("搜索任务", "原生客户端")
            if polish_only:
                single_height = ui.node("scroll", "搜索结果列表")["bounds"]["height"]
                assert single_height < viewport["height"] and empty_height < viewport["height"]
            ui.capture(artifacts / "native-review-search-results.png")
            ui.call("input", events=[{"type": "key", "key": "Enter"}])
            ui.task_title(normal["title"])
            ui.press("button", "返回搜索")
            assert ui.node("textField", "搜索任务")["value"] == "原生客户端"
            ui.call("input", events=[{"type": "key", "key": "Escape"}])
            wait_for(lambda: not ui.find("textField", "搜索任务"), "Esc未关闭搜索面板")
            ui.press("button", "关闭")
            passed("原生搜索面板：空状态、清除、上下文结果、Enter进入右详情、返回路径与Esc关闭")
            if polish_only:
                for fixture in api("/api/tasks"):
                    if fixture["title"].startswith("搜索滚动验证 "):
                        api(f"/api/tasks/{fixture['id']}", "DELETE")
                ui.press("button", "刷新")
                ui.ready()

            ui.call("menu", path=["任务", "新建任务"])
            wait_for(lambda: ui.call("tree").get("focus") == ui.node("textField", "快捷添加标题")["id"], "新建快捷键入口未聚焦快捷添加")
            ui.fill("快捷添加标题", "连续录入的第一项")
            ui.press("button", "编辑快捷日期")
            ui.capture(artifacts / "native-review-quick-date.png")
            ui.press("button", "明天")
            ui.press("button", "完成")
            ui.press("button", "编辑快捷优先级")
            ui.press("button", "高")
            ui.capture(artifacts / "native-review-quick-add.png")
            # The title input must own Enter; selecting an option keeps native focus on that option.
            ui.call("act", id=ui.node("textField", "快捷添加标题")["id"], action="focus")
            ui.call("input", events=[{"type": "key", "key": "Enter"}])
            ui.ready()
            first_quick = next(t for t in api("/api/tasks") if t["title"] == "连续录入的第一项")
            assert first_quick["priority"] == 1 and first_quick["start_time"]
            assert ui.node("textField", "快捷添加标题").get("value", "") == ""
            ui.fill("快捷添加标题", "Esc保护的快捷草稿")
            ui.call("input", events=[{"type": "key", "key": "Escape"}])
            assert ui.node("textField", "快捷添加标题")["value"] == "Esc保护的快捷草稿"
            quick_bounds = ui.node("textField", "快捷添加标题")["bounds"]
            ui.call("input", events=[{"type": "click", "x": quick_bounds["x"] + 8, "y": quick_bounds["y"] + 8}])
            ui.press("button", "详细编辑")
            assert ui.task_title()["value"] == "Esc保护的快捷草稿"
            ui.press("button", "关闭")
            ui.press("button", "放弃并切换")
            passed("快捷添加日期与优先级、Enter保存后连续输入、Esc保留草稿、转详情保留标题")

            # Capture the current build's main native pages before mutating the tasks.
            ui.press("treeItem", "管理分类")
            ui.ready()
            ui.capture(artifacts / "native-review-categories.png")
            ui.press("treeItem", "日历")
            ui.ready()
            ui.capture(artifacts / "native-review-calendar.png")
            ui.press("treeItem", "设置")
            ui.ready()
            ui.capture(artifacts / "native-review-settings.png")
            ui.press("button", "编辑默认提醒")
            ui.capture(artifacts / "native-review-settings-editor.png")
            ui.press("button", "收起偏好编辑")
            for label, filename in (("同步", "sync"), ("CalDAV 与订阅", "caldav"), ("通知渠道", "notify"), ("AI 与提示词", "ai")):
                ui.press("button", "打开" + label)
                ui.ready()
                ui.capture(artifacts / ("native-review-" + filename + ".png"))
                ui.press("treeItem", "设置")
                ui.ready()
            ui.press("treeItem", "全部任务")

            # Default split view, selection, true edits and protected transitions.
            ui.node("text", "选择一个任务")
            ui.press("button", normal["title"])
            ui.assert_save_state("保存任务", enabled=False)
            title_input = ui.task_title(normal["title"])
            row = ui.node("button", normal["title"])
            assert title_input["bounds"]["x"] > row["bounds"]["x"] + row["bounds"]["width"], (title_input, row)
            assert row["bounds"]["height"] < 64, row
            ui.capture(artifacts / "native-lobe-task-detail.png")
            ui.press("button", "编辑开始")
            ui.capture(artifacts / "native-review-date-property.png")
            ui.press("button", "收起开始时间")
            ui.press("button", "编辑优先级")
            ui.capture(artifacts / "native-review-priority-property.png")
            ui.press("button", "普通")
            ui.press("button", "高")
            ui.press("button", "收起优先级")
            ui.assert_save_state("保存任务", enabled=False)
            assert not ui.find("text", "保留未保存的任务草稿？")
            ui.press("button", "整理设计参考")
            assert not ui.find("text", "保留未保存的任务草稿？")
            ui.fill_task_title("尚未保存的整理草稿", "整理设计参考")
            for role, label in (("button", normal["title"]), ("button", "＋ 新建任务"), ("treeItem", "设置"), ("button", "关闭")):
                ui.press(role, label)
                ui.node("text", "保留未保存的任务草稿？")
                ui.press("button", "继续编辑")
                assert ui.task_title()["value"] == "尚未保存的整理草稿"
            ui.press("button", normal["title"])
            ui.press("button", "放弃并切换")
            assert ui.task_title(normal["title"])["value"] == normal["title"]
            ui.fill_task_description("右侧详情保存验证")
            ui.assert_save_state("保存任务", enabled=True)
            ui.press("button", "保存任务")
            ui.ready()
            assert task(normal["id"])["description"] == "右侧详情保存验证"
            normal["description"] = "右侧详情保存验证"
            passed("默认双栏、紧凑行、选中联动；未修改直接切换，修改后切换/新建/导航/关闭均保护草稿；右栏保存持久化")

            if polish_only:
                ui.press("treeItem", "✏️ 产品设计")
                ui.capture(artifacts / "native-polish-sidebar-category.png")
                ui.press("treeItem", "设置")
                ui.press("button", "编辑默认提醒")
                ui.fill("默认提前分钟数", "17")
                ui.press("button", "收起偏好编辑")
                ui.press("button", "编辑默认提醒")
                assert ui.node("textField", "默认提前分钟数")["value"] == "17"
                ui.capture(artifacts / "native-polish-settings-draft.png")
                ui.press("button", "保存默认提醒")
                wait_for(lambda: (node := ui.find("button", "保存默认提醒")) and "disabled" not in node.get("states", []), "默认提醒保存未结束")
                assert api("/api/auth/me")["default_reminder_minutes"] == 17
                ui.press("button", "收起偏好编辑")
                ui.choose("外观", "深色")
                ui.press("button", "编辑默认提醒")
                ui.capture(artifacts / "native-polish-settings-dark.png")
                ui.press("button", "收起偏好编辑")
                ui.press("treeItem", "全部任务")
                ui.press("button", normal["title"])
                ui.capture(artifacts / "native-lobe-task-detail-dark.png")
                ui.press("button", "编辑开始")
                ui.capture(artifacts / "native-polish-date-dark.png")
                ui.press("button", "收起开始时间")
                if sys.platform == "darwin":
                    subprocess.run(["osascript", "-e", f'tell application "System Events" to set size of window 1 of (first process whose unix id is {native.pid}) to {{960, 680}}'], check=True, capture_output=True, text=True, timeout=15)
                    wait_for(lambda: ui.call("windows")["windows"][0]["bounds"]["width"] < 1100, "测试窗口未缩小")
                    ui.press("button", "编辑开始")
                    panel = ui.node("popup", "属性选项")["bounds"]
                    window_height = ui.call("windows")["windows"][0]["bounds"]["height"]
                    assert panel["y"] >= 0 and panel["y"] + panel["height"] < window_height
                    ui.capture(artifacts / "native-review-date-narrow-dark.png")
                    ui.press("button", "收起开始时间")
                passed("视觉收尾：搜索自适应与多结果键盘滚动、侧栏单一分类标识、统一主动作、设置收起保留草稿与保存、明暗主题和窄窗弹层")
                print(f"Native visual polish smoke: {count}/{count} PASS", flush=True)
                return

            menu(normal["title"])
            ui.capture(artifacts / "native-lobe-task-menu.png")
            revision = task(normal["id"])["revision"]
            ui.call("input", events=[{"type": "key", "key": "Escape"}])
            ui.call("idle", timeout=3000)
            wait_for(lambda:not ui.find("menuItem","取消任务"),"Esc 没有关闭任务菜单")
            assert not ui.find("menuItem", "取消任务") and task(normal["id"])["revision"] == revision and not cache().get("outbox")
            menu(normal["title"], "取消任务")
            assert task(normal["id"])["status"] == "cancelled"
            ui.press("treeItem", "已取消")
            menu(normal["title"], "恢复任务待办")
            saved = task(normal["id"])
            assert saved["status"] == "pending" and saved["description"] == normal["description"] and saved["start_time"] == normal["start_time"] and saved["categories"][0]["id"] == category["id"]
            passed("Esc 不写入；列表直接取消和恢复普通任务，其他字段保留")

            ui.press("treeItem", "全部任务")
            first = next(o for o in api("/api/tasks/next-occurrences") if o["task_id"] == series["id"])
            menu(series["title"], "跳过本次")
            history = api("/api/tasks/occurrences?status=skipped&limit=200")["items"]
            assert any(o["instance_id"] == first["instance_id"] for o in history)
            assert task(series["id"])["start_time"] == series["start_time"]
            ui.press("treeItem", "已跳过")
            menu(series["title"], "恢复本次待办")
            assert next(o for o in api("/api/tasks/next-occurrences") if o["task_id"] == series["id"])["instance_id"] == first["instance_id"]
            passed("重复任务菜单跳过与历史恢复只操作本次，原始身份和系列起点保留")

            ui.press("treeItem", "全部任务")
            menu(series["title"], "取消本次")
            assert any(o["instance_id"] == first["instance_id"] for o in api("/api/tasks/occurrences?status=cancelled&limit=200")["items"])
            ui.press("treeItem", "已取消")
            menu(series["title"], "恢复本次待办")
            assert task(series["id"])["status"] == "pending" and task(series["id"])["start_time"] == series["start_time"]
            passed("取消重复本次与恢复使用实例接口，后续系列保持待办")

            ui.press("treeItem", "全部任务")
            menu(series["title"], "编辑整个系列")
            ui.fill_task_description("从原生卡片编辑器保存的系列描述")
            ui.capture(artifacts / "native-lobe-task-editor.png")
            ui.press("button", "保存任务")
            ui.ready()
            saved = task(series["id"])
            assert saved["description"] == "从原生卡片编辑器保存的系列描述" and saved["start_time"] == series["start_time"] and saved["recurrence_rule"] == series["recurrence_rule"]
            passed("分组编辑器保存系列描述，保持起点和复杂重复规则")

            menu(normal["title"], "提醒与活动记录")
            ui.node("button", "关闭提醒与记录")
            ui.press("button", "关闭提醒与记录")
            menu(series["title"], "删除整个系列")
            ui.node("text", "重复任务将删除整个系列。")
            ui.press("button", "保留")
            assert task(series["id"])["status"] == "pending"
            menu(series["title"], "删除整个系列")
            ui.press("button", "确认删除")
            ui.ready()
            assert all(t["id"] != series["id"] for t in api("/api/tasks"))
            passed("菜单直接打开提醒记录，删除整个系列必须经过明确确认")

            ui.press("treeItem", "设置")
            ui.choose("外观", "深色")
            ui.press("treeItem", "全部任务")
            ui.capture(artifacts / "native-lobe-task-list-dark.png")
            ui.press("button", normal["title"])
            ui.capture(artifacts / "native-lobe-task-detail-dark.png")
            ui.press("button", "关闭")
            menu(normal["title"])
            ui.capture(artifacts / "native-lobe-task-menu-dark.png")
            ui.call("input", events=[{"type": "key", "key": "Escape"}])
            ui.call("idle", timeout=3000)
            passed("真实原生窗口深色列表和操作菜单可用，主题保存到本机偏好")

            if sys.platform == "darwin":
                subprocess.run(["osascript", "-e", f'tell application "System Events" to set size of window 1 of (first process whose unix id is {native.pid}) to {{960, 680}}'], check=True, capture_output=True, text=True, timeout=15)
                wait_for(lambda: ui.call("windows")["windows"][0]["bounds"]["width"] < 1100, "测试窗口未缩小")
                ui.press("button", normal["title"])
                ui.press("button", "编辑开始")
                close_date = ui.node("popup", "属性选项")["bounds"]
                window_height = ui.call("windows")["windows"][0]["bounds"]["height"]
                assert close_date["y"] >= 0 and close_date["y"] + close_date["height"] < window_height
                ui.capture(artifacts / "native-review-date-narrow-dark.png")
                ui.call("act", id=ui.node("button", "编辑日期时间")["id"], action="scrollIntoView")
                ui.call("idle", timeout=3000)
                time_bounds = ui.node("button", "编辑日期时间")["bounds"]
                assert time_bounds["y"] + time_bounds["height"] < window_height
                ui.capture(artifacts / "native-review-date-narrow-dark-scroll.png")
                ui.call("act", id=ui.node("button", "收起开始时间")["id"], action="scrollIntoView")
                ui.press("button", "收起开始时间")
                ui.fill_task_title("小窗口保留的草稿", normal["title"])
                ui.node("button", "‹ 返回任务列表")
                ui.capture(artifacts / "native-lobe-task-narrow-dark.png")
                ui.press("button", "‹ 返回任务列表")
                ui.node("button", "整理设计参考")
                ui.capture(artifacts / "native-lobe-task-narrow-list-dark.png")
                ui.press("button", normal["title"])
                assert ui.task_title("小窗口保留的草稿")["value"] == "小窗口保留的草稿"
                ui.press("button", "关闭")
                ui.press("button", "放弃并切换")
                ui.press("treeItem", "设置")
                ui.choose("外观", "浅色")
                ui.press("treeItem", "全部任务")
                ui.press("button", normal["title"])
                ui.capture(artifacts / "native-lobe-task-narrow-light.png")
                ui.press("button", "关闭")
                passed("macOS 真实小窗口：单栏编辑、返回列表保留草稿，重新选择恢复；明暗主题均可用")

            server.terminate()
            server.wait(timeout=8)
            menu(normal["title"], "完成任务")
            queued = cache()["outbox"][0]
            assert queued["task_id"] == normal["id"] and queued["method"] == "PATCH"
            native.terminate()
            native.wait(timeout=8)
            wait_for(lambda: not (work / "native.sock").exists(), "测试原生窗口未关闭")
            native, ui = start_native()
            ui.node("button", "＋ 新建任务")
            ui.ready()
            ui.press("treeItem", "已完成")
            ui.node("button", normal["title"])
            assert cache()["outbox"][0]["id"] == queued["id"]
            passed("真实断网菜单操作写入持久队列，重启恢复完成状态和相同操作编号")

            server = start_server()
            wait_for(healthy, "隔离后端未恢复")
            ui.press("button", "刷新")
            ui.ready()
            wait_for(lambda: not cache().get("outbox"), "离线菜单操作未同步")
            assert task(normal["id"])["status"] == "completed"
            passed("恢复联网提交离线完成，服务端状态与原生列表一致")
            print(f"Native task actions smoke: {count}/{count} PASS", flush=True)
        except Exception:
            if ui:
                try:
                    ui.capture(artifacts / "task-actions-failure.png")
                    (artifacts / "task-actions-failure-tree.json").write_text(json.dumps(ui.nodes(), ensure_ascii=False, indent=2))
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
            raise SystemExit("macOS 当前已锁屏，请解锁后重跑 make task-actions-smoke；测试尚未开始。")
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--server", type=Path, default=ROOT.parent / "bin/todo-app")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts")
    parser.add_argument("--visual-polish", action="store_true", help="只验证搜索、快捷添加、任务属性、设置与本轮视觉收尾")
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    smoke(args.app.resolve(), args.server.resolve(), args.artifacts, args.visual_polish)
