import { lstat, mkdir, readFile, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';

const exists = async (path) => {
  try { await lstat(path); return true; } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
};

export function skillVersion(content) {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return frontmatter?.[1].match(/^(?:version| {2}version):\s*["']?([^\s"']+)/m)?.[1] || null;
}

export class SkillManager {
  constructor({ bundledPath, version, configPath, roots }) {
    this.bundledPath = bundledPath;
    this.version = version;
    this.statePath = join(dirname(resolve(configPath)), 'skills-state.json');
    this.roots = roots || [
      join(homedir(), '.agents', 'skills'),
      join(homedir(), '.codex', 'skills'),
      join(homedir(), '.claude', 'skills'),
      join(homedir(), '.pi', 'agent', 'skills'),
      ...(process.env.CODEX_HOME ? [join(process.env.CODEX_HOME, 'skills')] : []),
      ...(process.platform === 'darwin' ? [join(homedir(), 'Library', 'Application Support', 'Cindy', 'codex-home', 'skills', 'xdt-agents')] : []),
    ];
  }

  async state() {
    try {
      const state = JSON.parse(await readFile(this.statePath, 'utf8'));
      if (!Array.isArray(state.targets) || state.targets.some((target) => typeof target !== 'string')) {
        throw new Error('invalid targets');
      }
      return state;
    } catch (err) {
      if (err.code === 'ENOENT') return { targets: [] };
      throw new Error(`Cannot read Skill state ${this.statePath}: ${err.message}`);
    }
  }

  async targets(explicit) {
    if (explicit) return [resolve(explicit)];
    const paths = new Set((await this.state()).targets.map((path) => resolve(path)));
    for (const root of this.roots) {
      const path = join(root, 'todo-cli');
      if (await exists(path)) paths.add(resolve(path));
    }
    return [...paths];
  }

  async inspect(target) {
    try {
      const [bundled, installed] = await Promise.all([
        readFile(this.bundledPath, 'utf8'), readFile(join(target, 'SKILL.md'), 'utf8'),
      ]);
      return { path: target, ready: true, version: skillVersion(installed),
        in_sync: installed === bundled,
        linked: await realpath(target) === await realpath(dirname(this.bundledPath)),
        sha256: createHash('sha256').update(installed).digest('hex') };
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') throw err;
      return { path: target, ready: false, version: null, in_sync: false, linked: false };
    }
  }

  async doctor(explicit) {
    const targets = await this.targets(explicit);
    const reports = await Promise.all(targets.map((target) => this.inspect(target)));
    const state = await this.state();
    const bundledVersion = skillVersion(await readFile(this.bundledPath, 'utf8'));
    const versionMatch = bundledVersion === this.version;
    const stateMatches = state.targets.length === 0 || state.version === this.version;
    return { ok: versionMatch && stateMatches && reports.every((target) => target.in_sync),
      cli_version: this.version, skill_version: bundledVersion, version_match: versionMatch,
      synced_version: state.version || null, state_in_sync: stateMatches,
      skill_path: this.bundledPath, target_path: explicit ? resolve(explicit) : null,
      target_ready: explicit ? reports[0].ready : null, targets: reports,
      state_path: this.statePath, new_session_required: false };
  }

  async save(targets) {
    await mkdir(dirname(this.statePath), { recursive: true });
    const temp = `${this.statePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, JSON.stringify({ version: this.version, source: this.bundledPath,
        targets, updated_at: new Date().toISOString() }, null, 2) + '\n', 'utf8');
      await rename(temp, this.statePath);
    } finally {
      await rm(temp, { force: true });
    }
  }

  async install(target, { force = false } = {}) {
    target = resolve(target);
    const state = await this.state();
    const hadTarget = await exists(target);
    if (hadTarget && !force) throw new Error(`skill target already exists: ${target}`);
    const before = await this.inspect(target);
    let backup = null;
    let changed = false;
    if (!before.linked) {
      await mkdir(dirname(target), { recursive: true });
      if (hadTarget) {
        // Keep backups outside every agent's discovery root.
        backup = join(dirname(this.statePath), 'skill-backups', `todo-cli.backup-${Date.now()}-${randomUUID()}`);
        await mkdir(dirname(backup), { recursive: true });
        await rename(target, backup);
      }
      try {
        await symlink(dirname(this.bundledPath), target, 'dir');
        changed = true;
      } catch (err) {
        if (backup) await rename(backup, target);
        throw err;
      }
    }
    try {
      await this.save([...new Set([...state.targets, target])]);
    } catch (err) {
      if (changed) {
        await rm(target, { force: true });
        if (backup) await rename(backup, target);
      }
      throw err;
    }
    return { ok: true, installed: true, cli_version: this.version, skill_version: this.version,
      source: dirname(this.bundledPath), target, backup,
      new_session_required: changed || state.version !== this.version };
  }

  async sync(explicit, { dryRun = false } = {}) {
    const targets = await this.targets(explicit);
    if (dryRun) return { dry_run: true, targets, action: 'sync_skills' };
    const results = [];
    for (const target of targets) {
      // A target may be the shared directory reached by another agent's link.
      results.push(await this.install(target, { force: true }));
    }
    const report = await this.doctor(explicit);
    return { ...report, skills_action: targets.length ? 'synced' : 'not_installed',
      installations: results, new_session_required: results.some((item) => item.new_session_required) };
  }
}
