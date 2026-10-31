import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { minimalEnvironment } from '../src/process.js';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
function start(env) {
  const child = spawn(process.execPath, ['src/main.js', '--demo'], { cwd: resolve(import.meta.dirname, '..'), env: { ...minimalEnvironment(), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', d => { log += d; }); child.stderr.on('data', d => { log += d; });
  return { child, log: () => log, ended: once(child, 'exit') };
}
async function stop(process) { if (process.child.exitCode === null) process.child.kill('SIGTERM'); await process.ended; }
async function healthy(origin, process) {
  for (let i = 0; i < 60; i++) {
    if (process.child.exitCode !== null) throw new Error(process.log());
    try { if ((await fetch(`${origin}/health`, { signal: AbortSignal.timeout(300) })).ok) return; } catch { /* Startup in progress. */ }
    await delay(50);
  }
  throw new Error('Local process failed to become healthy.');
}

test('real addon processes restart with the same private link/cache and reject a second owner', async t => {
  const dataDir = await mkdtemp(join(tmpdir(), 'subtitle-lifecycle-'));
  const port = await freePort(); const origin = `http://127.0.0.1:${port}`;
  const env = { DATA_DIR: dataDir, PORT: String(port), PUBLIC_BASE_URL: origin };
  const processes = [];
  t.after(async () => { for (const p of processes) await stop(p); await rm(dataDir, { recursive: true, force: true }); });
  const first = start(env); processes.push(first); await healthy(origin, first);
  const token = (await readFile(join(dataDir, 'addon-token'), 'utf8')).trim();
  const listingUrl = `${origin}/${token}/subtitles/movie/tt0000000.json`;
  const listing = await (await fetch(listingUrl)).json();
  const before = await (await fetch(listing.subtitles[0].url)).text(); assert.match(before, /Elhoztad/);
  const usage = await readFile(join(dataDir, 'daily-usage.json'), 'utf8');
  const second = start(env); processes.push(second); const [code] = await second.ended;
  assert.equal(code, 1); assert.match(second.log(), /Another server/);
  await stop(first);
  const restarted = start(env); processes.push(restarted); await healthy(origin, restarted);
  assert.equal((await readFile(join(dataDir, 'addon-token'), 'utf8')).trim(), token);
  const afterListing = await (await fetch(listingUrl)).json(); assert.equal(afterListing.subtitles[0].url, listing.subtitles[0].url);
  assert.equal(await (await fetch(listing.subtitles[0].url)).text(), before);
  assert.equal(await readFile(join(dataDir, 'daily-usage.json'), 'utf8'), usage);
  assert.ok(!first.log().includes(token)); assert.ok(!restarted.log().includes(token));
});
