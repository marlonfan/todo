---
name: todo-cli
description: Use the Todo app CLI to manage tasks, categories, calendar events, and auth from AI tools. Prefer this skill whenever the user asks to create, list, update, complete, cancel, delete, search, or inspect Todo app data through the local project.
---

# Todo CLI Skill

Use this skill to operate the Todo app through `todo-cli` or `cli/todo-cli.mjs`.
The CLI talks to the running HTTP server, returns JSON by default, and supports
`--dry-run` for previewing side effects.

## Location

Prefer the installed npm binary when available:

```bash
todo-cli --help
```

From the repository root:

```bash
node ./cli/todo-cli.mjs --help
```

When running from `cli/`:

```bash
node ./todo-cli.mjs --help
```

The local development default is `http://127.0.0.1:8080`. For installed npm usage,
the user should configure their real server URL first:

```bash
todo-cli init --base-url https://your-todo-server.example.com
```

Server URL precedence is `--base-url`, then `TODO_BASE_URL`, then
`~/.todo-cli/config.json`, then the local development default.

If `todo-cli` is not installed and this is not the Todo repository, ask the user
to install it:

```bash
npm install -g @marlonfan/todo-app-cli
```

## Operating Rules

- Use `todo-cli` when available. Use `node ./cli/todo-cli.mjs` only inside the Todo repository.
- Start with `todo-cli doctor` when server availability, configured URL, or auth state is unknown.
- Use `todo-cli health` only when you need a narrow server liveness check.
- If health fails against `127.0.0.1:8080`, ask for the user's Todo server URL and run `todo-cli init --base-url URL`.
- Check auth with `todo-cli auth status`.
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
todo-cli doctor
todo-cli init --base-url https://your-todo-server.example.com
```

### Auth

```bash
todo-cli auth login --username USER --password PASS
todo-cli auth status
todo-cli auth me
todo-cli auth logout
```

Login stores the token in `~/.todo-cli/config.json` unless `--no-save` is passed.

### List Tasks

```bash
todo-cli task list --status pending
todo-cli task list --category-id 3
todo-cli task get 42
todo-cli +today
todo-cli +inbox
```

Use `--summary=false` to return full task records:

```bash
todo-cli task list --summary=false
```

### Create Tasks

```bash
todo-cli +add --title "Follow up" --priority medium
todo-cli task create \
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
todo-cli task update 42 --title "New title"
todo-cli task update 42 --description "Updated markdown" --if-match 3
todo-cli task complete 42
todo-cli task pending 42
todo-cli task cancel 42
todo-cli task schedule 42 --start-time-local "2026-05-11T14:00:00" --timezone Asia/Shanghai
```

Use `--if-match REVISION` when the task record includes a `revision`; this helps avoid overwriting newer edits.

### Delete Tasks

Preview first:

```bash
todo-cli task delete 42 --dry-run
```

Only delete when explicitly requested:

```bash
todo-cli task delete 42 --yes
```

### Categories

```bash
todo-cli category list
todo-cli category create --name Work --color '#2563eb'
todo-cli category update 3 --name Personal
todo-cli category delete 3 --dry-run
```

### Calendar

```bash
todo-cli calendar +agenda --days 7
todo-cli calendar events \
  --start 2026-05-11T00:00:00+08:00 \
  --end 2026-05-12T00:00:00+08:00
```

### Raw API

Use this when wrapped commands do not cover a feature:

```bash
todo-cli api GET /tasks
todo-cli api PATCH /tasks/42/status --data '{"status":"completed"}'
todo-cli api GET /calendar --query '{"start":"2026-05-11T00:00:00+08:00","end":"2026-05-12T00:00:00+08:00"}'
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
todo-cli task list --status pending
```

Create a task from user text:

```bash
todo-cli +add --title "USER_TITLE" --description "USER_NOTES"
```

Mark a task complete:

```bash
todo-cli task complete TASK_ID
```

Show the next 7 days of calendar items:

```bash
todo-cli calendar +agenda --days 7
```
