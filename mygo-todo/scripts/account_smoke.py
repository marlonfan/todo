#!/usr/bin/env python3
"""Native account/settings acceptance with disposable account, DB and profile."""
import argparse
import base64
import json
import os
from pathlib import Path
import socket
import struct
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import urllib.error
import urllib.request
import uuid
import zlib

from smoke import Native, ROOT, wait_for


class AccountNative(Native):
    def ready(self):
        self.call("idle", timeout=3000)
        def idle():
            nodes = self.nodes()
            candidates = [n for n in nodes if n.get("role") == "button" and n.get("label") in ("刷新", "保存账户时区", "保存默认提醒", "保存头像", "保存任务偏好", "确认修改密码", "保存分类", "保留")]
            return candidates and all("disabled" not in n.get("states", []) for n in candidates)
        wait_for(idle, "原生账户操作没有结束", timeout=40)

    def show(self, role, label):
        self.call("act", id=self.node(role, label)["id"], action="scrollIntoView")
        self.call("idle", timeout=3000)

    def preference(self, panel):
        field = "时区" if panel == "timezone" else "默认提前分钟数"
        if self.find("textField", field):
            return
        self.close_preference()
        self.press("button", "编辑账户时区" if panel == "timezone" else "编辑默认提醒")

    def close_preference(self):
        if self.find("button", "收起偏好编辑"):
            self.press("button", "收起偏好编辑")

    def choose(self, label, value):
        if label == "外观":
            self.close_preference()
            self.press("menuButton", label)
            self.press("menuItem", value)
        else:
            super().choose(label, value)

    def fill(self, label, text):
        self.show("textField", label)
        super().fill(label, text)


