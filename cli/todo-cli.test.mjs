import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const cliPath = join(dirname(fileURLToPath(import.meta.url)), 'todo-cli.mjs');

async function withFixtureServer(handler, run) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

async function runCLI(baseUrl, args) {
  const configDir = await mkdtemp(join(tmpdir(), 'todo-cli-test-'));
  try {
    return await execFileAsync(process.execPath, [
      cliPath,
      '--base-url', baseUrl,
      '--token', 'test-token',
      '--config', join(configDir, 'config.json'),
      ...args,
    ]);
  } finally {
    await rm(configDir, { recursive: true, force: true });
  }
}

async function runLocalCLI(args) {
  return execFileAsync(process.execPath, [cliPath, ...args]);
}

test('notify settings output redacts credentials returned by an older server', async () => {
  await withFixtureServer((req, res) => {
    assert.equal(req.url, '/api/notify/settings');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify([{
      id: 7,
      channel: 'telegram',
      config: { bot_token: 'telegram-secret', chat_id: 'private-chat' },
      is_default: true,
    }]));
  }, async (baseUrl) => {
    const { stdout } = await runCLI(baseUrl, ['notify', 'settings']);
    assert.doesNotMatch(stdout, /telegram-secret|private-chat/);
    assert.match(stdout, /<redacted>/);
  });
});

test('doctor output never emits avatar data URLs', async () => {
  await withFixtureServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/health') {
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    assert.equal(req.url, '/api/auth/me');
    res.end(JSON.stringify({
      id: 9,
      username: 'agent-user',
      avatar_url: 'data:image/png;base64,very-large-secret',
      timezone: 'Asia/Shanghai',
    }));
  }, async (baseUrl) => {
    const { stdout } = await runCLI(baseUrl, ['doctor']);
    assert.doesNotMatch(stdout, /data:image|very-large-secret/);
    assert.match(stdout, /<redacted>/);
  });
});

test('HTTP errors are redacted before they reach stderr', async () => {
  await withFixtureServer((req, res) => {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'bot_token=telegram-secret avatar=data:image/png;base64,avatar-secret' }));
  }, async (baseUrl) => {
    await assert.rejects(runCLI(baseUrl, ['notify', 'settings']), (err) => {
      assert.doesNotMatch(err.stderr, /telegram-secret|avatar-secret|data:image/);
      assert.match(err.stderr, /<redacted>/);
      return true;
    });
  });
});

test('timed task creation submits only task time and hides server-managed scheduling fields', async () => {
  await withFixtureServer(async (req, res) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/api/tasks');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert.equal(body.start_time_local, '2026-08-04T20:37:00');
    assert.equal(body.client_timezone, 'Asia/Shanghai');
    assert.equal('reminder_policy' in body, false);
    assert.equal('reminder_minutes_before' in body, false);
    assert.equal(req.headers['x-client-op-id'], 'at-start-op');
    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      id: 61,
      title: body.title,
      ...body,
      reminder_policy: 'inherit',
      reminder_minutes_before: null,
      reminder_summary: [{ id: 9, notify_at: '2026-08-04T20:32:00+08:00' }],
    }));
  }, async (baseUrl) => {
    const { stdout } = await runCLI(baseUrl, [
      'task', 'create',
      '--title', '打熊',
      '--start-time-local', '2026-08-04T20:37:00',
      '--timezone', 'Asia/Shanghai',
      '--client-op-id', 'at-start-op',
    ]);
    assert.match(stdout, /2026-08-04T20:37:00/);
    assert.doesNotMatch(stdout, /reminder|notify_at|20:32/);
  });
});

test('retired task reminder flags fail instead of being silently ignored', async () => {
  await withFixtureServer((_req, res) => {
    res.statusCode = 500;
    res.end();
  }, async (baseUrl) => {
    await assert.rejects(
      runCLI(baseUrl, [
        'task', 'create',
        '--title', '打熊',
        '--start-time-local', '2026-08-04T20:37:00',
        '--remind-at-start',
      ]),
      /--remind-at-start is no longer supported; set the task time/,
    );
  });
});

