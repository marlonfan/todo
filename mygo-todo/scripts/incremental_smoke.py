#!/usr/bin/env python3
"""Native long-poll/cursor acceptance with an isolated backend and controlled slow response."""
import argparse
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

from smoke import Native, ROOT, wait_for


def smoke(app_binary, server_binary, artifacts):
    count = 0
    def passed(label):
        nonlocal count
        count += 1
        print("PASS: " + label, flush=True)

    with tempfile.TemporaryDirectory(prefix="todo-native-incremental-") as tmp:
        work = Path(tmp)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        upstream = f"http://127.0.0.1:{port}"
        requests = []
        mutex = threading.Lock()
        held, release = threading.Event(), threading.Event()
        slow = {"enabled": False, "claimed": False}
        class Proxy(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass
            def forward(self):
                with mutex:
                    requests.append((self.command, self.path))
                data = self.rfile.read(int(self.headers.get("Content-Length", "0"))) or None
                req = urllib.request.Request(upstream + self.path, method=self.command, data=data, headers={k: v for k, v in self.headers.items() if k.lower() not in ("host", "connection", "content-length")})
                try:
                    response = urllib.request.urlopen(req, timeout=32)
                except urllib.error.HTTPError as error:
                    response = error
                except OSError:
                    self.send_error(502)
                    return
                with response:
                    status, body = response.status, response.read()
                    content_type = response.headers.get("Content-Type", "application/json")
                block = False
                with mutex:
                    if self.path == "/api/categories" and slow["enabled"] and not slow["claimed"]:
                        slow["claimed"], block = True, True
                if block:
                    held.set()
                    release.wait(timeout=20)
                try:
                    self.send_response(status)
                    self.send_header("Content-Type", content_type)
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                except (BrokenPipeError, ConnectionResetError):
                    pass
            do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = forward
        proxy = ThreadingHTTPServer(("127.0.0.1", 0), Proxy)
        threading.Thread(target=proxy.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{proxy.server_port}"
        config = work / "server.yaml"
        config.write_text(json.dumps({"server": {"host": "127.0.0.1", "port": port}, "database": {"driver": "sqlite", "dsn": str(work / "test.db")}, "jwt": {"secret": uuid.uuid4().hex, "expire": "24h"}}))
        server_log, native_log = open(work / "server.log", "wb"), open(work / "native.log", "wb")
        server = native = ui = None
        token = ""
        def api(path, method="GET", body=None):
            req = urllib.request.Request(upstream + path, method=method, data=None if body is None else json.dumps(body).encode(), headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as response:
                body = response.read()
                return json.loads(body) if body else None
        def healthy():
            try:
                return api("/health")["status"] == "ok"
            except OSError:
                return False
        def cache():
            return json.loads((work / "profile/cache.json").read_text())
        def row(id):
            return next((t for t in cache()["tasks"] or [] if t["id"] == id), None)
        def task_is(id, title):
            item = row(id)
            return item and item["title"] == title
        def log():
            with mutex:
                return list(requests)
        def start_native():
            sock = work / "native.sock"
            sock.unlink(missing_ok=True)
            env = dict(os.environ, TODO_NATIVE_QA="1", TODO_API_URL=base, TODO_NATIVE_DATA_DIR=str(work / "profile"), TODO_NATIVE_REMINDER_LOG=str(work / "reminders.jsonl"), MYGO_AUTOMATION=str(sock))
            process = subprocess.Popen([str(app_binary)], cwd=work, env=env, stdout=native_log, stderr=subprocess.STDOUT)
            wait_for(sock.exists, "原生窗口未启动")
            connection = Native(sock)
            wait_for(lambda: connection.call("windows").get("windows"), "原生窗口未就绪")
            return process, connection
        try:
            server = subprocess.Popen([str(server_binary), "-config", str(config)], cwd=work, stdout=server_log, stderr=subprocess.STDOUT)
            wait_for(healthy, "隔离后端未启动")
            native, ui = start_native()
            assert ui.call("windows")["windows"][0]["kind"] == "content"
            username, password = "delta_" + uuid.uuid4().hex[:10], uuid.uuid4().hex
            ui.press("button", "创建账户")
            ui.fill("用户名", username)
            ui.fill("邮箱", username + "@example.test")
            ui.fill("密码", password)
            ui.press("button", "注册并登录")
            ui.node("button", "＋ 新建任务")
            ui.ready()
            token = api("/api/auth/login", "POST", {"username": username, "password": password})["token"]
            wait_for(lambda: cache().get("sync_cursor"), "同步游标未持久化")
            wait_for(lambda: any("wait=20" in p for _, p in log()), "未发起后台长轮询")
            assert not any(p == "/api/tasks" for m, p in log() if m == "GET")
            passed("序号游标引导与长轮询已启动，没有全量任务 GET")

            first = api("/api/tasks", "POST", {"title": "编辑期间增量同步", "reminder_policy": "none"})
            other = api("/api/tasks", "POST", {"title": "另一设备任务", "reminder_policy": "none"})
            wait_for(lambda: row(first["id"]) and row(other["id"]), "其他客户端新增未自动同步", timeout=10)
            ui.press("button", first["title"])
            ui.fill_task_title("网络读取期间仍可保存", first["title"])
            with mutex:
                slow["enabled"] = True
            api(f"/api/tasks/{other['id']}", "PUT", {"title": "另一设备已更新"})
            wait_for(held.is_set, "没有捕获待完成的后台读取", timeout=10)
            assert "disabled" not in ui.node("button", "保存任务").get("states", [])
            ui.fill_task_description("后台网络正在等待，但此处可以继续输入。")
            ui.press("button", "保存任务")
            ui.ready()
            assert api(f"/api/tasks/{first['id']}")["title"] == "网络读取期间仍可保存"
            assert not cache().get("outbox")
            passed("后台网络响应未结束时可继续编辑并保存，前台提交不被长轮询阻塞")
            release.set()
            added = api("/api/tasks", "POST", {"title": "迟到响应后继续接收", "reminder_policy": "none"})
            wait_for(lambda: row(added["id"]), "迟到响应后没有继续同步", timeout=10)
            assert task_is(first["id"], "网络读取期间仍可保存") and task_is(other["id"], "另一设备已更新")
            passed("迟到后台响应不会回滚已提交任务、复活旧队列或覆盖更新游标")

            ui.press("button", "网络读取期间仍可保存")
            ui.fill_task_title("保留未保存的修改", "网络读取期间仍可保存")
            baseline = api(f"/api/tasks/{first['id']}")
            api(f"/api/tasks/{first['id']}", "PUT", {"title": "远端同时编辑"})
            wait_for(lambda: task_is(first["id"], "远端同时编辑"), "编辑器打开期间未合并远端修改", timeout=10)
            assert ui.task_title()["value"] == "保留未保存的修改"
            ui.press("button", "保存任务")
            ui.ready()
            op = cache()["outbox"][0]
            assert op["state"] == "conflict" and op["base"]["title"] == baseline["title"] and op["revision"] == baseline["revision"]
            assert op["latest"]["title"] == "远端同时编辑"
            passed("打开编辑器时持续接收远端修改，草稿保留，保存仍以原版本触发真实 409")
            ui.press("treeItem", "同步")
            ui.press("button", "用本地修改覆盖此版本")
            ui.ready()
            assert not cache().get("outbox") and api(f"/api/tasks/{first['id']}")["title"] == "保留未保存的修改"
            passed("增量读取后的冲突仍需显式覆盖，并使用服务器最新版本提交")

            ui.press("treeItem", "全部任务")
            api(f"/api/tasks/{other['id']}", "DELETE")
            wait_for(lambda: row(other["id"]) is None, "远端删除未自动合并", timeout=10)
            wait_for(lambda:not ui.find("button", "另一设备已更新"),"持久缓存的远端删除没有更新原生列表")
            passed("其他客户端删除任务后，列表和持久缓存同步移除")

            start = (datetime.now(timezone.utc) + timedelta(days=1)).replace(microsecond=0)
            series = api("/api/tasks", "POST", {"title": "增量重复实例", "start_time": start.isoformat(), "recurrence_rule": {"freq": "daily", "count": 3}, "reminder_policy": "none"})
            wait_for(lambda: row(series["id"]), "重复任务未同步", timeout=10)
            instance = next(o for o in api("/api/tasks/next-occurrences") if o["task_id"] == series["id"])
            api(f"/api/tasks/{series['id']}/status", "PATCH", {"status": "completed", "instance_id": instance["instance_id"], "occurrence_date": instance["original_date"][:10]})
            wait_for(lambda: any(o["instance_id"] == instance["instance_id"] and o["status"] == "completed" for o in cache()["occurrence_history"]["items"] or []), "单次历史未与游标一起同步", timeout=10)
            assert row(series["id"])["status"] == "pending"
            assert not any(o["instance_id"] == instance["instance_id"] for o in cache()["next_occurrences"] or [])
            passed("重复单次完成后，同步任务版本、后续实例与历史，系列仍待办")

            saved_cursor = cache()["sync_cursor"]
            native.terminate()
            native.wait(timeout=8)
            restarted = api("/api/tasks", "POST", {"title": "重启期间新增", "reminder_policy": "none"})
            log_start = len(log())
            native, ui = start_native()
            ui.node("button", "＋ 新建任务")
            ui.ready()
            wait_for(lambda: row(restarted["id"]), "重启没有补齐增量", timeout=10)
            sync_calls = [urllib.parse.parse_qs(urllib.parse.urlsplit(p).query) for m, p in log()[log_start:] if p.startswith("/api/tasks/sync?")]
            assert sync_calls[0]["cursor"] == [saved_cursor]
            assert not any(p == "/api/tasks" for m, p in log() if m == "GET")
            passed("重启从已持久化游标继续补齐，没有重新扫描全部任务")
            print(f"Native incremental smoke: {count}/{count} PASS", flush=True)
        except Exception:
            if ui:
                try:
                    ui.capture(artifacts / "incremental-smoke-failure.png")
                    (artifacts / "incremental-smoke-failure-tree.json").write_text(json.dumps(ui.nodes(), ensure_ascii=False, indent=2))
                except Exception:
                    pass
            raise
        finally:
            release.set()
            for process in (native, server):
                if process and process.poll() is None:
                    process.terminate()
                    process.wait(timeout=8)
            proxy.shutdown()
            proxy.server_close()
            native_log.close()
            server_log.close()


if __name__ == "__main__":
    if sys.platform == "darwin" and '"CGSSessionScreenIsLocked"=Yes' in subprocess.check_output(["ioreg", "-n", "Root", "-d1"], text=True):
        raise SystemExit("macOS 当前已锁屏，请解锁后重跑 make incremental-smoke；测试尚未开始。")
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--server", type=Path, default=ROOT.parent / "bin/todo-app")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts")
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    smoke(args.app.resolve(), args.server.resolve(), args.artifacts)
