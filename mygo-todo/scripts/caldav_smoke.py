#!/usr/bin/env python3
"""Real Native UI -> real Todo API/SQLite/encryption -> disposable DAV fixture.

The backend is built with a temporary Go overlay that swaps only the CalDAV
outbound transport for a single test hostname. No source tree file or production
network policy is changed. Dummy accounts, ports and profiles are isolated.
"""
import argparse
import base64
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
import urllib.parse
import urllib.request
import uuid
from zoneinfo import ZoneInfo

from smoke import Native, ROOT, wait_for


class CaldavNative(Native):
    def ready(self):
        self.call("idle", timeout=3000)
        controls = {"刷新", "取消来源编辑", "保留来源"}
        wait_for(lambda:any(n.get("role") == "button" and n.get("label") in controls and "disabled" not in n.get("states", []) for n in self.nodes()), "原生 CalDAV 网络操作尚未完成")

    def show(self, role, label):
        self.call("act", id=self.node(role, label)["id"], action="scrollIntoView")
        self.call("idle", timeout=3000)

    def fill(self, label, text):
        self.show("textField", label)
        super().fill(label, text)


class DAV(BaseHTTPRequestHandler):
    version = 1
    failing = False
    requests = []
    password = "fixture-application-password"

    def log_message(self, *_):
        pass

    def respond(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/xml; charset=utf-8")
        self.end_headers()
        self.wfile.write(data.encode())

    def check(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        DAV.requests.append((self.command, self.path))
        expected = "Basic " + base64.b64encode(("dav-user:" + DAV.password).encode()).decode()
        if DAV.failing or self.headers.get("Authorization") != expected:
            self.respond(401, "<error>fixture authentication failed</error>")
            return None
        return body

    def do_PROPFIND(self):
        if self.check() is None:
            return
        paths = [("work", "工作日历"), ("private", "个人日历")]
        if self.path.rstrip("/").endswith("work"):
            paths = paths[:1]
        responses = "".join(f"""<d:response><d:href>/dav/{slug}/</d:href><d:propstat><d:prop>
          <d:displayname>{name}</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype>
          <cs:getctag>fixture-{DAV.version}</cs:getctag><cs:calendar-color>#3788d8</cs:calendar-color>
          </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>""" for slug, name in paths)
        self.respond(207, f'<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">{responses}</d:multistatus>')

    def do_REPORT(self):
        body = self.check()
        if body is None:
            return
        if b"sync-collection" in body:
            self.respond(403, "<error>use full fixture query</error>")
            return
        title = "CalDAV 原生集成会议" if DAV.version == 1 else "CalDAV 手动同步后的会议"
        begin = datetime.now(ZoneInfo("Asia/Shanghai")).replace(hour=10, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
        ics = "\r\n".join([
            "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Native DAV Fixture//EN", "BEGIN:VEVENT",
            "UID:native-caldav-meeting", "DTSTAMP:" + begin.strftime("%Y%m%dT%H%M%SZ"),
            "DTSTART:" + begin.strftime("%Y%m%dT%H%M%SZ"),
            "DTEND:" + (begin + timedelta(hours=1)).strftime("%Y%m%dT%H%M%SZ"),
            "SUMMARY:" + title, "DESCRIPTION:来自独立 DAV 测试服务器的会议", "LOCATION:原生测试会议室",
            "ORGANIZER:mailto:calendar@example.test", "STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR", "",
        ])
        self.respond(207, f"""<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
          <d:response><d:href>/dav/work/meeting.ics</d:href><d:propstat><d:prop>
          <d:getetag>"v{DAV.version}"</d:getetag><c:calendar-data><![CDATA[{ics}]]></c:calendar-data>
          </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>""")


def build_backend(work, go):
    main = ROOT.parent / "cmd/server/main.go"
    source = main.read_text()
    assert source.count("service.NewCaldavService(") == 1
    replacement = work / "main.go"
    replacement.write_text(source.replace("service.NewCaldavService(", "service.NewNativeFixtureCaldavService("))
    overlay = work / "overlay.json"
    overlay.write_text(json.dumps({"Replace": {
        str(main): str(replacement),
        str(ROOT.parent / "internal/service/native_fixture.go"): str(ROOT / "scripts/caldav_transport.go.txt"),
    }}))
    binary = work / "todo-caldav-server"
    subprocess.run([go, "build", "-overlay", str(overlay), "-tags=native_caldav_fixture", "-o", str(binary), "./cmd/server"], cwd=ROOT.parent, env=dict(os.environ, CGO_ENABLED="1"), check=True)
    return binary


def smoke(app, artifacts, go):
    artifacts.mkdir(parents=True, exist_ok=True)
    DAV.version, DAV.failing, DAV.requests = 1, False, []
    checks = 0

    def passed(message):
        nonlocal checks
        checks += 1
        print("PASS: " + message, flush=True)

    with tempfile.TemporaryDirectory(prefix="todo-native-caldav-") as temporary:
        work = Path(temporary)
        backend = build_backend(work, go)
        dav = ThreadingHTTPServer(("127.0.0.1", 0), DAV)
        threading.Thread(target=dav.serve_forever, daemon=True).start()
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        config = work / "server.json"
        config.write_text(json.dumps({"server":{"host":"127.0.0.1","port":port}, "database":{"driver":"sqlite","dsn":str(work / "test.db")}, "jwt":{"secret":uuid.uuid4().hex,"expire":"24h"}}))
        env = dict(os.environ, TODO_NATIVE_QA="1", TODO_API_URL=base, TODO_NATIVE_DATA_DIR=str(work / "profile"), MYGO_AUTOMATION=str(work / "native.sock"), TODO_NATIVE_DAV_FIXTURE_URL=f"http://127.0.0.1:{dav.server_port}")
        token = ""

        def api(path, method="GET", data=None):
            request = urllib.request.Request(base + path, method=method, data=None if data is None else json.dumps(data).encode(), headers={"Content-Type":"application/json", "Authorization":"Bearer " + token})
            with urllib.request.urlopen(request, timeout=5) as response:
                body = response.read()
                return json.loads(body) if body else None

        def healthy():
            try:
                return api("/health")["status"] == "ok"
            except OSError:
                return False

        server = native = None
        with open(work / "native.log", "wb") as native_log, open(work / "server.log", "wb") as server_log:
            try:
                server = subprocess.Popen([str(backend), "-config", str(config)], cwd=work, env=env, stdout=server_log, stderr=subprocess.STDOUT)
                wait_for(healthy, "CalDAV 隔离后端未启动")
                native = subprocess.Popen([str(app)], cwd=work, env=env, stdout=native_log, stderr=subprocess.STDOUT)
                wait_for(lambda:(work / "native.sock").exists(), "原生 CalDAV 测试接口未启动")
                ui = CaldavNative(work / "native.sock")
                wait_for(lambda:ui.call("windows")["windows"], "原生窗口未创建")
                assert ui.call("windows")["windows"][0]["kind"] == "content"
                username, password = "dav_" + uuid.uuid4().hex[:10], uuid.uuid4().hex
                ui.press("button", "创建账户")
                ui.fill("用户名", username)
                ui.fill("邮箱", username + "@example.test")
                ui.fill("密码", password)
                ui.press("button", "注册并登录")
                ui.ready()
                token = api("/api/auth/login", "POST", {"username":username,"password":password})["token"]
                api("/api/auth/profile", "PATCH", {"timezone":"Asia/Shanghai"})
                ui.press("button", "刷新")
                ui.ready()
                ui.press("treeItem", "设置")
                ui.press("button", "打开CalDAV 与订阅")
                ui.ready()
                ui.node("button", "显示订阅地址")
                ui.capture(artifacts / "native-lobe-caldav-empty.png")
                passed("原生 CalDAV 页面读取真实后端来源与订阅信息")

                ui.press("button", "添加 CalDAV 来源")
                ui.fill("来源名称", "原生集成来源")
                ui.fill("CalDAV 地址", "https://calendar.example.test/dav/")
                ui.fill("CalDAV 用户名", "dav-user")
                ui.fill("CalDAV 密码", "wrong")
                ui.press("button", "发现日历")
                wait_for(lambda:any("fixture authentication failed" in n.get("label", "") for n in ui.nodes()), "发现失败没有显示错误")
                ui.fill("CalDAV 密码", DAV.password)
                ui.press("button", "发现日历")
                ui.node("checkBox", "选择日历 工作日历")
                ui.ready()
                ui.press("button", "清空选择")
                ui.press("button", "保存来源")
                ui.node("text", "请至少选择一个日历")
                assert api("/api/caldav/sources") == []
                ui.press("button", "发现日历")
                ui.ready()
                assert all("checked" not in ui.node("checkBox", "选择日历 " + name).get("states", []) for name in ("工作日历", "个人日历"))
                ui.press("button", "全选日历")
                assert all("checked" in ui.node("checkBox", "选择日历 " + name).get("states", []) for name in ("工作日历", "个人日历"))
                passed("原生全选与清空日历，空选择禁止保存，重新发现保留显式清空")
                ui.fill("CalDAV 地址", "https://calendar.example.test/dav/work/")
                ui.node("text", "连接已更改，请重新发现日历")
                ui.press("button", "保存来源")
                ui.node("text", "连接地址或用户名已更改，请重新发现日历后保存")
                assert api("/api/caldav/sources") == []
                ui.fill("CalDAV 地址", "https://calendar.example.test/dav/")
                assert not ui.find("text", "连接地址或用户名已更改，请重新发现日历后保存")
                passed("修改连接显示旧列表提示，校验阻止将旧发现结果写入新地址")
                ui.press("checkBox", "选择日历 个人日历")
                assert "checked" in ui.node("checkBox", "选择日历 工作日历").get("states", [])
                assert "checked" not in ui.node("checkBox", "选择日历 个人日历").get("states", [])
                ui.show("textField", "来源名称")
                ui.capture(artifacts / "native-caldav-editor.png")
                ui.capture(artifacts / "native-lobe-caldav-editor.png")
                ui.show("checkBox", "选择日历 工作日历")
                ui.show("checkBox", "选择日历 个人日历")
                ui.capture(artifacts / "native-lobe-caldav-selection.png")
                passed("真实 PROPFIND 发现、认证失败后保留草稿、原生多日历选择")

                ui.press("button", "保存来源")
                ui.ready()
                source = wait_for(lambda:next(iter(api("/api/caldav/sources")), None), "来源未保存")
                sid = source["id"]
                wait_for(lambda:api("/api/caldav/sources")[0].get("last_sync_at"), "后台首次同步未完成")
                external = wait_for(lambda:api("/api/caldav/tasks"), "REPORT 同步没有写入日程缓存")
                assert external[0]["title"] == "CalDAV 原生集成会议", external
                assert len(source["calendars"]) == 1 and "password" not in json.dumps(source).lower()
                assert not any(path.endswith("/private/") for method, path in DAV.requests if method == "REPORT")
                passed("真实来源创建、密码加密保存、REPORT 导入所选日历")

                date_key = datetime.now(ZoneInfo("Asia/Shanghai")).strftime("%Y-%m-%d")
                ui.press("treeItem", "日历")
                ui.ready()
                ui.press("button", f"日程 {date_key} CalDAV 原生集成会议")
                ui.node("button", "关闭日程")
                assert any("地点：原生测试会议室" in n.get("label", "") for n in ui.nodes())
                assert not ui.find("button", "保存任务")
                ui.capture(artifacts / "native-caldav-event.png")
                ui.press("button", "关闭日程")
                passed("实际同步的外部日程进入原生日历，只读详情显示会议地点")

                ui.press("treeItem", "设置")
                ui.press("button", "打开CalDAV 与订阅")
                ui.ready()
                ui.press("button", "编辑来源 原生集成来源")
                assert not ui.node("textField", "CalDAV 密码").get("value")
                ui.press("button", "发现日历")
                ui.node("checkBox", "选择日历 工作日历")
                ui.fill("来源名称", "编辑后的来源")
                ui.press("checkBox", "启用此来源")
                ui.press("button", "保存来源")
                ui.ready()
                edited = api("/api/caldav/sources")[0]
                assert edited["is_active"] is False and edited["name"] == "编辑后的来源", edited
                assert not api("/api/caldav/tasks")
                ui.press("treeItem", "日历")
                ui.ready()
                assert not ui.find("button", f"日程 {date_key} CalDAV 原生集成会议")
                passed("编辑保留服务器密码，空密码重新发现成功；暂停来源清除原生日历旧事件")

                ui.press("treeItem", "设置")
                ui.press("button", "打开CalDAV 与订阅")
                ui.ready()
                ui.press("button", "编辑来源 编辑后的来源")
                ui.press("checkBox", "启用此来源")
                ui.press("button", "保存来源")
                ui.ready()
                wait_for(lambda:api("/api/caldav/tasks"), "重新启用来源没有恢复事件")
                DAV.version = 2
                ui.press("button", "同步来源 编辑后的来源")
                wait_for(lambda:any(t["title"] == "CalDAV 手动同步后的会议" for t in api("/api/caldav/tasks")), "手动同步没有读取 DAV 更新")
                ui.ready()
                ui.press("button", "刷新")
                ui.ready()
                ui.capture(artifacts / "native-caldav.png")
                ui.show("button", "添加 CalDAV 来源")
                ui.capture(artifacts / "native-lobe-caldav-sources.png")
                ui.press("treeItem", "设置")
                ui.choose("外观", "深色")
                ui.press("button", "打开CalDAV 与订阅")
                ui.ready()
                ui.capture(artifacts / "native-lobe-caldav-sources-dark.png")
                ui.press("treeItem", "设置")
                ui.choose("外观", "浅色")
                ui.press("button", "打开CalDAV 与订阅")
                ui.ready()
                passed("Lobe 原生来源概览、启用状态与同步信息适配明暗主题")
                passed("重新启用来源、原生手动同步真实 DAV 更新并显示服务端同步时间")

                DAV.failing = True
                ui.press("button", "同步来源 编辑后的来源")
                wait_for(lambda:api("/api/caldav/sources")[0]["last_error"], "同步失败没有回报来源错误")
                ui.ready()
                ui.press("button", "刷新")
                ui.ready()
                wait_for(lambda:any("同步错误：" in n.get("label", "") for n in ui.nodes()), "原生界面未显示异步同步错误")
                ui.capture(artifacts / "native-caldav-error.png")
                ui.capture(artifacts / "native-lobe-caldav-error.png")
                DAV.failing = False
                ui.press("button", "同步来源 编辑后的来源")
                wait_for(lambda:not api("/api/caldav/sources")[0]["last_error"], "认证恢复后重试未成功")
                ui.ready()
                ui.press("button", "刷新")
                ui.ready()
                passed("异步同步错误可见，恢复认证后可以重试成功")

                ui.press("button", "显示订阅地址")
                ui.press("button", "复制ICS 订阅地址")
                wait_for(lambda:any("已复制ICS 订阅地址" in n.get("label", "") for n in ui.nodes()), "复制没有成功反馈")
                sub = api("/api/calendar/subscription")
                ui.node("text", "已复制")
                ui.show("button", "导出 ICS 文件")
                ui.capture(artifacts / "native-lobe-caldav-subscription.png")
                ui.press("button", "显示连接信息")
                for label in ("Webcal 地址", "CalDAV 日历地址", "CalDAV 服务地址", "CalDAV 主体地址", "CalDAV 日历目录", "订阅用户名"):
                    ui.press("button", "复制" + label)
                    ui.node("text", "已复制" + label + "。")
                    ui.node("text", "已复制")
                ui.capture(artifacts / "native-lobe-caldav-connection.png")
                passed("原生订阅分组逐项复制，长地址旁显示即时反馈")
                api("/api/tasks", "POST", {"title":"原生ICS导出验证", "start_time":datetime.now(timezone.utc).replace(microsecond=0).isoformat()})
                with urllib.request.urlopen(sub["ics_url"]) as feed:
                    content = feed.read().decode()
                assert "BEGIN:VCALENDAR" in content and "原生ICS导出验证" in content
                passed("原生订阅地址复制反馈与真实 ICS 订阅文件内容验证")

                ui.press("menuButton", "更多来源操作 编辑后的来源")
                ui.press("menuItem", "删除来源 编辑后的来源")
                ui.press("button", "保留来源")
                assert len(api("/api/caldav/sources")) == 1
                ui.press("menuButton", "更多来源操作 编辑后的来源")
                ui.press("menuItem", "删除来源 编辑后的来源")
                ui.press("button", "确认删除来源")
                ui.ready()
                assert not api("/api/caldav/sources") and not api("/api/caldav/tasks")
                assert all(method != "DELETE" for method, _ in DAV.requests)
                ui.press("treeItem", "日历")
                ui.ready()
                assert not ui.find("button", f"日程 {date_key} CalDAV 手动同步后的会议")
                passed("原生删除确认与取消，删除来源后不再显示事件，外部日历未收到删除请求")
                for path in (work / "profile").glob("*.json"):
                    assert DAV.password not in path.read_text(), "CalDAV 密码不应落到原生 profile"
                print(f"Native CalDAV smoke: {checks}/{checks} PASS", flush=True)
            except Exception:
                try:
                    ui.capture(artifacts / "caldav-failure.png")
                    (artifacts / "caldav-failure-tree.json").write_text(json.dumps(ui.nodes(),ensure_ascii=False,indent=2))
                except Exception:
                    pass
                (artifacts / "caldav-server.log").write_bytes((work / "server.log").read_bytes())
                (artifacts / "caldav-native.log").write_bytes((work / "native.log").read_bytes())
                raise
            finally:
                for process in (native, server):
                    if process is not None and process.poll() is None:
                        process.terminate()
                        process.wait(timeout=10)
                dav.shutdown()
                dav.server_close()


if __name__ == "__main__":
    if sys.platform == "darwin":
        state = subprocess.check_output(["ioreg", "-n", "Root", "-d1"], text=True)
        if '"CGSSessionScreenIsLocked"=Yes' in state:
            raise SystemExit("macOS 当前已锁屏，请解锁后重跑 make caldav-smoke；测试尚未开始。")
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts")
    parser.add_argument("--go", default="go")
    args = parser.parse_args()
    smoke(args.app.resolve(), args.artifacts.resolve(), args.go)
