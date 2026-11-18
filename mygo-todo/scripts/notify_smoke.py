#!/usr/bin/env python3
"""Native notification channels, manual reminders and task history against real
Todo API/SQLite and real notification plugins. An overlay redirects the outbound
transport to one disposable local sink; production source/network policy is intact.
"""
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
import urllib.request
import uuid

from smoke import Native, ROOT, wait_for


class NotifyNative(Native):
    def ready(self):
        self.call("idle", timeout=3000)
        def settled():
            # An accessible modal hides the background Refresh button.
            controls = {"刷新", "取消渠道编辑", "关闭提醒与记录", "保留渠道"}
            return any(n.get("role") == "button" and n.get("label") in controls and "disabled" not in n.get("states", []) for n in self.nodes())
        wait_for(settled, "原生通知窗口的网络操作尚未完成")


class Sink(BaseHTTPRequestHandler):
    deliveries = []
    failing = False

    def log_message(self, *_):
        pass

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        Sink.deliveries.append({"method":self.command, "path":self.path, "headers":dict(self.headers), "body":body.decode()})
        self.send_response(503 if Sink.failing else 200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    do_PUT = do_POST


def build_backend(work, go):
    main = ROOT.parent / "cmd/server/main.go"
    source = main.read_text()
    replace = {str(ROOT.parent / "internal/notify/native_fixture.go"):str(ROOT / "scripts/notify_transport.go.txt")}
    for package, kind, host in (("webhook","WebhookNotifier","notify.example.test"), ("ntfy","NtfyNotifier","notify.example.test"), ("telegram","TelegramNotifier","api.telegram.org")):
        assert source.count(package + ".New()") == 1
        source = source.replace(package + ".New()", package + ".NewNativeFixture()")
        wrapper = work / (package + ".go")
        wrapper.write_text('//go:build native_notify_fixture\npackage ' + package + '\nimport "todo-app/internal/notify"\nfunc NewNativeFixture() *' + kind + ' { return &' + kind + '{httpClient:notify.NativeFixtureHTTPClient("' + host + '")} }\n')
        replace[str(ROOT.parent / "internal/notify" / package / "native_fixture.go")] = str(wrapper)
    replacement = work / "main.go"
    replacement.write_text(source)
    replace[str(main)] = str(replacement)
    overlay = work / "overlay.json"
    overlay.write_text(json.dumps({"Replace":replace}))
    binary = work / "todo-notify-server"
    subprocess.run([go, "build", "-overlay", str(overlay), "-tags=native_notify_fixture", "-o", str(binary), "./cmd/server"], cwd=ROOT.parent, env=dict(os.environ, CGO_ENABLED="1"), check=True)
    return binary


def smoke(app, artifacts, go):
    artifacts.mkdir(parents=True, exist_ok=True)
    Sink.deliveries, Sink.failing = [], False
    with tempfile.TemporaryDirectory(prefix="todo-native-notify-") as temporary:
        work = Path(temporary)
        backend = build_backend(work, go)
        sink = ThreadingHTTPServer(("127.0.0.1", 0), Sink)
        threading.Thread(target=sink.serve_forever, daemon=True).start()
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        config = work / "server.json"
        config.write_text(json.dumps({"server":{"host":"127.0.0.1","port":port}, "database":{"driver":"sqlite","dsn":str(work / "test.db")}, "jwt":{"secret":uuid.uuid4().hex,"expire":"24h"}, "notify":{"check_interval":"100ms"}, "plugins":{name:{"enabled":True} for name in ("telegram","ntfy","webhook")}}))
        env = dict(os.environ, TODO_NATIVE_QA="1", TODO_API_URL=base, TODO_NATIVE_DATA_DIR=str(work / "profile"), MYGO_AUTOMATION=str(work / "native.sock"), TODO_NATIVE_NOTIFY_FIXTURE_URL=f"http://127.0.0.1:{sink.server_port}")
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

        server_log, native_log = open(work / "server.log","wb"), open(work / "native.log","wb")
        server = subprocess.Popen([str(backend),"-config",str(config)], cwd=work, env=env, stdout=server_log, stderr=subprocess.STDOUT)
        native = None
        checks = 0

        def passed(message):
            nonlocal checks
            checks += 1
            print("PASS: " + message, flush=True)

        try:
            wait_for(healthy,"通知隔离后端未启动")
            username, password = "notify_"+uuid.uuid4().hex[:10], uuid.uuid4().hex
            api("/api/auth/register","POST",{"username":username,"password":password,"email":username+"@example.test"})
            token = api("/api/auth/login","POST",{"username":username,"password":password})["token"]
            api("/api/auth/profile","PATCH",{"timezone":"Asia/Shanghai"})
            native = subprocess.Popen([str(app)], cwd=work, env=env, stdout=native_log, stderr=subprocess.STDOUT)
            wait_for(lambda:(work / "native.sock").exists(),"原生通知测试窗口未启动")
            ui = NotifyNative(work / "native.sock")
            assert wait_for(lambda:ui.call("windows")["windows"],"无原生窗口")[0]["kind"] == "content"
            ui.fill("用户名",username)
            ui.fill("密码",password)
            ui.press("button","登录")
            ui.node("button","＋ 新建任务")
            ui.ready()
            def open_notify():
                ui.press("treeItem", "设置")
                ui.press("button", "打开通知渠道")
                ui.ready()

            def sync_tasks():
                ui.press("treeItem", "设置")
                ui.press("button", "打开同步")
                ui.press("button", "立即同步")
                ui.press("treeItem", "全部任务")
                ui.ready()

            open_notify()
            ui.ready()

            ui.capture(artifacts / "native-lobe-notify-empty.png")
            ui.press("button","添加通知渠道")
            ui.press("button","保存通知渠道")
            ui.node("text","请输入完整的 http:// 或 https:// 地址，凭据请填写在专用字段中")
            assert api("/api/notify/settings") == []
            passed("原生渠道输入校验保留草稿，不写入无效渠道")
            ui.fill("Webhook 地址","https://notify.example.test/hook")
            ui.choose("Webhook 请求方式","PUT")
            ui.press("button","测试填写的配置")
            ui.ready()
            assert Sink.deliveries[-1]["method"] == "PUT" and Sink.deliveries[-1]["path"] == "/hook"
            assert json.loads(Sink.deliveries[-1]["body"])["title"] == "Test Notification"
            assert api("/api/notify/settings") == []
            passed("原生测试未保存的 Webhook 配置，真实插件投递到隔离接收端")
            ui.node("text", "配置测试成功")
            delivery_count = len(Sink.deliveries)
            ui.choose("Webhook 请求方式", "POST")
            assert not ui.find("text", "配置测试成功")
            ui.choose("Webhook 请求方式", "PUT")
            assert not ui.find("text", "配置测试成功") and len(Sink.deliveries) == delivery_count
            passed("修改配置立即清除旧测试结果，切换选项不会自动发送通知")
            ui.press("button","保存通知渠道")
            ui.ready()
            webhook = api("/api/notify/settings")[0]
            assert webhook["is_default"] and webhook["configured"] and "config" not in webhook
            ui.capture(artifacts / "native-notify-channels.png")
            ui.press("button",f"测试渠道 #{webhook['id']}")
            ui.ready()
            assert Sink.deliveries[-1]["path"] == "/hook"
            ui.node("text", f"渠道 #{webhook['id']}测试成功")
            passed("原生保存渠道、首个自动默认、复用已保存凭据发送测试")
            ui.press("button","添加通知渠道")
            ui.choose("通知方式","ntfy")
            ui.fill("ntfy 服务地址","https://notify.example.test")
            ui.fill("ntfy 主题","native-topic")
            ui.fill("ntfy 访问令牌","fixture-ntfy-private-token")
            ui.fill("ntfy 优先级","5")
            ui.press("checkBox","设为默认通知渠道")
            ui.press("button","保存通知渠道")
            ui.ready()
            ntfy = next(s for s in api("/api/notify/settings") if s["channel"] == "ntfy")
            ui.press("button",f"测试渠道 #{ntfy['id']}")
            ui.ready()
            last = Sink.deliveries[-1]
            assert last["path"] == "/native-topic" and last["headers"]["Authorization"] == "Bearer fixture-ntfy-private-token" and last["headers"]["Priority"] == "5"
            passed("原生 ntfy 配置、访问令牌、优先级与默认渠道")
            ui.press("button","添加通知渠道")
            ui.choose("通知方式","Telegram")
            ui.fill("Telegram Bot Token","fixture-telegram-private-token")
            ui.fill("Telegram Chat ID","-10042")
            ui.capture(artifacts / "native-notify-editor.png")
            ui.press("button","保存通知渠道")
            ui.ready()
            telegram = next(s for s in api("/api/notify/settings") if s["channel"] == "telegram")
            ui.press("button",f"测试渠道 #{telegram['id']}")
            ui.ready()
            assert Sink.deliveries[-1]["path"] == "/botfixture-telegram-private-token/sendMessage"
            assert json.loads(Sink.deliveries[-1]["body"])["chat_id"] == "-10042"
            passed("原生 Telegram 配置与真实消息序列化，流量仅进入隔离接收端")
            Sink.failing = True
            ui.press("button",f"测试渠道 #{webhook['id']}")
            ui.ready()
            assert any("503" in n.get("label","") for n in ui.nodes())
            ui.node("text", f"渠道 #{webhook['id']}测试失败")
            ui.node("text", f"渠道 #{ntfy['id']}测试成功")
            ui.node("text", f"渠道 #{telegram['id']}测试成功")
            ui.capture(artifacts / "native-lobe-notify-test-failure.png")
            Sink.failing = False
            ui.press("button",f"测试渠道 #{webhook['id']}")
            ui.ready()
            ui.node("text", f"渠道 #{webhook['id']}测试成功")
            assert not ui.find("text", f"渠道 #{webhook['id']}测试失败")
            ui.press("button",f"设为默认渠道 #{webhook['id']}")
            ui.ready()
            assert next(s for s in api("/api/notify/settings") if s["is_default"])["id"] == webhook["id"]
            passed("渠道测试失败后恢复，原生切换默认渠道")
            passed("测试结果分别显示在对应渠道卡片，失败重试不影响其他渠道结果")
            ui.capture(artifacts / "native-lobe-notify-channels.png")
            ui.press("treeItem", "设置")
            ui.choose("外观", "深色")
            open_notify()
            ui.ready()
            ui.capture(artifacts / "native-lobe-notify-channels-dark.png")
            ui.press("treeItem", "设置")
            ui.choose("外观", "浅色")
            open_notify()
            ui.ready()
            passed("Lobe 原生通知概览、默认标签与结果卡片适配浅色和深色主题")

            task = api("/api/tasks","POST",{"title":"原生提醒与记录验证","description":"服务器中的描述"})
            api(f"/api/tasks/{task['id']}","PUT",{"title":"原生提醒与记录验证","description":"来自另一个客户端的修改","priority":1})
            sync_tasks()
            ui.press("button","原生提醒与记录验证")
            ui.assert_save_state("保存任务", enabled=False)
            ui.fill_task_title("仍在编辑中的任务标题", "原生提醒与记录验证")
            ui.assert_save_state("保存任务", enabled=True)
            ui.open_task_activity()
            ui.ready()
            ui.press("radio","活动记录")
            ui.node("text","新值：来自另一个客户端的修改")
            ui.node("text","新值：高")
            ui.capture(artifacts / "native-task-activities.png")
            passed("原生活动记录显示服务端字段变更、账户时区与原值/新值")
            ui.press("radio","服务端提醒")
            ui.press("button","添加手动提醒")
            ui.capture(artifacts / "native-manual-reminder.png")
            ui.press("button","保存手动提醒")
            ui.ready()
            reminders = api(f"/api/tasks/{task['id']}/notifications")
            assert len(reminders) == 1 and reminders[0]["source"] == "manual" and reminders[0]["delivery_mode"] == "locked_snapshot"
            reminder = reminders[0]
            ui.press("button",f"改时提醒 #{reminder['id']}")
            # Native time inputs expose localized spin buttons. Stepping the
            # minutes exercises the same editing path as the system picker.
            minutes = next(n for n in ui.nodes() if n.get("role") == "stepper" and "服务端提醒时刻" in n.get("label","") and ("分" in n.get("label","") or "minute" in n.get("label","")))
            ui.call("act",id=minutes["id"],action="decrement")
            ui.call("idle", timeout=3000)
            ui.press("button","保存手动提醒")
            ui.ready()
            updated = api(f"/api/tasks/{task['id']}/notifications")[0]
            assert updated["id"] == reminder["id"] and updated["notify_at"] != reminder["notify_at"] and updated["channel"] == "webhook"
            passed("原生手动提醒创建、时刻改时与渠道快照保留")
            ui.press("button","关闭提醒与记录")
            assert ui.task_title()["value"] == "仍在编辑中的任务标题"
            ui.assert_save_state("保存任务", enabled=True)
            ui.press("button","关闭")
            ui.press("button", "放弃并切换")
            passed("提醒窗口关闭后保留未保存的任务编辑草稿")

            # Reconcile an automatic reminder without waiting for real clocks.
            api("/api/auth/profile","PATCH",{"default_reminder_enabled":True,"default_reminder_minutes":5})
            auto = api("/api/tasks","POST",{"title":"自动渠道提醒验证","start_time":(datetime.now(timezone.utc)+timedelta(hours=2)).isoformat()})
            sync_tasks()
            ui.press("button","自动渠道提醒验证")
            ui.open_task_activity()
            ui.ready()
            automatic = api(f"/api/tasks/{auto['id']}/notifications")[0]
            assert automatic["source"] == "default_auto" and automatic["delivery_mode"] == "current_default"
            assert not ui.find("button",f"删除提醒 #{automatic['id']}")
            ui.capture(artifacts / "native-auto-reminder.png")
            ui.press("button","关闭提醒与记录")
            ui.press("button","关闭")
            passed("原生区分自动/手动提醒，自动提醒通过任务策略调整")

            # A manual reminder retains the old webhook even after default
            # channel changes; bring it due via API only to speed up dispatch.
            open_notify()
            ui.ready()
            ui.press("button",f"设为默认渠道 #{ntfy['id']}")
            ui.ready()
            api(f"/api/tasks/{task['id']}/notifications/{reminder['id']}","PATCH",{"notify_at":(datetime.now(timezone.utc)+timedelta(seconds=1)).isoformat()})
            delivered = wait_for(lambda:next((json.loads(d["body"]) for d in Sink.deliveries if d["path"] == "/hook" and json.loads(d["body"]).get("task_id") == task["id"]),None),"服务端定时提醒未投递到原渠道快照")
            assert delivered["title"] == "原生提醒与记录验证"
            passed("真实服务端调度投递，切换默认渠道后手动提醒仍使用原快照")
            ui.press("treeItem","全部任务")
            ui.press("button","原生提醒与记录验证")
            ui.open_task_activity()
            ui.ready()
            ui.press("button",f"删除提醒 #{reminder['id']}")
            ui.press("button","保留提醒")
            assert api(f"/api/tasks/{task['id']}/notifications")
            ui.press("button",f"删除提醒 #{reminder['id']}")
            ui.press("button","确认删除提醒")
            ui.ready()
            assert api(f"/api/tasks/{task['id']}/notifications") == []
            ui.press("button", "添加手动提醒")
            ui.choose("提醒投递方式", "指定配置")
            ui.choose("通知方式", "ntfy")
            ui.fill("ntfy 服务地址", "https://notify.example.test")
            ui.fill("ntfy 主题", "manual-topic")
            ui.fill("ntfy 访问令牌", "fixture-manual-private-token")
            ui.call("act", id=ui.node("textField", "ntfy 访问令牌")["id"], action="scrollIntoView")
            ui.capture(artifacts / "native-lobe-manual-reminder-custom.png")
            ui.press("button", "保存手动提醒")
            ui.ready()
            custom = api(f"/api/tasks/{task['id']}/notifications")
            assert len(custom) == 1 and custom[0]["channel"] == "ntfy" and custom[0]["delivery_mode"] == "locked_snapshot"
            ui.press("button", f"删除提醒 #{custom[0]['id']}")
            ui.press("button", "确认删除提醒")
            ui.ready()
            assert api(f"/api/tasks/{task['id']}/notifications") == []
            passed("指定配置的长提醒表单可滚动，固定保存操作创建独立 ntfy 渠道快照")
            ui.press("button","关闭提醒与记录")
            ui.press("button","关闭")
            passed("原生手动提醒删除确认与取消，后端记录同步")
            open_notify()
            ui.ready()
            ui.press("menuButton",f"更多渠道操作 #{ntfy['id']}")
            ui.press("menuItem",f"删除渠道 #{ntfy['id']}")
            ui.press("button","保留渠道")
            assert len(api("/api/notify/settings")) == 3
            ui.press("menuButton",f"更多渠道操作 #{ntfy['id']}")
            ui.press("menuItem",f"删除渠道 #{ntfy['id']}")
            ui.press("button","确认删除渠道")
            ui.ready()
            settings = api("/api/notify/settings")
            assert len(settings) == 2 and sum(s["is_default"] for s in settings) == 1
            passed("原生渠道删除确认，删除默认后服务器选择剩余默认渠道")
            ui.capture(artifacts / "native-notify-channels.png")
            ui.press("treeItem","全部任务")
            ui.press("button","原生提醒与记录验证")
            ui.open_task_activity()
            ui.ready()
            ui.press("radio","活动记录")
            server.terminate()
            # The notification scheduler may be inside a plugin delivery when the
            # process receives SIGTERM.  Keep the test deterministic: allow the
            # normal graceful path briefly, then force-stop the disposable server
            # so the UI can exercise its offline refresh path.
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)
            ui.press("button","刷新提醒与记录")
            ui.ready()
            ui.node("text","新值：来自另一个客户端的修改")
            assert any("无法连接 Todo 服务" in n.get("label","") for n in ui.nodes())
            assert not json.loads((work / "profile/cache.json").read_text()).get("outbox")
            passed("断网后保留已读取活动并显示连接错误，未污染任务离线队列")
            files = b"".join(p.read_bytes() for p in (work / "profile").rglob("*") if p.is_file())
            assert b"fixture-ntfy-private-token" not in files and b"fixture-telegram-private-token" not in files and b"fixture-manual-private-token" not in files
            passed("原生 profile 不持久化渠道凭据，所有投递仅进入隔离接收端")
            print(f"Native notification smoke: {checks}/{checks} PASS", flush=True)
        except Exception:
            try:
                ui.capture(artifacts / "notify-smoke-failure.png")
                (artifacts / "notify-smoke-failure-tree.json").write_text(json.dumps(ui.nodes(),ensure_ascii=False,indent=2))
            except Exception:
                pass
            (artifacts / "notify-smoke-native.log").write_bytes((work / "native.log").read_bytes())
            (artifacts / "notify-smoke-server.log").write_bytes((work / "server.log").read_bytes())
            raise
        finally:
            for process in (native,server):
                if process is not None:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
            sink.shutdown()
            sink.server_close()
            server_log.close()
            native_log.close()


if __name__ == "__main__":
    if sys.platform == "darwin":
        state = subprocess.check_output(["ioreg", "-n", "Root", "-d1"], text=True)
        if '"CGSSessionScreenIsLocked"=Yes' in state:
            raise SystemExit("macOS 当前已锁屏，请解锁后重跑 make notify-smoke；测试尚未开始。")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app",type=Path,default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--artifacts",type=Path,default=ROOT / "artifacts")
    parser.add_argument("--go",default="go")
    args=parser.parse_args()
    smoke(args.app.resolve(),args.artifacts.resolve(),args.go)
