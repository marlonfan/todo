#!/usr/bin/env python3
"""Native offline categories, durable receipts and dependent task mapping."""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import urllib.error
import urllib.request
import uuid

from account_smoke import AccountNative
from smoke import ROOT, wait_for


def smoke(app_binary, server_binary, artifacts):
    count = 0
    def passed(label):
        nonlocal count
        count += 1
        print("PASS: " + label, flush=True)

    with tempfile.TemporaryDirectory(prefix="todo-native-category-offline-") as tmp:
        work = Path(tmp)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        upstream = f"http://127.0.0.1:{port}"
        offline, drop = threading.Event(), threading.Event()
        requests = []
        class Proxy(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass
            def forward(self):
                if offline.is_set():
                    self.connection.shutdown(socket.SHUT_RDWR)
                    self.connection.close()
                    return
                body = self.rfile.read(int(self.headers.get("Content-Length", "0"))) or None
                payload = json.loads(body) if body else None
                requests.append((self.command, self.path, payload, self.headers.get("X-Client-Op-Id")))
                request = urllib.request.Request(upstream + self.path, data=body, method=self.command, headers={k:v for k,v in self.headers.items() if k.lower() not in ("host", "connection", "content-length")})
                try:
                    response = urllib.request.urlopen(request, timeout=32)
                except urllib.error.HTTPError as err:
                    response = err
                except OSError:
                    self.send_error(502)
                    return
                with response:
                    data = response.read()
                    status, content_type = response.status, response.headers.get("Content-Type", "application/json")
                if drop.is_set() and self.path == "/api/categories/sync" and payload and payload["method"] == "POST" and status == 200:
                    drop.clear()
                    self.connection.shutdown(socket.SHUT_RDWR)
                    self.connection.close()
                    return
                try:
                    self.send_response(status)
                    self.send_header("Content-Type", content_type)
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                except (BrokenPipeError, ConnectionResetError):
                    pass
            do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = forward
        proxy = ThreadingHTTPServer(("127.0.0.1", 0), Proxy)
        threading.Thread(target=proxy.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{proxy.server_port}"
        config = work / "server.yaml"
        config.write_text(json.dumps({"server":{"host":"127.0.0.1", "port":port}, "database":{"driver":"sqlite", "dsn":str(work / "test.db")}, "jwt":{"secret":uuid.uuid4().hex, "expire":"24h"}}))
        server_log, native_log = open(work / "server.log", "wb"), open(work / "native.log", "wb")
        server = native = ui = None
        token = ""
        profile = work / "profile"
        def api(path, method="GET", payload=None):
            request = urllib.request.Request(upstream + path, data=None if payload is None else json.dumps(payload).encode(), method=method, headers={"Authorization":"Bearer " + token, "Content-Type":"application/json"})
            with urllib.request.urlopen(request, timeout=8) as response:
                data = response.read()
                return json.loads(data) if data else None
        def healthy():
            try:
                return api("/health")["status"] == "ok"
            except OSError:
                return False
        def cache():
            return json.loads((profile / "cache.json").read_text())
        def pending():
            return cache().get("category_outbox", [])
        def categories():
            items = {c["id"]:c for c in cache().get("categories") or []}
            for op in pending():
                items.pop(op["category_id"], None)
                if op["method"] != "DELETE":
                    items[op["category_id"]] = op["local"]
            return list(items.values())
        def new_category(name):
            ui.press("treeItem", "管理分类")
            ui.press("button", "新建分类")
            ui.fill("分类名称", name)
            ui.press("button", "保存分类")
            ui.ready()
        def new_task(title, names):
            ui.press("treeItem", "全部任务")
            ui.press("button", "＋ 新建任务")
            ui.fill_task_title(title)
            if names:
                ui.press("button","编辑分类")
                for name in names:
                    ui.press("button", name)
                ui.press("button","收起分类")
            ui.press("button", "保存任务")
            ui.ready()
        env = dict(os.environ, TODO_NATIVE_QA="1", TODO_API_URL=base, TODO_NATIVE_DATA_DIR=str(profile), MYGO_AUTOMATION=str(work / "native.sock"))
        def start_native():
            sock = work / "native.sock"
            sock.unlink(missing_ok=True)
            process = subprocess.Popen([str(app_binary)], cwd=work, env=env, stdout=native_log, stderr=subprocess.STDOUT)
            wait_for(sock.exists, "原生应用未启动")
            ui = AccountNative(sock)
            wait_for(lambda: ui.call("windows")["windows"], "原生窗口未创建")
            ui.node("button", "＋ 新建任务")
            ui.ready()
            return process, ui
        def stop_native():
            if native and native.poll() is None:
                native.terminate()
                native.wait(timeout=8)
        try:
            server = subprocess.Popen([str(server_binary), "-config", str(config)], cwd=work, stdout=server_log, stderr=subprocess.STDOUT)
            wait_for(healthy, "隔离后端未启动")
            username, password = "category_" + uuid.uuid4().hex[:10], uuid.uuid4().hex
            api("/api/auth/register", "POST", {"username":username, "email":username+"@example.test", "password":password})
            login = api("/api/auth/login", "POST", {"username":username, "password":password})
            token = login["token"]
            user = api("/api/auth/me")
            existing = api("/api/categories", "POST", {"name":"已有分类", "emoji":"📁", "color":"#3788d8"})
            fixture = api("/api/tasks", "POST", {"title":"已有的关联任务", "category_ids":[existing["id"]]})
            profile.mkdir()
            (profile / "session.json").write_text(json.dumps({"server":base, "token":token, "user":user}))
            native, ui = start_native()
            assert ui.call("windows")["windows"][0]["kind"] == "content"
            passed("独立账户、SQLite 与原生 Content 窗口启动，无 WebView")

            offline.set()
            ui.press("treeItem", "管理分类")
            ui.press("button", "编辑分类 已有分类")
            ui.fill("分类名称", "离线重命名")
            ui.press("button", "保存分类")
            ui.ready()
            assert any(c["name"] == "离线重命名" for c in categories())
            new_category("离线项目")
            local = next(c for c in categories() if c["name"] == "离线项目")
            assert local["id"] < 0
            new_task("使用新分类的离线任务", ["离线项目"])
            assert cache()["outbox"][0]["local"]["categories"][0]["id"] == local["id"]
            ui.press("treeItem", "管理分类")
            ui.press("button", "编辑分类 离线项目")
            ui.fill("分类名称", "离线项目新名称")
            ui.press("radio", "分类紫色")
            ui.press("button", "保存分类")
            ui.ready()
            assert len([o for o in pending() if o["category_id"] == local["id"]]) == 1
            assert next(o for o in pending() if o["category_id"] == local["id"])["local"]["color"] == "#9333ea"
            ui.capture(artifacts / "native-categories-offline.png")
            passed("断网创建与编辑分类，本机立即生效，新分类可用于离线任务")

            ui.press("treeItem", "同步")
            ui.node("text", "等待分类同步")
            ui.capture(artifacts / "native-categories-offline-sync.png")
            ui.press("treeItem", "设置")
            ui.choose("外观", "深色")
            ui.press("treeItem", "同步")
            ui.capture(artifacts / "native-categories-offline-sync-dark.png")
            ui.press("treeItem", "设置")
            ui.press("button", "退出登录")
            ui.node("text", "还有未同步的修改，请先在同步页面提交或处理后再退出登录")
            ids = [o["id"] for o in pending()]
            stop_native()
            native, ui = start_native()
            assert [o["id"] for o in pending()] == ids
            ui.press("treeItem", "管理分类")
            ui.node("button", "编辑分类 离线项目新名称")
            ui.node("button", "编辑分类 离线重命名")
            ui.press("treeItem", "全部任务")
            ui.press("button", "使用新分类的离线任务")
            ui.press("button","编辑分类")
            assert "checked" in ui.node("button", "离线项目新名称").get("states", [])
            ui.press("button","收起分类")
            ui.press("button", "关闭")
            passed("离线重启恢复分类队列、任务关联与操作编号，未同步时阻止退出登录")

            # Drop the response only after the backend has committed the create.
            ui.press("treeItem", "同步")
            drop.set()
            offline.clear()
            ui.press("button", "立即同步")
            ui.ready()
            wait_for(lambda:any(c["name"]=="离线项目新名称" for c in api("/api/categories")), "后端未执行待确认创建")
            sent = next(o for o in pending() if o["category_id"] == local["id"])
            assert sent["sent"] and sent["state"] == "pending"
            original_id = sent["id"]
            offline.set()
            stop_native()
            native, ui = start_native()
            assert next(o for o in pending() if o["category_id"] == local["id"])["id"] == original_id
            offline.clear()
            ui.press("button", "刷新")
            ui.ready()
            wait_for(lambda:not pending() and not cache().get("outbox"), "编号映射或任务同步未完成", timeout=45)
            server_categories = api("/api/categories")
            matching = [c for c in server_categories if c["name"] == "离线项目新名称"]
            assert len(matching) == 1
            remote = matching[0]
            assert next(c for c in server_categories if c["id"]==existing["id"])["name"] == "离线重命名"
            task = next(t for t in api("/api/tasks") if t["title"] == "使用新分类的离线任务")
            assert [c["id"] for c in task["categories"]] == [remote["id"]]
            retries = [r for r in requests if r[1]=="/api/categories/sync" and r[3]==original_id]
            assert len(retries) == 2 and retries[0][2] == retries[1][2]
            assert cache()["category_aliases"][str(local["id"])] == remote["id"]
            passed("创建响应丢失后跨重启使用相同操作重放，仅创建一个分类并映射关联任务")

            offline.set()
            new_task("删除分类后仍保留的任务", ["离线重命名"])
            ui.press("treeItem", "管理分类")
            ui.press("menuButton", "更多分类操作 离线重命名")
            ui.press("menuItem", "删除分类")
            ui.press("button", "保留")
            assert any(c["id"]==existing["id"] for c in categories())
            ui.press("menuButton", "更多分类操作 离线重命名")
            ui.press("menuItem", "删除分类")
            ui.press("button", "确认删除")
            ui.ready()
            assert not any(c["id"]==existing["id"] for c in categories())
            ui.press("treeItem", "同步")
            ui.capture(artifacts / "native-categories-pending-delete.png")
            start_index = len(requests)
            offline.clear()
            ui.press("button", "立即同步")
            ui.ready()
            wait_for(lambda:not pending() and not cache().get("outbox"), "分类删除未完成")
            assert all(c["id"] != existing["id"] for c in api("/api/categories"))
            assert api(f"/api/tasks/{fixture['id']}").get("categories", []) == []
            retained = next(t for t in api("/api/tasks") if t["title"] == "删除分类后仍保留的任务")
            assert retained.get("categories", []) == []
            log = requests[start_index:]
            task_index = next(i for i,r in enumerate(log) if r[0]=="POST" and r[1]=="/api/tasks")
            delete_index = next(i for i,r in enumerate(log) if r[1]=="/api/categories/sync" and r[2]["method"]=="DELETE")
            assert task_index < delete_index
            passed("离线删除确认可取消；关联任务先同步再删除分类，现有任务均保留")

            offline.set()
            new_category("放弃的本机分类")
            new_task("放弃分类后保留任务", ["放弃的本机分类", "离线项目新名称"])
            ui.press("treeItem", "同步")
            ui.press("button", "放弃分类修改 放弃的本机分类")
            ui.capture(artifacts / "native-categories-discard-confirm.png")
            ui.press("button", "保留分类修改")
            assert pending()
            ui.press("button", "放弃分类修改 放弃的本机分类")
            ui.press("button", "确认放弃分类修改")
            ui.ready()
            assert not pending() and len(cache()["outbox"]) == 1
            body = cache()["outbox"][0]["body"]
            assert body["category_ids"] == [remote["id"]]
            passed("放弃本机分类需要确认，仅解除临时分类关联，任务和其他分类保留")

            new_category("跨设备同名")
            new_task("等待重命名分类的任务", ["跨设备同名"])
            api("/api/categories", "POST", {"name":"跨设备同名", "emoji":"📁", "color":"#3788d8"})
            ui.press("treeItem", "同步")
            offline.clear()
            ui.press("button", "立即同步")
            ui.ready()
            wait_for(lambda:pending() and pending()[0]["state"]=="rejected", "分类拒绝状态未保留")
            assert len(cache()["outbox"]) == 1
            assert any(t["title"]=="放弃分类后保留任务" for t in api("/api/tasks"))
            ui.capture(artifacts / "native-categories-rejected.png")
            ui.press("treeItem", "管理分类")
            # Both devices now have the same display name; address the pending
            # card via its temporary identity by editing its first button.
            buttons = [n for n in ui.nodes() if n.get("role")=="button" and n.get("label")=="编辑分类 跨设备同名"]
            assert len(buttons) == 2
            ui.call("act", id=buttons[-1]["id"], action="press")
            ui.fill("分类名称", "冲突后修正名称")
            ui.press("button", "保存分类")
            ui.ready()
            wait_for(lambda:not pending() and not cache().get("outbox"), "修正分类后依赖任务未同步", timeout=45)
            corrected = next(c for c in api("/api/categories") if c["name"]=="冲突后修正名称")
            linked = next(t for t in api("/api/tasks") if t["title"]=="等待重命名分类的任务")
            assert [c["id"] for c in linked["categories"]] == [corrected["id"]]
            passed("跨设备同名拒绝保留依赖任务，独立任务照常同步，修正后自动继续")

            offline.set()
            ui.press("treeItem", "管理分类")
            ui.press("button", "新建分类")
            ui.fill("分类名称", "写入失败不能采用")
            cached, backup = profile / "cache.json", profile / "cache-backup.json"
            cached.rename(backup)
            cached.mkdir()
            try:
                ui.press("button", "保存分类")
                ui.ready()
                assert ui.node("textField", "分类名称")["value"] == "写入失败不能采用"
                assert any("无法保存本地分类" in n.get("label", "") for n in ui.nodes())
            finally:
                cached.rmdir()
                backup.rename(cached)
            assert not pending()
            ui.press("button", "取消分类编辑")
            passed("本地存储失败时保留编辑器草稿，不采用未落盘分类")
            print(f"Native offline category smoke: {count}/{count} PASS", flush=True)
        except Exception:
            try:
                ui.capture(artifacts / "category-offline-smoke-failure.png")
                (artifacts / "category-offline-smoke-failure-tree.json").write_text(json.dumps(ui.nodes(), ensure_ascii=False, indent=2))
            except Exception:
                pass
            native_log.flush()
            print((work / "native.log").read_text(errors="replace")[-2000:])
            raise
        finally:
            stop_native()
            if server and server.poll() is None:
                server.terminate()
                server.wait(timeout=8)
            proxy.shutdown()
            proxy.server_close()
            server_log.close()
            native_log.close()


if __name__ == "__main__":
    if sys.platform == "darwin":
        state = subprocess.check_output(["ioreg", "-n", "Root", "-d1"], text=True)
        if '"CGSSessionScreenIsLocked"=Yes' in state:
            raise SystemExit("macOS 当前已锁屏，请解锁后重跑 make category-offline-smoke；测试尚未开始。")
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--server", type=Path, default=ROOT.parent / "bin/todo-app")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts")
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    smoke(args.app.resolve(), args.server.resolve(), args.artifacts)
