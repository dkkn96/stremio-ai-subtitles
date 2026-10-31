import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { readFile, writeFile, copyFile, chmod } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { LANGUAGES, languageInfo } from '../src/languages.js';
import { PROVIDERS, integer, publicOrigin, sourceUrl } from '../src/config.js';

export function serializeEnv(entries) {
  return Object.entries(entries).map(([key, raw]) => {
    const value = String(raw);
    if (!/^[A-Z_0-9]+$/.test(key) || /[\r\n\0]/.test(value)) throw new Error('Invalid configuration value.');
    const quote = !value.includes("'") ? "'" : !value.includes('"') ? '"' : null;
    if (!quote) throw new Error('Configuration values cannot contain both quote styles.');
    return `${key}=${quote}${value}${quote}`;
  }).join('\n') + '\n';
}
export async function setup(ask, { file = '.env', language = 'en' } = {}) {
  const it = language === 'it';
  const q = (italian, english, fallback, secret = false) => ask(`${it ? italian : english}${fallback !== undefined ? ` [${secret && fallback ? (it ? 'valore salvato' : 'saved value') : fallback}]` : ''}: `).then(answer => answer.trim() || fallback || '');
  let old = {};
  try { old = parseEnv(await readFile(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (Object.keys(old).length && (await q('Aggiornare la configurazione esistente? Scrivi SI', 'Update existing configuration? Type YES', '')).toUpperCase() !== (it ? 'SI' : 'YES')) return false;
  console.log(it ? 'Profili CLI: codex, gemini, claude, grok, opencode. Profili API facoltativi: openai-api, compatible-api.' : 'CLI profiles: codex, gemini, claude, grok, opencode. Optional API profiles: openai-api, compatible-api.');
  const provider = await q('Servizio AI', 'AI service', old.AI_PROVIDER || 'codex');
  if (!PROVIDERS.includes(provider)) throw new Error('Unknown provider. Run setup again.');
  if (provider !== 'codex') console.log(it ? 'Questo adattatore è sperimentale: richiede la prova finale sul tuo account.' : 'This adapter is experimental: complete the final probe with your own account.');
  const preset = JSON.parse(await readFile(new URL(`../profiles/${provider}.json`, import.meta.url), 'utf8'));
  const model = await q('Identificativo del modello nel tuo account', 'Model identifier available in your account', old.AI_PROVIDER === provider ? old.AI_MODEL : preset.AI_MODEL);
  if (!model || model === 'auto') throw new Error('Choose an explicit model identifier; consult docs/PROVIDERS.md.');
  console.log(LANGUAGES.map(l => `${l.code}=${l.name}`).join(', '));
  const source = languageInfo(await q('Lingua di partenza', 'Source language', old.SOURCE_LANGUAGE || 'eng'));
  const target = languageInfo(await q('Lingua desiderata', 'Target language', old.TARGET_LANGUAGE || 'hun'));
  if (source.code === target.code) throw new Error('Choose different languages.');
  const port = integer({ PORT: await q('Porta locale', 'Local port', old.PORT || '7017') }, 'PORT', 7017, 1024, 65535);
  const base = publicOrigin(await q('Indirizzo HTTPS, oppure invio per prova locale', 'HTTPS address, or Enter for local testing', old.PUBLIC_BASE_URL || `http://127.0.0.1:${port}`));
  const sourceManifest = sourceUrl(await q('Manifest della fonte sottotitoli', 'Subtitle source manifest', old.SOURCE_ADDON_URL || 'https://opensubtitles-v3.strem.io/manifest.json', Boolean(old.SOURCE_ADDON_URL)));
  const fallback = await q('Manifest di riserva (facoltativo)', 'Fallback manifest (optional)', old.FALLBACK_SOURCE_ADDON_URL || '', true);
  if (fallback) sourceUrl(fallback);
  const daily = integer({ LIMIT: await q('Massimo di nuovi lavori al giorno', 'Maximum new jobs per day', old.MAX_NEW_JOBS_PER_DAY || '20') }, 'LIMIT', 20, 1, 1000);
  const entries = { ...old, AI_PROVIDER: provider, AI_MODEL: model, SOURCE_LANGUAGE: source.code, TARGET_LANGUAGE: target.code, PORT: port, HOST: '127.0.0.1', PUBLIC_BASE_URL: base, SOURCE_ADDON_URL: sourceManifest, FALLBACK_SOURCE_ADDON_URL: fallback, MAX_NEW_JOBS_PER_DAY: daily, BATCH_SIZE: 50, BATCH_CONCURRENCY: 2, MAX_ACTIVE_JOBS: 1, MAX_QUEUED_JOBS: 4, PREFER_EXISTING: 'true', PROVIDER_TIMEOUT_SECONDS: 180, ALLOW_PAID_API: 'false', AI_REASONING: '', CODEX_SERVICE_TIER: 'fast' };
  if (provider === 'codex') entries.AI_REASONING = await q('Reasoning Codex', 'Codex reasoning', old.AI_REASONING || 'max');
  if (provider.endsWith('-api')) {
    const consent = await q('Le API possono comportare costi. Abilitarle? Scrivi SI', 'APIs may incur charges. Enable them? Type YES', '');
    if (consent.toUpperCase() !== (it ? 'SI' : 'YES')) return false;
    entries.ALLOW_PAID_API = 'true';
    if (provider === 'compatible-api') entries.AI_API_BASE_URL = await q('URL base API, incluso /v1 se richiesto', 'API base URL, including /v1 if required', old.AI_API_BASE_URL || '');
    console.log(it ? 'La chiave va inserita privatamente nel file .env come AI_API_KEY. Non incollarla in una chat.' : 'Enter your key privately in .env as AI_API_KEY. Do not paste it in chat.');
  }
  const text = '# Private local configuration. Do not publish.\n' + serializeEnv(entries);
  if (Object.keys(old).length) {
    const backup = `${file}.backup-${Date.now()}`;
    await copyFile(file, backup); await chmod(backup, 0o600);
  }
  await writeFile(file, text, { mode: 0o600, flag: Object.keys(old).length ? 'w' : 'wx' });
  await chmod(file, 0o600);
  console.log(it ? 'Configurazione salvata. Prossimi passi: npm run login, npm run doctor, npm run probe -- --confirm, npm start.' : 'Saved. Next: npm run login, npm run doctor, npm run probe -- --confirm, npm start.');
  return true;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const language = process.argv.includes('--en') ? 'en' : process.argv.includes('--it') ? 'it' : (await rl.question('Language / Lingua [it/en]: ')).trim() || 'en';
    await setup(prompt => rl.question(prompt), { language });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { rl.close(); }
}
