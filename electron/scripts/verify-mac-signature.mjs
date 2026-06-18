import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const electronDir = path.resolve(__dirname, '..');
const explicitAppPath = process.argv[2] ? path.resolve(process.argv[2]) : '';

function findPackagedApp() {
  if (explicitAppPath) return explicitAppPath;

  const distDir = path.join(electronDir, 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error(`Build output directory does not exist: ${distDir}`);
  }

  const candidates = fs
    .readdirSync(distDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('mac'))
    .map((entry) => path.join(distDir, entry.name, 'Todo.app'))
    .filter((candidate) => fs.existsSync(candidate));

  if (!candidates.length) {
    throw new Error(`Could not find Todo.app under ${distDir}/mac*`);
  }
  return candidates[0];
}

function runCodesign(args) {
  return execFileSync('/usr/bin/codesign', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const appPath = findPackagedApp();

try {
  runCodesign(['--verify', '--deep', '--strict', '--verbose=2', appPath]);
  const details = runCodesign(['--display', '--verbose=4', appPath]);
  const authorityLines = details
    .split('\n')
    .filter((line) => line.trim().startsWith('Authority=') || line.trim().startsWith('Signature='));

  console.log(`macOS signature OK: ${appPath}`);
  if (authorityLines.length) {
    console.log(authorityLines.join('\n'));
  }
} catch (error) {
  const output = [error.stdout, error.stderr].filter(Boolean).join('\n').trim();
  console.error(`macOS signature check failed: ${appPath}`);
  if (output) {
    console.error(output);
  }
  process.exit(1);
}
