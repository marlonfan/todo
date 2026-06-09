import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const electronDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(electronDir, '..');
const webDir = path.join(repoRoot, 'web');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const electronBin = process.platform === 'win32'
  ? path.join(electronDir, 'node_modules', '.bin', 'electron.cmd')
  : path.join(electronDir, 'node_modules', '.bin', 'electron');

function waitForPort(port, host = '127.0.0.1', timeoutMs = 30000) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ port, host });
      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 250);
      });
    };

    attempt();
  });
}

function spawnChild(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    ...options,
  });

  child.on('error', (error) => {
    console.error(error);
    shutdown(1);
  });

  return child;
}

let shuttingDown = false;
const children = new Set();

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const vite = spawnChild(npm, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '3000'], {
  cwd: webDir,
  env: process.env,
});
children.add(vite);

vite.on('exit', (code) => {
  children.delete(vite);
  if (!shuttingDown) {
    shutdown(code ?? 0);
  }
});

await waitForPort(3000);

const electron = spawnChild(electronBin, ['.'], {
  cwd: electronDir,
  env: {
    ...process.env,
    ELECTRON_DEV: '1',
    VITE_DEV_SERVER_URL: 'http://127.0.0.1:3000',
  },
});
children.add(electron);

electron.on('exit', (code) => {
  children.delete(electron);
  if (!shuttingDown) {
    shutdown(code ?? 0);
  }
});
