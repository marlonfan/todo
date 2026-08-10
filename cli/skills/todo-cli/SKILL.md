---
name: todo-cli
description: "Todo 任务管理：通过已安装的 todo-cli 创建、查看、更新、完成、取消和删除任务，并管理分类与日历。当用户说‘提醒我’‘创建待办’‘记个任务’‘今天有什么任务’，或提到 Todo CLI、Todo、task 时使用；所有含时间的请求都只设置任务时间。"
metadata:
  version: "0.3.0"
  requires:
    bins: ["todo-cli"]
  cliHelp: "todo-cli --help;todo-cli task --help;todo-cli calendar --help;todo-cli skill doctor"
---

# Todo CLI Skill

Use this skill to operate the Todo app through the installed `todo-cli` command.
The CLI talks to the running HTTP server, returns JSON by default, and supports
`--dry-run` for previewing side effects.

## Command Setup

Always verify the installed command before querying or mutating tasks:

```bash
todo_cli() {
  if command -v todo-cli >/dev/null 2>&1; then
    todo-cli "$@"
  else
    echo "todo-cli is not installed. Run: npm install -g @marlonfan/todo-app-cli" >&2
    return 127
  fi
}
todo_cli --help
```

This function is intentional. Do not use an `npx` package fallback, because it can run an older published package than the installed skill expects.

For one-off commands, require the installed binary:

```bash
if command -v todo-cli >/dev/null 2>&1; then
  todo-cli task list --status pending
else
  echo "todo-cli is not installed. Run: npm install -g @marlonfan/todo-app-cli" >&2
  exit 127
fi
```

If the user asks for a permanent install, run or tell them to run:

```bash
npm install -g @marlonfan/todo-app-cli
```

If `npm install -g` succeeds but `todo-cli` is still not found, explain that the npm global bin directory is not in
`PATH`. Check it with:

```bash
npm prefix -g
```

Then add its `bin` directory to `PATH`, for example `/opt/homebrew/bin` on Homebrew Node installations.

The local development default is `http://127.0.0.1:8080`. For installed npm usage,
the user should configure their real server URL first:

```bash
todo_cli init --base-url https://your-todo-server.example.com
```

Server URL precedence is `--base-url`, then `TODO_BASE_URL`, then
`~/.todo-cli/config.json`, then the local development default.

## Operating Rules

