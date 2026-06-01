# Todo CLI

`todo-cli` exposes the Todo app HTTP API as an agent-friendly command line tool.
It is intentionally lightweight: one Node.js script, no runtime dependencies, JSON
output by default, table/NDJSON for humans and pipelines, and `--dry-run` for
side-effect previews.

The layout borrows the same operating model as `lark-cli`:

- Shortcuts: `+add`, `+today`, `+inbox`, `+agenda`
- Resource commands: `task list`, `task create`, `category list`
- Raw API: `api METHOD /path`
- AI skill: `cli/skills/todo-cli/SKILL.md`

## Requirements

- Node.js 18+
- A running Todo app server. `http://127.0.0.1:8080` is the local development default.

For npm users, configure the server URL before using resource commands:

```bash
npm install -g @marlonfan/todo-app-cli
todo-cli init --base-url https://your-todo-server.example.com
todo-cli auth login --username alice --password secret123
```

## Quick Start

```bash
cd cli
node ./todo-cli.mjs init --base-url http://127.0.0.1:8080
node ./todo-cli.mjs health
node ./todo-cli.mjs auth login --username alice --password secret123
node ./todo-cli.mjs task list --format table
node ./todo-cli.mjs +add --title "Review roadmap" --priority high
node ./todo-cli.mjs +today --format table
```

You can also install it locally as an npm-linked binary:

```bash
cd cli
npm link
todo-cli auth status
```

## Configuration

The CLI reads config from `~/.todo-cli/config.json` by default.
Server URL precedence is:

1. `--base-url URL`
2. `TODO_BASE_URL`
3. `~/.todo-cli/config.json`
4. local development default `http://127.0.0.1:8080`

```bash
todo-cli init --base-url https://your-todo-server.example.com
todo-cli init --base-url https://your-todo-server.example.com --username alice --password secret123
todo-cli doctor
todo-cli config set --base-url https://your-todo-server.example.com
todo-cli auth login --username alice --password secret123
todo-cli config show
```

Environment overrides:

- `TODO_BASE_URL`: server base URL
- `TODO_TOKEN`: bearer token
- `TODO_CLI_CONFIG`: config file path
- `TODO_CLI_TIMEOUT_MS`: HTTP timeout in milliseconds

Global flags:

- `--base-url URL`
- `--token TOKEN`
- `--config PATH`
- `--format json|table|ndjson`
- `--dry-run`
- `--timeout-ms MS`

Run Todo operations with the installed `todo-cli` binary. Avoid using
an `npx` package fallback for normal commands because it may run a different
published version than the installed skill expects.

## Skill Installation

Install the AI-facing skill directly with `skills`.

If the GitHub repository is public:

```bash
npx skills add marlonfan/todo@todo-cli -g -a codex -y
```

If the repository is private and your machine has GitHub SSH access:

```bash
npx skills add 'git@github.com:marlonfan/todo.git#main@todo-cli' -g -a codex -y
```

For all supported agents:

```bash
npx skills add marlonfan/todo@todo-cli -g --agent '*' -y
```

To inspect before installing:

```bash
npx skills add marlonfan/todo --list
```

The skill installs instructions for AI tools. The CLI binary is still installed through npm:

```bash
npm install -g @marlonfan/todo-app-cli
todo-cli init --base-url https://your-todo-server.example.com
todo-cli doctor
```

## Commands

### First Run

```bash
todo-cli init --base-url https://your-todo-server.example.com
todo-cli init --base-url https://your-todo-server.example.com --username alice --password secret123
todo-cli init --base-url https://your-todo-server.example.com --token YOUR_TOKEN
todo-cli init --base-url https://your-todo-server.example.com --no-check
todo-cli doctor
```

`init` writes `~/.todo-cli/config.json` by default and checks `/health` unless `--no-check` is passed.
`doctor` checks the effective server URL, `/health`, and stored credentials, then prints next-step recommendations.

### Auth

```bash
todo-cli auth register --username alice --email alice@example.com --password secret123
todo-cli auth login --username alice --password secret123
todo-cli auth status
todo-cli auth me
todo-cli auth logout
```

### Tasks

```bash
todo-cli task list --status pending --format table
todo-cli task get 42
todo-cli task detail 42
todo-cli task detail 42 --date 2026-05-11
todo-cli task today --include-occurrences
todo-cli task create --title "Ship CLI" --description "Markdown notes" --priority high
todo-cli task update 42 --title "Ship CLI v2" --if-match 3
todo-cli task update 42 --description-file ./daily-review.md --if-match 3
todo-cli task complete 42
todo-cli task pending 42
todo-cli task skip 42
todo-cli task cancel 42
todo-cli task schedule 42 --start-time-local "2026-05-11T09:00:00" --timezone Asia/Shanghai
todo-cli task remind 42 --notify-at "2026-05-11T20:25:00+08:00"
todo-cli task notifications 42
todo-cli task next-occurrences --task-id 42
todo-cli task delete 42 --yes
```

