#!/usr/bin/env python3
"""Native offline preferences with disposable DB/profile and controlled network failures."""
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

    with tempfile.TemporaryDirectory(prefix="todo-native-profile-offline-") as tmp:
        work = Path(tmp)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        upstream = f"http://127.0.0.1:{port}"
        offline, reject = threading.Event(), threading.Event()
        patches = []
        class Proxy(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass
            def forward(self):
                if offline.is_set():
                    self.connection.shutdown(socket.SHUT_RDWR)
                    self.connection.close()
                    return
                body = self.rfile.read(int(self.headers.get("Content-Length", "0"))) or None
                if self.command == "PATCH" and self.path == "/api/auth/profile":
                    patches.append(json.loads(body))
                    if reject.is_set():
                        body = b'{"error":"QA preference rejection"}'
                        self.send_response(400)
                        self.send_header("Content-Length", str(len(body)))
                        self.end_headers()
                        self.wfile.write(body)
                        return
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
            return cache().get("profile_changes")
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
            username, password = "offline_" + uuid.uuid4().hex[:10], uuid.uuid4().hex
            api("/api/auth/register", "POST", {"username":username, "email":username+"@example.test", "password":password})
            login = api("/api/auth/login", "POST", {"username":username, "password":password})
            token = login["token"]
            user = api("/api/auth/profile", "PATCH", {"timezone":"UTC", "default_reminder_enabled":True, "default_reminder_minutes":5, "default_morning_time":"09:00", "calendar_default_view":"dayGridMonth", "default_task_start_time":"09:00", "default_noon_time":"12:00", "default_time_granularity":15})
            profile.mkdir()
            (profile / "session.json").write_text(json.dumps({"server":base, "token":token, "user":user}))
            native, ui = start_native()
            assert ui.call("windows")["windows"][0]["kind"] == "content"
            wait_for(lambda: (profile / "cache.json").exists(), "初始缓存未写入")
            passed("独立后端、账户和原生 Content 窗口启动")

            offline.set()
            ui.press("treeItem", "设置")
            ui.preference("timezone")
            ui.fill("时区", "America/New_York")
            ui.press("button", "保存账户时区")
            ui.ready()
            assert pending()["values"]["timezone"] == "America/New_York"
            ui.close_preference()
            ui.node("text", "账户偏好待同步")
            ui.preference("reminders")
            ui.fill("默认提前分钟数", "17")
            ui.press("switch", "账户默认开启提前提醒")
            ui.fill("全天任务早间时间", "08:10")
            ui.press("button", "保存默认提醒")
            ui.ready()
            ui.fill("默认提前分钟数", "23")
            ui.press("button", "保存默认提醒")
            ui.ready()
            assert pending()["values"]["default_reminder_minutes"] == 23
            assert pending()["values"]["default_reminder_enabled"] is False
            assert not ui.find("text", "默认提醒尚未保存")
            assert api("/api/auth/me")["default_reminder_minutes"] == 5
            passed("真实断连后保存时区和提醒，同字段合并为最新值并保留 false")
            ui.close_preference()

            ui.press("button", "任务与日历偏好")
            ui.fill("默认任务开始时间", "08:35")
            ui.choose("默认日历视图", "周")
            ui.choose("时间步长（分钟）", "30")
            ui.press("button", "保存任务偏好")
            ui.ready()
            values = pending()["values"]
            assert values["default_task_start_time"] == "08:35" and values["calendar_default_view"] == "timeGridWeek"
            assert "default_noon_time" not in values and "default_evening_time" not in values
            assert set(values) <= {"timezone", "default_reminder_enabled", "default_reminder_minutes", "default_morning_time", "default_task_start_time", "calendar_default_view", "default_time_granularity"}
            ui.show("text", "账户设置在客户端之间同步；本机偏好只影响当前设备。")
            ui.capture(artifacts / "native-profile-offline-settings.png")
            passed("任务偏好离线保存，仅将实际编辑的非敏感字段加入队列")

            ui.press("button", "退出登录")
            ui.node("text", "还有未同步的修改，请先在同步页面提交或处理后再退出登录")
            assert (profile / "session.json").exists()
            ui.press("button", "打开同步")
            ui.node("text", "1 条本地修改")
            assert not ui.find("text", "所有本地修改均已同步")
            ui.capture(artifacts / "native-profile-offline-sync.png")
            ui.press("treeItem", "设置")
            ui.choose("外观", "深色")
            ui.press("button", "打开同步")
            ui.capture(artifacts / "native-profile-offline-sync-dark.png")
            ui.press("treeItem", "设置")
            ui.choose("外观", "浅色")
            ui.press("button", "打开同步")
            ui.press("button", "放弃本机账户偏好")
            ui.capture(artifacts / "native-profile-discard-confirm.png")
            ui.press("button", "保留账户偏好")
            assert pending()
            passed("原生同步详情、退出保护与放弃确认取消均保留本机偏好")

            stop_native()
            native, ui = start_native()
            ui.press("treeItem", "设置")
            ui.preference("timezone")
            assert ui.node("textField", "时区")["value"] == "America/New_York"
            ui.preference("reminders")
            assert ui.node("textField", "默认提前分钟数")["value"] == "23"
            assert "checked" not in ui.node("switch", "账户默认开启提前提醒").get("states", [])
            ui.close_preference()
            ui.press("button", "任务与日历偏好")
            assert ui.node("textField", "默认任务开始时间")["value"] == "08:35"
            assert ui.node("popUpButton", "默认日历视图")["value"] == "周"
            ui.press("button", "取消账户编辑")
            ui.press("treeItem", "今天")
            ui.press("button", "＋ 新建任务")
            ui.fill_task_title("离线偏好默认时间")
            ui.press("button", "保存任务")
            ui.ready()
            task = cache()["outbox"][0]["local"]
            assert "08:35:00" in task["start_time"] and task["start_time"].endswith("-05:00"), task
            passed("断网重启恢复全部偏好，新任务实际使用账户时区和 08:35 默认时间")

            api("/api/auth/profile", "PATCH", {"default_noon_time":"14:20", "timezone":"Asia/Tokyo"})
            ui.press("treeItem", "设置")
            ui.press("button", "打开同步")
            offline.clear()
            wait_for(lambda: not pending() and not cache().get("outbox"), "联网后偏好和任务未自动同步", timeout=45)
            ui.ready()
            user = api("/api/auth/me")
            assert user["timezone"] == "America/New_York" and user["default_noon_time"] == "14:20" and user["default_reminder_minutes"] == 23 and user["default_reminder_enabled"] is False
            assert patches and all("default_noon_time" not in p for p in patches)
            server_task = next(t for t in api("/api/tasks") if t["title"] == "离线偏好默认时间")
            assert "08:35:00-05:00" in server_task["start_time"], server_task
            ui.node("text", "所有本地修改均已同步")
            ui.capture(artifacts / "native-profile-synced.png")
            passed("恢复联网自动提交任务和偏好，不覆盖其他设备修改的未编辑字段")

            ui.press("treeItem", "设置")
            ui.preference("reminders")
            ui.fill("默认提前分钟数", "31")
            api("/api/auth/profile", "PATCH", {"default_morning_time":"07:55"})
            ui.close_preference()
            ui.press("button", "刷新")
            ui.ready()
            ui.preference("reminders")
            assert ui.node("textField", "全天任务早间时间")["value"] == "08:10"
            ui.press("button", "保存默认提醒")
            ui.ready()
            assert api("/api/auth/me")["default_morning_time"] == "07:55"
            assert api("/api/auth/me")["default_reminder_minutes"] == 31
            ui.close_preference()
            ui.press("button", "任务与日历偏好")
            ui.fill("默认任务开始时间", "07:45")
            api("/api/auth/profile", "PATCH", {"default_noon_time":"16:15"})
            # The modal correctly hides background controls; keep its original
            # field values while the other client updates the server.
            assert ui.node("textField", "午间快捷时间")["value"] == "14:20"
            ui.press("button", "保存任务偏好")
            ui.ready()
            assert api("/api/auth/me")["default_noon_time"] == "16:15"
            assert api("/api/auth/me")["default_task_start_time"] == "07:45"
            passed("表单打开后刷新远端设置，保存只提交实际编辑字段，保留远端新值")

            reject.set()
            ui.press("treeItem", "设置")
            ui.preference("timezone")
            ui.fill("时区", "Europe/London")
            ui.press("button", "保存账户时区")
            ui.ready()
            wait_for(lambda: pending() and pending().get("rejected"), "偏好拒绝状态未保留")
            ui.close_preference()
            ui.press("button", "打开同步")
            ui.node("text", "需要处理")
            ui.capture(artifacts / "native-profile-rejected.png")
            reject.clear()
            ui.press("button", "重新同步账户偏好")
            ui.ready()
            wait_for(lambda: not pending(), "偏好重试未完成")
            assert api("/api/auth/me")["timezone"] == "Europe/London"
            passed("服务端拒绝保留偏好并显示处理状态，显式重试成功")

            offline.set()
            ui.press("treeItem", "设置")
            ui.preference("timezone")
            ui.fill("时区", "UTC")
            ui.press("button", "保存账户时区")
            ui.ready()
            ui.close_preference()
            ui.press("treeItem", "今天")
            ui.press("button", "＋ 新建任务")
            ui.fill_task_title("放弃偏好后仍保留的任务")
            ui.press("button", "保存任务")
            ui.ready()
            ui.press("treeItem", "设置")
            ui.press("button", "打开同步")
            ui.press("button", "放弃本机账户偏好")
            ui.press("button", "确认放弃账户偏好")
            ui.ready()
            assert not pending() and len(cache()["outbox"]) == 1
            ui.press("treeItem", "设置")
            ui.preference("timezone")
            assert ui.node("textField", "时区")["value"] == "Europe/London"
            assert api("/api/auth/me")["timezone"] == "Europe/London"
            passed("确认放弃只移除偏好队列，恢复原设置并保留独立任务修改")

            cached = profile / "cache.json"
            backup = profile / "cache-backup.json"
            cached.rename(backup)
            cached.mkdir()
            try:
                ui.fill("时区", "Asia/Shanghai")
                ui.press("button", "保存账户时区")
                ui.ready()
                assert ui.node("textField", "时区")["value"] == "Asia/Shanghai"
                ui.node("text", "时区尚未保存")
                assert any("无法保存账户偏好" in n.get("label", "") for n in ui.nodes())
            finally:
                cached.rmdir()
                backup.rename(cached)
            assert not pending()
            passed("本地写入失败保留未保存草稿，未采用也未提交失败值")
            print(f"Native offline profile smoke: {count}/{count} PASS", flush=True)
        except Exception:
            try:
                ui.capture(artifacts / "profile-offline-smoke-failure.png")
                (artifacts / "profile-offline-smoke-failure-tree.json").write_text(json.dumps(ui.nodes(), ensure_ascii=False, indent=2))
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
            raise SystemExit("macOS 当前已锁屏，请解锁后重跑 make profile-offline-smoke；测试尚未开始。")
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--server", type=Path, default=ROOT.parent / "bin/todo-app")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts")
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    smoke(args.app.resolve(), args.server.resolve(), args.artifacts)
