import { mkdtempSync, rmSync, cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, '..');
const vendorDir = path.join(webDir, 'vendor', 'marktext-muya');
const upstreamRepo = 'https://github.com/marktext/marktext.git';
const upstreamPackage = 'packages/muya';
const requestedRef = process.argv[2] || 'develop';

function run(cmd, args, cwd, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
    },
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function output(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function writeUpstreamReadme(commit) {
  const content = `# Vendored MarkText Muya

This package vendors the editor core used by MarkText so the app does not depend on the archived standalone \`marktext/muya\` repository at runtime.

- Upstream repository: https://github.com/marktext/marktext
- Upstream package path: \`${upstreamPackage}\`
- Upstream commit: \`${commit}\`
- Runtime import used by this app: \`@todo/vendor-marktext-muya\`

## Updating

Run from \`web/\`:

\`\`\`sh
node ./scripts/updateMarktextMuya.mjs
\`\`\`

To pin a specific upstream commit:

\`\`\`sh
node ./scripts/updateMarktextMuya.mjs ${commit}
\`\`\`

The script pulls \`marktext/marktext\`, builds \`${upstreamPackage}\`, and replaces this package's \`lib/\` output. Review the resulting diff before committing.
`;
  writeFileSync(path.join(vendorDir, 'UPSTREAM.md'), content);
}

function updatePackageVersion(commit) {
  const packagePath = path.join(vendorDir, 'package.json');
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  pkg.version = `0.2.0-marktext.${commit.slice(0, 7)}`;
  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function replaceOnce(filePath, from, to) {
  const content = readFileSync(filePath, 'utf8');
  if (!content.includes(from)) {
    throw new Error(`Expected MarkText Muya patch target not found in ${filePath}`);
  }
  writeFileSync(filePath, content.replace(from, to));
}

function patchBuiltMuya() {
  replaceOnce(
    path.join(vendorDir, 'lib', 'es', 'index.js'),
    'let { key: n, metaKey: r } = e, { isSelectionInSameBlock: i } = (t = this.selection.getSelection()) == null ? {} : t;\n\t\t\t\ti || /Alt|Option|Meta|Shift|CapsLock|ArrowUp|ArrowDown|ArrowLeft|ArrowRight/.test(n) || r || ((n === "Backspace" || n === "Delete") && e.preventDefault(), this.cutHandler());',
    'let { key: n, metaKey: r, ctrlKey: i } = e, { isSelectionInSameBlock: a } = (t = this.selection.getSelection()) == null ? {} : t;\n\t\t\ta || /Alt|Option|Meta|Shift|CapsLock|ArrowUp|ArrowDown|ArrowLeft|ArrowRight/.test(n) || r || i || ((n === "Backspace" || n === "Delete") && e.preventDefault(), this.cutHandler());'
  );
  replaceOnce(
    path.join(vendorDir, 'lib', 'cjs', 'index.js'),
    'let{key:n,metaKey:r}=e,{isSelectionInSameBlock:i}=(t=this.selection.getSelection())==null?{}:t;i||/Alt|Option|Meta|Shift|CapsLock|ArrowUp|ArrowDown|ArrowLeft|ArrowRight/.test(n)||r||((n===`Backspace`||n===`Delete`)&&e.preventDefault(),this.cutHandler())',
    'let{key:n,metaKey:r,ctrlKey:i}=e,{isSelectionInSameBlock:a}=(t=this.selection.getSelection())==null?{}:t;a||/Alt|Option|Meta|Shift|CapsLock|ArrowUp|ArrowDown|ArrowLeft|ArrowRight/.test(n)||r||i||((n===`Backspace`||n===`Delete`)&&e.preventDefault(),this.cutHandler())'
  );
}

if (!existsSync(vendorDir)) {
  throw new Error(`Missing vendor directory: ${vendorDir}`);
}

const tempDir = mkdtempSync(path.join(tmpdir(), 'todo-marktext-muya-'));
const checkoutDir = path.join(tempDir, 'marktext');

try {
  run('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', upstreamRepo, checkoutDir], tempDir);
  run('git', ['sparse-checkout', 'set', upstreamPackage], checkoutDir);
  run('git', ['fetch', '--depth', '1', 'origin', requestedRef], checkoutDir);
  run('git', ['checkout', 'FETCH_HEAD'], checkoutDir);

  const commit = output('git', ['rev-parse', 'HEAD'], checkoutDir);
  const packageDir = path.join(checkoutDir, upstreamPackage);

  run('npm', ['install', '--no-audit', '--no-fund'], packageDir);
  run('npm', ['run', 'build'], packageDir);

  const builtLib = path.join(packageDir, 'lib');
  if (!existsSync(builtLib)) {
    throw new Error(`Expected build output not found: ${builtLib}`);
  }

  rmSync(path.join(vendorDir, 'lib'), { recursive: true, force: true });
  cpSync(builtLib, path.join(vendorDir, 'lib'), { recursive: true });
  patchBuiltMuya();

  for (const file of ['LICENSE', 'README.md']) {
    const source = path.join(packageDir, file);
    if (existsSync(source)) {
      cpSync(source, path.join(vendorDir, file));
    }
  }

  updatePackageVersion(commit);
  writeUpstreamReadme(commit);
  console.log(`Updated MarkText Muya vendor from ${commit}`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
