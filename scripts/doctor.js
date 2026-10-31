import { access, stat } from 'node:fs/promises';
import { loadConfig } from '../src/config.js';
import { runProcess, minimalEnvironment } from '../src/process.js';
import { codexStatus } from '../src/codex.js';
let failures = 0;
const report = (state, text) => { console.log(`${state}: ${text}`); if (state === 'FAIL') failures++; };
try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  report(major > 22 || (major === 22 && minor >= 12) ? 'OK' : 'FAIL', `Node ${process.versions.node} (requires >=22.12)`);
  try { await access('.env'); report('OK', 'Local configuration exists'); } catch { report('FAIL', 'No .env file: run npm run setup'); }
  const config = await loadConfig();
  report('OK', `${config.provider} · ${config.model} · ${config.sourceLanguageName} → ${config.targetLanguageName}`);
  report('OK', `Limits: ${config.maxDailyJobs} admissions/day UTC, ${config.maxActive} active job(s), ${config.batchConcurrency} batches/job`);
  if (process.platform !== 'win32') {
    const mode = (await stat(config.dataDir)).mode & 0o077;
    report(mode ? 'WARN' : 'OK', mode ? 'data directory is accessible to other local users; restrict its permissions' : 'Private data directory permissions');
  }
  if (!config.provider.endsWith('-api')) {
    const result = await runProcess(config.provider === 'codex' ? config.codexBinary : config.cliBinary, ['--version'], { env: minimalEnvironment(), cwd: config.dataDir, timeoutMs: 10000 });
    report(result.code === 0 ? 'OK' : 'FAIL', `AI executable ${result.code === 0 ? 'responds' : 'failed'}${result.stdout.match(/\b\d+\.\d+(?:\.\d+)?\b/) ? ` (${result.stdout.match(/\b\d+\.\d+(?:\.\d+)?\b/)[0]})` : ''}`);
    if (config.provider === 'codex') report(await codexStatus(config) ? 'OK' : 'FAIL', 'Dedicated ChatGPT login (npm run login if missing)');
    else report('UNVERIFIED', 'Account/model access requires the opt-in probe: npm run probe -- --confirm');
  } else report('WARN', 'Explicit API mode enabled; charges may apply. This check sends no AI request.');
  try {
    const response = await fetch(`http://127.0.0.1:${config.port}/health`, { signal: AbortSignal.timeout(2500) });
    const health = await response.json();
    report(response.ok && health.status === 'ok' ? 'OK' : 'FAIL', 'Local server health');
  } catch { report('INFO', 'Local server not running yet: npm start'); }
  if (process.argv.includes('--online')) {
    if (!config.publicBase.startsWith('https:')) report('WARN', 'Remote devices require a public HTTPS address; see docs/HOSTING.md');
    else {
      const response = await fetch(`${config.publicBase}/health`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      report(response.ok && (await response.json()).status === 'ok' ? 'OK' : 'FAIL', 'Public HTTPS health (this machine only; also test on mobile data)');
    }
  }
  console.log('Doctor does not prove translation quality or TV/iPhone playback. Complete the Stremio checklist.');
} catch (error) { report('FAIL', error.message); }
process.exitCode = failures ? 1 : 0;