def fixture_png():
    def chunk(kind, data):
        return struct.pack("!I", len(data)) + kind + data + struct.pack("!I", zlib.crc32(kind + data))
    rows = b"".join(b"\0" + b"".join(bytes((40 + x * 3, 80 + y * 2, 160, 255)) for x in range(48)) for y in range(48))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack("!2I5B", 48, 48, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")


def smoke(app_binary, server_binary, artifacts):
    count = 0
    def passed(label):
        nonlocal count
        count += 1
        print("PASS: " + label, flush=True)
    with tempfile.TemporaryDirectory(prefix="todo-native-account-") as tmp:
        work = Path(tmp)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        server_url = f"http://127.0.0.1:{port}"
        config = work / "server.yaml"
        config.write_text(json.dumps({"server": {"host": "127.0.0.1", "port": port}, "database": {"driver": "sqlite", "dsn": str(work / "test.db")}, "jwt": {"secret": uuid.uuid4().hex, "expire": "24h"}}))
        server_log = open(work / "server.log", "wb")
        native_log = open(work / "native.log", "wb")
        server = None
        native = None
        token = ""
        requests = []
        png = fixture_png()
        class AvatarHandler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass
            def do_GET(self):
                requests.append(dict(self.headers))
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.end_headers()
                self.wfile.write(png)
        avatars = ThreadingHTTPServer(("127.0.0.1", 0), AvatarHandler)
        threading.Thread(target=avatars.serve_forever, daemon=True).start()
        def api(path, method="GET", payload=None):
            req = urllib.request.Request(server_url + path, data=None if payload is None else json.dumps(payload).encode(), method=method, headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = response.read()
                return json.loads(data) if data else None
        def healthy():
            try:
                return api("/health")["status"] == "ok"
            except OSError:
                return False
        def start_server():
            return subprocess.Popen([str(server_binary), "-config", str(config)], cwd=work, stdout=server_log, stderr=subprocess.STDOUT)
        env = dict(os.environ, TODO_NATIVE_QA="1", TODO_API_URL=server_url, TODO_NATIVE_DATA_DIR=str(work / "profile"), MYGO_AUTOMATION=str(work / "native.sock"))
        def start_native():
            sock = work / "native.sock"
            sock.unlink(missing_ok=True)
            process = subprocess.Popen([str(app_binary)], env=env, cwd=work, stdout=native_log, stderr=subprocess.STDOUT)
            wait_for(sock.exists, "原生应用未启动")
            ui = AccountNative(sock)
            wait_for(lambda: ui.call("windows")["windows"], "原生窗口尚未创建")
            return process, ui
        try:
            server = start_server()
            wait_for(healthy, "隔离后端未启动")
            native, ui = start_native()
            assert ui.call("windows")["windows"][0]["kind"] == "content"
            username = "account_" + uuid.uuid4().hex[:10]
            password = "old-" + uuid.uuid4().hex
            new_password = "new-" + uuid.uuid4().hex
            ui.press("button", "创建账户")
            ui.fill("用户名", username)
            ui.fill("邮箱", username + "@example.test")
            ui.fill("密码", password)
            ui.press("button", "注册并登录")
            ui.node("button", "＋ 新建任务")
            ui.ready()
            token = api("/api/auth/login", "POST", {"username": username, "password": password})["token"]
            ui.press("treeItem", "设置")
            ui.capture(artifacts / "native-lobe-settings-account.png")
            passed("隔离原生窗口注册并进入账户设置，无 WebView")

            ui.preference("timezone")
            ui.fill("时区", "Bad/Timezone")
            ui.node("text", "时区尚未保存")
            ui.press("button", "保存账户时区")
            ui.node("text", "请输入有效时区，例如 Asia/Shanghai")
            assert ui.node("textField", "时区")["value"] == "Bad/Timezone"
            ui.fill("时区", "Asia/Shanghai")
            ui.press("button", "保存账户时区")
            ui.ready()
            assert api("/api/auth/me")["timezone"] == "Asia/Shanghai"
            assert not ui.find("text", "时区尚未保存")
            passed("时区无效时保留输入，修正后同步至服务端与本机会话")

            previous = api("/api/auth/me")
            ui.fill("时区", "Europe/London")
            ui.preference("reminders")
            ui.fill("默认提前分钟数", "0")
            ui.press("button", "保存默认提醒")
            ui.node("text", "默认提前分钟数应为 1–10080 的整数")
            ui.fill("默认提前分钟数", "12")
            ui.fill("全天任务早间时间", "08:10")
            ui.node("text", "默认提醒尚未保存")
            ui.close_preference()
            ui.press("switch", "在本机发送任务提醒")
            assert api("/api/auth/me")["default_reminder_minutes"] == previous["default_reminder_minutes"]
            assert api("/api/auth/me")["timezone"] == "Asia/Shanghai"
            preferences = json.loads((work / "profile/preferences.json").read_text())
            assert preferences["local_reminders"] == ("checked" in ui.node("switch", "在本机发送任务提醒").get("states", []))
            ui.press("switch", "在本机发送任务提醒")
            passed("本机提醒即时保存，账户时区和默认提醒草稿不会被连带提交")
            ui.preference("reminders")
            ui.press("button", "保存默认提醒")
            ui.ready()
            user = api("/api/auth/me")
            assert user["default_reminder_minutes"] == 12 and user["default_morning_time"] == "08:10"
            assert user["timezone"] == "Asia/Shanghai"
            assert not ui.find("text", "默认提醒尚未保存")
            ui.show("button", "保存默认提醒")
            ui.capture(artifacts / "native-lobe-settings-reminders.png")
            ui.preference("timezone")
            assert ui.node("textField", "时区")["value"] == "Europe/London"
            ui.node("text", "时区尚未保存")
            ui.fill("时区", "Asia/Shanghai")
            ui.press("button", "保存账户时区")
            ui.ready()
            passed("默认提醒与时区独立保存，保存后更新已保存值并保留其他草稿")

            session = work / "profile/session.json"
            backup = work / "session-backup.json"
            session.rename(backup)
            session.mkdir()
            try:
                ui.preference("reminders")
                ui.fill("默认提前分钟数", "17")
                ui.press("button", "保存默认提醒")
                ui.ready()
                assert api("/api/auth/me")["default_reminder_minutes"] == 17
                assert ui.node("textField", "默认提前分钟数")["value"] == "17"
                assert not ui.find("text", "默认提醒尚未保存")
                assert any("服务器已保存设置，但本地会话写入失败" in n.get("label", "") for n in ui.nodes())
            finally:
                session.rmdir()
                backup.rename(session)
            ui.close_preference()
            ui.press("button", "刷新")
            ui.ready()
            assert json.loads(session.read_text())["user"]["default_reminder_minutes"] == 17
            passed("服务器保存成功、本机会话写入失败时采用已确认值，存储恢复后可刷新持久化")

            ui.press("button", "任务与日历偏好")
            ui.fill("默认任务开始时间", "25:00")
            ui.press("button", "保存任务偏好")
            assert ui.node("textField", "默认任务开始时间")["value"] == "25:00"
            ui.fill("默认任务开始时间", "08:35")
            ui.fill("午间快捷时间", "12:45")
            ui.fill("下午快捷时间", "16:10")
            ui.fill("晚间快捷时间", "21:20")
            ui.choose("默认日历视图", "周")
            ui.choose("时间步长（分钟）", "30")
            ui.capture(artifacts / "native-account-preferences.png")
            ui.press("button", "保存任务偏好")
            ui.ready()
            user = api("/api/auth/me")
            assert user["default_task_start_time"] == "08:35" and user["default_noon_time"] == "12:45" and user["default_time_granularity"] == 30 and user["calendar_default_view"] == "timeGridWeek"
            passed("原生任务与日历偏好校验、保存，读取真实账户值")
            ui.press("button", "任务与日历偏好")
            ui.capture(artifacts / "native-account-preferences.png")
            ui.press("button", "取消账户编辑")
            ui.show("text", "账户设置在客户端之间同步；本机偏好只影响当前设备。")
            ui.capture(artifacts / "native-lobe-settings-account.png")

            ui.press("treeItem", "今天")
            ui.press("button", "＋ 新建任务")
            ui.fill_task_title("账户默认时间验证")
            ui.press("button", "保存任务")
            ui.ready()
            task = next(t for t in api("/api/tasks") if t["title"] == "账户默认时间验证")
            assert "08:35:00+08:00" in task["start_time"], task
            # Saving keeps the selected task in the inline detail pane.
            ui.press("button", "编辑开始")
            ui.press("button", "编辑日期时间")
            ui.press("button", "开始时间午间")
            ui.press("button", "开始时间推迟一个步长")
            ui.press("button", "收起开始时间")
            ui.press("button", "保存任务")
            ui.ready()
            assert "13:15:00+08:00" in api(f"/api/tasks/{task['id']}")["start_time"]
            passed("新建使用 08:35，快捷午间加 30 分钟实际保存为 13:15")

            ui.press("treeItem", "设置")
            ui.choose("外观", "深色")
            assert json.loads((work / "profile/preferences.json").read_text())["theme"] == "dark"
            passed("原生外观切换写入独立桌面偏好")
            ui.show("menuButton", "外观")
            ui.capture(artifacts / "native-lobe-settings-desktop-dark.png")
            ui.choose("外观", "浅色")
            ui.press("button", "账户头像")
            ui.fill("头像地址", "javascript:alert(1)")
            ui.press("button", "保存头像")
            ui.ready()
            assert api("/api/auth/me")["avatar_url"] == ""
            assert ui.node("textField", "头像地址")["value"] == "javascript:alert(1)"
            ui.fill("头像地址", f"http://127.0.0.1:{avatars.server_port}/avatar.png")
            ui.press("button", "保存头像")
            ui.ready()
            wait_for(lambda: len(requests) >= 2, "头像未显示在原生账户区")
            assert all("Authorization" not in r and "Cookie" not in r for r in requests)
            assert api("/api/auth/me")["avatar_url"].endswith("/avatar.png")
            passed("头像地址校验、加载与保存，外部图片请求不携带账户凭据")
            ui.capture(artifacts / "native-account-settings.png")
            ui.press("button", "账户头像")
            ui.fill("头像地址", "data:image/png;base64," + base64.b64encode(png).decode())
            ui.press("button", "保存头像")
            ui.ready()
            assert api("/api/auth/me")["avatar_url"].startswith("data:image/png;base64,")
            passed("图片数据校验并转为 PNG，同步至账户以支持离线头像")

            ui.press("button", "修改密码")
            ui.fill("当前密码", password)
            ui.fill("新密码", new_password)
            ui.fill("确认新密码", "mismatch")
            ui.press("button", "确认修改密码")
            ui.node("text", "两次输入的新密码不一致")
            ui.fill("确认新密码", new_password)
            ui.fill("当前密码", "wrong-current")
            ui.press("button", "确认修改密码")
            ui.ready()
            ui.node("textField", "新密码")  # Password values are deliberately absent from automation.
            ui.capture(artifacts / "native-account-password.png")
            ui.fill("当前密码", password)
            ui.press("button", "确认修改密码")
            ui.ready()
            try:
                api("/api/auth/login", "POST", {"username": username, "password": password})
                raise AssertionError("旧密码仍可登录")
            except urllib.error.HTTPError as err:
                assert err.code == 401
            assert api("/api/auth/login", "POST", {"username": username, "password": new_password})["token"]
            ui.press("button", "修改密码")
            # Empty native password form rejects submission before any network call.
            ui.press("button", "确认修改密码")
            ui.node("text", "请输入当前密码")
            ui.press("button", "取消账户编辑")
            passed("密码不匹配与旧密码错误保留草稿，成功后清空，新旧密码真实登录验证")

            ui.press("button", "修改密码")
            ui.fill("当前密码", "cancel-only-secret")
            ui.press("button", "取消账户编辑")
            ui.press("button", "修改密码")
            ui.press("button", "确认修改密码")
            ui.node("text", "请输入当前密码")
            ui.press("button", "取消账户编辑")
            files = b"".join(p.read_bytes() for p in (work / "profile").rglob("*") if p.is_file())
            assert all(s.encode() not in files for s in (password, new_password, "cancel-only-secret", "wrong-current"))
            passed("取消清空密码输入，profile 和任务队列没有密码明文")

            ui.press("treeItem", "管理分类")
            ui.capture(artifacts / "native-lobe-categories-empty.png")
            ui.press("button", "新建分类")
            ui.press("button", "保存分类")
            ui.node("text", "分类名称应为 1–50 个字符")
            ui.fill("分类名称", "原生分类验证")
            ui.fill("颜色", "#zzzzzz")
            ui.press("button", "保存分类")
            ui.node("text", "分类颜色应为 #RRGGBB，例如 #3788d8")
            assert api("/api/categories") == []
            ui.press("radio", "分类紫色")
            assert ui.node("textField", "颜色")["value"] == "#9333ea"
            ui.fill("表情", "🧪")
            ui.show("textField", "分类名称")
            ui.capture(artifacts / "native-lobe-category-editor.png")
            ui.press("button", "保存分类")
            ui.ready()
            category = api("/api/categories")[0]
            assert category["name"] == "原生分类验证" and category["emoji"] == "🧪" and category["color"] == "#9333ea"
            passed("分类原生预览与调色板、名称/颜色校验，保存真实分类值")
            other = api("/api/categories", "POST", {"name":"保留分类", "emoji":"📁", "color":"#16a34a"})
            categorized = api("/api/tasks", "POST", {"title":"删除分类后保留的任务", "category_ids":[category["id"], other["id"]]})
            ui.press("button", "刷新")
            ui.ready()
            ui.capture(artifacts / "native-lobe-categories.png")
            ui.press("button", "编辑分类 原生分类验证")
            ui.fill("分类名称", "保留分类")
            ui.press("button", "保存分类")
            ui.ready()
            ui.node("text", "已有同名分类，请换一个名称")
            assert ui.node("textField", "分类名称")["value"] == "保留分类"
            ui.fill("分类名称", "重命名后的分类")
            ui.press("button", "保存分类")
            ui.ready()
            updated = api(f"/api/tasks/{categorized['id']}")
            assert next(c for c in updated["categories"] if c["id"] == category["id"])["name"] == "重命名后的分类"
            ui.press("button", "编辑分类 重命名后的分类")
            ui.fill("分类名称", "取消的修改")
            ui.press("button", "取消分类编辑")
            assert next(c for c in api("/api/categories") if c["id"] == category["id"])["name"] == "重命名后的分类"
            passed("分类重复名称失败后保留输入，修正后更新关联任务，取消不写入服务端")
            ui.press("treeItem", "设置")
            ui.choose("外观", "深色")
            ui.press("treeItem", "管理分类")
            ui.capture(artifacts / "native-lobe-categories-dark.png")
            ui.press("treeItem", "设置")
            ui.choose("外观", "浅色")
            ui.press("treeItem", "管理分类")
            passed("Lobe 分类卡片与操作适配明暗主题")
            ui.press("menuButton", "更多分类操作 重命名后的分类")
            ui.press("menuItem", "删除分类")
            ui.node("text", "分类中的任务会保留。")
            ui.press("button", "保留")
            assert len(api("/api/categories")) == 2
            ui.press("menuButton", "更多分类操作 重命名后的分类")
            ui.press("menuItem", "删除分类")
            ui.press("button", "确认删除")
            ui.ready()
            updated = api(f"/api/tasks/{categorized['id']}")
            assert len(updated["categories"]) == 1 and updated["categories"][0]["id"] == other["id"]
            assert updated["title"] == "删除分类后保留的任务"
            ui.press("treeItem", "全部任务")
            ui.node("button", "删除分类后保留的任务")
            passed("原生分类删除确认与取消，删除只移除关联，任务和其他分类保留")
            ui.press("treeItem", "设置")

            ui.choose("外观", "深色")
            ui.press("button", "任务与日历偏好")
            ui.fill("默认任务开始时间", "07:25")
            server.terminate()
            # Allow the server its full 5-second graceful shutdown plus process exit.
            server.wait(timeout=8)
            ui.press("button", "保存任务偏好")
            ui.ready()
            ui.node("text", "账户偏好待同步")
            cached = json.loads((work / "profile/cache.json").read_text())
            assert cached["profile_changes"]["values"]["default_task_start_time"] == "07:25"
            assert not cached.get("outbox")
            ui.press("button", "任务与日历偏好")
            assert ui.node("textField", "默认任务开始时间")["value"] == "07:25"
            ui.press("button", "取消账户编辑")
            passed("断网保存任务偏好至本机，显示待同步状态且不混入任务队列")
            ui.press("treeItem", "管理分类")
            ui.press("button", "新建分类")
            ui.fill("分类名称", "离线分类草稿")
            ui.press("button", "保存分类")
            ui.ready()
            cached = json.loads((work / "profile/cache.json").read_text())
            assert cached["category_outbox"][0]["local"]["name"] == "离线分类草稿"
            assert not cached.get("outbox")
            ui.press("button", "编辑分类 离线分类草稿")
            assert ui.node("textField", "分类名称")["value"] == "离线分类草稿"
            ui.press("button", "取消分类编辑")
            passed("断网分类保存到独立本机队列，重新打开恢复值，取消编辑保留已保存修改")
            native.terminate()
            native.wait(timeout=5)
            native, ui = start_native()
            ui.node("button", "＋ 新建任务")
            ui.press("treeItem", "设置")
            ui.ready()
            assert json.loads((work / "profile/preferences.json").read_text())["theme"] == "dark"
            ui.node("menuButton", "外观")
            ui.preference("timezone")
            assert ui.node("textField", "时区")["value"] == "Asia/Shanghai"
            ui.close_preference()
            assert json.loads((work / "profile/session.json").read_text())["user"]["avatar_url"].startswith("data:")
            ui.press("button", "任务与日历偏好")
            assert ui.node("popUpButton", "默认日历视图")["value"] == "周"
            assert ui.node("textField", "默认任务开始时间")["value"] == "07:25"
            ui.press("button", "取消账户编辑")
            passed("断网重启恢复深色、时区、头像与上次已保存偏好")
            server = start_server()
            wait_for(healthy, "隔离后端未恢复")
            ui.press("button", "刷新")
            ui.ready()
            assert api("/api/auth/me")["default_task_start_time"] == "07:25"
            assert not json.loads((work / "profile/cache.json").read_text()).get("profile_changes")
            assert not json.loads((work / "profile/cache.json").read_text()).get("category_outbox")
            assert any(c["name"] == "离线分类草稿" for c in api("/api/categories"))
            ui.press("button", "账户头像")
            ui.press("button", "移除头像")
            ui.ready()
            assert api("/api/auth/me")["avatar_url"] == ""
            passed("联网恢复后原生移除头像，服务端与本机一致")
            ui.press("button", "退出登录")
            ui.node("button", "登录")
            assert not (work / "profile/session.json").exists()
            ui.fill("用户名", username)
            ui.fill("密码", new_password)
            ui.press("button", "登录")
            ui.node("button", "＋ 新建任务")
            ui.ready()
            passed("原生退出清理会话，以新密码重新登录")
            print(f"Native account smoke: {count}/{count} PASS", flush=True)
        except Exception:
            native_log.flush()
            try:
                ui.capture(artifacts / "account-smoke-failure.png")
                (artifacts / "account-smoke-failure-tree.json").write_text(json.dumps(ui.nodes(), ensure_ascii=False, indent=2))
            except Exception:
                pass
            print((work / "native.log").read_text(errors="replace")[-3000:])
            raise
        finally:
            for process in (native, server):
                if process and process.poll() is None:
                    process.terminate()
                    process.wait(timeout=8)
            avatars.shutdown()
            avatars.server_close()
            native_log.close()
            server_log.close()


if __name__ == "__main__":
    if sys.platform == "darwin":
        state = subprocess.check_output(["ioreg", "-n", "Root", "-d1"], text=True)
        if '"CGSSessionScreenIsLocked"=Yes' in state:
            raise SystemExit("macOS 当前已锁屏，请解锁后重跑 make account-smoke；测试尚未开始。")
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--server", type=Path, default=ROOT.parent / "bin/todo-app")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts")
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    smoke(args.app.resolve(), args.server.resolve(), args.artifacts)
