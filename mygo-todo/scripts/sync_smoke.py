#!/usr/bin/env python3
"""Lobe native synchronization/conflict recovery against a disposable backend/account/profile."""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import urllib.request
import uuid

from smoke import Native, ROOT, wait_for


def smoke(app_binary, server_binary, artifacts):
    count = 0
    def passed(label):
        nonlocal count
        count += 1
        print("PASS: " + label, flush=True)

    with tempfile.TemporaryDirectory(prefix="todo-native-sync-") as tmp:
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
            native, ui = start_native()
            assert ui.call("windows")["windows"][0]["kind"] == "content"
            username, password = "sync_" + uuid.uuid4().hex[:10], uuid.uuid4().hex
            ui.press("button", "创建账户")
            ui.fill("用户名", username)
            ui.fill("邮箱", username + "@example.test")
            ui.fill("密码", password)
            ui.press("button", "注册并登录")
            ui.node("button", "＋ 新建任务")
            ui.ready()
            token = api("/api/auth/login", "POST", {"username": username, "password": password})["token"]
            api("/api/auth/profile", "PATCH", {"timezone": "Asia/Shanghai", "default_reminder_enabled": False})
            first = api("/api/tasks", "POST", {"title": "团队周报", "description": "原始描述", "reminder_policy": "none"})
            independent = api("/api/tasks", "POST", {"title": "独立任务", "reminder_policy": "none"})
            ui.press("button", "刷新")
            ui.ready()
            ui.press("treeItem", "同步")
            ui.node("text", "所有本地修改均已同步")
            ui.capture(artifacts / "native-lobe-sync-empty.png")
            passed("Lobe 同步概览与已同步空状态，窗口为 Native UI content")

            def conflict(task, local_title, remote_title):
                ui.press("treeItem", "全部任务")
                ui.press("button", task["title"])
                ui.assert_save_state("保存任务", enabled=False)
                ui.fill_task_title(local_title, task["title"])
                ui.fill_task_description("本机编辑的描述")
                ui.assert_save_state("保存任务", enabled=True)
                api(f"/api/tasks/{task['id']}", "PUT", {"title": remote_title, "description": "其他设备的描述"})
                ui.press("button", "保存任务")
                ui.ready()
                ui.press("treeItem", "同步")
                ui.node("button", "用本地修改覆盖此版本")
                result = cache()["outbox"][0]
                assert result["state"] == "conflict" and result["latest"]["title"] == remote_title
                assert api(f"/api/tasks/{task['id']}")["title"] == remote_title
                return result

            def reveal(role, label):
                ui.call("act", id=ui.node(role, label)["id"], action="scrollIntoView")
                ui.call("idle", timeout=3000)

            queued = conflict(first, "周报 · 本机编辑", "周报 · 其他设备更新")
            ui.node("text", "差异字段：标题、描述")
            ui.node("text", "最初读取")
            ui.node("text", "本地修改")
            ui.node("text", "服务器最新")
            ui.capture(artifacts / "native-lobe-sync-conflict.png")
            reveal("text", "服务器最新")
            ui.capture(artifacts / "native-lobe-sync-versions.png")
            reveal("button", "展开完整版本")
            ui.press("button", "展开完整版本")
            ui.node("text", "提醒：不提醒")
            ui.node("text", "开始：未设置")
            ui.press("button", "收起完整版本")
            assert cache()["outbox"][0]["id"] == queued["id"]
            passed("真实 409 保留双方版本；差异字段和完整版本切换不提交内容")

            reveal("button", "放弃此任务全部待同步修改")
            ui.press("button", "放弃此任务全部待同步修改")
            ui.node("text", "将移除这项任务的 1 条待同步修改")
            ui.capture(artifacts / "native-lobe-sync-discard.png")
            ui.press("button", "保留本地修改")
            assert cache()["outbox"][0]["id"] == queued["id"]
            passed("放弃确认显示实际队列数量，取消保留相同操作编号")

            ui.press("treeItem", "设置")
            ui.choose("外观", "深色")
            ui.press("treeItem", "同步")
            reveal("button", "用本地修改覆盖此版本")
            ui.capture(artifacts / "native-lobe-sync-conflict-dark.png")
            passed("真实原生窗口深色同步卡片与冲突处理可用")

            server.terminate()
            server.wait(timeout=8)
            ui.press("treeItem", "全部任务")
            ui.press("button", "周报 · 本机编辑")
            ui.fill_task_title("周报 · 后续离线编辑", "周报 · 本机编辑")
            ui.press("button", "保存任务")
            ui.ready()
            ui.press("button", independent["title"])
            ui.assert_save_state("保存任务", enabled=False)
            ui.choose("状态（整项任务）", "已完成")
            ui.assert_save_state("保存任务", enabled=True)
            ui.press("button", "保存任务")
            ui.ready()
            operations = [op["id"] for op in cache()["outbox"]]
            assert len(operations) == 3
            native.terminate()
            native.wait(timeout=8)
            wait_for(lambda: not (work / "native.sock").exists(), "测试原生窗口未关闭")
            native, ui = start_native()
            ui.node("button", "＋ 新建任务")
            ui.ready()
            ui.press("treeItem", "同步")
            ui.node("text", "等待前序修改处理")
            assert [op["id"] for op in cache()["outbox"]] == operations
            passed("冲突后的同任务修改明确显示等待，断网重启保留全部原操作")

            server = start_server()
            wait_for(healthy, "隔离后端未恢复")
            ui.press("button", "立即同步")
            ui.ready()
            assert task(independent["id"])["status"] == "completed"
            assert len(cache()["outbox"]) == 2
            assert task(first["id"])["title"] == "周报 · 其他设备更新"
            passed("冲突阻塞同一任务后续写入，独立任务仍可提交")
            reveal("button", "放弃此任务全部待同步修改")
            ui.press("button", "放弃此任务全部待同步修改")
            ui.node("text", "将移除这项任务的 2 条待同步修改")
            ui.press("button", "确认放弃本地修改")
            ui.ready()
            assert not cache().get("outbox")
            assert task(first["id"])["title"] == "周报 · 其他设备更新"
            assert task(independent["id"])["status"] == "completed"
            passed("确认放弃仅移除此任务全部依赖修改，保留服务端和独立任务")

            current = task(first["id"])
            queued = conflict(current, "周报 · 显式本地覆盖", "周报 · 第二次远端更新")
            reveal("button", "用本地修改覆盖此版本")
            ui.press("button", "用本地修改覆盖此版本")
            ui.ready()
            assert not cache().get("outbox")
            assert task(first["id"])["title"] == "周报 · 显式本地覆盖"
            assert task(first["id"])["description"] == "本机编辑的描述"
            passed("显式覆盖采用最新 revision，服务端确认后才移除本机操作")

            removed = api("/api/tasks", "POST", {"title": "服务端已删除的任务"})
            ui.press("treeItem", "全部任务")
            ui.press("button", "刷新")
            ui.ready()
            ui.press("button", removed["title"])
            ui.fill_task_title("待重试的本机修改", removed["title"])
            api(f"/api/tasks/{removed['id']}", "DELETE")
            ui.press("button", "保存任务")
            ui.ready()
            ui.press("treeItem", "同步")
            rejected = cache()["outbox"][0]
            assert rejected["state"] == "rejected"
            reveal("button", "重新尝试此修改")
            ui.press("button", "重新尝试此修改")
            ui.ready()
            assert cache()["outbox"][0]["state"] == "rejected" and cache()["outbox"][0]["id"] == rejected["id"]
            reveal("button", "放弃此任务全部待同步修改")
            ui.press("button", "放弃此任务全部待同步修改")
            ui.press("button", "确认放弃本地修改")
            ui.ready()
            assert not cache().get("outbox")
            assert all(t["id"] != removed["id"] for t in api("/api/tasks"))
            passed("服务器拒绝的修改可以原编号重试，放弃不会重建已删除的任务")

            # A server signing-key change makes an actually issued session invalid.
            server.terminate()
            server.wait(timeout=8)
            ui.press("treeItem", "全部任务")
            ui.press("button", "周报 · 显式本地覆盖")
            ui.fill_task_title("登录恢复后提交的周报", "周报 · 显式本地覆盖")
            ui.press("button", "保存任务")
            ui.ready()
            operation_id = cache()["outbox"][0]["id"]
            cfg = json.loads(config.read_text())
            cfg["jwt"]["secret"] = uuid.uuid4().hex
            config.write_text(json.dumps(cfg))
            server = start_server()
            wait_for(healthy, "隔离后端未恢复")
            ui.press("treeItem", "同步")
            ui.press("button", "立即同步")
            ui.ready()
            # The account check happens before Flush: pending intent stays intact.
            assert cache()["outbox"][0]["state"] == "pending" and cache()["outbox"][0]["id"] == operation_id
            ui.node("text", "登录已失效，本地修改已保留")
            ui.capture(artifacts / "native-lobe-sync-reauthenticate.png")
            passed("登录失效时先验证账户，原待同步意图与编号保留，恢复入口置顶")
            reveal("textField", "当前账户密码")
            ui.fill("当前账户密码", password)
            reveal("button", "验证并继续同步")
            ui.press("button", "验证并继续同步")
            ui.ready()
            assert not cache().get("outbox")
            token = api("/api/auth/login", "POST", {"username": username, "password": password})["token"]
            assert task(first["id"])["title"] == "登录恢复后提交的周报"
            ui.node("text", "所有本地修改均已同步")
            passed("重新验证同一账户后提交原离线修改，完整恢复同步")
            print(f"Native sync smoke: {count}/{count} PASS", flush=True)
        except Exception:
            if ui:
                try:
                    ui.capture(artifacts / "sync-failure.png")
                    (artifacts / "sync-failure-tree.json").write_text(json.dumps(ui.nodes(), ensure_ascii=False, indent=2))
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
            raise SystemExit("macOS 当前已锁屏，请解锁后重跑 make sync-smoke；测试尚未开始。")
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--server", type=Path, default=ROOT.parent / "bin/todo-app")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts")
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    smoke(args.app.resolve(), args.server.resolve(), args.artifacts)