function localDateOnly(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function occurrenceFixtureHandler() {
  const today = localDateOnly();
  const staleDate = localDateOnly(-49);
  const requested = [];
  const handler = (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    requested.push(url.pathname);
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/tasks') {
      res.end(JSON.stringify([
        { id: 89, title: '普通任务', status: 'pending' },
        { id: 43, title: 'Obsidian 日报复盘', status: 'pending', recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
      ]));
      return;
    }
    // Faithful to the server: next-occurrences only returns the earliest unfinished
    // instance of each series, so it never carries today's instance for a stale series.
    if (url.pathname === '/api/tasks/next-occurrences') {
      res.end(JSON.stringify([{
        instance_id: `43_${staleDate.replaceAll('-', '')}`,
        task_id: 43,
        title: 'Obsidian 日报复盘',
        original_date: staleDate,
        start_time: `${staleDate}T20:30:00+08:00`,
        is_recurring: true,
      }]));
      return;
    }
    if (url.pathname === '/api/calendar') {
      res.end(JSON.stringify([
        {
          id: `43_${today.replaceAll('-', '')}`,
          title: 'Obsidian 日报复盘',
          start: `${today}T20:30:00+08:00`,
          end: `${today}T21:00:00+08:00`,
          allDay: false,
          editable: true,
          extendedProps: {
            taskId: 43,
            priority: 0,
            status: 'pending',
            isRecurring: true,
            instanceId: `43_${today.replaceAll('-', '')}`,
          },
        },
        {
          id: 'caldav-7',
          title: '外部日历事件',
          start: `${today}T09:00:00+08:00`,
          allDay: false,
          editable: false,
          extendedProps: { taskId: 7, priority: 0, status: 'pending', isRecurring: false, source: 'caldav' },
        },
      ]));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: `unexpected ${url.pathname}` }));
  };
  handler.requested = requested;
  return handler;
}

test('task today includes today\'s recurring instance from the calendar and drops them with --no-occurrences', async () => {
  const handler = occurrenceFixtureHandler();
  await withFixtureServer(handler, async (baseUrl) => {
    const today = localDateOnly().replaceAll('-', '');
    const { stdout } = await runCLI(baseUrl, ['task', 'today']);
    const rows = JSON.parse(stdout);
    assert.deepEqual(
      rows.map((row) => row.title).sort(),
      ['Obsidian 日报复盘', '普通任务'],
    );
    const occurrence = rows.find((row) => row.task_id === 43);
    assert.ok(occurrence, 'expected the recurring occurrence in task today output');
    assert.equal(occurrence.instance_id, `43_${today}`);
    assert.equal(occurrence.original_date, localDateOnly());
    assert.equal(occurrence.start_time, `${localDateOnly()}T20:30:00+08:00`);
    assert.equal(occurrence.source, 'occurrence');
    assert.ok(rows.every((row) => row.title !== '外部日历事件'), 'caldav events must not leak into task today');

    const optOut = JSON.parse((await runCLI(baseUrl, ['task', 'today', '--no-occurrences'])).stdout);
    assert.deepEqual(optOut.map((row) => row.id).sort((a, b) => a - b), [43, 89]);
    assert.ok(optOut.every((row) => row.task_id === undefined));

    const aliasOptOut = JSON.parse((await runCLI(baseUrl, ['task', 'today', '--no-include-occurrences'])).stdout);
    assert.deepEqual(aliasOptOut.map((row) => row.id).sort((a, b) => a - b), [43, 89]);
    assert.ok(aliasOptOut.every((row) => row.task_id === undefined));

    assert.ok(handler.requested.includes('/api/calendar'), 'task today must read /calendar');
  });
});

test('version and skill doctor report matching bundled versions', async () => {
  const versionResult = await runLocalCLI(['--version']);
  assert.equal(versionResult.stdout.trim(), '0.3.1');

  const doctorResult = await runLocalCLI(['skill', 'doctor']);
  const report = JSON.parse(doctorResult.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.cli_version, '0.3.1');
  assert.equal(report.skill_version, '0.3.1');
  assert.equal(report.version_match, true);
});

test('skill install creates a discoverable target without overwriting it', async () => {
  const targetDir = await mkdtemp(join(tmpdir(), 'todo-cli-skill-target-'));
  try {
    const installResult = await runLocalCLI(['skill', 'install', '--target-dir', targetDir]);
    const installed = JSON.parse(installResult.stdout);
    assert.equal(installed.ok, true);
    assert.equal(installed.installed, true);

    const doctorResult = await runLocalCLI(['skill', 'doctor', '--target-dir', targetDir]);
    const report = JSON.parse(doctorResult.stdout);
    assert.equal(report.ok, true);
    assert.equal(report.target_ready, true);

    await assert.rejects(
      runLocalCLI(['skill', 'install', '--target-dir', targetDir]),
      /already exists/,
    );

    const forceResult = await runLocalCLI(['skill', 'install', '--target-dir', targetDir, '--force']);
    const replaced = JSON.parse(forceResult.stdout);
    assert.equal(replaced.ok, true);
    assert.match(replaced.backup, /todo-cli\.backup-/);

    const doctorAfterForce = JSON.parse((await runLocalCLI(['skill', 'doctor', '--target-dir', targetDir])).stdout);
    assert.equal(doctorAfterForce.target_ready, true);
  } finally {
    await rm(targetDir, { recursive: true, force: true });
  }
});
