import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = {
  ...process.env,
  VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || 'http://10.0.2.2:8080/api',
};

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCommand, ['run', 'build:desktop'], {
  cwd: webDir,
  env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