- **Visible-time invariant:** whenever the user supplies a time, the created task must have that visible `start_time`. Never send `end_time` or `--end-time-local` by itself: an end-only task can disappear from time-based views or be cleared by a later client save.
- When the user gives only an exact deadline such as “今天 19:00 前完成”, preserve the existing `start_time` when updating a task. For a new task, use the current account-local time as `start_time` and the requested deadline as `end_time`, and send both in the same create call. If the deadline is already past, ask for or choose an explicitly stated future deadline instead of creating an invalid range. Use `due_date` only for a date-only deadline with no clock time.
- After every create or update that changes task timing, run `task detail ID` and verify that `start_time` is non-null and `end_time` matches the requested deadline when one was supplied. Do not report success while `end_time` exists without `start_time`, or while either requested field was cleared; repair the task with one `task schedule` call containing both times, then verify again.
- Interpret “20:37 提醒我打熊” and “安排我 20:37 打熊” identically: create a task starting at 20:37 and submit only task scheduling fields.
- Relative or ambiguous wall times use the Todo account timezone from `auth me`. Choose the nearest reasonable future time when cues such as “一会”“今晚”“明早” make it unambiguous; state explicitly when the chosen date crosses midnight. Do not silently create a task in the past.
- Generate one stable `--client-op-id` for each user intent and reuse it for retries. Do not generate a new operation ID merely because a response was lost.
- After creating a timed task, verify its returned `start_time` with `task detail ID` and report only the task time.
- CLI output is agent-safe by default. Never request, reproduce, log, or store notification credentials, tokens, chat IDs, webhook URLs, cookies, passwords, or avatar Data URLs.
- Define `todo_cli() { ... }` from Command Setup before running Todo commands in a new shell session.
- Put resource/action before flags when possible: use `todo_cli task create --base-url URL --title "Task"`, not `todo_cli --base-url URL task create --title "Task"`.
- If `todo-cli` is not found, do not switch to unrelated task systems such as Feishu/Lark tasks and do not run the npm package through `npx`. Ask the user to install or update the Todo CLI.
- Start with `todo_cli doctor` when server availability, configured URL, or auth state is unknown.
- Use `todo_cli health` only when you need a narrow server liveness check.
- If health fails against `127.0.0.1:8080`, ask for the user's Todo server URL and run `todo_cli init --base-url URL`.
- Check auth with `todo_cli auth status`.
- If unauthenticated or a command returns `HTTP 401: invalid or expired token`, run `todo_cli auth refresh` once, then retry the original command. If refresh fails with an expired refresh window or invalid token, ask the user to log in again or provide `TODO_TOKEN`.
- Resource commands automatically attempt one refresh/retry when a bearer token gets a 401; refreshed config-file tokens are saved back. Still use `todo_cli auth refresh` explicitly when diagnosing auth.
- Use `--format json` by default for machine parsing.
- Use `--format table` only for human-facing summaries.
- Use `--dry-run` before destructive or broad updates.
- Deleting requires `--yes`; do not add `--yes` unless the user explicitly asked to delete.
- Prefer wrapped resource commands before raw API.
- Use raw API only when no wrapped command exists.
- For long Markdown descriptions, write the content to a temporary `.md` file and pass `--description-file PATH`; avoid putting large multiline text directly in a shell argument.
- For large raw API payloads, write JSON to a temporary file and pass `--data-file PATH`.
- For user-facing detail questions such as "今天的任务详情", "当日任务", "当前页面这个任务", "日历里这个任务", or "看看详情", use `task detail ID` instead of `task get ID`.
- For recurring tasks, `task detail ID` returns the effective visible record under `effective`; `task get ID` reads the series body only. Use `task get ID` when the user asks about the recurring template, series defaults, revision, recurrence rule, or future default behavior.
- `task list --status pending` returns pending recurring series templates. For recurring rows, do not treat the series `start_time` as an unfinished historical occurrence. Confirm the visible pending instance with `task today --include-occurrences`, `task next-occurrences --task-id ID`, or `task detail ID --date YYYY-MM-DD` before calling a recurring task overdue or listing a past date as pending.
- If the user asks about today's tasks without an ID, start with `task today --include-occurrences` so recurring instances are included in the candidate list.
- If the user is looking at a specific calendar/today occurrence, prefer `task detail ID --date YYYY-MM-DD`; update the displayed instance with `task update ID --occurrence-date YYYY-MM-DD` when needed.
- Pass only the task fields documented below when creating or verifying a task.
- When uncertain about flags, run focused help first: `todo_cli task --help`, `todo_cli task create --help`, `todo_cli calendar --help`, `todo_cli category --help`, `todo_cli auth --help`, or `todo_cli api --help`.

## Common Commands

### Setup Diagnostics

```bash
todo_cli doctor
todo_cli --version
todo_cli skill doctor
todo_cli init --base-url https://your-todo-server.example.com
```

If the binary exists but the current agent cannot discover this Skill, inspect or explicitly install the bundled version, then start a new agent session:

```bash
todo_cli skill path
todo_cli skill install --target minis
todo_cli skill install --target minis --force
todo_cli skill doctor --target minis
```

Installation refuses to replace an existing target by default. Use `--force` only for an intentional upgrade; the CLI moves the old target to a timestamped `todo-cli.backup-*` path before creating the new symlink.

### Auth

```bash
todo_cli auth login --username USER --password PASS
todo_cli auth refresh
todo_cli auth status
todo_cli auth me
todo_cli auth logout
```

Login stores the token in `~/.todo-cli/config.json` unless `--no-save` is passed.
`auth refresh` exchanges the stored bearer token for a new token and saves it unless `--no-save` is passed. The server accepts expired tokens for refresh up to 30 days after expiry; after that, login is required.
Use `todo_cli auth --help` for auth/profile examples.

### List Tasks

```bash
todo_cli task list --status pending
todo_cli task list --category-id 3
todo_cli task get 42
todo_cli task detail 42
todo_cli task today --include-occurrences
todo_cli task next-occurrences --task-id 42
todo_cli +today
todo_cli +inbox
```

Use `--summary=false` to return full task records:

```bash
todo_cli task list --summary=false
```

For "all unfinished tasks" summaries, separate non-recurring pending tasks from recurring series. Use the next visible occurrence date for recurring tasks, not the series anchor/start date, and avoid labeling old completed recurring instances as overdue.

### Create Tasks

```bash
todo_cli +add --title "Follow up" --priority medium
todo_cli task create \
  --title "Write proposal" \
  --description "Markdown notes" \
  --priority high \
  --start-time-local "2026-05-11T09:00:00" \
  --timezone Asia/Shanghai
```

