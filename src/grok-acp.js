import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { AppError } from './errors.js';
import { terminateTree, providerFailure } from './process.js';

// Standard ACP: the client advertises no filesystem/terminal capabilities and
// rejects every permission request. No subscription token is read by this app.
export async function runGrokAcp(config, prompt, { env, cwd, spawnImpl = spawn } = {}) {
  const child = spawnImpl(config.cliBinary, ['agent', 'stdio'], { env, cwd, shell: false, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  let nextId = 1, text = '', size = 0, failure;
  const fail = error => { failure ||= error; for (const entry of pending.values()) entry.reject(failure); pending.clear(); };
  const send = value => child.stdin.write(JSON.stringify(value) + '\n');
  const request = (method, params) => new Promise((resolve, reject) => {
    if (failure) return reject(failure);
    const id = nextId++; pending.set(id, { resolve, reject }); send({ jsonrpc: '2.0', id, method, params });
  });
  const timer = setTimeout(() => { fail(new AppError('PROVIDER_TIMEOUT', 'Grok timed out.')); terminateTree(child); }, config.providerTimeoutMs);
  child.stdin.on('error', () => {});
  child.on('error', () => fail(new AppError('PROVIDER_NOT_INSTALLED', 'Grok Build CLI unavailable.')));
  child.on('exit', () => fail(new AppError('PROVIDER_INCOMPLETE', 'Grok exited before completion.')));
  child.stdout.on('data', chunk => { size += chunk.length; if (size > 4000000) { fail(new AppError('PROVIDER_OUTPUT_LIMIT', 'Grok output limit exceeded.')); terminateTree(child); } });
  child.stderr.on('data', chunk => { size += chunk.length; if (size > 4000000) fail(new AppError('PROVIDER_OUTPUT_LIMIT', 'Grok output limit exceeded.')); });
  lines.on('line', line => {
    if (size > 4000000) { fail(new AppError('PROVIDER_OUTPUT_LIMIT', 'Grok output limit exceeded.')); terminateTree(child); return; }
    let message;
    try { message = JSON.parse(line); } catch { fail(new AppError('PROVIDER_INVALID_JSON', 'Invalid Grok ACP response.')); return; }
    if (message.method && message.id !== undefined) {
      if (message.method === 'session/request_permission') send({ jsonrpc: '2.0', id: message.id, result: { outcome: { outcome: 'cancelled' } } });
      else send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Client capability not available' } });
      fail(new AppError('PROVIDER_TOOL_ATTEMPT', 'Grok requested a tool. Result rejected.')); return;
    }
    if (message.method === 'session/update') {
      const update = message.params?.update;
      if (['tool_call', 'tool_call_update'].includes(update?.sessionUpdate)) { fail(new AppError('PROVIDER_TOOL_ATTEMPT', 'Grok attempted a tool. Result rejected.')); return; }
      if (update?.sessionUpdate === 'agent_message_chunk' && update.content?.type === 'text') text += update.content.text;
      return;
    }
    const entry = pending.get(message.id);
    if (entry) { pending.delete(message.id); if (message.error) entry.reject(providerFailure(JSON.stringify(message.error))); else entry.resolve(message.result); }
  });
  try {
    const init = await request('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } });
    if (!init.authMethods?.some(method => method.id === 'cached_token')) throw new AppError('PROVIDER_LOGIN', 'Grok cached login unavailable. Run npm run login; API fallback is disabled.');
    await request('authenticate', { methodId: 'cached_token', _meta: { headless: true } });
    const session = await request('session/new', { cwd, mcpServers: [] });
    if (session.models?.currentModelId !== config.model) {
      if (!session.models?.availableModels?.some(model => model.modelId === config.model)) throw new AppError('PROVIDER_MODEL', 'Grok did not advertise the exact configured model. No substitution was made.');
      await request('session/set_model', { sessionId: session.sessionId, modelId: config.model });
    }
    const result = await request('session/prompt', { sessionId: session.sessionId, prompt: [{ type: 'text', text: prompt }] });
    if (failure) throw failure;
    if (result.stopReason !== 'end_turn') throw new AppError('PROVIDER_INCOMPLETE', 'Grok did not finish the translation.');
    return text;
  } finally {
    clearTimeout(timer); lines.close(); terminateTree(child);
    const kill = setTimeout(() => terminateTree(child, 'SIGKILL'), 2000); kill.unref();
    child.once('exit', () => clearTimeout(kill));
  }
}
