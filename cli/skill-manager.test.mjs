import assert from 'node:assert/strict';
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { SkillManager } from './skill-manager.mjs';

const exec = promisify(execFile);
const cliDir = dirname(fileURLToPath(import.meta.url));
const contents = (version, body = 'Current instructions') => `---
name: todo-cli
metadata:
  version: "${version}"
---
${body}
`;

async function fixture(run) {
  const dir = await mkdtemp(join(tmpdir(), 'todo-skill-sync-'));
  try {
    const bundledPath = join(dir, 'package', 'skills', 'todo-cli', 'SKILL.md');
    const root = join(dir, 'agent', 'skills');
    const target = join(root, 'todo-cli');
    await mkdir(dirname(bundledPath), { recursive: true });
    await mkdir(root, { recursive: true });
    await writeFile(bundledPath, contents('1.0.0'));
    const manager = new SkillManager({ bundledPath, version: '1.0.0',
      configPath: join(dir, 'config', 'config.json'), roots: [root] });
    await run({ dir, root, target, manager, bundledPath });
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test('doctor detects old versions and edited contents, sync migrates copies without discoverable backups', async () => {
  await fixture(async ({ root, target, manager, bundledPath }) => {
    await mkdir(target);
    await writeFile(join(target, 'SKILL.md'), contents('0.9.0'));
    assert.equal((await manager.doctor()).ok, false);
    // Even matching version metadata cannot hide a stale/edited copy.
    await writeFile(join(target, 'SKILL.md'), contents('1.0.0', 'Different instructions'));
    assert.equal((await manager.doctor()).ok, false);
    const result = await manager.sync();
    assert.equal(result.ok, true);
    assert.equal(result.targets[0].linked, true);
    const backup = result.installations[0].backup;
    assert.ok(!backup.startsWith(root));
    assert.match(await readFile(join(backup, 'SKILL.md'), 'utf8'), /Different instructions/);
    assert.equal(await realpath(target), await realpath(dirname(bundledPath)));
    assert.deepEqual((await manager.state()).targets, [target]);
    // Subsequent calls do not accumulate backups.
    assert.equal((await manager.sync()).installations[0].backup, null);
  });
});

test('dry-run does not write state or replace a copy', async () => {
  await fixture(async ({ target, manager }) => {
    await mkdir(target);
    await writeFile(join(target, 'SKILL.md'), contents('0.9.0'));
    await manager.sync(undefined, { dryRun: true });
    assert.equal((await lstat(target)).isSymbolicLink(), false);
    await assert.rejects(readFile(manager.statePath), { code: 'ENOENT' });
  });
});

test('a package-only upgrade stays detectable until sync records the new version', async () => {
  await fixture(async ({ manager, target, bundledPath }) => {
    await manager.install(target);
    await writeFile(bundledPath, contents('1.1.0'));
    manager.version = '1.1.0';
    const report = await manager.doctor();
    assert.equal(report.targets[0].in_sync, true);
    assert.equal(report.state_in_sync, false);
    assert.equal(report.ok, false);
    const synced = await manager.sync();
    assert.equal(synced.ok, true);
    assert.equal(synced.synced_version, '1.1.0');
    assert.equal(synced.new_session_required, true);
  });
});

test('tracked custom targets are repaired even when their package symlink is broken', async () => {
  await fixture(async ({ dir, manager }) => {
    const target = join(dir, 'custom', 'todo-cli');
    await manager.install(target);
    await rm(target);
    await symlink(join(dir, 'missing-package'), target, 'dir');
    assert.equal((await manager.doctor()).ok, false);
    assert.equal((await manager.sync()).ok, true);
    assert.equal((await manager.inspect(target)).linked, true);
  });
});

test('shared agent links remain usable and repeated sync preserves their topology', async () => {
  await fixture(async ({ dir, manager, target }) => {
    const alias = join(dir, 'claude', 'skills', 'todo-cli');
    await mkdir(dirname(alias), { recursive: true });
    await mkdir(target);
    await writeFile(join(target, 'SKILL.md'), contents('0.9.0'));
    await symlink(target, alias, 'dir');
    manager.roots.push(dirname(alias));
    const result = await manager.sync();
    assert.equal(result.ok, true);
    assert.equal(result.installations[1].backup, null);
    assert.equal(await realpath(alias), await realpath(target));
  });
});

test('invalid state stops sync before touching installed Skills', async () => {
  await fixture(async ({ target, manager }) => {
    await mkdir(target);
    await writeFile(join(target, 'SKILL.md'), contents('0.9.0'));
    await mkdir(dirname(manager.statePath), { recursive: true });
    await writeFile(manager.statePath, 'broken JSON');
    await assert.rejects(manager.sync(), /Cannot read Skill state/);
    assert.equal((await lstat(target)).isSymbolicLink(), false);
  });
});

test('update --check is read-only; update re-enters the new CLI and synchronizes tracked Skills', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'todo-cli-update-'));
  try {
    const prefix = join(dir, 'global');
    const pkg = join(prefix, 'lib', 'node_modules', '@marlonfan', 'todo-app-cli');
    const bin = join(dir, 'bin');
    const config = join(dir, 'config', 'config.json');
    const targetRoot = join(dir, 'skills');
    await mkdir(pkg, { recursive: true });
    await mkdir(bin);
    for (const name of ['todo-cli.mjs', 'skill-manager.mjs', 'skills', 'package.json']) {
      await cp(join(cliDir, name), join(pkg, name), { recursive: true });
    }
    const current = JSON.parse(await readFile(join(pkg, 'package.json'), 'utf8')).version;
    const next = '99.0.0';
    // A fake package manager exercises the real updater without network or global changes.
    const fakeNpm = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
if (args[0] === 'view') console.log(JSON.stringify(process.env.FAKE_LATEST || ${JSON.stringify(next)}));
else if (args[0] === 'prefix') console.log(${JSON.stringify(prefix)});
else if (args[0] === 'install') {
  if (args[2] !== '@marlonfan/todo-app-cli@${next}') process.exit(2);
  fs.writeFileSync(${JSON.stringify(join(dir, 'installed'))}, 'yes');
  for (const name of ['todo-cli.mjs', 'skills/todo-cli/SKILL.md']) {
    const file = path.join(${JSON.stringify(pkg)}, name);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll(${JSON.stringify(current)}, ${JSON.stringify(next)}));
  }
} else process.exit(3);
`;
    await writeFile(join(bin, 'npm'), fakeNpm, { mode: 0o755 });
    const run = async (args, env = {}) => JSON.parse((await exec(process.execPath, [join(pkg, 'todo-cli.mjs'),
      ...args, '--config', config], { env: { ...process.env, HOME: dir,
        CODEX_HOME: join(dir, '.codex'), PATH: `${bin}:${process.env.PATH}`, ...env } })).stdout);
    await run(['skill', 'install', '--target-dir', targetRoot]);
    const check = await run(['update', '--check']);
    assert.equal(check.update_available, true);
    await assert.rejects(readFile(join(dir, 'installed')), { code: 'ENOENT' });
    const result = await run(['update']);
    assert.equal(result.action, 'updated');
    assert.equal(result.cli_version, next);
    assert.equal(result.skill_version, next);
    assert.equal(result.ok, true);
    assert.equal(JSON.parse(await readFile(join(dirname(config), 'skills-state.json'), 'utf8')).version, next);
    assert.match(await readFile(join(targetRoot, 'todo-cli', 'SKILL.md'), 'utf8'), /99\.0\.0/);
    assert.equal((await run(['update', '--skills-only'])).skills_action, 'synced');
    await rm(join(dir, 'installed'));
    const newerLocal = await run(['update'], { FAKE_LATEST: current });
    assert.equal(newerLocal.action, 'already_up_to_date');
    assert.equal(newerLocal.cli_version, next);
    await assert.rejects(readFile(join(dir, 'installed')), { code: 'ENOENT' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
