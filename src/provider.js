import { createOpenAITranslator } from './translator.js';
import { demoTranslator } from './demo.js';
import { prepareCodexTranslator } from './codex.js';
import { prepareCliTranslator } from './cli-provider.js';
import { createCompatibleTranslator } from './compatible-api.js';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { AppError } from './errors.js';

export const pausePath = config => join(config.dataDir, `provider-${config.provider}-paused.json`);
export async function resumeProvider(config) {
  await rm(pausePath(config), { force: true });
  if (config.provider === 'codex') await rm(join(config.dataDir, 'codex-usage-paused.json'), { force: true });
}
export function quotaGuard(config, translate) {
  let paused = false;
  return async (...args) => {
    if (!paused) {
      try { await readFile(pausePath(config)); paused = true; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (paused) throw new AppError('PROVIDER_PAUSED', 'Provider paused after a quota/rate limit. Check your account, then run npm run resume.', 429);
    try { return await translate(...args); }
    catch (error) {
      if (['PROVIDER_QUOTA', 'MODEL_RATE_LIMIT', 'CODEX_USAGE_LIMIT', 'CODEX_RATE_LIMIT'].includes(error.code)) {
        paused = true;
        await writeFile(pausePath(config), JSON.stringify({ pausedAt: new Date().toISOString(), reason: error.code }), { mode: 0o600 });
      }
      throw error;
    }
  };
}
export async function prepareTranslator(config) {
  if (config.demo) return { translator: demoTranslator, description: 'Synthetic demo: no AI or source downloads' };
  let prepared;
  if (config.provider === 'codex') prepared = await prepareCodexTranslator(config);
  else if (config.provider.endsWith('-api')) {
    if (!config.apiEnabled) throw new Error('API access has not been explicitly enabled.');
    prepared = { translator: config.provider === 'openai-api' ? createOpenAITranslator(config) : createCompatibleTranslator(config), description: 'Explicit API mode: provider billing may apply' };
  } else prepared = await prepareCliTranslator(config);
  return { ...prepared, translator: quotaGuard(config, prepared.translator) };
}
