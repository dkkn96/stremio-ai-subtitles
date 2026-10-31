import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { minimalEnvironment, runProcess, providerFailure } from './process.js';
import { translationInstructions, TRANSLATION_SCHEMA } from './translator.js';
import { validateTranslations } from './subtitles.js';
import { AppError } from './errors.js';
import { runGrokAcp } from './grok-acp.js';

export function cliEnvironment(config, inherited = process.env) {
  const env = minimalEnvironment(inherited);
  if (config.provider === 'gemini') env.GEMINI_CLI_HOME = config.accountDir;
  if (config.provider === 'claude') env.CLAUDE_CONFIG_DIR = config.accountDir;
  if (config.provider === 'grok') {
    Object.assign(env, { GROK_HOME: config.accountDir, GROK_DEFAULT_MODEL: config.model, GROK_SANDBOX: 'read-only', GROK_SANDBOX_AUTO_ALLOW_BASH: '0', GROK_WEB_FETCH: '0', GROK_MEMORY: '0', GROK_SUBAGENTS: '0', GROK_GOAL: '0', GROK_DISABLE_AUTOUPDATER: '1' });
    for (const vendor of ['CURSOR', 'CLAUDE']) for (const item of ['SKILLS', 'RULES', 'AGENTS', 'MCPS', 'HOOKS']) env[`GROK_${vendor}_${item}_ENABLED`] = '0';
  }
  if (config.provider === 'opencode') {
    Object.assign(env, {
      XDG_CONFIG_HOME: join(config.accountDir, 'config'), XDG_DATA_HOME: join(config.accountDir, 'data'), XDG_STATE_HOME: join(config.accountDir, 'state'), XDG_CACHE_HOME: join(config.accountDir, 'cache'),
      OPENCODE_CONFIG_CONTENT: JSON.stringify({ permission: { '*': 'deny' }, share: 'disabled', autoupdate: false, plugin: [], mcp: {} }),
      OPENCODE_PERMISSION: JSON.stringify({ '*': 'deny' }), OPENCODE_DISABLE_AUTOUPDATE: 'true', OPENCODE_DISABLE_DEFAULT_PLUGINS: 'true', OPENCODE_DISABLE_LSP_DOWNLOAD: 'true',
    });
  }
  return env;
}
export async function prepareAccount(config) {
  await mkdir(config.accountDir, { recursive: true, mode: 0o700 });
  if (config.provider === 'gemini') {
    await mkdir(join(config.accountDir, '.gemini'), { recursive: true, mode: 0o700 });
    // This directory belongs to the addon; never change the user's global settings.
    await writeFile(join(config.accountDir, '.gemini', 'settings.json'), JSON.stringify({
      security: { auth: { selectedType: 'oauth-personal' } }, tools: { core: [] }, mcpServers: {},
      general: { enableAutoUpdate: false }, telemetry: { enabled: false },
    }), { mode: 0o600 });
  }
}
export function cliArguments(config) {
  if (config.provider === 'gemini') return ['--model', config.model, '--prompt', 'Translate the JSON subtitle task on stdin. Return only its required JSON.', '--output-format', 'stream-json'];
  if (config.provider === 'claude') return ['--print', '--model', config.model, '--output-format', 'json', '--json-schema', JSON.stringify(TRANSLATION_SCHEMA), '--tools', '', '--disallowedTools', '*', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '', '--settings', '{"disableAllHooks":true}', '--disable-slash-commands', '--no-session-persistence', '--max-turns', '2'];
  if (config.provider === 'opencode') return ['run', '--model', config.model, '--format', 'json'];
  throw new Error('Unsupported CLI provider.');
}
function parseJson(text) {
  try { return JSON.parse(text); } catch { throw new AppError('PROVIDER_INVALID_JSON', 'AI returned invalid JSON. No partial subtitle was published.'); }
}
export function parseCliOutput(provider, result) {
  if (result.code !== 0) throw providerFailure(result.stderr + result.stdout);
  if (provider === 'claude') {
    const data = parseJson(result.stdout);
    if (data.is_error || (data.subtype && data.subtype !== 'success')) throw providerFailure(JSON.stringify(data.errors || data.result));
    return { data: data.structured_output || parseJson(data.result || ''), usage: data.usage || {} };
  }
  let text = '', complete = false, usage = {};
  for (const line of result.stdout.split(/\r?\n/).filter(Boolean)) {
    const event = parseJson(line);
    if (['error', 'tool_use', 'tool_result'].includes(event.type) || event.part?.type === 'tool') {
      if (event.type === 'error') throw providerFailure(JSON.stringify(event.error || event));
      throw new AppError('PROVIDER_TOOL_ATTEMPT', 'A translation attempted to use a tool. Result rejected.');
    }
    if (provider === 'gemini') {
      if (event.type === 'message' && event.role === 'assistant') text += event.content || '';
      if (event.type === 'result') {
        if (event.status !== 'success') throw providerFailure(JSON.stringify(event.error || event));
        complete = true; usage = event.stats || {};
      }
    } else {
      if (event.type === 'text') text += event.part?.text || '';
      if (event.type === 'step_finish' && event.part?.reason === 'stop') { complete = true; usage = event.part?.tokens || {}; }
    }
  }
  if (!complete) throw new AppError('PROVIDER_INCOMPLETE', 'AI did not confirm completion. No subtitle was published.');
  return { data: parseJson(text), usage: { input_tokens: usage.input_tokens || usage.input || 0, output_tokens: usage.output_tokens || usage.output || 0 } };
}
export async function prepareCliTranslator(config, { run = runProcess, acp = runGrokAcp } = {}) {
  await prepareAccount(config);
  return {
    description: `${config.provider} CLI · your dedicated local account · experimental adapter`,
    translator: async (cues, context) => {
      const directory = await mkdtemp(join(tmpdir(), 'stremio-ai-'));
      try {
        const input = JSON.stringify({ instructions: translationInstructions(config), schema: TRANSLATION_SCHEMA, context, cues: cues.map(cue => ({ id: cue.id, text: cue.text, duration_seconds: (cue.end - cue.start) / 1000 })) });
        const env = cliEnvironment(config);
        let output;
        if (config.provider === 'grok') output = { data: parseJson(await acp(config, input, { env, cwd: directory })), usage: {} };
        else output = parseCliOutput(config.provider, await run(config.cliBinary, cliArguments(config), { input, env, cwd: directory, timeoutMs: config.providerTimeoutMs }));
        return { cues: validateTranslations(cues, output.data.translations), usage: output.usage };
      } finally { await rm(directory, { recursive: true, force: true }); }
    },
  };
}
