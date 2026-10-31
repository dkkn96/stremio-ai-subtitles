import { resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { languageInfo } from './languages.js';

export const PROVIDERS = ['codex', 'gemini', 'claude', 'grok', 'opencode', 'openai-api', 'compatible-api'];
export function integer(env, name, fallback, min, max) {
  const value = env[name] === undefined || env[name] === '' ? fallback : Number(env[name]);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}: expected ${min}–${max}.`);
  return value;
}
function bool(env, name, fallback = false) {
  if (env[name] === undefined || env[name] === '') return fallback;
  if (!['true', 'false'].includes(env[name])) throw new Error(`Invalid ${name}: use true or false.`);
  return env[name] === 'true';
}
export function publicOrigin(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('PUBLIC_BASE_URL must be an origin, without a path or credentials.');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw new Error('PUBLIC_BASE_URL requires HTTPS except on localhost.');
  return url.origin;
}
export function sourceUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || !url.pathname.endsWith('/manifest.json')) throw new Error('Subtitle source must be an HTTPS manifest.json URL without username or password.');
  return value;
}
export async function loadConfig(env = process.env, demo = false) {
  const port = integer(env, 'PORT', demo ? 7018 : 7017, 1, 65535);
  const provider = env.AI_PROVIDER || 'codex';
  if (!PROVIDERS.includes(provider)) throw new Error('Invalid AI_PROVIDER. Run npm run setup.');
  const api = provider.endsWith('-api');
  const apiEnabled = bool(env, 'ALLOW_PAID_API');
  if (!demo && api && !apiEnabled) throw new Error('API mode requires explicit ALLOW_PAID_API=true. No API request was sent.');
  const apiKey = api ? env.AI_API_KEY || env.OPENAI_API_KEY || '' : '';
  const model = demo ? 'demo-fixture' : env.AI_MODEL || (provider === 'codex' ? 'gpt-6-luna' : '');
  if (!model || model === 'auto' || /[\x00-\x1f]/.test(model) || model.length > 200) throw new Error('Set AI_MODEL to a model available in your chosen account. No automatic substitution is made.');
  const apiBaseUrl = provider === 'openai-api' ? 'https://api.openai.com/v1' : env.AI_API_BASE_URL || '';
  if (!demo && api) {
    const url = new URL(apiBaseUrl);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) throw new Error('Invalid AI_API_BASE_URL. Use HTTPS, or loopback HTTP for a local model.');
    if (!local && !apiKey) throw new Error('API mode requires your own AI_API_KEY, stored locally.');
  }
  const source = languageInfo(demo ? 'eng' : env.SOURCE_LANGUAGE || 'eng');
  const target = languageInfo(demo ? 'hun' : env.TARGET_LANGUAGE || 'hun');
  if (source.code === target.code) throw new Error('Source and target languages must be different.');
  const codexServiceTier = env.CODEX_SERVICE_TIER || 'fast';
  if (!['fast', 'default'].includes(codexServiceTier)) throw new Error('Invalid CODEX_SERVICE_TIER.');
  const publicBase = publicOrigin(env.PUBLIC_BASE_URL || `http://127.0.0.1:${port}`);
  const sourceManifest = sourceUrl(env.SOURCE_ADDON_URL || 'https://opensubtitles-v3.strem.io/manifest.json');
  const fallbackSourceManifest = env.FALLBACK_SOURCE_ADDON_URL ? sourceUrl(env.FALLBACK_SOURCE_ADDON_URL) : '';
  const dataDir = resolve(env.DATA_DIR || (demo ? './data/demo' : './data'));
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  let token = env.ADDON_TOKEN;
  if (!token) {
    const path = resolve(dataDir, 'addon-token');
    try { token = (await readFile(path, 'utf8')).trim(); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      token = randomBytes(24).toString('hex');
      try { await writeFile(path, token, { mode: 0o600, flag: 'wx' }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; token = (await readFile(path, 'utf8')).trim(); }
    }
  }
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) throw new Error('ADDON_TOKEN must contain 32–128 random URL-safe characters.');
  return {
    demo, provider, authMode: provider, port, host: env.HOST || '127.0.0.1', dataDir, token, publicBase,
    instanceId: createHash('sha256').update(token).digest('hex').slice(0, 12),
    sourceManifest, fallbackSourceManifest, sourceLanguage: source.code, targetLanguage: target.code,
    sourceLanguageName: source.name, targetLanguageName: target.name,
    model, apiKey, apiBaseUrl: apiBaseUrl.replace(/\/$/, ''), apiEnabled,
    reasoning: env.AI_REASONING || (provider === 'codex' ? 'max' : ''), codexServiceTier,
    codexBinary: env.CODEX_BINARY || 'codex', codexHome: resolve(dataDir, 'accounts/codex'),
    cliBinary: env.AI_CLI_BINARY || ({ gemini: 'gemini', claude: 'claude', grok: 'grok', opencode: 'opencode' }[provider] || 'codex'),
    accountDir: resolve(dataDir, 'accounts', provider),
    preferExisting: bool(env, 'PREFER_EXISTING', true), autoStart: bool(env, 'AUTO_START', true),
    sourceTimeoutMs: integer(env, 'SOURCE_TIMEOUT_SECONDS', 20, 1, 120) * 1000,
    batchSize: integer(env, 'BATCH_SIZE', 50, 1, 200), batchConcurrency: integer(env, 'BATCH_CONCURRENCY', 2, 1, 8),
    maxActive: integer(env, 'MAX_ACTIVE_JOBS', 1, 1, 4), maxQueued: integer(env, 'MAX_QUEUED_JOBS', 4, 1, 100),
    maxDailyJobs: integer(env, 'MAX_NEW_JOBS_PER_DAY', 20, 1, 1000), maxCues: integer(env, 'MAX_CUES', 4000, 1, 10000),
    deliveryWaitMs: integer(env, 'DELIVERY_WAIT_SECONDS', 45, 1, 120) * 1000,
    providerTimeoutMs: integer(env, 'PROVIDER_TIMEOUT_SECONDS', 180, 1, 600) * 1000,
    retryCooldownMs: integer(env, 'RETRY_COOLDOWN_SECONDS', 300, 1, 3600) * 1000,
  };
}
