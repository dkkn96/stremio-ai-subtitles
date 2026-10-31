import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { runGrokAcp } from '../src/grok-acp.js';

function fixture({ permission = false, model = 'test-model', quota = false } = {}) {
  const calls = [];
  const child = new EventEmitter();
  Object.assign(child, { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill() {} });
  const send = value => child.stdout.write(JSON.stringify(value) + '\n');
  child.stdin.on('data', chunk => {
    for (const line of chunk.toString().trim().split('\n')) {
      const request = JSON.parse(line); calls.push(request);
      if (!request.method) continue;
      queueMicrotask(() => {
        let result = {};
        if (request.method === 'initialize') result = { authMethods: [{ id: 'cached_token' }] };
        if (request.method === 'session/new') result = { sessionId: 'synthetic-session', models: { currentModelId: model, availableModels: [{ modelId: model }] } };
        if (request.method === 'session/prompt') {
          if (quota) { send({ id: request.id, error: { message: 'quota exceeded' } }); return; }
          if (permission) { send({ id: 100, method: 'session/request_permission', params: {} }); return; }
          send({ method: 'session/update', params: { update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: '{"translations":[]}' } } } });
          result = { stopReason: 'end_turn' };
        }
        send({ id: request.id, result });
      });
    }
  });
  return { calls, spawnImpl: () => child };
}
const config = { cliBinary: 'grok', model: 'test-model', providerTimeoutMs: 500 };

test('Grok ACP uses personal cached login and no filesystem, terminal or MCP capabilities', async () => {
  const f = fixture();
  assert.equal(await runGrokAcp(config, 'synthetic task', { env: {}, cwd: '/tmp', spawnImpl: f.spawnImpl }), '{"translations":[]}');
  assert.equal(f.calls.find(c => c.method === 'authenticate').params.methodId, 'cached_token');
  assert.equal(f.calls[0].params.clientCapabilities.terminal, false);
  assert.deepEqual(f.calls.find(c => c.method === 'session/new').params.mcpServers, []);
});

test('Grok ACP denies tool permissions before rejecting the translation', async () => {
  const f = fixture({ permission: true });
  await assert.rejects(runGrokAcp(config, 'synthetic task', { env: {}, cwd: '/tmp', spawnImpl: f.spawnImpl }), error => error.code === 'PROVIDER_TOOL_ATTEMPT');
  assert.equal(f.calls.find(c => c.id === 100).result.outcome.outcome, 'cancelled');
});

test('Grok ACP never silently substitutes unavailable models or bypasses quota', async () => {
  for (const [options, expected] of [[{ model: 'other-model' }, 'PROVIDER_MODEL'], [{ quota: true }, 'PROVIDER_QUOTA']]) {
    const f = fixture(options);
    await assert.rejects(runGrokAcp(config, 'synthetic task', { env: {}, cwd: '/tmp', spawnImpl: f.spawnImpl }), error => error.code === expected);
    if (options.model) assert.ok(!f.calls.some(c => c.method === 'session/prompt'));
  }
});
