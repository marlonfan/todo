---
name: todo-cli
description: Use the Todo app CLI to manage tasks, categories, calendar events, and auth from AI tools. Prefer this skill whenever the user asks to create, list, update, complete, cancel, delete, search, or inspect Todo app data through the local project.
---

# Todo CLI Skill

Use this skill to operate the Todo app through `todo-cli`, `npx`, or `cli/todo-cli.mjs`.
The CLI talks to the running HTTP server, returns JSON by default, and supports
`--dry-run` for previewing side effects.

## Command Setup

Always resolve the command before querying or mutating tasks:

```bash
todo_cli() {
  if command -v todo-cli >/dev/null 2>&1; then
    todo-cli "$@"
  elif [ -f ./cli/todo-cli.mjs ]; then
    node ./cli/todo-cli.mjs "$@"
  else
    npx -y @marlonfan/todo-app-cli@latest "$@"
  fi
}
todo_cli --help
```

This function is intentional. Do not store `node ./cli/todo-cli.mjs` or `npx -y ...` in a plain string variable; zsh may treat the whole string as one command name.

For one-off commands, use the same resolution pattern:

```bash
if command -v todo-cli >/dev/null 2>&1; then
  todo-cli task list --status pending
elif [ -f ./cli/todo-cli.mjs ]; then
  node ./cli/todo-cli.mjs task list --status pending
else
  npx -y @marlonfan/todo-app-cli@latest task list --status pending
fi
```

If `todo-cli` is not available, it is also valid to run the npm package directly:

```bash
npx -y @marlonfan/todo-app-cli@latest doctor
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

- Define `todo_cli() { ... }` from Command Setup before running Todo commands in a new shell session.
- Put resource/action before flags when possible, especially with `npx`: use `todo_cli task create --base-url URL --title "Task"`, not `todo_cli --base-url URL task create --title "Task"`.
- If `todo-cli` is not found, do not switch to unrelated task systems such as Feishu/Lark tasks. Use the `npx -y @marlonfan/todo-app-cli@latest` fallback or ask the user to install the Todo CLI.
- Start with `todo_cli doctor` when server availability, configured URL, or auth state is unknown.
- Use `todo_cli health` only when you need a narrow server liveness check.
- If health fails against `127.0.0.1:8080`, ask for the user's Todo server URL and run `todo_cli init --base-url URL`.
- Check auth with `todo_cli auth status`.
- If unauthenticated, ask the user for credentials or use `TODO_TOKEN` if they provided one.
- Use `--format json` by default for machine parsing.
- Use `--format table` only for human-facing summaries.
- Use `--dry-run` before destructive or broad updates.
- Deleting requires `--yes`; do not add `--yes` unless the user explicitly asked to delete.
- Prefer wrapped resource commands before raw API.
- Use raw API only when no wrapped command exists.
- For reminders, check `todo_cli auth me` and `todo_cli notify settings` before promising delivery. Creating a scheduled task only auto-generates reminders when the user's `default_reminder_enabled` is true and a default notify setting exists.
- When uncertain about flags, run focused help first: `todo_cli task --help`, `todo_cli task create --help`, `todo_cli notify --help`, `todo_cli calendar --help`, `todo_cli category --help`, `todo_cli auth --help`, or `todo_cli api --help`.

## Common Commands

### Setup Diagnostics

```bash
todo_cli doctor
todo_cli init --base-url https://your-todo-server.example.com
```

### Auth

```bash
todo_cli auth login --username USER --password PASS
todo_cli auth status
todo_cli auth me
todo_cli auth logout
```

Login stores the token in `~/.todo-cli/config.json` unless `--no-save` is passed.
Use `todo_cli auth --help` for auth/profile examples.

### List Tasks

```bash
todo_cli task list --status pending
todo_cli task list --category-id 3
todo_cli task get 42
todo_cli +today
todo_cli +inbox
```

Use `--summary=false` to return full task records:

```bash
todo_cli task list --summary=false
```

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
- `--priority low|medium|high`
- `--start-time` / `--end-time` for RFC3339 timestamps
- `--start-time-local` / `--end-time-local` with `--timezone`
- `--due-date`
- `--all-day true|false`
- `--category-ids 1,2`
- `--recurrence-rule '{"freq":"weekly","interval":1,"byday":["MO"]}'`
- Weekdays use `["MO","TU","WE","TH","FR"]`.
- Use `todo_cli recurrence --help` for more examples.

### Reminder Workflow

```bash
todo_cli auth me
todo_cli notify settings
todo_cli task notifications TASK_ID
todo_cli task remind TASK_ID --notify-at "2026-05-11T20:30:00+08:00"
```

Automatic reminders:

- `auth me` returns `default_reminder_enabled` and `default_reminder_minutes`.
- `notify settings` returns delivery channels; one setting must be `is_default: true`.
- When both are configured, creating or updating a scheduled task generates one `default_auto` reminder, usually `default_reminder_minutes` before the task start.
- Always verify with `task notifications TASK_ID` after creating a reminder-bearing task.

Manual reminders:

- Use `task remind TASK_ID --notify-at RFC3339` when the user asks for an exact notification time, when default reminders are disabled, or when no default notify setting exists.
- If the user says "晚上 8:30 提醒我复盘", interpret 20:30 as the task time. If they explicitly want the notification exactly at 20:30, add a manual reminder at `20:30`.

Notification settings:

```bash
todo_cli notify settings
todo_cli notify channels
todo_cli notify create-setting --channel ntfy --config '{"topic":"todo"}' --default=true
todo_cli notify default SETTING_ID
todo_cli notify reconcile
```

### Update Tasks

```bash
todo_cli task update 42 --title "New title"
todo_cli task update 42 --description "Updated markdown" --if-match 3
todo_cli task complete 42
todo_cli task pending 42
todo_cli task cancel 42
todo_cli task schedule 42 --start-time-local "2026-05-11T14:00:00" --timezone Asia/Shanghai
```

Use `--if-match REVISION` when the task record includes a `revision`; this helps avoid overwriting newer edits.
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
todo_cli api GET /calendar --query '{"start":"2026-05-11T00:00:00+08:00","end":"2026-05-12T00:00:00+08:00"}'
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
