#!/usr/bin/env python3
"""A–F real macOS detail acceptance. Preparation is the default; never builds.

After the parent explicitly announces buildready:
  python3 scripts/detail_interactions_smoke.py --buildready --app <e2e-binary>

Only disposable processes launched by this script are ever terminated. The
HTTP fault gateway forwards to a real isolated Go server; fixtures use its API,
whereas tested mutations enter through the real Native window. Synthetic wheel
and text events do not establish physical trackpad or system IME correctness.
"""
import argparse
import contextlib
from datetime import datetime, timedelta
import fcntl
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import plistlib
from pathlib import Path
import re
import socket
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import urllib.error
import urllib.request
import uuid
from zoneinfo import ZoneInfo

from smoke import ROOT, wait_for
from designer_fixes_smoke import SettledNative

DEFAULT_ARTIFACTS = ROOT / "artifacts/detail-interactions/20261111-round2/windows-current"
FINAL_ARTIFACTS = ROOT / "artifacts/detail-interactions/20261111-round2/windows-final"
FINAL_APP = ROOT / "build/qa/todo-native-detail-final2"
PROPERTIES = ("编辑状态", "编辑开始", "编辑截止", "编辑优先级", "编辑分类", "编辑重复", "编辑提醒")
PLAN = {
    "A": "Six real window/theme combinations; ordinary/instance/category/history/search/calendar entry, window count, detail/list IDs, visible row coordinates and scroll evidence before/after switching.",
    "B": "Direct consecutive checkbox events, monotonic tree/PNG timeline around 180ms filter hiding, unaffected native IDs and scroll; retained history rows; real HTTP rejection rollback and offline durable completion.",
    "C": "Native multiLine title read/edit bounds, Chinese/English/200/201 characters, native text replacement, debounce/switch isolation, blur/close save, server revision and offline cache/outbox/restart recovery.",
    "D": "Every property popup bounds at each size/theme, Up/Down/Enter/Esc/outside and focus restoration; searchable flat categories, selected markers and preservation of multiple relations.",
    "E": "Pointer drag from native handle to real sidebar category, source replacement/additive aggregate semantics, invalid aggregate/Esc/no-op, undo after later title edit, sidebar held-pointer edge scroll, series scope, restart persistence.",
    "F": "Long Markdown/list description and many categories, precise synthetic wheel with independent list/detail geometry; real 1024/1280/1600 window resize in light/dark.",
}
MANUAL = [
    "System IME marked-text composition and physical trackpad gestures require manual input; synthetic Chinese text/wheel events are only automation evidence.",
    "PNG/tree time series can reveal node replacement/blank frames but cannot prove the absence of every visible flash between samples; review captures and perform live observation/recording.",
    "Visual typography, contrast and title baseline require screenshot/live review; accessibility bounds alone do not expose glyph baselines.",
]


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def unlocked():
    if sys.platform != "darwin":
        raise RuntimeError("This acceptance suite requires macOS real windows")
    registry = plistlib.loads(subprocess.check_output(["ioreg", "-a", "-l", "-n", "Root", "-d1"], timeout=10))
    root = registry[0] if isinstance(registry, list) else registry
    sessions = root.get("IOConsoleUsers", [])
    if root.get("IOConsoleLocked") or any(session.get("CGSSessionScreenIsLocked") for session in sessions):
        raise RuntimeError("macOS 已锁屏；未启动任何 QA 进程，请解锁后重试")
    if not any(session.get("kCGSSessionOnConsoleKey") and session.get("kCGSessionLoginDoneKey") for session in sessions):
        raise RuntimeError("无法确认 macOS 当前有已登录的控制台会话；不启动 GUI 验收")
    return {"checked_at": datetime.now().astimezone().isoformat(),
            "source": "ioreg -a -l -n Root -d1 / IOConsoleUsers", "locked": False,
            "lock_property_present": any("CGSSessionScreenIsLocked" in session for session in sessions)}


