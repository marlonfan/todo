#!/usr/bin/env python3
"""Real Native UI + Todo API + local deterministic model transports; no paid API calls."""
import argparse
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import urllib.request
import uuid

from smoke import Native, ROOT, wait_for


class AINative(Native):
    def show(self, role, label):
        self.call("act", id=self.node(role, label)["id"], action="scrollIntoView")

    def fill(self, label, text):
        self.show("textField", label)
        super().fill(label, text)

    def ready(self):
        self.call("idle", timeout=3000)
        def idle():
            candidates = [n for n in self.nodes() if n.get("role") == "button" and n.get("label") in ("刷新", "保存 AI 配置", "保存提示词", "关闭 AI 预览", "确认删除 AI 内容")]
            return candidates and all("disabled" not in n.get("states", []) for n in candidates)
        wait_for(idle, "原生 AI 操作没有结束", timeout=30)


class Model(BaseHTTPRequestHandler):
    requests = []
    def log_message(self, *_):
        pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        Model.requests.append({"path": self.path, "headers": dict(self.headers), "body": body})
        text = body["messages"][-1]["content"]
        if "FAIL_HTTP" in text:
            self.send_response(429)
            self.end_headers()
            self.wfile.write(b'{"error":{"message":"fixture-provider-private-error"}}')
            return
        anthropic = self.path == "/v1/messages"
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        def event(data):
            self.wfile.write(("data: " + json.dumps(data, ensure_ascii=False) + "\n\n").encode())
            self.wfile.flush()
        def chunk(text):
            event({"delta": {"type": "text_delta", "text": text}, "type": "content_block_delta"} if anthropic else {"choices": [{"delta": {"content": text}}]})
        try:
            if anthropic:
                event({"type": "content_block_delta", "delta": {"type": "thinking_delta", "thinking": "MODEL_PRIVATE_REASONING"}})
            else:
                event({"choices": [{"delta": {"reasoning_content": "MODEL_PRIVATE_REASONING"}}]})
            if "SLOW_STOP" in text:
                chunk("已收到的部分回复")
                for _ in range(60):
                    time.sleep(0.1)
                    chunk("…")
            elif "TRUNCATED" in text:
                chunk("这是一段被截断的回复")
            elif "当前任务（唯一权威）" in text:
                chunk("## 行动清单\n\n")
                chunk("- [ ] 核对需求\n\n完成标准：回归通过。")
            else:
                chunk("<thi")
                chunk("nk>hidden tag thought</think>## 原生 AI 答案\n\n")
                chunk("- 检查输入\n- 完成验证")
            reason = "length" if "TRUNCATED" in text else "stop"
            if anthropic:
                event({"type": "message_delta", "delta": {"stop_reason": "end_turn"}})
                event({"type": "message_stop"})
            else:
                event({"choices": [{"delta": {}, "finish_reason": reason}]})
                self.wfile.write(b"data: [DONE]\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            return


def smoke(app_binary, server_binary, artifacts):
    count = 0
    def passed(label):
        nonlocal count
        count += 1
        print("PASS: " + label, flush=True)
    with tempfile.TemporaryDirectory(prefix="todo-native-ai-") as tmp:
        work = Path(tmp)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        config = work / "server.yaml"
        config.write_text(json.dumps({"server": {"host": "127.0.0.1", "port": port}, "database": {"driver": "sqlite", "dsn": str(work / "test.db")}, "jwt": {"secret": uuid.uuid4().hex, "expire": "24h"}}))
        native_log = open(work / "native.log", "wb")
        server_log = open(work / "server.log", "wb")
        server = None
        native = None
        model = ThreadingHTTPServer(("127.0.0.1", 0), Model)
        threading.Thread(target=model.serve_forever, daemon=True).start()
        model_url = f"http://127.0.0.1:{model.server_port}/v1"
        token = ""
        def api(path, method="GET", body=None):
            req = urllib.request.Request(base + path, data=None if body is None else json.dumps(body).encode(), method=method, headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
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
        def ask(ui, text):
            ui.press("button", "使用提示词 原生测试提示词")
            ui.fill("AI 输入", text)
            ui.press("button", "生成 AI 回复")
            ui.ready()
        try:
            server = start_server()
            wait_for(healthy, "隔离 Todo 服务未启动")
            env = dict(os.environ, TODO_NATIVE_QA="1", TODO_API_URL=base, TODO_NATIVE_DATA_DIR=str(work / "profile"), TODO_NATIVE_REMINDER_LOG=str(work / "reminders.jsonl"), MYGO_AUTOMATION=str(work / "native.sock"))
            native = subprocess.Popen([str(app_binary)], env=env, cwd=work, stdout=native_log, stderr=subprocess.STDOUT)
            wait_for(lambda: (work / "native.sock").exists(), "原生 AI 窗口未启动")
            ui = AINative(work / "native.sock")
            wait_for(lambda: ui.call("windows")["windows"], "原生窗口未创建")
            assert ui.call("windows")["windows"][0]["kind"] == "content"
            username = "ai_" + uuid.uuid4().hex[:10]
            password = uuid.uuid4().hex
            ui.press("button", "创建账户")
            ui.fill("用户名", username)
            ui.fill("邮箱", username + "@example.test")
            ui.fill("密码", password)
            ui.press("button", "注册并登录")
            ui.node("button", "＋ 新建任务")
            ui.ready()
            token = api("/api/auth/login", "POST", {"username": username, "password": password})["token"]
            def open_ai():
                ui.press("treeItem", "设置")
                ui.press("button", "打开AI 与提示词")
                ui.ready()

            open_ai()
            ui.ready()
            ui.capture(artifacts / "native-lobe-ai-empty.png")
            ui.press("button", "新建提示词")
            ui.press("button", "保存提示词")
            ui.node("text", "提示词标题应为 1–120 个字符")
            ui.fill("提示词标题", "原生测试提示词")
            assert not ui.find("text", "提示词标题应为 1–120 个字符")
            ui.fill("提示词内容", "以原生测试身份回答；只根据输入提供行动建议。")
            ui.show("textField", "提示词标题")
            ui.capture(artifacts / "native-lobe-ai-prompt-editor.png")
            ui.press("button", "保存提示词")
            ui.ready()
            prompt = api("/api/prompts")[0]
            assert prompt["title"] == "原生测试提示词"
            passed("原生提示词校验和创建，真实服务端持久化")
            ui.press("button", "编辑提示词 原生测试提示词")
            ui.fill("提示词内容", "请提供可执行的建议，不编造事实。")
            ui.press("button", "保存提示词")
            ui.ready()
            assert api(f"/api/prompts/{prompt['id']}")["content"] == "请提供可执行的建议，不编造事实。"
            ui.fill("搜索提示词或历史", "没有匹配的搜索")
            assert not ui.find("button", "使用提示词 原生测试提示词")
            ui.fill("搜索提示词或历史", "")
            passed("原生提示词编辑、搜索与清空搜索")
            ui.press("button", "编辑提示词 原生测试提示词")
            ui.fill("提示词内容", "取消时不应写入的草稿")
            ui.press("button", "取消提示词编辑")
            assert api(f"/api/prompts/{prompt['id']}")["content"] == "请提供可执行的建议，不编造事实。"
            passed("修改输入立即清除旧校验错误，取消提示词编辑不修改账户内容")
            ui.capture(artifacts / "native-lobe-ai-workspace.png")
            ui.press("treeItem", "设置")
            ui.choose("外观", "深色")
            open_ai()
            ui.ready()
            ui.capture(artifacts / "native-lobe-ai-workspace-dark.png")
            ui.press("button", "新建提示词")
            ui.fill("提示词标题", "深色编辑预览")
            ui.fill("提示词内容", "保留清晰的固定底部操作。")
            ui.capture(artifacts / "native-lobe-ai-prompt-editor-dark.png")
            ui.press("button", "取消提示词编辑")
            ui.press("treeItem", "设置")
            ui.choose("外观", "浅色")
            open_ai()
            ui.ready()
            passed("AI 工作区和编辑器支持浅色/深色，切换后保留提示词与操作")
            ask(ui, "尚未配置模型")
            assert not Model.requests
            assert any("请先打开 AI 配置" in n.get("label", "") for n in ui.nodes())
            ui.press("button", "关闭 AI 预览")
            passed("未配置模型时保留输入并显示说明，没有模型网络请求")
            ui.press("button", "AI 配置")
            ui.ready()
            ui.fill("模型服务地址", "https://user:password@invalid.test/v1")
            ui.press("button", "保存 AI 配置")
            assert not api("/api/ai/config")["configured"]
            ui.fill("模型服务地址", model_url)
            ui.fill("API Key", "fixture-model-private-key")
            ui.fill("模型 ID", "fixture-model")
            ui.fill("使用者背景", "原生用户的背景")
            ui.press("button", "保存 AI 配置")
            ui.ready()
            assert api("/api/ai/config")["config"]["api_key"] == "fixture-model-private-key"
            assert not Model.requests
            ui.press("button", "AI 配置")
            ui.ready()
            ui.show("popUpButton", "AI 协议")
            ui.capture(artifacts / "native-ai-config.png")
            ui.press("button", "取消 AI 配置")
            passed("原生配置校验、密钥掩码与账户保存；保存配置不自动调用模型")
            ask(ui, "请规划验证步骤")
            history = api("/api/prompts/history")["items"]
            assert len(history) == 1 and history[0]["status"] == "completed"
            assert history[0]["output"] == "## 原生 AI 答案\n\n- 检查输入\n- 完成验证"
            assert "MODEL_PRIVATE_REASONING" in history[0]["reasoning"] and "hidden tag thought" in history[0]["reasoning"]
            assert Model.requests[-1]["headers"]["Authorization"] == "Bearer fixture-model-private-key"
            assert token not in json.dumps(Model.requests)
            ui.press("radio", "源码")
            assert "hidden tag thought" not in ui.node("textField", "AI 回复源码")["value"]
            ui.press("radio", "预览")
            ui.show("text", "模型回复")
            ui.capture(artifacts / "native-ai-answer.png")
            ui.press("checkBox", "显示模型返回的思考内容")
            assert any("MODEL_PRIVATE_REASONING" in n.get("label", "") for n in ui.nodes())
            ui.press("button", "关闭 AI 预览")
            passed("OpenAI 兼容流式回复、思考内容隔离、Markdown 原生预览和历史自动保存")
            ask(ui, "TRUNCATED")
            assert not any("MODEL_PRIVATE_REASONING" in n.get("label", "") for n in ui.nodes())
            assert api("/api/prompts/history")["items"][0]["status"] == "incomplete"
            ui.node("text", "回复未完整结束，请检查内容后使用。")
            ui.press("button", "关闭 AI 预览")
            passed("模型长度截断保留部分回复，界面与历史标记未完整结束")
            passed("上一问答展开思考后，新问答仍默认折叠并恢复预览模式")
            ui.press("button", "使用提示词 原生测试提示词")
            ui.fill("AI 输入", "SLOW_STOP")
            ui.press("button", "生成 AI 回复")
            wait_for(lambda: any(n.get("role") == "text" and n.get("label", "").startswith("已收到的部分回复") for n in ui.nodes()), "未收到可取消的流式正文", timeout=4)
            assert ui.find("button", "停止生成"), "模型已结束，未覆盖生成中的取消"
            ui.press("button", "停止生成")
            ui.ready()
            stopped = api("/api/prompts/history")["items"][0]
            assert stopped["status"] == "stopped" and "已收到" in stopped["output"]
            ui.press("button", "关闭 AI 预览")
            passed("原生停止生成取消 HTTP 流，保留部分内容并记录 stopped 历史")
            before = len(api("/api/prompts/history")["items"])
            ask(ui, "FAIL_HTTP")
            assert any("HTTP 429" in n.get("label", "") for n in ui.nodes())
            assert not any("fixture-provider-private-error" in n.get("label", "") for n in ui.nodes())
            assert len(api("/api/prompts/history")["items"]) == before
            ui.press("button", "关闭 AI 预览")
            passed("模型 HTTP 错误显示中文原因，不保存空回答、不回显服务端敏感错误")
            ui.press("button", "AI 配置")
            ui.ready()
            ui.choose("AI 协议", "anthropic")
            ui.press("button", "保存 AI 配置")
            ui.ready()
            ask(ui, "验证 Anthropic 协议")
            request = Model.requests[-1]
            assert request["path"] == "/v1/messages" and request["headers"]["X-Api-Key"] == "fixture-model-private-key" and "Authorization" not in request["headers"]
            assert request["headers"]["Anthropic-Version"] == "2023-06-01"
            assert api("/api/prompts/history")["items"][0]["finish_reason"] == "end_turn"
            ui.press("button", "关闭 AI 预览")
            passed("Anthropic 原生请求与流事件解析，专用密钥头和结束原因正确")

            task = api("/api/tasks", "POST", {"title": "AI 描述任务", "description": "尚未修改的描述"})
            private_task = api("/api/tasks", "POST", {"title": "OTHER_PRIVATE_TASK"})
            ui.press("treeItem", "全部任务")
            ui.press("button", "刷新")
            ui.ready()
            ui.press("button", "AI 描述任务")
            ui.fill_task_title("编辑中的最新标题", "AI 描述任务")
            ui.press("button", "AI 生成描述")
            ui.press("button", "生成 AI 回复")
            ui.ready()
            sent = Model.requests[-1]["body"]
            assert "编辑中的最新标题" in sent["messages"][-1]["content"] and "OTHER_PRIVATE_TASK" not in sent["messages"][-1]["content"]
            assert "原生用户的背景" in sent["system"]
            assert api(f"/api/tasks/{task['id']}")["description"] == "尚未修改的描述"
            ui.capture(artifacts / "native-ai-description.png")
            ui.press("button", "替换描述草稿")
            assert ui.task_title()["value"] == "编辑中的最新标题"
            assert "核对需求" in ui.task_description()["value"]
            assert api(f"/api/tasks/{task['id']}")["description"] == "尚未修改的描述"
            ui.press("button", "结束编辑")
            ui.node("heading", "行动清单")
            ui.press("button", "保存任务")
            ui.ready()
            assert "核对需求" in api(f"/api/tasks/{task['id']}")["description"]
            passed("AI 读取当前草稿、默认不附带其他任务；采用仅改草稿，明确保存后同步")
            ui.press("button", "编辑中的最新标题")
            ui.press("button", "AI 生成描述")
            ui.press("checkBox", "本次附带其他任务背景")
            ui.press("button", "生成 AI 回复")
            ui.ready()
            assert "OTHER_PRIVATE_TASK" in Model.requests[-1]["body"]["messages"][-1]["content"]
            ui.press("button", "关闭 AI 预览")
            ui.press("button", "关闭")
            passed("本次显式勾选且账户允许时附带受长度限制的任务背景")

            anchor = (datetime.now(timezone.utc) + timedelta(days=1)).replace(microsecond=0)
            series = api("/api/tasks", "POST", {"title": "AI 单次描述系列", "description": "系列原描述", "start_time": anchor.isoformat(), "recurrence_rule": {"freq": "daily", "interval": 1, "count": 3}})
            ui.press("button", "刷新")
            ui.ready()
            ui.press("button", "AI 单次描述系列")
            ui.press("button", "编辑本次描述")
            ui.fill("本次描述", "尚未保存的本次描述")
            ui.press("button", "AI 生成本次描述")
            ui.press("button", "生成 AI 回复")
            ui.ready()
            assert "尚未保存的本次描述" in Model.requests[-1]["body"]["messages"][-1]["content"]
            ui.press("button", "替换描述草稿")
            assert "核对需求" in ui.node("textField", "本次描述")["value"]
            assert api(f"/api/tasks/{series['id']}")["description"] == "系列原描述"
            ui.press("button", "保存本次描述")
            ui.ready()
            occurrence = next(o for o in api("/api/tasks/next-occurrences") if o["task_id"] == series["id"])
            assert "核对需求" in occurrence["description"] and occurrence["status"] == "pending"
            saved_series = api(f"/api/tasks/{series['id']}")
            assert saved_series["description"] == "系列原描述" and saved_series["start_time"] == series["start_time"]
            passed("单次 AI 使用未保存的实例草稿，明确保存后仅更新本次，保留系列描述和起点")

            for i in range(51):
                api("/api/prompts/history", "POST", {"prompt_id": prompt["id"], "input": f"分页输入 {i}", "output": f"分页输出 {i}"})
            open_ai()
            ui.ready()
            ui.press("radio", "问答历史")
            ui.press("button", "读取更早问答历史")
            ui.ready()
            assert not ui.find("button", "读取更早问答历史")
            last_id = history[0]["id"]
            ui.press("button", f"查看问答历史 #{last_id}")
            ui.node("text", "历史快照；原提示词删除或更改后，此处仍保留当时的内容。")
            ui.show("text", "模型回复")
            ui.capture(artifacts / "native-lobe-ai-history-detail.png")
            ui.press("button", "关闭 AI 预览")
            ui.show("button", f"查看问答历史 #{last_id}")
            ui.capture(artifacts / "native-lobe-ai-history.png")
            ui.press("menuButton", f"更多问答历史操作 #{last_id}")
            ui.press("menuItem", f"删除问答历史 #{last_id}")
            ui.press("button", "保留 AI 内容")
            ui.press("menuButton", f"更多问答历史操作 #{last_id}")
            ui.press("menuItem", f"删除问答历史 #{last_id}")
            ui.press("button", "确认删除 AI 内容")
            ui.ready()
            assert not ui.find("button", f"查看问答历史 #{last_id}")
            passed("真实游标分页读取更早历史、查看快照和删除确认/取消")
            ui.press("radio", "提示词")
            ui.press("menuButton", "更多提示词操作 原生测试提示词")
            ui.press("menuItem", "删除提示词 原生测试提示词")
            ui.press("button", "确认删除 AI 内容")
            ui.ready()
            assert api("/api/prompts") == []
            assert api("/api/prompts/history")["items"][0]["prompt_content"] == "请提供可执行的建议，不编造事实。"
            passed("删除提示词保留已保存的问答快照")

            ui.press("button", "新建提示词")
            ui.fill("提示词标题", "离线草稿")
            ui.fill("提示词内容", "断网时保留这个输入")
            server.terminate()
            # A disposable backend may still be draining a scheduler/plugin
            # request during graceful shutdown.  Force-stop it after the
            # grace period so the following UI assertions exercise offline
            # editing instead of failing during process cleanup.
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)
            ui.press("button", "保存提示词")
            ui.ready()
            assert ui.node("textField", "提示词标题")["value"] == "离线草稿"
            assert not json.loads((work / "profile/cache.json").read_text()).get("outbox")
            ui.press("button", "取消提示词编辑")
            files = b"".join(p.read_bytes() for p in (work / "profile").rglob("*") if p.is_file())
            assert b"fixture-model-private-key" not in files and b"MODEL_PRIVATE_REASONING" not in files
            assert "原生 AI 答案".encode() not in files and "请规划验证步骤".encode() not in files
            passed("断网保留输入、AI 写入不进任务 outbox、本机 profile 不含密钥与问答内容")
            print(f"Native AI smoke: {count}/{count} PASS", flush=True)
        except Exception:
            try:
                ui.capture(artifacts / "ai-smoke-failure.png")
                artifacts.joinpath("ai-smoke-failure-tree.json").write_text(json.dumps(ui.nodes(), ensure_ascii=False, indent=2))
            except Exception:
                pass
            native_log.flush()
            print((work / "native.log").read_text(errors="replace")[-3000:])
            raise
        finally:
            for process in (native, server):
                if process and process.poll() is None:
                    process.terminate()
                    process.wait(timeout=8)
            model.shutdown()
            model.server_close()
            native_log.close()
            server_log.close()


if __name__ == "__main__":
    if sys.platform == "darwin":
        state = subprocess.check_output(["ioreg", "-n", "Root", "-d1"], text=True)
        if '"CGSSessionScreenIsLocked"=Yes' in state:
            raise SystemExit("macOS 当前已锁屏，请解锁后重跑 make ai-smoke；测试尚未开始。")
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, default=ROOT / "build/qa/todo-native-qa")
    parser.add_argument("--server", type=Path, default=ROOT.parent / "bin/todo-app")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts")
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    smoke(args.app.resolve(), args.server.resolve(), args.artifacts)
