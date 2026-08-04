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

test('task create can request one atomic reminder at the visible start time', async () => {
  await withFixtureServer(async (req, res) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/api/tasks');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert.equal(body.start_time_local, '2026-08-04T20:37:00');
    assert.equal(body.client_timezone, 'Asia/Shanghai');
    assert.equal(body.reminder_policy, 'offset');
    assert.equal(body.reminder_minutes_before, 0);
    assert.equal(req.headers['x-client-op-id'], 'at-start-op');
    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id: 61, title: body.title, ...body, reminder_summary: [] }));
  }, async (baseUrl) => {
    await runCLI(baseUrl, [
      'task', 'create',
      '--title', '打熊',
      '--start-time-local', '2026-08-04T20:37:00',
      '--timezone', 'Asia/Shanghai',
      '--remind-at-start',
      '--client-op-id', 'at-start-op',
    ]);
  });
});

test('task reminder update and delete use item endpoints', async () => {
  const requests = [];
  await withFixtureServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push({ method: req.method, url: req.url, body: Buffer.concat(chunks).toString('utf8') });
    res.statusCode = req.method === 'DELETE' ? 204 : 200;
    if (req.method !== 'DELETE') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ id: 9, task_id: 42, notify_at: '2026-08-04T20:07:00+08:00' }));
    } else {
      res.end();
    }
  }, async (baseUrl) => {
    await runCLI(baseUrl, [
      'task', 'reminder-update', '42', '9',
      '--notify-at', '2026-08-04T20:07:00+08:00',
      '--client-op-id', 'update-reminder-op',
    ]);
    await runCLI(baseUrl, [
      'task', 'reminder-delete', '42', '9', '--yes',
      '--client-op-id', 'delete-reminder-op',
    ]);
  });

  assert.deepEqual(requests.map(({ method, url }) => ({ method, url })), [
    { method: 'PATCH', url: '/api/tasks/42/notifications/9' },
    { method: 'DELETE', url: '/api/tasks/42/notifications/9' },
  ]);
  assert.equal(JSON.parse(requests[0].body).notify_at, '2026-08-04T20:07:00+08:00');
});

test('version and skill doctor report matching bundled versions', async () => {
  const versionResult = await runLocalCLI(['--version']);
  assert.equal(versionResult.stdout.trim(), '0.2.0');

  const doctorResult = await runLocalCLI(['skill', 'doctor']);
  const report = JSON.parse(doctorResult.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.cli_version, '0.2.0');
  assert.equal(report.skill_version, '0.2.0');
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
