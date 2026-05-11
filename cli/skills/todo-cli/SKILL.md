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

### Calendar

```bash
todo_cli calendar +agenda --days 7
todo_cli calendar events \
  --start 2026-05-11T00:00:00+08:00 \
  --end 2026-05-12T00:00:00+08:00
```

### Raw API

Use this when wrapped commands do not cover a feature:

```bash
todo_cli api GET /tasks
todo_cli api PATCH /tasks/42/status --data '{"status":"completed"}'
todo_cli api GET /calendar --query '{"start":"2026-05-11T00:00:00+08:00","end":"2026-05-12T00:00:00+08:00"}'
```

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
