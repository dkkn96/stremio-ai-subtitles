import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { loadConfig } from '../src/config.js';
import { demoSource, demoTranslator, demoEnglish } from '../src/demo.js';
import { JobStore } from '../src/jobs.js';
import { makeServer } from '../src/server.js';
import { parseSubtitles } from '../src/subtitles.js';
const dataDir = await mkdtemp(join(tmpdir(), 'subtitle-smoke-'));
let server;
try {
  const config = await loadConfig({ DATA_DIR: dataDir }, true);
  const jobs = new JobStore(config, demoSource, demoTranslator); await jobs.init();
  server = makeServer(config, demoSource, jobs); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  config.publicBase = `http://127.0.0.1:${server.address().port}`;
  const base = `${config.publicBase}/${config.token}`;
  assert.equal((await fetch(`${config.publicBase}/health`)).status, 200);
  assert.equal((await fetch(`${config.publicBase}/wrong/manifest.json`)).status, 404);
  const manifest = await (await fetch(`${base}/manifest.json`)).json(); assert.deepEqual(manifest.resources, ['subtitles']);
  const listing = await (await fetch(`${base}/subtitles/movie/tt0000000.json`)).json();
  assert.equal(listing.subtitles[0].lang, 'hun');
  const response = await fetch(listing.subtitles[0].url); assert.equal(response.status, 200);
  const result = parseSubtitles(await response.text());
  assert.deepEqual(result.map(c => [c.start, c.end]), parseSubtitles(demoEnglish).map(c => [c.start, c.end]));
  assert.equal(result.length, 6);
  console.log('PASS: local Stremio protocol, private manifest, listing, six synthetic cues, exact timestamps. No AI requests, remote downloads or video playback.');
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await rm(dataDir, { recursive: true, force: true });
}
