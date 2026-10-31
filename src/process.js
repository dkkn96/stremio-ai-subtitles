import { spawn } from 'node:child_process';
import { AppError } from './errors.js';

export function minimalEnvironment(inherited = process.env) {
  const env = {};
  for (const name of ['PATH', 'HOME', 'USERPROFILE', 'LANG', 'LC_ALL', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot', 'WINDIR']) if (inherited[name]) env[name] = inherited[name];
  return env;
}
export function terminateTree(child, signal = 'SIGTERM') {
  try { if (process.platform === 'win32') child.kill(signal); else process.kill(-child.pid, signal); } catch { /* Already exited. */ }
}
export function runProcess(binary, args, { env = minimalEnvironment(), cwd, input = '', timeoutMs = 180000, maxBytes = 4000000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd, env, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', size = 0, failure, killTimer;
    const stop = error => {
      if (failure) return;
      failure = error; terminateTree(child);
      killTimer = setTimeout(() => terminateTree(child, 'SIGKILL'), 2000); killTimer.unref();
    };
    const timer = setTimeout(() => stop(new AppError('PROVIDER_TIMEOUT', 'AI client timed out. Try a smaller batch or check your account.')), timeoutMs);
    for (const [name, stream] of [['stdout', child.stdout], ['stderr', child.stderr]]) {
      stream.setEncoding('utf8');
      stream.on('data', text => {
        size += Buffer.byteLength(text);
        if (size > maxBytes) return stop(new AppError('PROVIDER_OUTPUT_LIMIT', 'AI response exceeded the output limit.'));
        if (!failure) { if (name === 'stdout') stdout += text; else stderr += text; }
      });
    }
    child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timer); clearTimeout(killTimer); reject(new AppError('PROVIDER_NOT_INSTALLED', 'AI client unavailable. Follow docs/PROVIDERS.md, then run npm run doctor.')); });
    child.on('close', code => { clearTimeout(timer); clearTimeout(killTimer); if (failure) reject(failure); else resolve({ code, stdout, stderr }); });
    child.stdin.end(input);
  });
}
export function providerFailure(text = '') {
  if (/quota|rate.?limit|usage.limit|too many requests|\b429\b|credit balance|spending.limit/i.test(text)) return new AppError('PROVIDER_QUOTA', 'AI account quota or rate limit reached. Check your account before resuming.', 429);
  if (/unauthori[sz]ed|\b401\b|login|log.in|authenticat|sign.in/i.test(text)) return new AppError('PROVIDER_LOGIN', 'AI login required or expired. Run npm run login.');
  if (/model.*(?:unavailable|not found|not supported|not exist)/i.test(text)) return new AppError('PROVIDER_MODEL', 'The selected model is unavailable. Choose a model explicitly in setup.');
  return new AppError('PROVIDER_FAILED', 'The AI client could not complete the translation. Run doctor and the opt-in probe.');
}
