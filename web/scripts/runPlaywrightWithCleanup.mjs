import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(webDir, '..');
const fallbackLibPath = '/tmp/pwprobe/sysroot/usr/lib/x86_64-linux-gnu';
const playwrightEnv = {
  ...process.env,
  LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH
    ? `${fallbackLibPath}:${process.env.LD_LIBRARY_PATH}`
    : fallbackLibPath,
};

function run(cmd, args, cwd, env = process.env, allowFail = false) {
  const result = spawnSync(cmd, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: false,
  });
  if (!allowFail && result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result.status ?? 1;
}

function cleanup(allowFail = false) {
  const env = {
    ...process.env,
    GOCACHE: process.env.GOCACHE || '/tmp/gocache',
  };
  const args = [
    'run',
    './cmd/e2e-cleanup',
    '-db',
    './todo.db',
    '-prefix',
    'e2e_pw_',
  ];
  return run('go', args, rootDir, env, allowFail);
}

const playwrightArgs = process.argv.slice(2);

cleanup(false);
const testCode = run('npx', ['playwright', 'test', ...playwrightArgs], webDir, playwrightEnv, true);
cleanup(true);
process.exit(testCode);