For a new task that only specifies a 19:00 deadline, set the current account-local time as its visible start and send both fields together:

```bash
todo_cli task create \
  --title "Token 板块跟进" \
  --start-time-local "2026-05-11T15:00:00" \
  --end-time-local "2026-05-11T19:00:00" \
  --timezone Asia/Shanghai \
  --client-op-id STABLE_UUID
```

Then run `todo_cli task detail ID`; require a non-null `start_time` and the requested `end_time` before telling the user the task is scheduled.

For a workday recurring task at 20:30:

```bash
todo_cli task create \
  --title "当日复盘" \
  --description "工作日晚上进行当日复盘。" \
  --priority medium \
  --start-time-local "2026-05-11T20:30:00" \
  --timezone Asia/Shanghai \
  --recurrence-rule '{"freq":"weekly","interval":1,"byday":["MO","TU","WE","TH","FR"]}'
```

Use the next valid local date for the first occurrence. If today's requested time has already passed, start on the next matching weekday.

Useful flags:

- `--title`
- `--description` or `--desc`
- `--description-file` or `--desc-file` for long Markdown
- `--priority low|medium|high`
- `--start-time` / `--end-time` for RFC3339 timestamps
- `--start-time-local` / `--end-time-local` with `--timezone`
- `--due-date`
- `--all-day true|false`
- `--category-ids 1,2`
- `--recurrence-rule '{"freq":"weekly","interval":1,"byday":["MO"]}'`
- Weekdays use `["MO","TU","WE","TH","FR"]`.
- Use `todo_cli recurrence --help` for more examples.

### Update Tasks

```bash
todo_cli task detail 42
todo_cli task detail 42 --date 2026-05-11
todo_cli task update 42 --title "New title"
todo_cli task update 42 --description "Updated markdown" --if-match 3
todo_cli task update 42 --description-file ./daily-review.md --if-match 3
todo_cli task update 42 --description-file ./daily-review.md --occurrence-date 2026-05-11 --if-match 3
todo_cli task next-occurrences --task-id 42
todo_cli task complete 42
todo_cli task pending 42
todo_cli task cancel 42
todo_cli task schedule 42 --start-time-local "2026-05-11T14:00:00" --timezone Asia/Shanghai
```

Use `--if-match REVISION` when the task record includes a `revision`; this helps avoid overwriting newer edits.
For recurring tasks, use `--occurrence-date YYYY-MM-DD` when the user wants to update the specific occurrence currently shown in the UI. After updating a recurring task, verify with `task detail ID --date YYYY-MM-DD` when the user's complaint is about what the page displays.
Use `todo_cli task update --help` or `todo_cli task schedule --help` when changing task fields.

### Delete Tasks

Preview first:

```bash
todo_cli task delete 42 --dry-run
```

Only delete when explicitly requested:

```bash
todo_cli task delete 42 --yes
```

### Categories

```bash
todo_cli category list
todo_cli category create --name Work --color '#2563eb'
todo_cli category update 3 --name Personal
todo_cli category delete 3 --dry-run
```

Use `todo_cli category --help` before creating, updating, or deleting categories.

### Calendar

```bash
todo_cli calendar +agenda --days 7
todo_cli calendar events \
  --start 2026-05-11T00:00:00+08:00 \
  --end 2026-05-12T00:00:00+08:00
```

Use `todo_cli calendar --help` for range query examples. Calendar event ranges require both `--start` and `--end`.

### Raw API

Use this when wrapped commands do not cover a feature:

```bash
todo_cli api GET /tasks
todo_cli api PATCH /tasks/42/status --data '{"status":"completed"}'
todo_cli api PUT /tasks/42 --data-file ./payload.json
todo_cli api GET /calendar --query '{"start":"2026-05-11T00:00:00+08:00","end":"2026-05-12T00:00:00+08:00"}'
todo_cli api GET /calendar --query-file ./query.json
```

Use `todo_cli api --help` before raw calls.

## Output Contract

Default output is JSON.

- Successful list commands output arrays.
- Successful get/create/update commands output objects.
- `--format ndjson` emits one JSON object per line.
- `--format table` is for compact human display.
- Errors are written to stderr and return a non-zero exit code.

## Examples for AI Workflows

Get pending tasks:

```bash
todo_cli task list --status pending
```

Create a task from user text:

```bash
todo_cli +add --title "USER_TITLE" --description "USER_NOTES"
```

Mark a task complete:

```bash
todo_cli task complete TASK_ID
```

Show the next 7 days of calendar items:

```bash
todo_cli calendar +agenda --days 7
```
