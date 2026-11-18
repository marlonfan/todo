#!/usr/bin/env python3
"""Exercise the real Native UI against a disposable Todo backend/database.

Build the backend and 'go build -tags=e2e -o build/qa/todo-native-qa .' first.
No existing Todo account, database, profile or application is changed.
"""
import argparse
import base64
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.request
import uuid
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]


def wait_for(fn, message, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = fn()
        if value:
            return value
        time.sleep(0.05)
    raise AssertionError(message)


class Native:
    def __init__(self, path):
        self.path = str(path)

    def call(self, method, **params):
        with socket.socket(socket.AF_UNIX) as conn:
            conn.settimeout(15)
            conn.connect(self.path)
            conn.sendall((json.dumps({"id": 1, "method": method, "params": params}) + "\n").encode())
            result = json.loads(conn.makefile("rb").readline())
        if "error" in result:
            raise AssertionError(result["error"])
        return result["result"]

    def nodes(self):
        return self.call("tree")["nodes"]

    def find(self, role, label):
        nodes = self.nodes()
        found=next((n for n in nodes if n.get("role") == role and n.get("label") == label), None)
        if found is None and role == "button":
            found=next((n for n in nodes if n.get("role")==role and n.get("label")=="搜索结果 "+label),None)
        return found

    def node(self, role, label):
        return wait_for(lambda: self.find(role, label), f"找不到原生控件：{role} {label}")

    def reveal_task_advanced(self, label):
        """Reveal only known detail controls; never toggle behind a task menu."""
        advanced = {
            "编辑优先级", "编辑分类", "编辑重复", "编辑提醒", "任务活动",
            "删除任务…", "编辑整个系列", "整个系列提醒与活动记录",
        }
        if label not in advanced or self.find("button", label):
            return
        if any(n.get("role") in ("menu", "menuItem") for n in self.nodes()):
            return
        for fold in ("系列高级属性", "高级属性"):
            if self.find("button", fold):
                # Both detail types expose these controls whenever already open.
                if not (self.find("button", "编辑优先级") or self.find("button", "编辑整个系列")):
                    self.press("button", fold)
                return

    def assert_save_state(self, label, enabled):
        self.call("idle", timeout=3000)
        return wait_for(
            lambda: (node := self.find("button", label))
            and ("disabled" not in node.get("states", [])) == enabled and node,
            f"保存按钮状态不符：{label}，预期{'启用' if enabled else '禁用'}",
        )

    def press(self, role, label):
        if role == "button":
            self.reveal_task_advanced(label)
        if role == "button" and not self.find(role, label) and self.find("button", "‹ 返回任务列表"):
            # Another task row lives in the list when compact detail replaces it.
            self.press("button", "‹ 返回任务列表")
        if role == "treeItem":
            if self.find("button","收起偏好编辑"):
                self.press("button","收起偏好编辑")
            for popup_label in ("收起分类","收起开始时间","收起截止日期","收起重复","收起优先级","收起提醒","收起状态（整项任务）"):
                if self.find("button",popup_label):
                    self.press("button",popup_label)
            if self.find("button","‹ 返回任务列表"):
                self.press("button","‹ 返回任务列表")
            if self.find("button", "展开导航"):
                self.press("button", "展开导航")
            services = {"同步": "同步", "CalDAV": "CalDAV 与订阅", "通知渠道": "通知渠道", "AI 与提示词": "AI 与提示词"}
            if label in services and not self.find(role, label):
                self.press("treeItem", "设置")
                self.press("button", "打开" + services[label])
                return
        def enabled():
            node = self.find(role, label)
            return node if node and "disabled" not in node.get("states", []) else None
        node = wait_for(enabled, f"原生控件没有就绪：{role} {label}")
        self.call("act", id=node["id"], action="scrollIntoView")
        node = wait_for(enabled, f"原生控件没有就绪：{role} {label}")
        self.call("act", id=node["id"], action="press")
        self.call("idle", timeout=3000)

    def ready(self):
        self.call("idle", timeout=3000)
        wait_for(lambda: (n := self.find("button", "刷新")) and "disabled" not in n.get("states", []), "原生同步没有结束")

    def fill(self, label, text):
        if label == "搜索任务" and not self.find("textField", label):
            self.press("button", "返回搜索" if self.find("button","返回搜索") else "搜索任务")
        def enabled():
            node = self.find("textField", label)
            return node if node and "disabled" not in node.get("states", []) else None
        node = wait_for(enabled, f"原生输入框没有就绪：{label}")
        self.call("act", id=node["id"], action="scrollIntoView")
        node = wait_for(enabled, f"原生输入框没有就绪：{label}")
        self.call("act", id=node["id"], action="setValue", text=text)
        self.call("idle", timeout=3000)

    def task_title(self, current_title=None):
        """Enter the read-first detail title via its stable accessibility label."""
        if not self.find("textField", "任务标题"):
            self.press("button", "编辑任务标题")
        return self.node("textField", "任务标题")

    def fill_task_title(self, text, current_title=None):
        self.task_title(current_title)
        self.fill("任务标题", text)

    def task_description(self):
        if not self.find("textField", "备注"):
            label = "编辑描述" if self.find("button", "编辑描述") else "添加描述…"
            self.press("button", label)
        return self.node("textField", "备注")

    def fill_task_description(self, text):
        self.task_description()
        self.fill("备注", text)

    def open_task_activity(self):
        if self.find("button", "保存本次描述") or self.find("button", "保存本次时间"):
            self.press("button", "整个系列提醒与活动记录")
            return
        if not self.find("button", "提醒与活动记录"):
            self.press("button", "任务活动")
        self.press("button", "提醒与活动记录")

    def capture(self, path):
        capture = self.call("capture")
        path.write_bytes(base64.b64decode(capture["png"]))

    def edit_task_recurrence(self):
        """Expose advanced controls inside the repeat property's popover."""
        if not self.find("button", "收起重复"):
            self.press("button", "编辑重复")
        if not (self.find("textField", "重复间隔") or self.find("button", "编辑重复规则")):
            self.press("button", "编辑高级重复规则")
        if self.find("button", "编辑重复规则"):
            self.press("button", "编辑重复规则")
        self.node("textField", "重复间隔")

    def choose(self, label, value):
        properties = {
            "状态（整项任务）": ("编辑状态", "收起状态（整项任务）"),
            "分类": ("编辑分类", "收起分类"),
            "优先级": ("编辑优先级", "收起优先级"),
            "重复": ("编辑重复", "收起重复"),
            "提醒": ("编辑提醒", "收起提醒"),
        }
        property_controls = properties.get(label)
        if property_controls:
            trigger, close = property_controls
            if not self.find("button", close):
                self.press("button", trigger)
            self.press("button", value)
            self.press("button", close)
            return
        node = self.find("popUpButton", label) or self.find("menuButton", label) or self.find("button", label)
        if node is None:
            raise AssertionError("找不到原生选项入口：" + label)
        self.call("act", id=node["id"], action="scrollIntoView")
        self.press(node["role"], label)
        option = wait_for(lambda: self.find("listItem", value) or self.find("menuItem", value) or self.find("button", value), "找不到原生选项：" + value)
        self.press(option["role"], value)


def smoke(app_binary, server_binary, artifacts, empty_only=False):
    with tempfile.TemporaryDirectory(prefix="todo-native-smoke-") as work:
        work = Path(work)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        server_url = f"http://127.0.0.1:{port}"
        config = work / "server.yaml"
        config.write_text(json.dumps({
            "server": {"host": "127.0.0.1", "port": port},
            "database": {"driver": "sqlite", "dsn": str(work / "test.db")},
            "jwt": {"secret": uuid.uuid4().hex, "expire": "24h"},
        }))
        server_log = open(work / "server.log", "wb")
        native_log = open(work / "native.log", "wb")
        server = subprocess.Popen([str(server_binary), "-config", str(config)], cwd=work, stdout=server_log, stderr=subprocess.STDOUT)
        native = None
        token = ""

        def api(path, method="GET", payload=None):
            data = None if payload is None else json.dumps(payload).encode()
            request = urllib.request.Request(server_url + path, data=data, method=method, headers={"Content-Type": "application/json", "Authorization": "Bearer " + token})
            with urllib.request.urlopen(request, timeout=5) as response:
                body = response.read()
                return json.loads(body) if body else None

        def healthy():
            try:
                return api("/health")["status"] == "ok"
            except OSError:
                return False

        try:
            wait_for(healthy, "隔离后端没有启动")
            env = dict(os.environ, TODO_NATIVE_QA="1", TODO_API_URL=server_url,
                       TODO_NATIVE_DATA_DIR=str(work / "profile"), TODO_NATIVE_REMINDER_LOG=str(work / "reminder-deliveries.jsonl"), MYGO_AUTOMATION=str(work / "native.sock"))
            if empty_only:
                size_file=work/"window-size.json"
                size_file.write_text(json.dumps({"Width":1280,"Height":800}))
                env["TODO_NATIVE_QA_SIZE_FILE"]=str(size_file)
            native = subprocess.Popen([str(app_binary)], env=env, cwd=work, stdout=native_log, stderr=subprocess.STDOUT)
            wait_for(lambda: (work / "native.sock").exists(), "原生应用没有启动自动化接口")
            ui = Native(work / "native.sock")
            windows = wait_for(lambda: ui.call("windows")["windows"], "原生窗口尚未创建")
            assert len(windows) == 1 and windows[0]["kind"] == "content", windows
            assert not any(n.get("webView") for n in ui.nodes()), "不应创建 WebView"
            print("PASS: 窗口为 Native UI content，无 WebView")

            username = "native_" + uuid.uuid4().hex[:10]
            password = uuid.uuid4().hex
            ui.press("button", "创建账户")
            ui.fill("用户名", username)
            ui.fill("邮箱", username + "@example.test")
            ui.fill("密码", password)
            ui.press("button", "注册并登录")
            ui.node("button", "＋ 新建任务")
            token = api("/api/auth/login", "POST", {"username": username, "password": password})["token"]
            print("PASS: 原生注册、登录、会话保存")
            ui.node("text","暂时没有任务")
            ui.capture(artifacts/"native-empty.png")
            if empty_only:
                wait_for(lambda:ui.call("windows")["windows"][0]["bounds"]["width"]==1280,"空态窗口宽度不符")
                for theme,slug in (("浅色","light"),("深色","dark")):
                    ui.press("treeItem","设置")
                    ui.choose("外观",theme)
                    ui.press("treeItem","全部任务")
                    ui.node("text","暂时没有任务")
                    ui.node("text","选择一个任务")
                    ui.capture(artifacts/("native-empty-"+slug+".png"))
                print("PASS: 1280 真实原生窗口明暗主题空列表与无选择状态")
                if os.name=="posix" and os.uname().sysname=="Darwin":
                    subprocess.run(["osascript","-e",f'tell application "System Events" to tell (first process whose unix id is {native.pid}) to set frontmost to true'],check=True,capture_output=True,text=True,timeout=15)
                    wait_for(lambda:ui.call("windows")["windows"][0]["focused"],"原生窗口没有取得键盘焦点")
                    subprocess.run(["osascript","-e",'tell application "System Events" to keystroke "k" using command down'],check=True,capture_output=True,text=True,timeout=15)
                    ui.call("idle",timeout=3000)
                    search=ui.node("textField","搜索任务")
                    wait_for(lambda:ui.call("tree").get("focus")==search["id"],"Cmd+K 没有聚焦原生搜索")
                    ui.node("text","没有匹配的任务")
                    ui.capture(artifacts/"native-empty-keyboard-search.png")
                    ui.call("input",events=[{"type":"key","key":"Escape"}])
                    wait_for(lambda:not ui.find("textField","搜索任务"),"Esc 没有关闭搜索")
                    print("PASS: macOS 原生 Cmd+K 搜索聚焦与 Esc 返回")
                return

            ui.press("treeItem", "管理分类")
            ui.press("button", "新建分类")
            ui.fill("分类名称", "工作计划")
            ui.press("button", "保存分类")
            wait_for(lambda: any(c["name"] == "工作计划" for c in api("/api/categories")), "分类未写入后端")
            ui.node("button", "编辑分类 工作计划")
            print("PASS: 原生创建分类 → 后端持久化")

            ui.press("treeItem", "全部任务")
            ui.press("button", "＋ 新建任务")
            ui.fill_task_title("完成 MyGo 原生客户端迁移")
            ui.fill_task_description("使用 Go Native UI 构建；任务、日历和设置都在原生窗口内。")
            ui.choose("分类", "工作计划")
            ui.press("button", "保存任务")
            ui.assert_save_state("保存任务", enabled=False)
            ui.press("button", "关闭")
            ui.node("button", "完成 MyGo 原生客户端迁移")
            ui.ready()
            tasks = api("/api/tasks")
            assert len(tasks) == 1 and tasks[0]["categories"][0]["name"] == "工作计划", tasks
            print("PASS: 原生创建任务、描述与分类 → 后端持久化")
            ui.capture(artifacts / "native-tasks.png")

            ui.press("button", "完成 MyGo 原生客户端迁移")
            ui.assert_save_state("保存任务", enabled=False)
            ui.fill_task_title("验证原生任务编辑", "完成 MyGo 原生客户端迁移")
            ui.assert_save_state("保存任务", enabled=True)
            ui.press("button", "保存任务")
            ui.assert_save_state("保存任务", enabled=False)
            ui.press("button", "关闭")
            ui.node("button", "验证原生任务编辑")
            ui.ready()
            assert api("/api/tasks")[0]["revision"] > tasks[0]["revision"]
            print("PASS: 原生编辑任务、版本号推进")

            ui.press("checkBox", "完成 验证原生任务编辑")
            wait_for(lambda: api("/api/tasks")[0]["status"] == "completed", "任务未完成")
            ui.press("treeItem", "已完成")
            ui.node("button", "验证原生任务编辑")
            print("PASS: 原生完成任务、已完成列表")

            ui.press("button", "验证原生任务编辑")
            ui.press("button", "更多任务选项")
            ui.press("button", "删除任务…")
            ui.press("button", "确认删除")
            wait_for(lambda: api("/api/tasks") == [], "任务未删除")
            print("PASS: 原生删除确认 → 后端删除")

            # Seed recurrence and boundary fixtures through the API; all instance
            # actions below are driven through real Native UI, not a mock view.
            api("/api/auth/profile", "PATCH", {"timezone": "Asia/Shanghai"})
            today = datetime.now(ZoneInfo("Asia/Shanghai")).replace(hour=9, minute=0, second=0, microsecond=0)
            anchor = today - timedelta(days=1)
            series = api("/api/tasks", "POST", {
                "title": "原生重复实例验证", "description": "系列起点和后续计划应保留。",
                "start_time": anchor.isoformat(), "recurrence_rule": {"freq": "daily", "interval": 1, "count": 3},
            })
            for title, offset in (("原生逾期验证", -2), ("原生七天内验证", 6), ("原生七天外验证", 7)):
                api("/api/tasks", "POST", {"title": title, "due_date": (today + timedelta(days=offset)).isoformat()})
            ui.press("treeItem", "全部任务")
            ui.press("button", "刷新")
            ui.ready()
            ui.press("treeItem", "今天")
            ui.node("button", "原生逾期验证")
            ui.node("button", "原生重复实例验证")
            assert not ui.find("button", "原生七天内验证")
            ui.press("treeItem", "即将到来")
            ui.node("button", "原生七天内验证")
            ui.node("button", "原生逾期验证")
            assert not ui.find("button", "原生七天外验证")
            print("PASS: 原生今天包含逾期，最近七天使用账户时区与排他边界")

            def next_instance():
                return next(o for o in api("/api/tasks/next-occurrences") if o["task_id"] == series["id"])

            first = next_instance()
            ui.press("button", "原生重复实例验证")
            ui.node("button", "完成本次")
            ui.capture(artifacts / "native-recurring.png")
            ui.press("button", "完成本次")
            wait_for(lambda: next_instance()["instance_id"] != first["instance_id"], "完成本次后没有推进到下一次")
            ui.ready()
            second = next_instance()
            persisted = api(f"/api/tasks/{series['id']}")
            assert persisted["status"] == "pending" and persisted["start_time"] == series["start_time"]
            ui.press("treeItem", "已完成")
            ui.press("button", "原生重复实例验证")
            ui.press("button", "恢复本次待办")
            wait_for(lambda: next_instance()["instance_id"] == first["instance_id"], "恢复本次后没有重新出现")
            ui.ready()
            print("PASS: 原生完成单次 → 下一实例、历史恢复，系列起始日期不变")

            ui.press("treeItem", "今天")
            ui.press("button", "原生重复实例验证")
            ui.press("button", "跳过本次")
            wait_for(lambda: next_instance()["instance_id"] == second["instance_id"], "跳过本次后没有推进")
            ui.ready()
            ui.press("treeItem", "已跳过")
            ui.press("button", "原生重复实例验证")
            ui.node("button", "恢复本次待办")
            ui.press("button", "关闭")
            print("PASS: 原生跳过单次 → 已跳过历史")

            def first_history():
                return next(o for o in api("/api/tasks/occurrences?status=skipped&limit=200")["items"] if o["instance_id"] == first["instance_id"])

            ui.press("button", "原生重复实例验证")
            ui.assert_save_state("保存本次描述", enabled=False)
            ui.press("button", "编辑本次描述")
            ui.fill("本次描述", "仅记录本次跳过的原因")
            ui.assert_save_state("保存本次描述", enabled=True)
            ui.capture(artifacts / "native-occurrence-editor.png")
            ui.press("button", "保存本次描述")
            ui.ready()
            assert first_history()["description"] == "仅记录本次跳过的原因"
            assert first_history()["status"] == "skipped"
            assert api(f"/api/tasks/{series['id']}")["description"] == series["description"]
            assert next_instance()["instance_id"] == second["instance_id"]
            print("PASS: 原生编辑历史单次描述，状态、后续实例和系列描述保留")
            ui.press("button", "原生重复实例验证")
            ui.press("button", "编辑本次描述")
            ui.fill("本次描述", "")
            ui.press("button", "保存本次描述")
            ui.ready()
            assert first_history()["description"] == ""
            ui.press("button", "原生重复实例验证")
            assert not ui.find("text", series["description"])
            ui.press("button", "关闭")
            print("PASS: 原生清空本次描述，重新读取后不会错误继承系列描述")

            ui.press("treeItem", "今天")
            ui.press("button", "＋ 新建任务")
            ui.fill_task_title("自定义双周计划")
            ui.choose("重复", "每周")
            ui.edit_task_recurrence()
            ui.fill("重复间隔", "0")
            ui.press("button", "收起重复")
            ui.press("button", "保存任务")
            ui.node("text", "重复间隔应为 1–10000 的整数")
            assert not any(t["title"] == "自定义双周计划" for t in api("/api/tasks"))
            print("PASS: 无效重复间隔保留草稿，后端无错误任务")
            ui.edit_task_recurrence()
            ui.fill("重复间隔", "2")
            ui.fill("重复次数", "8")
            ui.fill("重复星期", "周一，周五")
            ui.call("act", id=ui.node("textField", "重复星期")["id"], action="scrollIntoView")
            ui.capture(artifacts / "native-recurrence-weekly.png")
            ui.press("button", "收起重复")
            ui.press("button", "保存任务")
            ui.ready()
            weekly = next(t for t in api("/api/tasks") if t["title"] == "自定义双周计划")
            assert weekly["recurrence_rule"] == {"freq":"weekly", "interval":2, "byday":["MO", "FR"], "count":8}, weekly
            assert next(o for o in api("/api/tasks/next-occurrences") if o["task_id"] == weekly["id"])
            print("PASS: 原生创建每两周周一/周五、共八次，服务端成功展开")

            monthly = api("/api/tasks", "POST", {"title":"复杂月度规则编辑", "start_time":today.isoformat(), "recurrence_rule":{"freq":"monthly", "interval":1, "byday":["2MO", "-1FR"], "count":12}})
            ui.press("treeItem", "全部任务")
            ui.press("button", "刷新")
            ui.ready()
            ui.press("button", "复杂月度规则编辑")
            ui.press("button", "编辑整个系列")
            ui.edit_task_recurrence()
            assert ui.node("textField", "重复星期")["value"] == "第2个周一，最后1个周五"
            ui.fill("重复间隔", "3")
            ui.fill("重复次数", "6")
            ui.fill("限定月份", "1，6，12")
            ui.call("act", id=ui.node("textField", "限定月份")["id"], action="scrollIntoView")
            ui.capture(artifacts / "native-recurrence-monthly.png")
            ui.press("button", "收起重复")
            ui.press("button", "保存任务")
            ui.ready()
            saved = api(f"/api/tasks/{monthly['id']}")
            assert saved["recurrence_rule"] == {"freq":"monthly", "interval":3, "byday":["2MO", "-1FR"], "bymonth":[1,6,12], "count":6}, saved
            assert saved["start_time"] == monthly["start_time"]
            print("PASS: 原生载入并编辑序数星期/月限制，保留系列起点")

            ui.press("treeItem", "今天")
            ui.press("button", "＋ 新建任务")
            ui.fill_task_title("原生农历计划")
            ui.choose("重复", "农历每年")
            ui.edit_task_recurrence()
            ui.fill("重复间隔", "2")
            ui.fill("重复次数", "5")
            ui.fill("农历月份", "8")
            ui.fill("农历日期", "15")
            ui.press("checkBox", "优先使用闰月")
            ui.call("act", id=ui.node("textField", "农历日期")["id"], action="scrollIntoView")
            ui.capture(artifacts / "native-recurrence-lunar.png")
            ui.press("button", "收起重复")
            ui.press("button", "保存任务")
            ui.ready()
            lunar = next(t for t in api("/api/tasks") if t["title"] == "原生农历计划")
            assert lunar["recurrence_rule"] == {"freq":"lunar_yearly", "interval":2, "count":5, "lunar_month":8, "lunar_day":15, "lunar_is_leap_month":True}, lunar
            assert next(o for o in api("/api/tasks/next-occurrences") if o["task_id"] == lunar["id"])
            print("PASS: 原生创建农历八月十五双年计划、闰月偏好与次数")

            for title, begin, finish in (("原生日历重叠一", 9, 10.5), ("原生日历重叠二", 9.5, 11)):
                base = today.replace(hour=0)
                api("/api/tasks", "POST", {"title": title, "start_time": (base + timedelta(hours=begin)).isoformat(), "end_time": (base + timedelta(hours=finish)).isoformat()})
            calendar_series = api("/api/tasks", "POST", {
                "title": "日历单次操作验证", "start_time": today.replace(hour=14).isoformat(),
                "recurrence_rule": {"freq": "daily", "interval": 1, "count": 3},
            })
            ui.press("treeItem", "日历")
            ui.press("button", "刷新")
            ui.ready()
            ui.press("radio", "日程")
            ui.node("table", "选择日程日期")
            ui.capture(artifacts / "native-calendar.png")
            print("PASS: 原生日历控件与日程页面")
            ui.ready()

            date_key = today.strftime("%Y-%m-%d")
            ui.press("radio", "月")
            # Month cells show only the first three events; account defaults
            # can legitimately move the other fixture tasks before this event.
            assert any(n.get("role") == "button" and n.get("label", "").startswith(f"日程 {date_key} ") for n in ui.nodes())
            ui.capture(artifacts / "native-calendar-month.png")
            if not ui.find("button", f"日程 {date_key} 原生日历重叠一"):
                ui.press("button", f"更多日程 {date_key}")
                ui.node("button", f"日程 {date_key} 原生日历重叠一")
                ui.press("radio", "月")
                ui.ready()
            print("PASS: 原生月视图显示日期格和事件，可直接打开日程")
            ui.press("radio", "周")
            first_card = ui.node("button", f"日程 {date_key} 原生日历重叠一")
            second_card = ui.node("button", f"日程 {date_key} 原生日历重叠二")
            assert abs(first_card["bounds"]["x"] - second_card["bounds"]["x"]) > 10, (first_card, second_card)
            ui.capture(artifacts / "native-calendar-week.png")
            print("PASS: 原生周时间轴按实际时刻布局，重叠事件使用并排栏位")
            ui.press("button", f"日程 {date_key} 日历单次操作验证")
            ui.press("button", "完成本次")
            wait_for(lambda: any(o["task_id"] == calendar_series["id"] and o["status"] == "completed" for o in api("/api/tasks/occurrences?status=completed&limit=200")["items"]), "从日历完成单次未保存")
            assert api(f"/api/tasks/{calendar_series['id']}")["start_time"] == calendar_series["start_time"]
            print("PASS: 点击日历重复实例完成本次，系列起点保留")
            ui.ready()
            ui.press("radio", "日")
            ui.press("button", f"在 {date_key} 14:00 添加日程")
            ui.fill_task_title("从原生时间轴创建")
            ui.press("button", "保存任务")
            created = wait_for(lambda: next((t for t in api("/api/tasks") if t["title"] == "从原生时间轴创建"), None), "时间轴创建日程未保存")
            assert datetime.fromisoformat(created["start_time"].replace("Z", "+00:00")).astimezone(ZoneInfo("Asia/Shanghai")).hour == 14
            ui.ready()
            ui.capture(artifacts / "native-calendar-day.png")
            print("PASS: 点击原生时间轴空白时段创建，日期和时间正确保存")
            ui.press("radio", "月")
            ui.ready()

            # Stop only this disposable backend. Persist several dependent
            # offline edits and restart the native process with the same profile.
            server.terminate()
            # The backend may spend all 5 seconds draining a long-poll request.
            server.wait(timeout=8)
            ui.press("treeItem", "全部任务")
            ui.press("button", "＋ 新建任务")
            ui.fill_task_title("断网创建的原生任务")
            ui.press("button", "保存任务")
            ui.ready()
            ui.assert_save_state("保存任务", enabled=False)
            ui.press("button", "关闭")
            ui.press("button", "断网创建的原生任务")
            ui.fill_task_title("断网编辑并重启保留", "断网创建的原生任务")
            ui.press("button", "保存任务")
            ui.ready()
            ui.assert_save_state("保存任务", enabled=False)
            ui.press("button", "关闭")
            ui.press("checkBox", "完成 断网编辑并重启保留")
            ui.ready()
            ui.press("treeItem", "已完成")
            ui.node("button", "断网编辑并重启保留")
            cache_path = work / "profile" / "cache.json"
            queued = json.loads(cache_path.read_text())
            assert len(queued["outbox"]) == 3, queued
            ui.press("treeItem", "已跳过")
            ui.press("button", "原生重复实例验证")
            ui.press("button", "编辑本次描述")
            ui.fill("本次描述", "离线补充的本次记录")
            ui.press("button", "保存本次描述")
            ui.ready()
            queued = json.loads(cache_path.read_text())
            assert len(queued["outbox"]) == 4, queued
            operation_ids = [op["id"] for op in queued["outbox"]]
            print("PASS: 真实断网后原生创建、编辑、完成，三条修改持久化")

            native.terminate()
            native.wait(timeout=5)
            (work / "native.sock").unlink(missing_ok=True)
            native = subprocess.Popen([str(app_binary)], env=env, cwd=work, stdout=native_log, stderr=subprocess.STDOUT)
            wait_for(lambda: (work / "native.sock").exists(), "离线重启后自动化接口未启动")
            ui = Native(work / "native.sock")
            wait_for(lambda: ui.call("windows")["windows"], "离线重启未创建原生窗口")
            ui.ready()
            ui.press("treeItem", "已跳过")
            ui.press("button", "原生重复实例验证")
            ui.node("text", "离线补充的本次记录")
            ui.press("button", "关闭")
            print("PASS: 本次描述离线保存并在重启后恢复，保留历史状态")
            ui.press("treeItem", "已完成")
            ui.node("button", "断网编辑并重启保留")
            ui.press("treeItem", "日历")
            assert "checked" in ui.node("radio", "月").get("states", [])
            assert any(n.get("role") == "button" and n.get("label", "").startswith(f"日程 {date_key} ") for n in ui.nodes())
            ui.ready()
            ui.capture(artifacts / "native-calendar-offline.png")
            print("PASS: 真实离线重启后恢复月视图与已缓存日程")
            ui.press("treeItem", "同步")
            ui.capture(artifacts / "native-offline.png")
            assert [op["id"] for op in json.loads(cache_path.read_text())["outbox"]] == operation_ids
            print("PASS: 原生应用离线重启后恢复内容与原操作编号")

            server = subprocess.Popen([str(server_binary), "-config", str(config)], cwd=work, stdout=server_log, stderr=subprocess.STDOUT)
            wait_for(healthy, "隔离后端未恢复")
            # No refresh click: periodic synchronization must drain the outbox.
            wait_for(lambda: not json.loads(cache_path.read_text()).get("outbox"), "恢复联网后未自动提交离线修改", timeout=25)
            persisted = [t for t in api("/api/tasks") if t["title"] == "断网编辑并重启保留"]
            assert len(persisted) == 1 and persisted[0]["status"] == "completed", persisted
            print("PASS: 联网自动提交依赖队列、映射服务器编号，只创建一个任务")
            assert first_history()["description"] == "离线补充的本次记录"
            assert api(f"/api/tasks/{series['id']}")["description"] == series["description"]
            assert api(f"/api/tasks/{series['id']}")["start_time"] == series["start_time"]
            print("PASS: 联网自动提交离线本次描述，系列描述和起点保留")

            ui.press("treeItem", "全部任务")
            external = api("/api/tasks", "POST", {"title": "另一个客户端创建的任务"})
            # A remote insert must not scroll the virtualized list away from
            # the user's position. Check receipt independently of visibility.
            wait_for(lambda: any(t["id"] == external["id"] for t in json.loads(cache_path.read_text()).get("tasks", [])), "未自动读取其他客户端的修改", timeout=25)
            ui.fill("搜索任务", "另一个客户端创建的任务")
            wait_for(lambda: ui.find("button", "另一个客户端创建的任务"), "未自动读取其他客户端的修改", timeout=25)
            print("PASS: 自动读取其他客户端新增任务，无需手动刷新")

            ui.press("button", "另一个客户端创建的任务")
            ui.fill_task_title("原生本地冲突版本", "另一个客户端创建的任务")
            api(f"/api/tasks/{external['id']}", "PUT", {"title": "服务器并发版本"})
            ui.press("button", "保存任务")
            ui.ready()
            ui.press("treeItem", "同步")
            ui.node("button", "用本地修改覆盖此版本")
            assert api(f"/api/tasks/{external['id']}")["title"] == "服务器并发版本"
            ui.capture(artifacts / "native-conflict.png")
            ui.press("button", "用本地修改覆盖此版本")
            ui.ready()
            assert api(f"/api/tasks/{external['id']}")["title"] == "原生本地冲突版本"
            assert not json.loads(cache_path.read_text()).get("outbox")
            print("PASS: 409 保留双方版本，经原生界面显式处理后提交")
            assert (work / "profile" / "session.json").exists(), "登录信息未保存"
            # The e2e-tagged app injects a file sink in place of OS delivery, so
            # scheduler integration cannot prompt or spam the real desktop.
            ui.press("treeItem", "设置")
            ui.node("text", "账户设置在客户端之间同步；本机偏好只影响当前设备。")
            ui.ready()
            ui.press("button", "编辑默认提醒")
            ui.press("switch", "账户默认开启提前提醒")
            ui.fill("默认提前分钟数", "2")
            ui.fill("全天任务早间时间", "08:30")
            ui.press("button", "保存默认提醒")
            wait_for(lambda: (n := ui.find("button", "保存默认提醒")) and "disabled" not in n.get("states", []), "默认提醒保存没有结束")
            def reminder_profile_saved():
                profile = api("/api/auth/me")
                return profile if profile["default_reminder_enabled"] and profile["default_reminder_minutes"] == 2 and profile["default_morning_time"] == "08:30" else None
            wait_for(reminder_profile_saved, "原生默认提醒未保存")
            assert not json.loads(cache_path.read_text()).get("profile_changes")
            assert not ui.find("text", "默认提醒尚未保存")
            ui.call("act", id=ui.node("button", "保存默认提醒")["id"], action="scrollIntoView")
            ui.capture(artifacts / "native-reminders.png")
            ui.press("button", "收起偏好编辑")
            ui.ready()
            print("PASS: 原生账户默认提醒与全天早间时间保存")

            def deliveries():
                path = work / "reminder-deliveries.jsonl"
                return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []

            instant = datetime.now(timezone.utc).replace(microsecond=0)
            reminder = api("/api/tasks", "POST", {
                "title": "原生调度提醒验证", "start_time": (instant + timedelta(minutes=2, seconds=3)).isoformat(),
                "reminder_policy": "inherit",
            })
            ui.press("button", "刷新")
            ui.ready()
            sent = wait_for(lambda: next((d for d in deliveries() if d["Title"] == "原生调度提醒验证"), None), "原生提醒调度未触发")
            receipt_path = work / "profile/reminders.json"
            wait_for(lambda: json.loads(receipt_path.read_text())["records"][sent["ID"]]["state"] == "submitted", "提醒回执未保存")
            print("PASS: 本机定时调度 → 隔离通知接收端，持久化发送回执")

            # Restart without changing profile, account, or reminder identity.
            native.terminate()
            native.wait(timeout=5)
            (work / "native.sock").unlink(missing_ok=True)
            native = subprocess.Popen([str(app_binary)], env=env, cwd=work, stdout=native_log, stderr=subprocess.STDOUT)
            wait_for(lambda: (work / "native.sock").exists(), "提醒验证重启后接口未就绪")
            ui = Native(work / "native.sock")
            wait_for(lambda: ui.call("windows")["windows"], "提醒验证重启后窗口未创建")
            ui.ready()
            time.sleep(1.2)
            assert len([d for d in deliveries() if d["ID"] == sent["ID"]]) == 1, deliveries()
            print("PASS: 重启读取提醒回执，同一提醒不会重复发送")

            ui.press("treeItem", "设置")
            ui.press("switch", "在本机发送任务提醒")
            reminder2 = api("/api/tasks", "POST", {
                "title": "本机提醒开关验证", "start_time": (datetime.now(timezone.utc).replace(microsecond=0) + timedelta(minutes=2)).isoformat(),
                "reminder_policy": "inherit",
            })
            ui.press("button", "刷新")
            ui.ready()
            time.sleep(1.2)
            assert not any(d["Title"] == "本机提醒开关验证" for d in deliveries()), deliveries()
            assert json.loads((work / "profile/preferences.json").read_text())["local_reminders"] is False
            ui.press("switch", "在本机发送任务提醒")
            wait_for(lambda: any(d["Title"] == "本机提醒开关验证" for d in deliveries()), "重新开启后未补发有效窗口内提醒")
            print("PASS: 原生本机提醒开关持久化，关闭期间不发送，重新开启恢复调度")
            offline_due = api("/api/tasks", "POST", {
                "title": "离线本机提醒验证", "start_time": (datetime.now(timezone.utc).replace(microsecond=0) + timedelta(minutes=2, seconds=3)).isoformat(),
                "reminder_policy": "inherit",
            })
            ui.press("button", "刷新")
            wait_for(lambda: any(t["id"] == offline_due["id"] for t in json.loads(cache_path.read_text())["tasks"]), "离线提醒未缓存")
            server.terminate()
            # The backend may spend all 5 seconds draining a long-poll request.
            server.wait(timeout=8)
            wait_for(lambda: any(d["Title"] == "离线本机提醒验证" for d in deliveries()), "断网后缓存提醒未触发")
            print("PASS: 真实断网后，本机从已缓存数据继续调度提醒")
            print("Native smoke: 34/34 PASS")
        except Exception:
            try:
                ui.capture(artifacts / "smoke-failure.png")
                artifacts.joinpath("smoke-failure-tree.json").write_text(json.dumps(ui.nodes(), ensure_ascii=False, indent=2))
                artifacts.joinpath("smoke-failure-cache.json").write_bytes((work / "profile/cache.json").read_bytes())
            except Exception:
                pass
            artifacts.joinpath("smoke-native.log").write_bytes((work / "native.log").read_bytes())
            artifacts.joinpath("smoke-server.log").write_bytes((work / "server.log").read_bytes())
            raise
        finally:
            for process in (native, server):
                if process is not None:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
            server_log.close()
            native_log.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--server", type=Path, default=ROOT.parent / "bin/todo-app")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts")
    parser.add_argument("--empty-only",action="store_true",help="仅验收新账户明暗主题的空列表和无选择状态")
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    smoke(args.app.resolve(), args.server.resolve(), args.artifacts.resolve(),args.empty_only)
