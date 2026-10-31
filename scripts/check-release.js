import { readdir, readFile, lstat } from 'node:fs/promises';
import { resolve, relative, dirname, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const directories = ['src', 'scripts', 'test', 'docs', 'profiles', '.github'];
const roots = ['README.md', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'LICENSE', 'NOTICE.md', 'CONTRIBUTING.md', 'SECURITY.md', 'package.json', 'package-lock.json', '.gitignore', '.env.example'];
const files = [];
async function walk(path) {
  const info = await lstat(path);
  if (info.isSymbolicLink()) throw new Error(`Release must not contain symlinks: ${relative(root, path)}`);
  if (info.isDirectory()) { for (const name of await readdir(path)) await walk(resolve(path, name)); }
  else files.push(path);
}
try {
  for (const path of [...roots, ...directories]) await walk(resolve(root, path));
  const allowed = new Set(files.map(path => relative(root, path)));
  const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  if (tracked.status === 0) {
    for (const name of tracked.stdout.split('\0').filter(Boolean)) if (!allowed.has(name)) throw new Error(`Tracked file outside release allowlist: ${name}`);
  }
  const forbidden = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}/,
    /\bAKIA[A-Z0-9]{16}\b/,
    /https?:\/\/[^\s"'<>]+\/[a-f0-9]{40,128}\/(?:manifest\.json|install)/,
    /\/Users\/[a-z][a-z0-9._-]+\/(?:Documents|Downloads|\.codex|Library)\//i,
  ];
  for (const path of files) {
    const name = relative(root, path);
    if (/(?:^|\/)(?:auth\.json|\.env(?!\.example$)|data|runtime|node_modules|vendor)(?:\/|$)/.test(name) || /\.(?:pem|key|srt|vtt|log|zip)$/i.test(name)) throw new Error(`Private/generated material in release: ${name}`);
    const text = await readFile(path, 'utf8');
    if (forbidden.some(pattern => pattern.test(text))) throw new Error(`Potential secret or private deployment reference: ${name}. Inspect locally; do not paste the match.`);
    if (extname(path) === '.md') {
      for (const match of text.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
        const target = match[1].split('#')[0];
        if (!target || /^[a-z]+:/i.test(target)) continue;
        const destination = resolve(dirname(path), target);
        if (!allowed.has(relative(root, destination))) throw new Error(`Broken or non-release documentation link in ${name}: ${target}`);
      }
    }
  }
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  if (pkg.dependencies?.openai || pkg.dependencies?.jose || pkg.scripts?.build?.includes('vendor')) throw new Error('Legacy SDK/dependency unexpectedly reintroduced.');
  console.log(`PASS: ${files.length} allowlisted source/docs files, local links, no detected private artifacts or legacy SDK. Review staged content before publishing.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