Useful task flags:

- `--title`
- `--description` or `--desc`
- `--description-file` or `--desc-file` for long Markdown
- `--priority low|medium|high`
- `--status pending|completed|cancelled|skipped`
- `--start-time` / `--end-time`: RFC3339 timestamps
- `--start-time-local` / `--end-time-local`: local timestamps interpreted with `--timezone`
- `--timezone`
- `--due-date`
- `--all-day true|false`
- `--category-ids 1,2`
- `--recurrence-rule '{"freq":"weekly","interval":1,"byday":["MO"]}'`
- `--occurrence-date YYYY-MM-DD` for updating one recurring occurrence
- `--if-match REVISION`
- `--client-op-id ID`

Workday recurrence example:

```bash
todo-cli task create \
  --title "当日复盘" \
  --description "工作日晚上进行当日复盘。" \
  --priority medium \
  --start-time-local "2026-05-11T20:30:00" \
  --timezone Asia/Shanghai \
  --recurrence-rule '{"freq":"weekly","interval":1,"byday":["MO","TU","WE","TH","FR"]}'
```

Automatic reminders are created only when the user has default reminders enabled and a default notification setting.
Check and verify with:

```bash
todo-cli auth me
todo-cli notify settings
todo-cli task notifications 42
```

Use a manual reminder when you need an exact notification time:

```bash
todo-cli task remind 42 --notify-at "2026-05-11T20:30:00+08:00"
```

For recurring tasks, `task get 42` reads the series task. If the UI detail was opened from a
calendar/today occurrence, also verify that instance:

```bash
todo-cli task detail 42
todo-cli task detail 42 --date 2026-05-11
todo-cli task next-occurrences --task-id 42
todo-cli task update 42 --description-file ./daily-review.md --occurrence-date 2026-05-11 --if-match 3
```

Use `task detail` for user-facing "today/current/calendar/task detail" questions. It returns
the effective record under `effective`; for recurring tasks that is the visible occurrence when
one exists. Use `task get` only when you explicitly need the recurring series body, template,
revision, or recurrence rule.

If the user did not provide an ID, list today's visible records first:

```bash
todo-cli task today --include-occurrences
```

### Shortcuts

```bash
todo-cli +add --title "Inbox task"
todo-cli +today --format table
todo-cli +tomorrow --format table
todo-cli +inbox --format table
todo-cli task +done 42
todo-cli calendar +agenda --days 7 --format table
```

### Categories

```bash
todo-cli category list --format table
todo-cli category get 1
todo-cli category create --name Work --color '#2563eb'
todo-cli category update 1 --name Personal --color '#16a34a'
todo-cli category delete 1 --yes
```

### Calendar

```bash
todo-cli calendar events \
  --start 2026-05-11T00:00:00+08:00 \
  --end 2026-05-12T00:00:00+08:00 \
  --format table
```

### Notifications

```bash
todo-cli notify settings
todo-cli notify channels
todo-cli notify create-setting --channel ntfy --config '{"topic":"todo"}' --default=true
todo-cli notify default 1
todo-cli notify test --channel ntfy --config '{"topic":"todo"}'
todo-cli notify reconcile
```

### Raw API

Use raw API when a feature is not yet wrapped by a resource command.

```bash
todo-cli api GET /tasks
todo-cli api PATCH /tasks/42/status --data '{"status":"completed"}'
todo-cli api PUT /tasks/42 --data-file ./payload.json
todo-cli api GET /calendar --query '{"start":"2026-05-11T00:00:00+08:00","end":"2026-05-12T00:00:00+08:00"}'
todo-cli api GET /calendar --query-file ./query.json
```

## Skill

The AI-facing skill lives at:

```text
cli/skills/todo-cli/SKILL.md
```

Point other AI tools at that file, or copy/symlink it into their skill/plugin
directory. The skill tells agents how to verify auth, prefer dry runs for risky
operations, and call the CLI for common Todo workflows.

The recommended installer path is:

```bash
npx skills add marlonfan/todo@todo-cli -g -a codex -y
```

For private repository access, use:

```bash
npx skills add 'git@github.com:marlonfan/todo.git#main@todo-cli' -g -a codex -y
```