def stop_owned(process):
    """Popen ownership is the authority; never discover/kill another process."""
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class Server:
    """Isolated real backend plus explicitly logged transport fault injection."""
    def __init__(self, binary, work, artifacts):
        self.base = f"http://127.0.0.1:{free_port()}"
        self.binary, self.work = binary, work
        self.token = ""
        self.offline = False
        self.reject_task = None
        self.status_delay = 0
        self.requests = []
        self.process = None
        self.log = (artifacts / "server.log").open("wb")
        self.config = work / "server.json"
        dump(self.config, {"server": {"host": "127.0.0.1", "port": int(self.base.rsplit(":", 1)[1])},
                           "database": {"driver": "sqlite", "dsn": str(work / "qa.db")},
                           "jwt": {"secret": uuid.uuid4().hex, "expire": "24h"}})
        owner = self

        class Gateway(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def handle_request(self):
                body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                entry = {"t": time.monotonic(), "method": self.command, "path": self.path}
                if body:
                    with contextlib.suppress(ValueError):
                        entry["body"] = json.loads(body)
                mutation = self.command in ("PUT", "POST", "PATCH", "DELETE")
                if mutation and self.path.endswith("/status") and owner.status_delay:
                    time.sleep(owner.status_delay)
                reject = (mutation and owner.reject_task is not None
                          and self.path.split("?")[0] == f"/api/tasks/{owner.reject_task}/status")
                if owner.offline or reject:
                    status = 503 if owner.offline else 422
                    payload = json.dumps({"error": "QA transport unavailable" if owner.offline else "QA rejected completion"}).encode()
                    headers = {"Content-Type": "application/json"}
                else:
                    headers = {k: v for k, v in self.headers.items()
                               if k.lower() not in ("host", "connection", "content-length")}
                    req = urllib.request.Request(owner.base + self.path, data=body if mutation else None,
                                                 headers=headers, method=self.command)
                    try:
                        response = urllib.request.urlopen(req, timeout=35)
                    except urllib.error.HTTPError as error:
                        response = error
                    except OSError as error:
                        entry.update(status=502, error=str(error))
                        owner.requests.append(entry)
                        self.send_error(502)
                        return
                    with response:
                        status, payload = response.status, response.read()
                        headers = {"Content-Type": response.headers.get("Content-Type", "application/json")}
                        if response.headers.get("Content-Encoding"):
                            headers["Content-Encoding"] = response.headers["Content-Encoding"]
                entry.update(status=status, injected=bool(owner.offline or reject), completed_at=time.monotonic())
                owner.requests.append(entry)
                self.send_response(status)
                for key, value in headers.items():
                    self.send_header(key, value)
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                with contextlib.suppress(BrokenPipeError, ConnectionResetError):
                    self.wfile.write(payload)

            do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = handle_request

        self.gateway = ThreadingHTTPServer(("127.0.0.1", 0), Gateway)
        self.gateway.daemon_threads = True
        self.url = f"http://127.0.0.1:{self.gateway.server_port}"
        self.thread = threading.Thread(target=self.gateway.serve_forever, daemon=True)

    def start(self):
        self.process = subprocess.Popen([str(self.binary), "-config", str(self.config)], cwd=self.work,
                                        stdout=self.log, stderr=subprocess.STDOUT)
        def healthy():
            try:
                return self.api("/health").get("status") == "ok"
            except OSError:
                return False
        wait_for(healthy, "隔离真实后端未启动")
        self.thread.start()

    def api(self, path, method="GET", body=None):
        req = urllib.request.Request(self.base + path, method=method,
              data=None if body is None else json.dumps(body).encode(),
              headers={"Authorization": "Bearer " + self.token, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as response:
            raw = response.read()
            return json.loads(raw) if raw else None

    def task(self, task):
        return self.api(f"/api/tasks/{task['id']}")

    def close(self):
        if self.thread.is_alive():
            self.gateway.shutdown()
        self.gateway.server_close()
        stop_owned(self.process)
        self.log.close()


class AcceptanceStopped(RuntimeError):
    """A final acceptance case failed; preserve it and stop owned QA work."""


class Acceptance:
    def __init__(self, app, backend, artifacts, work, preflight):
        self.app, self.artifacts, self.work = app, artifacts, work
        self.server = Server(backend, work, artifacts)
        self.profile = work / "profile"
        self.profile.mkdir()
        self.size = work / "size.json"
        dump(self.size, {"Width": 1280, "Height": 900})
        self.sock = work / "native.sock"
        self.process = self.ui = self.awake = None
        self.log = (artifacts / "native.log").open("wb")
        self.serial = 0
        self.stop_on_failure = False
        self.report = {"status": "running", "preflight": preflight, "design": PLAN,
                       "manual_unverified": MANUAL, "checks": [], "captures": [],
                       "not_applicable": ["Nested categories/hover expansion: real Category model is flat."],
                       "binaries": {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in (app, backend)}}
        self.env = dict(os.environ, TODO_NATIVE_QA="1", TODO_API_URL=self.server.url,
                        TODO_NATIVE_DATA_DIR=str(self.profile), TODO_NATIVE_QA_SIZE_FILE=str(self.size),
                        TODO_NATIVE_REMINDER_LOG=str(work / "reminders.jsonl"), MYGO_AUTOMATION=str(self.sock))

    def start(self):
        unlocked()
        expected = self.report["binaries"][str(self.app)]
        if hashlib.sha256(self.app.read_bytes()).hexdigest() != expected:
            raise RuntimeError("QA native binary changed during this receipt; refusing to mix builds across restart")
        if self.awake is None or self.awake.poll() is not None:
            self.awake = subprocess.Popen(["caffeinate", "-dimsu", "-t", "3600"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            self.report.setdefault("owned_caffeinate_pids", []).append(self.awake.pid)
        self.sock.unlink(missing_ok=True)
        self.process = subprocess.Popen([str(self.app)], cwd=self.work, env=self.env,
                                        stdout=self.log, stderr=subprocess.STDOUT)
        self.report.setdefault("owned_native_pids", []).append(self.process.pid)
        wait_for(lambda: self.sock.exists(), "QA native socket 未启动")
        self.ui = SettledNative(self.sock)
        wait_for(lambda: self.ui.call("windows").get("windows"), "QA 窗口未创建")
        self.ui.ready()
        subprocess.run(["osascript", "-e", f'tell application "System Events" to tell (first process whose unix id is {self.process.pid}) to set frontmost to true'],
                       check=True, capture_output=True, text=True, timeout=15)
        wait_for(lambda: self.ui.call("windows")["windows"][0]["focused"], "QA 窗口没有原生焦点")

    def seed(self):
        s = self.server
        username, password = "details_" + uuid.uuid4().hex[:12], uuid.uuid4().hex
        s.api("/api/auth/register", "POST", {"username": username, "email": username + "@example.test", "password": password})
        s.token = s.api("/api/auth/login", "POST", {"username": username, "password": password})["token"]
        s.api("/api/auth/profile", "PATCH", {"timezone": "Asia/Shanghai", "default_reminder_enabled": False})
        dump(self.profile / "session.json", {"server": s.url, "token": s.token, "user": s.api("/api/auth/me")})
        self.categories = [s.api("/api/categories", "POST", {"name": f"QA分类{i:02d}", "emoji": ""}) for i in range(48)]
        self.day = datetime.now(ZoneInfo("Asia/Shanghai")).replace(hour=9, minute=0, second=0, microsecond=0)
        self.markdown = "## 长描述验收\n\n- [ ] Chinese 中文\n- [x] English\n\n> 引用\n\n```go\nfmt.Println(42)\n```\n\n" + "自然阅读滚动段落。\n\n" * 70
        def task(title, **fields):
            return s.api("/api/tasks", "POST", dict(title=title, reminder_policy="none", **fields))
        self.plain = task("QA普通任务 Chinese English", description=self.markdown, priority=1,
                          category_ids=[self.categories[0]["id"], self.categories[1]["id"]],
                          start_time=self.day.isoformat(), due_date=(self.day + timedelta(days=2)).isoformat())
        self.other = task("QA切换对照任务", description="另一任务，不得被异步回写",
                          start_time=self.day.isoformat(), due_date=(self.day + timedelta(days=2)).isoformat())
        self.series = task("QA重复实例", start_time=self.day.isoformat(), recurrence_rule={"freq": "daily", "count": 5},
                           category_ids=[self.categories[0]["id"]], description="系列原文")
        self.series_history = task("QA历史重复实例", start_time=(self.day - timedelta(days=1)).isoformat(),
                                   recurrence_rule={"freq": "daily", "count": 3}, description="历史单次原文")
        instance = next(o for o in s.api("/api/tasks/next-occurrences") if o["task_id"] == self.series_history["id"])
        s.api(f"/api/tasks/{self.series_history['id']}/status", "PATCH",
              {"status": "completed", "instance_id": instance["instance_id"],
               "occurrence_date": (self.day - timedelta(days=1)).strftime("%Y-%m-%d")})
        self.history = task("QA历史入口")
        s.api(f"/api/tasks/{self.history['id']}/status", "PATCH", {"status": "completed"})
        self.rows = [task(f"QA连续完成{i:02d}") for i in range(36)]
        self.reject = task("QA错误回滚")
        self.report["fixtures"] = {"plain": self.plain, "other": self.other, "series": self.series,
                                    "history": self.history, "categories": self.categories, "completion": self.rows}

    def snapshot(self, name, image=True):
        self.serial += 1
        slug = f"{self.serial:04d}-{name}"
        tree = self.ui.call("tree")
        value = {"t": time.monotonic(), "windows": self.ui.call("windows")["windows"], "tree": tree}
        if (self.profile / "cache.json").exists():
            dump(self.artifacts / (slug + "-cache.json"), self.cache())
        dump(self.artifacts / (slug + ".json"), value)
        if image:
            self.ui.capture(self.artifacts / (slug + ".png"))
        self.report["captures"].append({"name": slug, "t": value["t"], "png": image})
        return value

    def foreground(self):
        unlocked()
        subprocess.run(["osascript", "-e", f'tell application "System Events" to tell (first process whose unix id is {self.process.pid}) to set frontmost to true'],
                       check=True, capture_output=True, text=True, timeout=15)
        wait_for(lambda: self.ui.call("windows")["windows"][0]["focused"], "QA 窗口未取得原生焦点")

    def case(self, name, fn):
        print("RUN: " + name, flush=True)
        entry = {"name": name, "started": time.monotonic()}
        try:
            self.foreground()
            fn()
            entry["status"] = "passed"
        except Exception as error:
            entry.update(status="failed", error=str(error), traceback=traceback.format_exc())
            with contextlib.suppress(Exception):
                self.snapshot("failure-" + name)
            print("FAIL: " + name + ": " + str(error), flush=True)
        entry["ended"] = time.monotonic()
        self.report["checks"].append(entry)
        dump(self.artifacts / "report.json", self.report)
        if entry["status"] == "failed" and self.stop_on_failure:
            raise AcceptanceStopped(name + ": " + entry.get("error", "acceptance failed"))

    def cache(self):
        return json.loads((self.profile / "cache.json").read_text())

    def active_tree(self):
        if not self.ui.call("windows")["windows"][0]["focused"]:
            self.report.setdefault("system_focus_interruptions", []).append(time.monotonic())
            self.foreground()
        return self.ui.call("tree")

    def key(self, key, settle=True):
        if settle:
            self.active_tree()
        self.ui.call("input", events=[{"type": "key", "key": key}])
        if settle:
            self.ui.call("idle", timeout=3000)

    def navigate(self, label):
        self.key("Escape")
        if self.ui.find("button", "‹ 返回任务列表"):
            self.ui.press("button", "‹ 返回任务列表")
        if self.ui.find("button", "展开导航"):
            self.ui.press("button", "展开导航")
        self.ui.press("treeItem", self.sidebar_label(label))
        self.ui.ready()

    def sidebar_label(self, label):
        nodes = [n for n in self.ui.nodes() if n.get("role") == "treeItem"]
        match = next((n for n in nodes if n.get("label") == label), None)
        match = match or next((n for n in nodes if n.get("label", "").endswith(" " + label)), None)
        return match["label"] if match else label

    def resize(self, width):
        dump(self.size, {"Width": width, "Height": 900, "qa_request": time.monotonic_ns()})
        self.requested_width = width
        consecutive = 0
        def stable_size():
            nonlocal consecutive
            b = self.ui.call("windows")["windows"][0]["bounds"]
            consecutive = consecutive + 1 if abs(b["width"] - width) <= 1 and abs(b["height"] - 900) <= 1 else 0
            return consecutive >= 5
        wait_for(stable_size, f"实际 NSWindow 没稳定达到 {width}×900")
        self.ui.call("idle", timeout=3000)

    def invariant(self):
        windows = self.ui.call("windows")["windows"]
        assert len(windows) == 1 and windows[0]["kind"] == "content", windows
        bad = [n for n in self.ui.nodes() if n.get("role") in ("dialog", "alertDialog") or n.get("webView")]
        assert not bad, bad
        return windows[0]

    def reveal(self, role, label):
        node = self.ui.node(role, label)
        self.ui.call("act", id=node["id"], action="scrollIntoView")
        self.ui.call("idle", timeout=3000)
        return self.ui.node(role, label)

    def open(self, task):
        title = self.server.task(task)["title"]
        self.reveal_task(title)
        self.ui.press("button", title)
        wait_for(lambda: self.ui.find("button", "编辑任务标题") or self.ui.find("button", "编辑本次标题"), "任务标题阅读入口没有出现")
        self.invariant()

    def reveal_task(self, title):
        if self.ui.find("button", "‹ 返回任务列表"):
            self.ui.press("button", "‹ 返回任务列表")
        for dy in [-100000] + [480] * 20:
            node = self.ui.find("button", title)
            if node:
                return self.reveal("button", title)
            viewport = self.ui.find("list", "任务列表") or self.ui.find("scroll", "搜索结果列表")
            assert viewport, "找不到实际任务列表：" + title
            self.wheel(viewport, dy)
        raise AssertionError("虚拟列表滚动后仍未找到真实任务行：" + title)

    @staticmethod
    def stable(before, after, labels):
        for label in labels:
            a = next(n for n in before["tree"]["nodes"] if n.get("label") == label)
            b = next(n for n in after["tree"]["nodes"] if n.get("label") == label)
            assert a["id"] == b["id"], (label, "native node replaced", a, b)
            assert a["bounds"] == b["bounds"], (label, "bounds/scroll changed", a, b)

    def wheel(self, node, dy):
        b = node["bounds"]
        self.ui.call("input", events=[{"type": "wheel", "x": b["x"] + b["width"] / 2,
                                      "y": b["y"] + b["height"] / 2, "dy": dy, "precise": True}])
        self.ui.call("tree")
        time.sleep(.12)

    def entrances(self, width, suffix):
        ui = self.ui
        self.navigate("全部任务")
        self.open(self.plain)
        before = self.snapshot(f"A-{width}-{suffix}-ordinary")
        other_title = self.server.task(self.other)["title"]
        self.open(self.other)
        after = self.snapshot(f"A-{width}-{suffix}-switch")
        if width >= 1180:
            self.stable(before, after, ["任务列表", "任务行 " + other_title, "任务详情内容"])
        else:
            ui.node("button", "‹ 返回任务列表")
        self.navigate("今天")
        self.open(self.series)
        ui.node("text", "本次实例")
        self.snapshot(f"A-{width}-{suffix}-instance")
        self.navigate(self.categories[0]["name"])
        self.open(self.plain)
        self.snapshot(f"A-{width}-{suffix}-category")
        self.navigate("已完成")
        self.open(self.history)
        self.snapshot(f"A-{width}-{suffix}-history")
        self.navigate("全部任务")
        ui.fill("搜索任务", self.plain["title"][:6])
        ui.press("button", self.plain["title"])
        self.invariant()
        self.snapshot(f"A-{width}-{suffix}-search")
        self.navigate("日历")
        ui.press("radio", "日程")
        ui.press("button", f"日程 {self.day:%Y-%m-%d} " + self.plain["title"])
        self.invariant()
        self.snapshot(f"A-{width}-{suffix}-calendar")

    def title(self, width, suffix):
        self.navigate("全部任务")
        self.open(self.other)
        ui, s = self.ui, self.server
        reader = self.reveal("button", "编辑任务标题")
        ui.press("button", "编辑任务标题")
        editor = ui.node("textField", "任务标题")
        assert "multiline" in editor.get("states", []), editor
        rb, eb = reader["bounds"], editor["bounds"]
        # Native TextArea content excludes the reader's internal padding.
        # Glyph baselines are a manual item; comparing outer origins directly
        # would misclassify the established 13px/9px inset as a regression.
        assert rb["width"] - 28 <= eb["width"] <= rb["width"] and 0 <= eb["y"] - rb["y"] <= 14, (rb, eb)
        self.snapshot(f"C-{width}-{suffix}-read-edit-bounds")
        maximum = ("中文 English 标题多行 " * 20)[:200]
        assert len(maximum) == 200
        for text in ("短标题", "Chinese 中文\n原生多行 title", maximum):
            field = ui.node("textField", "任务标题")
            ui.call("act", id=field["id"], action="focus")
            ui.call("act", id=field["id"], action="selectText", **{"from": 0, "to": len(field.get("value", ""))})
            ui.call("input", events=[{"type": "text", "text": text}])
            wait_for(lambda: ui.node("textField", "任务标题")["value"] == text, "原生标题输入值不符")
            wait_for(lambda: s.task(self.other)["title"] == text.strip(), "防抖自动保存没有提交完整标题")
            assert ui.node("textField", "任务标题")["id"] == field["id"], "自动保存重建了原生输入节点"
            assert self.active_tree().get("focus") == field["id"], "自动保存丢失输入焦点"
        good = s.task(self.other)
        ui.fill("任务标题", maximum + "越")
        time.sleep(.7)
        self.snapshot(f"C-{width}-{suffix}-201-validation")
        assert s.task(self.other)["title"] == maximum, "201字符错误写入服务器"
        assert ui.node("textField", "任务标题")["value"] == maximum + "越", "校验错误丢弃输入"
        assert any("200" in n.get("label", "") for n in ui.nodes()), "缺少标题长度校验反馈"
        ui.fill("任务标题", "QA切换对照任务")
        # Do not idle before switching: this explicitly exercises blur/transition flush.
        if width >= 1180:
            ui.call("act", id=ui.node("button", self.plain["title"])["id"], action="press")
        else:
            ui.press("button", "关闭")
            self.open(self.plain)
        wait_for(lambda: s.task(self.other)["title"] == self.other["title"], "切换丢失最后输入")
        assert s.task(self.plain)["title"] == self.plain["title"], "异步保存污染另一任务"
        assert s.task(self.other)["revision"] > good["revision"]
        self.snapshot(f"C-{width}-{suffix}-switch-saved")

    def popovers(self, width, suffix):
        ui = self.ui
        for label in PROPERTIES:
            # Keep Esc, outside and Enter independent. The category path below
            # also probes actual post-Enter interactivity: focus restoration
            # alone did not prove closure with the old frame-local open state.
            self.navigate("全部任务")
            self.open(self.plain)
            ui.reveal_task_advanced(label)
            trigger = self.reveal("button", label)
            ui.press("button", label)
            self.snapshot(f"D-{width}-{suffix}-{label}-opened", image=False)
            popup = ui.node("popup", "属性选项")
            b, w = popup["bounds"], self.invariant()["bounds"]
            assert b["x"] >= 0 and b["y"] >= 0 and b["x"] + b["width"] <= w["width"] + 1 and b["y"] + b["height"] <= w["height"] + 1, popup
            self.key("Down")
            self.key("Up")
            self.snapshot(f"D-{width}-{suffix}-{label}")
            self.key("Escape")
            wait_for(lambda: not ui.find("popup", "属性选项"), "Esc没有关闭属性")
            wait_for(lambda: self.active_tree().get("focus") == trigger["id"], "Esc没有还原属性入口焦点")
            ui.press("button", label)
            popup = ui.node("popup", "属性选项")["bounds"]
            # Click the fixed toolbar, outside popup and away from toolbar actions.
            point = {"x": max(8, popup["x"] - 10), "y": 60}
            ui.call("input", events=[{"type": "click", **point}])
            wait_for(lambda: not ui.find("popup", "属性选项"), "外部点击未关闭属性")
            wait_for(lambda: self.active_tree().get("focus") == trigger["id"], "外部关闭没有恢复属性入口焦点")
            ui.press("button", label)
            self.key("Down")
            self.key("Up")
            focus_before_enter = self.active_tree().get("focus")
            self.key("Enter")
            if label in ("编辑状态", "编辑优先级", "编辑重复", "编辑提醒"):
                wait_for(lambda: self.active_tree().get("focus") == trigger["id"], "Enter没有确认属性选项并恢复anchor焦点")
            self.snapshot(f"D-{width}-{suffix}-{label}-keyboard-enter", image=False)
            self.report.setdefault("popover_keyboard", []).append({"width": width, "theme": suffix,
                "property": label, "focus_before_enter": focus_before_enter,
                "focus_after_enter": self.active_tree().get("focus"),
                "popup_after_enter": bool(ui.find("popup", "属性选项"))})
        self.category_search(width, suffix)

    def category_search(self, width, suffix):
        ui = self.ui
        self.navigate("全部任务")
        self.open(self.plain)
        before = set(c["id"] for c in self.server.task(self.plain).get("categories", []))
        target = self.categories[3]
        trigger = self.reveal("button", "编辑分类")
        ui.press("button", "编辑分类")
        ui.fill("搜索分类", target["name"])
        ui.node("button", target["name"])
        assert not ui.find("button", self.categories[4]["name"]), "分类搜索未过滤"
        self.key("Down")
        self.key("Enter")
        wait_for(lambda: self.active_tree().get("focus") == trigger["id"], "Enter未确认分类选项并恢复原anchor焦点")
        wanted = before ^ {target["id"]}
        wait_for(lambda: {c["id"] for c in self.server.task(self.plain).get("categories", [])} == wanted, "分类多选丢失其他关联或键盘未选中")
        self.snapshot(f"D-{width}-{suffix}-category-after-Enter-server-confirmed")
        # Distinguish an inert exit-frame node from a still-live editor. A live
        # searchable picker after confirmation violates natural dismissal.
        if ui.find("textField", "搜索分类"):
            ui.fill("搜索分类", self.categories[-1]["name"])
            self.snapshot(f"D-{width}-{suffix}-category-after-Enter-interactivity-probe")
            if ui.find("button", self.categories[-1]["name"]) and not ui.find("button", target["name"]):
                raise AssertionError("Enter后分类Popover仍可实际搜索/过滤，并非仅残留tree节点")
        ui.press("button", "编辑分类")
        ui.fill("搜索分类", target["name"])
        assert ui.node("button", target["name"]).get("description") == ("已选中" if target["id"] in wanted else "未选中")
        self.snapshot(f"D-{width}-{suffix}-category-search-first-selection-retained")
        second = self.categories[4]
        ui.fill("搜索分类", second["name"])
        self.key("Down")
        self.key("Enter")
        wait_for(lambda: self.active_tree().get("focus") == trigger["id"], "第二类Enter后未恢复同一anchor")
        wanted_second = wanted ^ {second["id"]}
        wait_for(lambda: {c["id"] for c in self.server.task(self.plain).get("categories", [])} == wanted_second, "第二次分类选择覆盖了第一类或其他原有关联")
        if ui.find("textField", "搜索分类"):
            ui.fill("搜索分类", self.categories[-1]["name"])
            self.snapshot(f"D-{width}-{suffix}-second-category-close-interactivity-probe")
            assert not ui.find("button", self.categories[-1]["name"]), "第二次Enter后分类Popover仍可实际搜索"
        wait_for(lambda: not any(op.get("task_id") == self.plain["id"] for op in self.cache().get("outbox", [])), "两次分类选择未获得落盘/服务器确认")
        cached = next(t for t in self.cache()["tasks"] if t["id"] == self.plain["id"])
        assert {c["id"] for c in cached.get("categories", [])} == wanted_second, "服务器成功后本机持久分类集合不一致"
        ui.press("button", "编辑分类")
        for category, selected in ((target, target["id"] in wanted_second), (second, second["id"] in wanted_second)):
            ui.fill("搜索分类", category["name"])
            assert ui.node("button", category["name"]).get("description") == ("已选中" if selected else "未选中"), "重新打开后多分类标记不一致"
        self.snapshot(f"D-{width}-{suffix}-category-search-multi-durable")
        self.key("Escape")

    def completion(self):
        self.resize(1280)
        self.navigate("全部任务")
        ui, s = self.ui, self.server
        # Start from a nonzero scroll offset, then use visible checkbox nodes.
        viewport = ui.node("list", "任务列表")
        self.wheel(viewport, 440)
        candidates = [n for n in ui.nodes() if n.get("role") == "checkBox"
                      and n.get("label", "").startswith("完成 QA连续完成")
                      and "offscreen" not in n.get("states", [])]
        assert len(candidates) >= 4, "非零滚动位置没有足够的真实任务行"
        targets = candidates[1:4]
        # An anchor above the removed rows should not move. Rows below them
        # naturally shift upward as rows disappear; that is not scroll reset.
        anchor = candidates[0]["label"].removeprefix("完成 ")
        before = self.snapshot("B-before-nonzero-scroll")
        start = time.monotonic()
        samples = []
        click_times = {}
        for node in targets:
            click_times[node["id"]] = time.monotonic()
            ui.call("act", id=node["id"], action="press")  # deliberately no idle
            samples.append(self.snapshot("B-click-immediate", image=False))
        for deadline in (.04, .09, .14, .18, .23, .32, .50):
            remaining = start + deadline - time.monotonic()
            if remaining > 0:
                time.sleep(remaining)
            samples.append(self.snapshot(f"B-timeline-{int(deadline*1000)}ms"))
        dump(self.artifacts / "completion-timeline.json", {"start": start, "samples": samples,
              "note": "Actual monotonic times are authoritative; screenshot/tree RPC latency may skip nominal sampling deadlines."})
        for node in targets:
            title = node["label"].removeprefix("完成 ")
            task = next(t for t in self.rows if t["title"] == title)
            wait_for(lambda t=task: s.task(t)["status"] == "completed", "连续完成未同步或串行误改")
        after = self.snapshot("B-after")
        self.stable(before, after, ["任务列表", "任务行 " + anchor])
        # Require observed checked feedback and later actual removal, not merely final API state.
        for node in targets:
            seen = [(sample["t"] - click_times[node["id"]], n) for sample in samples for n in sample["tree"]["nodes"] if n.get("id") == node["id"]]
            assert any("checked" in n.get("states", []) for _, n in seen), ("未采到勾选反馈", node, seen)
            # Actual sampling brackets the hide deadline. Do not claim exact
            # 180ms when the RPC/capture cadence cannot resolve that boundary.
            last_present = max((t for t, _ in seen), default=0)
            first_absent = min((sample["t"] - click_times[node["id"]] for sample in samples
                if sample["t"] >= click_times[node["id"]] and not any(n.get("id") == node["id"] for n in sample["tree"]["nodes"])), default=None)
            self.report.setdefault("completion_hide_brackets", []).append({"label": node["label"],
                "last_present_seconds": last_present, "first_absent_seconds": first_absent,
                "target_seconds": .180, "note": "Reduce Motion may legitimately remove immediately; review system preference if feedback samples are absent."})
            assert last_present < .30 and first_absent is not None, "筛选移除时序超出约180ms反馈范围或未采到移除"
            assert not any(n.get("id") == node["id"] for n in after["tree"]["nodes"]), "筛选没有移除已完成行"
        self.navigate("已完成")
        row = self.ui.node("checkBox", targets[0]["label"])
        self.snapshot("B-history-retained")
        assert "checked" in row.get("states", [])

    def rejection(self):
        self.navigate("全部任务")
        ui, s = self.ui, self.server
        self.reveal_task(self.reject["title"])
        self.reveal("checkBox", "完成 " + self.reject["title"])
        s.reject_task = self.reject["id"]
        try:
            ui.press("checkBox", "完成 " + self.reject["title"])
            wait_for(lambda: any(r.get("status") == 422 and r.get("injected") for r in s.requests), "未真正注入服务器拒绝")
            row = wait_for(lambda: ui.find("checkBox", "完成 " + self.reject["title"]), "拒绝后未恢复任务行")
            wait_for(lambda: "checked" not in ui.node("checkBox", row["label"]).get("states", []), "完成失败未回滚勾选")
            assert s.task(self.reject)["status"] == "pending"
            assert any(op.get("state") in ("rejected", "conflict") for op in self.cache().get("outbox", [])), "拒绝没有保留本机失败证据"
            self.snapshot("B-real-rejection-rollback")
        finally:
            s.reject_task = None

    def drag(self, task, target, cancel=False, edge=False):
        ui = self.ui
        title = self.server.task(task)["title"]
        source = next((n for n in ui.nodes() if n.get("label") == "拖动归类 " + title
                       and "offscreen" not in n.get("states", [])), None)
        if source is None:
            self.reveal_task(title)
            source = next(n for n in ui.nodes() if n.get("label") == "拖动归类 " + title)
        b = source["bounds"]
        x, y = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
        target_node = ui.node("treeItem", self.sidebar_label(target))
        b = target_node["bounds"]
        tx, ty = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
        ui.call("input", events=[{"type": "pointerMove", "x": x, "y": y}, {"type": "pointerDown", "x": x, "y": y}])
        try:
            for i in range(1, 9):
                ui.call("input", events=[{"type": "pointerMove", "x": x + (tx-x)*i/8, "y": y + (ty-y)*i/8}])
                ui.call("tree")
                time.sleep(.025)
            if edge:
                before = self.snapshot("E-edge-before", image=False)
                # Sidebar scroll container is exposed by current UI hooks. Its
                # native bounds, rather than window edge, define the hot zone.
                scrolls = [n for n in ui.nodes() if n.get("role") in ("scroll", "tree") and n["bounds"]["x"] < 260
                           and n["bounds"]["height"] > 200 and n["bounds"]["width"] < 300]
                assert scrolls, "未找到真实侧栏滚动容器，不能证明edge autoscroll"
                b = max(scrolls, key=lambda n: n["bounds"]["height"])["bounds"]
                tx, ty = b["x"] + b["width"] / 2, b["y"] + b["height"] - 6
                for _ in range(24):
                    ui.call("input", events=[{"type": "pointerMove", "x": tx, "y": ty}])
                    ui.call("tree")
                    time.sleep(.05)
                after = self.snapshot("E-edge-after")
                a = {n["label"]: {"id": n["id"], "bounds": n["bounds"]} for n in before["tree"]["nodes"] if n.get("role") == "treeItem" and "QA分类" in n.get("label", "")}
                changed = [n for n in after["tree"]["nodes"] if n.get("label") in a and n.get("bounds") != a[n["label"]]["bounds"]]
                self.report["sidebar_edge_scroll"] = {"before": a, "after_changed": changed}
                assert changed, "按住指针侧栏边缘没有采到分类位置变化"
                cancel = True
            self.snapshot("E-pointer-drag")
            if cancel:
                self.key("Escape", settle=False)
                ui.call("tree")
        finally:
            ui.call("input", events=[{"type": "pointerUp", "x": tx, "y": ty}])
        feedback = []
        for _ in range(6):
            tree = ui.call("tree")
            feedback.append({"t": time.monotonic(), "labels": [n.get("label", "") for n in tree["nodes"] if "系列" in n.get("label", "") or "归类" in n.get("label", "")]})
            if any("整个系列" in label and ("分类" in label or "归类" in label) for label in feedback[-1]["labels"]) and not any("整个系列" in label and ("分类" in label or "归类" in label) for sample in feedback[:-1] for label in sample["labels"]):
                self.snapshot("E-series-drop-immediate-scope-feedback")
            time.sleep(.015)
        self.report.setdefault("drag_feedback", []).append({"task_id": task["id"], "target": target,
            "cancel": cancel, "release_pointer": [tx, ty], "samples": feedback})
        ui.call("idle", timeout=3000)

    def categories_set(self, task):
        return {c["id"] for c in self.server.task(task).get("categories", [])}

    def drags(self):
        self.resize(1600)
        self.navigate("全部任务")
        s, ui = self.server, self.ui
        self.open(self.plain)
        original = s.task(self.plain)
        base = self.categories_set(self.plain)
        target = self.categories[2]
        self.drag(self.plain, target["name"])
        wait_for(lambda: self.categories_set(self.plain) == base | {target["id"]}, "聚合拖到真分类没有添加关联")
        changed = s.task(self.plain)
        for key in ("id", "title", "description", "start_time", "due_date", "priority"):
            assert changed.get(key) == original.get(key), (key, original, changed)
        self.snapshot("E-aggregate-add-detail-sync")
        # Edit title after drag; undo must apply only category difference.
        ui.fill_task_title("QA归类后编辑标题")
        wait_for(lambda: s.task(self.plain)["title"] == "QA归类后编辑标题", "后续标题没有保存")
        ui.press("button", "撤销任务归类")
        wait_for(lambda: self.categories_set(self.plain) == base, "撤销未恢复分类差异")
        assert s.task(self.plain)["title"] == "QA归类后编辑标题", "撤销覆盖了后续标题"
        self.plain["title"] = "QA归类后编辑标题"
        self.navigate(self.categories[0]["name"])
        self.drag(self.plain, target["name"])
        wanted = (base - {self.categories[0]["id"]}) | {target["id"]}
        wait_for(lambda: self.categories_set(self.plain) == wanted, "来源分类替换没有保留其他关联")
        wait_for(lambda: not ui.find("button", self.plain["title"]), "来源筛选未移除不匹配任务")
        self.navigate("全部任务")
        for invalid, cancel in (("全部任务", False), (self.categories[4]["name"], True), (target["name"], False)):
            revision = s.task(self.plain)["revision"]
            count = len(s.requests)
            self.drag(self.plain, invalid, cancel=cancel)
            time.sleep(.3)
            assert s.task(self.plain)["revision"] == revision, "无效/Esc/同目标拖拽写了服务器"
            assert not any(r["method"] == "PUT" and r["path"].split("?")[0] == f"/api/tasks/{self.plain['id']}" for r in s.requests[count:]), "无效拖拽发出修改请求"
        self.drag(self.plain, target["name"], edge=True)
        assert self.categories_set(self.plain) == wanted
        stop_owned(self.process)
        self.start()
        self.navigate("全部任务")
        self.open(self.plain)
        assert self.categories_set(self.plain) == wanted
        cached = next(t for t in self.cache()["tasks"] if t["id"] == self.plain["id"])
        assert {c["id"] for c in cached["categories"]} == wanted
        self.snapshot("E-restart-persisted")
        self.navigate("今天")
        before = s.task(self.series)
        self.drag(self.series, target["name"])
        wait_for(lambda: target["id"] in self.categories_set(self.series), "实例拖拽没有更新系列分类")
        wait_for(lambda: not any(op.get("task_id") == self.series["id"] for op in self.cache().get("outbox", [])), "系列归类服务端确认未完成")
        ui.node("text", "整个系列分类已存本机")
        self.snapshot("E-series-scope-persists-after-server-ack")
        scope_samples = self.report["drag_feedback"][-1]["samples"]
        assert any("整个系列" in label and ("分类" in label or "归类" in label) for sample in scope_samples for label in sample["labels"]) or any("整个系列" in n.get("label", "") and ("分类" in n.get("label", "") or "归类" in n.get("label", "")) for n in ui.nodes()), "重复实例归类未明确整个系列范围"
        assert s.task(self.series)["recurrence_rule"] == before["recurrence_rule"]
        assert s.task(self.series)["start_time"] == before["start_time"]
        self.snapshot("E-series-scope")

    def long_content(self, width, suffix):
        self.navigate("全部任务")
        self.open(self.plain)
        ui = self.ui
        before = self.snapshot(f"F-{width}-{suffix}-markdown-before")
        scroll = ui.node("scroll", "任务详情内容")
        self.wheel(scroll, 700)
        after = self.snapshot(f"F-{width}-{suffix}-markdown-scrolled")
        if width >= 1180:
            self.stable(before, after, ["任务列表"])
        a = next(n for n in before["tree"]["nodes"] if n.get("label") == "编辑任务标题")
        b = next(n for n in after["tree"]["nodes"] if n.get("label") == "编辑任务标题")
        assert b["bounds"]["y"] < a["bounds"]["y"] or "offscreen" in b.get("states", []), "长Markdown没有实际滚动"
        ui.reveal_task_advanced("编辑分类")
        self.reveal("button", "编辑分类")
        ui.press("button", "编辑分类")
        ui.fill("搜索分类", self.categories[-1]["name"])
        ui.node("button", self.categories[-1]["name"])
        self.snapshot(f"F-{width}-{suffix}-many-categories-search")
        self.key("Escape")

    def instance_autosave(self):
        self.resize(1280)
        self.navigate("今天")
        self.open(self.series)
        ui, s = self.ui, self.server
        base = s.task(self.series)
        ui.press("button", "编辑本次标题")
        title = "QA仅本次自动保存 中文 English"
        ui.fill("本次标题", title)
        wait_for(lambda: any(o["task_id"] == self.series["id"] and o["title"] == title
                 for o in s.api("/api/tasks/next-occurrences")), "实例标题没有通过自动保存写入实例")
        if not ui.find("textField", "本次描述"):
            ui.press("button", "编辑本次描述")
        ui.fill("本次描述", "仅本次 Markdown\n\n- 保留系列和下一次")
        wait_for(lambda: any(o["task_id"] == self.series["id"] and o.get("description", "").startswith("仅本次 Markdown")
                 for o in s.api("/api/tasks/next-occurrences")), "本次描述未自动保存")
        after = s.task(self.series)
        for key in ("title", "description", "start_time", "recurrence_rule"):
            assert after.get(key) == base.get(key), ("实例自动保存污染系列", key)
        self.snapshot("C-instance-autosave-scope")
        # Keep later drag fixtures discoverable by their original series title.
        if not ui.find("textField", "本次标题"):
            ui.press("button", "编辑本次标题")
        ui.fill("本次标题", base["title"])
        wait_for(lambda: any(o["task_id"] == self.series["id"] and o["title"] == base["title"]
                 for o in s.api("/api/tasks/next-occurrences")), "实例标题恢复未同步")
        ui.fill("本次标题", "QA实例第二次改名")
        wait_for(lambda: any(o["task_id"] == self.series["id"] and o["title"] == "QA实例第二次改名"
                 for o in s.api("/api/tasks/next-occurrences")), "同一实例第二次改名未更新")
        ui.fill("本次标题", "")
        wait_for(lambda: any(o["task_id"] == self.series["id"] and o["title"] == base["title"]
                 and o.get("description", "").startswith("仅本次 Markdown")
                 for o in s.api("/api/tasks/next-occurrences")), "清空标题覆盖后没有恢复系列标题或丢失本次描述")
        self.snapshot("C-instance-rename-restore-empty-override-description-preserved")
        ui.fill("本次标题", base["title"])
        wait_for(lambda: not any(op.get("task_id") == self.series["id"] for op in self.cache().get("outbox", [])), "本次标题边界验证后队列未确认")

    def offline(self):
        self.resize(1280)
        self.navigate("全部任务")
        self.open(self.other)
        ui, s = self.ui, self.server
        old = s.task(self.other)
        s.offline = True
        try:
            ui.fill_task_title("QA离线本机保存")
            wait_for(lambda: any(op.get("task_id") == self.other["id"] for op in self.cache().get("outbox", [])), "离线自动保存没有持久队列")
            wait_for(lambda: any("已存本机" in n.get("label", "") for n in ui.nodes()), "离线UI没有准确区分本机保存")
            assert s.task(self.other)["title"] == old["title"], "隔离网关断网没有生效"
            assert not ui.find("text", "已同步"), "离线却宣称已同步"
            pending = self.cache()["outbox"]
            self.snapshot("C-offline-local-pending")
            completion_target = self.rows[-1]
            self.reveal_task(completion_target["title"])
            ui.press("checkBox", "完成 " + completion_target["title"])
            wait_for(lambda: any(op.get("task_id") == completion_target["id"] and op.get("body", {}).get("status") == "completed" for op in self.cache().get("outbox", [])), "离线完成没有本机持久队列")
            self.navigate("已完成")
            row = ui.node("checkBox", "完成 " + completion_target["title"])
            assert "checked" in row.get("states", []), "离线完成队列未投影到真实历史行"
            assert s.task(completion_target)["status"] == "pending", "离线完成被错误宣称服务器成功"
            pending = self.cache()["outbox"]
            self.snapshot("B-offline-completion-queued")
            stop_owned(self.process)
            self.start()
            self.navigate("全部任务")
            self.ui.press("button", "QA离线本机保存")
            assert self.ui.node("button", "编辑任务标题").get("description") == "QA离线本机保存"
            assert {op["id"] for op in pending} <= {op["id"] for op in self.cache()["outbox"]}
            self.snapshot("C-offline-restart-durable")
        finally:
            s.offline = False
        self.ui.press("button", "刷新")
        wait_for(lambda: s.task(self.other)["title"] == "QA离线本机保存", "恢复网络后未提交自动保存", timeout=30)
        wait_for(lambda: s.task(completion_target)["status"] == "completed", "恢复网络后离线完成未同步", timeout=30)
        wait_for(lambda: not any(op.get("task_id") == self.other["id"] for op in self.cache().get("outbox", [])), "服务端成功后未清队列", timeout=30)
        self.snapshot("C-online-server-acknowledged")

    def baseline(self):
        """Observe the preserved binary; only actual observations are confirmed."""
        findings = []
        try:
            self.server.start()
            self.report["owned_backend_pid"] = self.server.process.pid
            self.seed()
            self.start()
            self.resize(1280)
            self.navigate("设置")
            self.ui.choose("外观", "浅色")
            for page, entry_kind in (("已完成", "ordinary"), ("已完成", "instance"), ("日历", "ordinary")):
                def entrance(page=page, entry_kind=entry_kind):
                    self.navigate(page)
                    before = self.snapshot("baseline-A-" + page + "-" + entry_kind + "-before")
                    if page == "日历":
                        self.ui.press("radio", "日程")
                        label = f"日程 {self.day:%Y-%m-%d} " + self.plain["title"]
                    else:
                        label = self.series_history["title"] if entry_kind == "instance" else self.history["title"]
                    self.ui.press("button", label)
                    wait_for(lambda: self.ui.find("button", "编辑任务标题") or self.ui.find("button", "编辑本次标题"), "基线任务标题入口没有出现")
                    after = self.snapshot("baseline-A-" + page + "-" + entry_kind + "-opened")
                    dialogs = [n for n in after["tree"]["nodes"] if n.get("role") in ("dialog", "alertDialog")]
                    findings.append({"module": "A", "entry": page, "entry_kind": entry_kind,
                        "result": "confirmed" if dialogs or len(after["windows"]) > len(before["windows"]) else "not-reproduced",
                        "observation": "Fallback detail dialog/extra window" if dialogs else "No accessible detail dialog observed",
                        "dialogs": dialogs, "windows": after["windows"]})
                    self.ui.press("button", "关闭")
                self.case("baseline-A-" + page + "-" + entry_kind, entrance)
            for width in (1024, 1280, 1600):
                def title_bounds(width=width):
                    self.resize(width)
                    self.navigate("全部任务")
                    self.open(self.other)
                    reader = self.reveal("button", "编辑任务标题")
                    self.ui.press("button", "编辑任务标题")
                    editor = self.ui.node("textField", "任务标题")
                    rb, eb = reader["bounds"], editor["bounds"]
                    bad = eb["width"] < rb["width"] - 28 or not (0 <= eb["y"] - rb["y"] <= 14)
                    findings.append({"module": "C", "width_requested": width,
                        "actual_window": self.ui.call("windows")["windows"][0]["bounds"],
                        "result": "confirmed" if bad else "not-reproduced",
                        "observation": "read/edit bounds exceed established native content-inset tolerance" if bad else "read/edit bounds within established native content-inset tolerance; glyph baseline unverified",
                        "bounds_delta": {"x": eb["x"] - rb["x"], "y": eb["y"] - rb["y"], "width": eb["width"] - rb["width"]},
                        "reader": reader, "editor": editor})
                    self.snapshot(f"baseline-C-{width}-read-edit")
                    self.ui.fill("任务标题", ("中文 English 多行 " * 20)[:200])
                    self.snapshot(f"baseline-C-{width}-200-native-multiline")
                    self.ui.fill("任务标题", self.other["title"])
                    self.key("Escape")
                    self.ui.press("button", "关闭")
                self.case(f"baseline-C-{width}", title_bounds)
            def complete():
                self.resize(1280)
                self.navigate("全部任务")
                self.open(self.other)
                viewport = self.ui.node("list", "任务列表")
                self.wheel(viewport, 450)
                before = self.snapshot("baseline-B-before-nonzero-scroll")
                candidates = [n for n in before["tree"]["nodes"] if n.get("role") == "checkBox"
                    and n.get("label", "").startswith("完成 QA连续完成") and "offscreen" not in n.get("states", [])]
                assert len(candidates) >= 3, "滚动后真实可见行不足"
                self.server.status_delay = .45
                samples = []
                start = time.monotonic()
                for index, node in enumerate(candidates[:3]):
                    self.ui.call("act", id=node["id"], action="press")
                    samples.append(self.snapshot(f"baseline-B-click-{index}", image=False))
                for delay in (.03, .10, .18, .25, .50, .80, 1.20):
                    remaining = start + delay - time.monotonic()
                    if remaining > 0:
                        time.sleep(remaining)
                    samples.append(self.snapshot(f"baseline-B-{int(delay*1000)}ms"))
                self.server.status_delay = 0
                after = self.snapshot("baseline-B-after")
                disabled = [n for sample in samples for n in sample["tree"]["nodes"]
                    if n.get("label") in ("刷新", self.other["title"], "＋ 新建任务") and "disabled" in n.get("states", [])]
                selected_before = [n for n in before["tree"]["nodes"] if n.get("label") == "编辑任务标题"]
                selected_after = [n for n in after["tree"]["nodes"] if n.get("label") == "编辑任务标题"]
                unchanged_labels = ["任务列表", "任务行 " + candidates[-1]["label"].removeprefix("完成 ")]
                differences = []
                for label in unchanged_labels:
                    a = next((n for n in before["tree"]["nodes"] if n.get("label") == label), None)
                    b = next((n for n in after["tree"]["nodes"] if n.get("label") == label), None)
                    if a is None or b is None or a["id"] != b["id"] or a["bounds"] != b["bounds"]:
                        differences.append({"label": label, "before": a, "after": b})
                observations = {"global_busy_disabled_controls": disabled,
                    "selection_lost": bool(selected_before and not selected_after), "node_or_scroll_changes": differences,
                    "clicked_task_statuses": {n["label"]: self.server.task(next(t for t in self.rows if t["title"] == n["label"].removeprefix("完成 ")))["status"] for n in candidates[:3]}}
                findings.append({"module": "B", "result": "confirmed" if disabled or observations["selection_lost"] or differences else "not-reproduced",
                    "observation": observations, "transport_delay_seconds": .45,
                    "timing_note": "Real backend responses forwarded after a controlled latency; UI code and persistence are unchanged."})
                dump(self.artifacts / "baseline-completion-timeline.json", {"start": start, "before": before, "samples": samples, "after": after})
            self.case("baseline-B-completion", complete)
            self.report["status"] = "baseline-observed" if all(c["status"] == "passed" for c in self.report["checks"]) else "baseline-partial"
        except Exception as error:
            self.report.update(status="baseline-blocked", fatal=str(error), traceback=traceback.format_exc())
            raise
        finally:
            self.report["findings"] = findings
            self.report["interpretation"] = "Only findings marked confirmed are reproduced. Earlier exploratory receipts are preserved; this invocation is self-contained. Native reader/editor outer bounds include different content insets and do not establish glyph baseline movement."
            lines = ["# Preserved baseline real-window observations", "", "Status: " + self.report["status"], ""]
            lines += [f"- {item['module']} {item.get('entry', item.get('width_requested', ''))} {item.get('entry_kind', '')}: {item['result']} — {item['observation']}" for item in findings]
            lines += ["", "Binary SHA-256:", ""] + [f"- {path}: {digest}" for path, digest in self.report["binaries"].items()]
            lines += ["", self.report["interpretation"], "", "Manual/unverified:", ""] + ["- " + item for item in MANUAL]
            (self.artifacts / "report.md").write_text("\n".join(lines) + "\n")
            dump(self.artifacts / "receipt.json", self.report)
            dump(self.artifacts / "http-evidence.json", self.server.requests)
            stop_owned(self.process)
            self.server.close()
            self.log.close()
            stop_owned(self.awake)
            dump(self.artifacts / "report.json", self.report)
        return all(c["status"] == "passed" for c in self.report["checks"])

    def fast_ack_instances(self):
        self.resize(1280)
        self.navigate("全部任务")
        ui, s = self.ui, self.server
        base = s.task(self.series)
        rounds = []
        for index in range(3):
            first = next(o for o in s.api("/api/tasks/next-occurrences") if o["task_id"] == self.series["id"])
            wait_for(lambda: any(o.get("task_id") == self.series["id"] and o.get("instance_id") == first["instance_id"]
                     for o in self.cache().get("next_occurrences", [])), "客户端尚未采纳下一实例projection，不能开始下一次可见行操作", timeout=25)
            self.reveal_task(first["title"])
            checkbox = ui.node("checkBox", "完成 " + first["title"])
            before = self.snapshot(f"B-fast-ack-instance-{index}-before")
            begin = time.monotonic()
            ui.call("act", id=checkbox["id"], action="press")
            samples, ack_at = [], None
            for deadline in (.02, .055, .09, .125, .16, .185, .215, .26, .33):
                remaining = begin + deadline - time.monotonic()
                if remaining > 0:
                    time.sleep(remaining)
                sample = self.snapshot(f"B-fast-ack-instance-{index}-{int(deadline*1000)}ms", image=deadline in (.02, .26))
                samples.append(sample)
                current = next(o for o in s.api("/api/tasks/next-occurrences") if o["task_id"] == self.series["id"])
                if current["instance_id"] != first["instance_id"] and ack_at is None:
                    ack_at = time.monotonic() - begin
            evidence = {"instance_id": first["instance_id"], "checkbox_id": checkbox["id"],
                        "started": begin, "ack_observed_seconds": ack_at, "before": before, "samples": samples}
            dump(self.artifacts / f"fast-ack-instance-{index}.json", evidence)
            rounds.append({k: v for k, v in evidence.items() if k not in ("before", "samples")})
            assert ack_at is not None and ack_at < .15, "未满足快ACK前置条件：150ms内尚未观察到下一实例，不能证明快ACK反馈边界"
            early = [sample for sample in samples if ack_at <= sample["t"] - begin < .15]
            assert early, "没有采到ACK后/150ms前帧；采样精度不足，不能宣称通过"
            for sample in early:
                retained = next((n for n in sample["tree"]["nodes"] if n["id"] == checkbox["id"]), None)
                assert retained and "checked" in retained.get("states", []), "快ACK替换projection后原实例勾选行提前消失"
            late = samples[-1]
            assert not any(n["id"] == checkbox["id"] for n in late["tree"]["nodes"]), "反馈截止后原实例行未移除"
            self.invariant()
        self.report["fast_ack_instance_rounds"] = rounds
        after = s.task(self.series)
        assert after["start_time"] == base["start_time"] and after["recurrence_rule"] == base["recurrence_rule"], "连续完成实例污染系列规则/起点"

    def diagnose_popover(self):
        self.resize(1280)
        self.navigate("全部任务")
        self.open(self.plain)
        ui = self.ui
        anchor = self.reveal("button", "编辑状态")
        ui.press("button", "编辑状态")
        before = self.snapshot("minimal-D-fresh-open-before-Esc")
        self.key("Escape")
        time.sleep(.2)
        after = self.snapshot("minimal-D-fresh-open-after-Esc")
        focus = after["tree"].get("focus")
        receipt = {"anchor_before": anchor, "before": before, "after": after,
                   "focus_after": focus, "focused_node_after": next((n for n in after["tree"]["nodes"] if n["id"] == focus), None)}
        dump(self.artifacts / "popover-fresh-Esc-receipt.json", receipt)
        assert any(n["id"] == anchor["id"] for n in after["tree"]["nodes"]), "全新Popover直接Esc导致详情/anchor卸载"
        assert focus == anchor["id"], "全新Popover直接Esc未恢复同一anchor焦点"
        assert not any(n.get("role") == "popup" for n in after["tree"]["nodes"]), "全新Popover直接Esc未关闭"

    def diagnose_instance_restore(self):
        self.resize(1280)
        self.navigate("今天")
        self.open(self.series)
        ui, s = self.ui, self.server
        base = s.task(self.series)
        ui.press("button", "编辑本次标题")
        ui.fill("本次标题", "QA独立实例标题覆盖")
        wait_for(lambda: any(o["task_id"] == self.series["id"] and o["title"] == "QA独立实例标题覆盖" for o in s.api("/api/tasks/next-occurrences")), "独立实例覆盖标题未保存")
        if not ui.find("textField", "本次描述"):
            ui.press("button", "编辑本次描述")
        ui.fill("本次描述", "QA独立实例描述覆盖")
        wait_for(lambda: any(o["task_id"] == self.series["id"] and o.get("description") == "QA独立实例描述覆盖" for o in s.api("/api/tasks/next-occurrences")), "独立实例覆盖描述未保存")
        before = s.api("/api/tasks/next-occurrences")
        ui.fill("本次标题", base["title"])
        readings = []
        for _ in range(25):
            readings.append({"t": time.monotonic(), "server": s.api("/api/tasks/next-occurrences")})
            if any(o["task_id"] == self.series["id"] and o["title"] == base["title"] for o in readings[-1]["server"]):
                break
            time.sleep(.1)
        snapshot = self.snapshot("minimal-C-instance-restored-UI-server-readback")
        receipt = {"series_before": base, "server_before_restore": before, "server_readings_after_restore": readings,
                   "ui": snapshot, "cache": self.cache(),
                   "requests": [r for r in s.requests if r["method"] == "PUT" and r["path"] == f"/api/tasks/{self.series['id']}"]}
        dump(self.artifacts / "instance-restore-direct-server-receipt.json", receipt)
        assert any(o["task_id"] == self.series["id"] and o["title"] == base["title"] for o in readings[-1]["server"]), "恢复系列同名标题PUT成功后直接server读数仍保留先前实例标题"

    def diagnose_series_scope(self):
        self.resize(1280)
        self.navigate("今天")
        self.reveal_task(self.series["title"])
        ui, s = self.ui, self.server
        before = s.task(self.series)
        original = self.categories_set(self.series)
        target = self.categories[2]
        self.snapshot("minimal-E-series-before-drop")
        self.drag(self.series, target["name"])
        wait_for(lambda: self.categories_set(self.series) == original | {target["id"]}, "系列归类未同步")
        wait_for(lambda: not any(op.get("task_id") == self.series["id"] for op in self.cache().get("outbox", [])), "系列归类尚未收到服务端确认")
        ui.node("text", "整个系列分类已存本机")
        after = self.snapshot("minimal-E-series-scope-after-server-ack")
        feedback = self.report["drag_feedback"][-1]
        receipt = {"series_before": before, "series_after": s.task(self.series),
                   "feedback": feedback, "after_server_ack": after}
        dump(self.artifacts / "series-scope-drop-receipt.json", receipt)
        assert any("整个系列" in label and ("分类" in label or "归类" in label) for sample in feedback["samples"] for label in sample["labels"]), "实际drop后即时采样未见整个系列归类作用域提示"
        ui.press("button", "撤销任务归类")
        wait_for(lambda: self.categories_set(self.series) == original, "撤销系列分类没有恢复原关联")
        wait_for(lambda: not ui.find("text", "整个系列分类已存本机"), "撤销后系列范围撤销行未清除")
        self.snapshot("minimal-E-series-scope-cleared-on-undo")
        self.drag(self.series, target["name"])
        wait_for(lambda: self.categories_set(self.series) == original | {target["id"]}, "第二次系列归类未保存")
        ui.node("text", "整个系列分类已存本机")
        self.navigate("全部任务")
        ui.node("text", "整个系列分类已存本机")
        plain_before = self.categories_set(self.plain)
        self.drag(self.plain, target["name"])
        wait_for(lambda: self.categories_set(self.plain) == plain_before | {target["id"]}, "普通任务后续归类未保存")
        ui.node("text", "分类已存本机")
        assert not ui.find("text", "整个系列分类已存本机"), "下一次普通归类仍错误显示系列scope"
        assert self.categories_set(self.series) == original | {target["id"]}, "普通任务手势误改系列分类"
        self.snapshot("minimal-E-ordinary-gesture-replaces-series-scope")
        ui.press("button", "撤销任务归类")
        wait_for(lambda: self.categories_set(self.plain) == plain_before, "普通撤销未恢复分类")
        assert self.categories_set(self.series) == original | {target["id"]}, "普通撤销覆盖了前一次系列分类"

    def agenda_visual(self, suffix):
        self.resize(1280)
        self.navigate("日历")
        ui = self.ui
        ui.press("radio", "日程")
        ui.press("button", "刷新")
        ui.ready()
        buttons = [ui.node("button", f"日程 {self.day:%Y-%m-%d} " + task["title"]) for task in self.agenda_tasks]
        summary = wait_for(lambda: next((n for n in ui.nodes() if n.get("role") == "text" and n.get("label", "").startswith("QA_LONG_SUMMARY")), None), "长日程摘要原生文本未出现")
        b = summary["bounds"]
        assert 0 < b["height"] <= 70, ("摘要未限制为约三行", summary)
        assert b["y"] + b["height"] <= buttons[1]["bounds"]["y"] - 4, "长摘要bounds覆盖相邻事件"
        assert buttons[1]["bounds"]["y"] + buttons[1]["bounds"]["height"] < buttons[2]["bounds"]["y"], "后续事件geometry重叠"
        assert self.server.task(self.agenda_tasks[0])["description"] == self.agenda_long, "日历摘要截断破坏完整description模型"
        self.report.setdefault("agenda_geometry", []).append({"theme": suffix, "summary": summary,
            "events": buttons, "full_description_length": len(self.agenda_long)})
        self.snapshot("affected-1280-" + suffix + "-agenda-adjacent-long-summary")

    def hints_visual(self, suffix):
        self.resize(1280)
        self.navigate("全部任务")
        self.open(self.plain)
        ui = self.ui
        for trigger, close, slug in (("编辑分类", "收起分类", "categories"), ("编辑优先级", "收起优先级", "priority")):
            ui.reveal_task_advanced(trigger)
            self.reveal("button", trigger)
            ui.press("button", trigger)
            ui.node("text", "选择后自动存入本机，联网后同步")
            assert not ui.find("text", "草稿 · 保存任务后生效"), "已有任务仍显示旧保存语义"
            self.snapshot("affected-1280-" + suffix + "-existing-" + slug + "-hint")
            ui.press("button", close)
        ui.press("button", "关闭")
        ui.press("button", "＋ 新建任务")
        ui.reveal_task_advanced("编辑分类")
        ui.press("button", "编辑分类")
        ui.node("text", "创建任务后生效")
        assert not ui.find("text", "选择后自动存入本机，联网后同步"), "未创建任务错误宣称已自动保存"
        self.snapshot("affected-1280-" + suffix + "-new-category-hint")
        ui.press("button", "收起分类")
        ui.press("button", "关闭")

    def prepare_agenda_fixtures(self):
        self.agenda_long = "QA_LONG_SUMMARY 中文 English\n" + "长日程摘要不得遮挡下方相邻事件；完整模型必须保留。\n" * 90
        self.agenda_tasks = [self.server.api("/api/tasks", "POST", {"title": f"QA相邻事件{i+1}",
            "description": self.agenda_long if i == 0 else f"相邻事件{i+1}说明",
            "start_time": (self.day.replace(hour=7) + timedelta(minutes=30*i)).isoformat(),
            "end_time": (self.day.replace(hour=7) + timedelta(minutes=30*i+20)).isoformat(), "reminder_policy": "none"}) for i in range(3)]

    def run(self, targeted=False, modules="ABCDEF", diagnose=False, restore_only=False, category_proof=None, fast_ack_proof=False, series_scope_proof=False, visual_affected=False, final_full=False):
        enabled = set(modules)
        self.stop_on_failure = final_full
        try:
            self.server.start()
            self.report["owned_backend_pid"] = self.server.process.pid
            self.seed()
            self.start()
            if visual_affected:
                self.report["scope"] = "final3-affected-agenda-hints-and-A-C-B-spotchecks"
                self.prepare_agenda_fixtures()
                for appearance, suffix in (("浅色", "light"), ("深色", "dark")):
                    self.resize(1280)
                    self.navigate("设置")
                    self.ui.choose("外观", appearance)
                    self.case("final3-agenda-1280-" + suffix, lambda s=suffix: self.agenda_visual(s))
                    self.case("final3-property-hints-1280-" + suffix, lambda s=suffix: self.hints_visual(s))
                self.case("A-1280-spotcheck", lambda: self.entrances(1280, "dark"))
                self.case("C-1280-spotcheck", lambda: self.title(1280, "dark"))
                self.case("B-ordinary-spotcheck", self.completion)
                self.case("B-fast-ACK-spotcheck", self.fast_ack_instances)
                self.report["status"] = "failed" if any(c["status"] == "failed" for c in self.report["checks"]) else "automated-passed-manual-pending"
                return self.report["status"] == "automated-passed-manual-pending"
            if fast_ack_proof or series_scope_proof:
                self.report["scope"] = "final-fast-ACK-only" if fast_ack_proof else "final-minimal-series-drop-scope-only"
                self.case("B-fast-ACK-three-instances", self.fast_ack_instances) if fast_ack_proof else self.case("E-minimal-series-drop-scope", self.diagnose_series_scope)
                self.report["status"] = "failed" if any(c["status"] == "failed" for c in self.report["checks"]) else "automated-passed-manual-pending"
                return self.report["status"] == "automated-passed-manual-pending"
            if category_proof:
                self.report["scope"] = "final-category-Enter-focus-and-server-multiselect-" + category_proof
                matrix = [(1280, "浅色", "light")] if category_proof == "minimal" else [(w, appearance, theme) for w in (1024, 1280, 1600) for appearance, theme in (("浅色", "light"), ("深色", "dark"))]
                for width, appearance, theme in matrix:
                    self.resize(width)
                    self.navigate("设置")
                    self.ui.choose("外观", appearance)
                    self.case(f"D-category-{width}-{theme}", lambda w=width, t=theme: self.category_search(w, t))
                self.report["status"] = "failed" if any(c["status"] == "failed" for c in self.report["checks"]) else "automated-passed-manual-pending"
                return self.report["status"] == "automated-passed-manual-pending"
            if diagnose or restore_only:
                self.report["scope"] = "minimal-instance-title-restore" if restore_only else "minimal-fresh-popover-Esc-and-instance-title-restore"
                if not restore_only:
                    self.case("D-minimal-fresh-open-Esc", self.diagnose_popover)
                self.case("C-minimal-instance-title-restore", self.diagnose_instance_restore)
                self.report["status"] = "failed" if any(c["status"] == "failed" for c in self.report["checks"]) else "automated-passed-manual-pending"
                return self.report["status"] == "automated-passed-manual-pending"
            if targeted:
                self.report["scope"] = "final-build-affected-B-fast-ACK-instances-and-ordinary-A-C-spotcheck"
                self.resize(1280)
                self.navigate("设置")
                self.ui.choose("外观", "浅色")
                self.case("A-1280-light-spotcheck", lambda: self.entrances(1280, "light"))
                self.case("C-1280-light-spotcheck", lambda: self.title(1280, "light"))
                self.case("B-fast-ACK-three-instances", self.fast_ack_instances)
                self.case("B-consecutive-ordinary", self.completion)
                self.report["status"] = "failed" if any(c["status"] == "failed" for c in self.report["checks"]) else "automated-passed-manual-pending"
                return self.report["status"] == "automated-passed-manual-pending"
            if final_full:
                self.report["category_close_fix_under_test"] = {
                    "confirmed_root_cause": "App selection was re-derived into a frame-local bool; event close changed the stale bool and the next frame reopened the picker.",
                    "parent_fix": "ownedPropertyOpen stores persistent ui.Local bool and tracks owner activation edges for normal and quick pickers.",
                    "acceptance": "Enter must leave search noninteractive, then reopening and selecting a second category must retain both associations durably; no residual-only assumption."}
            self.report["scope"] = "full-A-F-window-theme-matrix" if enabled == set("ABCDEF") else "same-binary-followup-modules-" + "".join(sorted(enabled))
            self.report["matrix_expected"] = [{"width": w, "theme": t} for w in (1024, 1280, 1600) for t in ("light", "dark")]
            for width in (1024, 1280, 1600):
                self.resize(width)
                for appearance, suffix in (("浅色", "light"), ("深色", "dark")):
                    self.navigate("设置")
                    self.ui.choose("外观", appearance)
                    for module, fn in (("A", self.entrances), ("C", self.title), ("D", self.popovers), ("F", self.long_content)):
                        if module not in enabled:
                            continue
                        def matrix_case(f=fn, w=width, s=suffix):
                            self.resize(w)
                            f(w, s)
                        self.case(f"{module}-{width}-{suffix}", matrix_case)
            if "C" in enabled:
                self.case("C-instance-autosave", self.instance_autosave)
            if "B" in enabled:
                self.case("B-consecutive-completion", self.completion)
            if "E" in enabled:
                self.case("E-native-category-drag", self.drags)
            if "B" in enabled or "C" in enabled:
                self.case("C-offline-restart-sync", self.offline)
            if "B" in enabled:
                self.case("B-fast-ACK-three-instances", self.fast_ack_instances)
            if final_full:
                self.report["includes_designer_affected_checks"] = True
                self.prepare_agenda_fixtures()
                for appearance, suffix in (("浅色", "light"), ("深色", "dark")):
                    self.resize(1280)
                    self.navigate("设置")
                    self.ui.choose("外观", appearance)
                    self.case("final-visual-agenda-1280-" + suffix, lambda s=suffix: self.agenda_visual(s))
                    self.case("final-visual-property-hints-1280-" + suffix, lambda s=suffix: self.hints_visual(s))
            # Terminal rejection stays in outbox for evidence; run last so it
            # cannot block unrelated mutation synchronization in earlier cases.
            if "B" in enabled:
                self.case("B-server-rejection-rollback", self.rejection)
            self.report["status"] = "failed" if any(c["status"] == "failed" for c in self.report["checks"]) else "automated-passed-manual-pending"
        except AcceptanceStopped as error:
            self.report.update(status="failed-stopped", stopped_at_failure=str(error))
        except Exception as error:
            self.report.update(status="blocked", fatal=str(error), traceback=traceback.format_exc())
            raise
        finally:
            with contextlib.suppress(Exception):
                dump(self.artifacts / "final-cache.json", self.cache())
            dump(self.artifacts / "http-evidence.json", self.server.requests)
            stop_owned(self.process)
            self.server.close()
            self.log.close()
            stop_owned(self.awake)
            dump(self.artifacts / "report.json", self.report)
            lines = ["# Detail interactions A–F", "", "Status: " + self.report["status"], ""]
            lines += [f"- {c['name']}: {c['status']}" + (": " + c["error"] if "error" in c else "") for c in self.report["checks"]]
            lines += ["", "Manual / unverified:", ""] + ["- " + item for item in MANUAL]
            (self.artifacts / "report.md").write_text("\n".join(lines) + "\n")
        return self.report["status"] == "automated-passed-manual-pending"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--final-ready", action="store_true", help="Only after parent announces the next final build ready: explicit --app, series/category minimal proof or complete A–F plus Designer checks")
    parser.add_argument("--visual-affected", action="store_true", help="After parent announces final3 ready: 1280 light/dark adjacent agenda summaries, existing/new property hints and ordinary A/C/B spotchecks; separate receipt")
    parser.add_argument("--fast-ack-proof", action="store_true", help="Only the three fast-ACK instance rounds, after waiting for each next projection")
    parser.add_argument("--series-scope-proof", action="store_true", help="Only one recurring instance pointer drop with immediate scope sampling")
    parser.add_argument("--category-proof", choices=("minimal", "matrix"), help="Only repair-validation of searchable multiselect category Enter/focus path; preserves all server and selection assertions")
    parser.add_argument("--backend-ready", action="store_true", help="Use only after parent announces backend-ready; defaults to final2 native binary and separate windows-final evidence")
    parser.add_argument("--restore-only", action="store_true", help="Minimal server restore proof before the one final full run; requires the ordinary execution gate")
    parser.add_argument("--diagnose", action="store_true", help="Only minimal fresh-open Esc and instance restore repros; fresh isolated profile/server and explicit binary")
    parser.add_argument("--modules", default="ABCDEF", help="Explicit same-binary follow-up subset, e.g. DE; default retains the full A–F suite")
    parser.add_argument("--targeted-final", action="store_true", help="After a separately authorized final build: affected B fast-ACK instance timeline plus ordinary A/C spotchecks; use a fresh artifact directory")
    parser.add_argument("--baseline", action="store_true", help="Authorized preserved baseline binary A/B/C observation only; never runs the new binary")
    parser.add_argument("--buildready", action="store_true", help="Run only after the parent explicitly announces buildready; does not build")
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--server", type=Path, default=ROOT.parent / "bin/todo-app")
    parser.add_argument("--artifacts", type=Path, default=DEFAULT_ARTIFACTS)
    args = parser.parse_args()
    if not args.modules or set(args.modules) - set("ABCDEF"):
        parser.error("--modules must be a nonempty subset of ABCDEF")
    if args.final_ready:
        if args.app == ROOT / "build/qa/todo-native-qa":
            parser.error("--final-ready requires parent-provided explicit final binary path")
        if args.backend_ready or args.baseline or args.targeted_final or args.diagnose or args.visual_affected or args.fast_ack_proof or args.modules != "ABCDEF":
            parser.error("--final-ready is only for series/category minimal proof, optional restore proof, or the final full suite")
        if args.category_proof == "matrix":
            parser.error("Before the final full suite use --category-proof minimal, not a repeated matrix")
        if args.artifacts == DEFAULT_ARTIFACTS:
            version = re.search(r"final(\d+)$", args.app.name)
            folder = "windows-final" + (version.group(1) if version else "-current")
            suffix = "series-scope-minimal" if args.series_scope_proof else ("category-minimal" if args.category_proof else ("minimal-restore" if args.restore_only else "full"))
            args.artifacts = FINAL_ARTIFACTS.parent / folder / suffix
    if args.visual_affected:
        if args.backend_ready or args.baseline or args.targeted_final:
            parser.error("--visual-affected requires its separately authorized --buildready and final3 binary, not historical/final2 modes")
        if args.app == ROOT / "build/qa/todo-native-qa":
            args.app = ROOT / "build/qa/todo-native-detail-final3"
        if args.artifacts == DEFAULT_ARTIFACTS:
            args.artifacts = FINAL_ARTIFACTS.parent / "windows-final3-affected"
    if args.backend_ready:
        if args.baseline or args.targeted_final or args.diagnose or args.modules != "ABCDEF":
            parser.error("--backend-ready is for the final complete suite or --restore-only; do not mix historical/subset modes")
        if args.app == ROOT / "build/qa/todo-native-qa":
            args.app = FINAL_APP
        if args.app.resolve() != FINAL_APP.resolve():
            parser.error("--backend-ready requires the explicit final2 native binary")
        if args.artifacts == DEFAULT_ARTIFACTS:
            suffix = "fast-ack-followup" if args.fast_ack_proof else ("series-scope-minimal" if args.series_scope_proof else ("category-" + args.category_proof if args.category_proof else ("minimal-restore" if args.restore_only else "full")))
            args.artifacts = FINAL_ARTIFACTS / suffix
    if args.baseline:
        baseline = ROOT / "artifacts/detail-interactions/20261111-round2/baseline-source/todo-native-qa"
        if args.app == ROOT / "build/qa/todo-native-qa":
            args.app = baseline
        if args.app.resolve() != baseline.resolve():
            parser.error("--baseline only accepts the preserved authorized baseline binary")
        if args.artifacts == DEFAULT_ARTIFACTS:
            args.artifacts = DEFAULT_ARTIFACTS.parent / "baseline-windows"
    if not args.buildready and not args.backend_ready and not args.final_ready and not args.baseline:
        print(json.dumps({"status": "prepared-waiting-for-parent-buildready", "design": PLAN,
                          "artifacts": str(args.artifacts), "manual_unverified": MANUAL}, ensure_ascii=False, indent=2))
        return 0
    preflight = unlocked()  # Before making artifacts or launching any process.
    for binary in (args.app, args.server):
        if not binary.is_file() or not os.access(binary, os.X_OK):
            parser.error("Missing executable; parent must build first: " + str(binary))
    # Coordinate only QA suites honoring this lock; do not touch user app locks.
    with open(Path(tempfile.gettempdir()) / "todo-native-detail-interactions-qa.lock", "a+") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            parser.error("Another detail QA run owns the lock; no processes were stopped")
        artifacts = args.artifacts.resolve()
        artifacts.mkdir(parents=True, exist_ok=False)  # Never overwrite prior evidence.
        with tempfile.TemporaryDirectory(prefix="todo-detail-interactions-qa-") as folder:
            suite = Acceptance(args.app.resolve(), args.server.resolve(), artifacts, Path(folder), preflight)
            return 0 if (suite.baseline() if args.baseline else suite.run(targeted=args.targeted_final, modules=args.modules, diagnose=args.diagnose, restore_only=args.restore_only, category_proof=args.category_proof, fast_ack_proof=args.fast_ack_proof, series_scope_proof=args.series_scope_proof, visual_affected=args.visual_affected, final_full=args.final_ready)) else 1


if __name__ == "__main__":
    sys.exit(main())
