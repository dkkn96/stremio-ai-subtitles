import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { once } from 'node:events';
import { parseSubtitles, serializeSrt, validateTranslations } from '../src/subtitles.js';
import { chooseSource, sourceRequestUrl, createSource } from '../src/source.js';
import { isPublicAddress } from '../src/http-client.js';
import { createOpenAITranslator, translateCues } from '../src/translator.js';
import { demoEnglish, demoSource, demoTranslator } from '../src/demo.js';
import { JobStore } from '../src/jobs.js';
import { makeServer } from '../src/server.js';
import { AppError } from '../src/errors.js';

const testRoot = resolve(import.meta.dirname, '../.test-data');
const token = 'test-only-token-not-for-deployment-12345678';
const english = { id: 'test-subtitle-1', lang: 'eng', url: 'https://example.org/episode.srt' };

test('installation page is private, uses the public origin, and never starts translation', async t => {
  const f = await webFixture(t);
  const response = await fetch(`${f.base}/install`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const html = await response.text();
  assert.ok(html.includes(`${f.base}/manifest.json`));
  assert.ok(html.includes(f.base.replace('http:', 'stremio:')));
  assert.match(html, /AI Subtitles/);
  assert.equal(f.jobs.jobs.size, 0);
  assert.equal((await fetch(`${f.config.publicBase}/wrong-token/install`)).status, 404);
  assert.equal((await fetch(`${f.base}/install`, { method: 'HEAD' })).status, 200);
  assert.equal(f.jobs.jobs.size, 0);
});

async function fixture(t, overrides = {}, source = demoSource, provider = demoTranslator) {
  await mkdir(testRoot, { recursive: true });
  const dataDir = await mkdtemp(resolve(testRoot, 'test-'));
  const config = {
    dataDir, demo: true, token, publicBase: 'http://127.0.0.1:0',
    model: 'demo-fixture', reasoning: 'low', sourceManifest: 'https://example.org/manifest.json',
    batchSize: 2, batchConcurrency: 2, maxActive: 2, maxQueued: 5, maxDailyJobs: 20,
    maxCues: 4000, deliveryWaitMs: 5000, providerTimeoutMs: 1000, retryCooldownMs: 60_000,
    autoStart: true, preferExisting: true,
    ...overrides,
  };
  const jobs = new JobStore(config, source, provider);
  await jobs.init();
  t.after(async () => {
    await jobs.admission;
    for (const job of jobs.jobs.values()) if (job.promise) await job.promise;
    const target = resolve(dataDir);
    if (dirname(target) !== testRoot || !basename(target).startsWith('test-')) throw new Error('Unsafe test cleanup path');
    await rm(target, { recursive: true, force: true });
  });
  return { config, jobs, source };
}

async function webFixture(t, overrides, source, provider) {
  const f = await fixture(t, overrides, source, provider);
  const server = makeServer(f.config, f.source, f.jobs);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  f.config.publicBase = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return { ...f, server, base: `${f.config.publicBase}/${token}` };
}

test('SRT round trip retains every cue and millisecond, including overlaps', () => {
  const original = '\uFEFF4\r\n00:00:01,025 --> 00:00:03,777\r\nHello.\r\n\r\n8\r\n00:00:03,500 --> 00:00:05,999\r\nBye.\r\n';
  const cues = parseSubtitles(original);
  assert.deepEqual(parseSubtitles(serializeSrt(cues)), cues);
  assert.equal(cues[0].start, 1025);
  assert.equal(cues[1].end, 5999);
});

test('WebVTT cue identifiers and styling become a plain SRT with correct timestamps', () => {
  const input = 'WEBVTT\n\nNOTE source\ncomment\n\nfirst\n00:01.025 --> 00:03.777 align:start\n<i>Hello</i> &amp; bye.\n';
  const [cue] = parseSubtitles(input);
  assert.equal(cue.text, 'Hello & bye.');
  assert.equal(cue.start, 1025);
  assert.match(serializeSrt([cue]), /00:00:01,025 --> 00:00:03,777/);
});

test('invalid, empty, truncated and excessive subtitles fail instead of being silently skipped', () => {
  for (const input of ['', '<html>Error</html>', '1\n00:00:01,000 --> 00:00:00,999\nHello', '1\n00:65:01,000 --> 00:66:00,000\nHello']) {
    assert.throws(() => parseSubtitles(input), AppError);
  }
  assert.throws(() => parseSubtitles(demoEnglish, 2), /limit/);
});

test('missing, duplicate or invented translations are rejected; order can be restored safely', () => {
  const cues = parseSubtitles(demoEnglish).slice(0, 2);
  for (const items of [[], [{ id: 1, text: 'Szia' }, { id: 1, text: 'Szia' }],
    [{ id: 1, text: 'Szia' }, { id: 3, text: 'Szia' }],
    [{ id: 1, text: '' }, { id: 2, text: 'Szia' }],
    [{ id: 1, text: '-->' }, { id: 2, text: 'Szia' }]]) {
    assert.throws(() => validateTranslations(cues, items), AppError);
  }
  const result = validateTranslations(cues, [{ id: 2, text: 'Második' }, { id: 1, text: 'Első' }]);
  assert.equal(result[0].text, 'Első');
  assert.deepEqual(result.map(c => [c.start, c.end]), cues.map(c => [c.start, c.end]));
});

test('source URL forwards encoded release information without injecting query parameters', () => {
  const url = sourceRequestUrl('https://example.org/private/manifest.json', 'series', 'tt1234567:1:2', {
    videoHash: '0123456789abcdef', filename: 'Show & Name S01E02.mkv', evil: 'ignored',
  });
  assert.match(url, /\/private\/subtitles\/series\/tt1234567%3A1%3A2\//);
  assert.match(url, /filename=Show\+%26\+Name/);
  assert.doesNotMatch(url, /evil/);
});

test('full English subtitles retain source ranking and take priority over a forced track', () => {
  const result = chooseSource([
    { ...english, id: 'forced', label: 'English forced' },
    { ...english, id: 'best' }, { ...english, id: 'second' },
  ]);
  assert.equal(result.id, 'best');
  assert.equal(chooseSource([{ ...english, label: 'English forced' }]), undefined);
  assert.equal(chooseSource([{ ...english, url: 'file:///etc/passwd' }]), undefined);
});

test('private, mapped IPv6, loopback and reserved addresses cannot be fetched as subtitles', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '100.64.0.1', '169.254.169.254', '192.168.1.1', '224.0.0.1',
    '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1', '2002:7f00:1::']) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('diagnostic SRT notices never become English translation sources', () => {
  const notice = { ...english, id: 'notice-no-file-info', label: 'Why these subtitles are not synced' };
  const noEnglish = { ...english, id: 'information', label: 'ℹ️ No English subtitles found for this video (pick this to see)' };
  assert.equal(chooseSource([notice, noEnglish]), undefined);
  assert.equal(chooseSource([notice, english]).id, english.id);
});

test('primary sync source forwards release information, retains ranking, and avoids fallback when usable', async () => {
  const seen = [];
  const source = createSource('https://sync.example.org/token/manifest.json', async (url, options) => {
    seen.push(url);
    assert.equal(options.timeoutMs, 60_000);
    return JSON.stringify({ subtitles: [english, { ...english, id: 'second' }] });
  }, { fallbackManifest: 'https://fallback.example.org/manifest.json', timeoutMs: 60_000 });
  const candidates = await source.list('series', 'tt1234567:2:3', { filename: 'A & B.mkv', videoHash: '0123456789abcdef' });
  assert.equal(chooseSource(candidates).id, english.id);
  assert.equal(candidates[0].sourceKind, 'primary');
  assert.equal(seen.length, 1);
  assert.match(seen[0], /filename=A\+%26\+B/);
  await source.download(candidates[0]);
  assert.equal(seen[1], english.url);
});

test('missing dialogue, notices and primary failures fall back without losing release information', async () => {
  for (const primary of [[], [{ ...english, id: 'notice-missing' }], 'failure']) {
    const seen = [];
    const source = createSource('https://sync.example.org/manifest.json', async url => {
      seen.push(url);
      if (url.startsWith('https://sync.')) {
        if (primary === 'failure') throw new AppError('SOURCE_TIMEOUT', 'Timeout');
        return JSON.stringify({ subtitles: primary });
      }
      return JSON.stringify({ subtitles: [english] });
    }, { fallbackManifest: 'https://fallback.example.org/manifest.json' });
    const candidates = await source.list('movie', 'tt1234567', { videoHash: '0123456789abcdef', videoSize: '12345' });
    assert.equal(candidates[0].sourceKind, 'fallback');
    assert.equal(chooseSource(candidates).id, english.id);
    assert.equal(seen.length, 2);
    assert.match(seen[1], /videoHash=0123456789abcdef/);
    assert.match(seen[1], /videoSize=12345/);
  }
});

test('OpenAI adapter sends cue text without editable timestamps and validates structured output', async () => {
  const cues = parseSubtitles(demoEnglish).slice(0, 2);
  const provider = createOpenAITranslator({ apiKey: 'test-not-real', model: 'gpt-6-luna', reasoning: 'low', providerTimeoutMs: 1000 }, async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(init.body);
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.model, 'gpt-6-luna');
    assert.doesNotMatch(body.input, /00:00:|"start"|"end"/);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text',
      text: JSON.stringify({ translations: [{ id: 2, text: 'Azt hittem, nálad vannak.' }, { id: 1, text: 'Elhoztad a kulcsokat?' }] }) }] }],
      usage: { input_tokens: 120, output_tokens: 90 } });
  });
  const result = await provider(cues, { before: [], after: [] });
  assert.equal(result.cues[0].text, 'Elhoztad a kulcsokat?');
  assert.equal(result.usage.output_tokens, 90);
});

test('refusals, provider errors and truncated model output never become playable subtitle text', async () => {
  const cues = parseSubtitles(demoEnglish).slice(0, 2);
  for (const response of [
    new Response('private upstream details', { status: 401 }),
    Response.json({ status: 'incomplete' }),
    Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] }),
    Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{bad' }] }] }),
  ]) {
    const provider = createOpenAITranslator({ apiKey: 'test', model: 'test', providerTimeoutMs: 1000 }, async () => response);
    await assert.rejects(provider(cues, {}), error => error instanceof AppError && !error.message.includes('private'));
  }
});

test('completed translation batches survive a failed later batch and are not billed again on retry', async () => {
  const cues = parseSubtitles(demoEnglish);
  const cache = new Map();
  let calls = 0;
  let fail = true;
  const provider = async batch => {
    calls++;
    if (batch[0].id === 3 && fail) throw new Error('simulated outage');
    return demoTranslator(batch);
  };
  const hooks = { getBatch: i => cache.get(i), putBatch: (i, value) => cache.set(i, value) };
  await assert.rejects(translateCues(cues, provider, { batchSize: 2, batchConcurrency: 1 }, hooks));
  assert.equal(cache.size, 1);
  fail = false;
  const result = await translateCues(cues, provider, { batchSize: 2, batchConcurrency: 1 }, hooks);
  assert.equal(calls, 4);
  assert.equal(result.cues.length, 6);
});

test('concurrent requests for one episode share one translation job and one set of API calls', async t => {
  let calls = 0;
  const f = await fixture(t, {}, demoSource, async cues => { calls++; return demoTranslator(cues); });
  const jobs = await Promise.all(Array.from({ length: 8 }, () => f.jobs.describe('movie', 'tt0000000', {}, english)));
  assert.ok(jobs.every(job => job === jobs[0]));
  await Promise.all(jobs.map(job => f.jobs.start(job)));
  await f.jobs.wait(jobs[0], 5000);
  assert.equal(jobs[0].state, 'ready');
  assert.equal(calls, 3);
  const original = parseSubtitles(demoEnglish);
  const translated = parseSubtitles(await f.jobs.result(jobs[0]));
  assert.deepEqual(translated.map(c => [c.start, c.end]), original.map(c => [c.start, c.end]));
  const usage = JSON.parse(await readFile(resolve(f.config.dataDir, 'daily-usage.json'), 'utf8'));
  assert.equal(usage.jobs, 1);
});

test('one incomplete block is retried without saving partial cues or retranslating other blocks', async () => {
  const cues = parseSubtitles(demoEnglish);
  const calls = [];
  const cache = new Map();
  let firstFailure = true;
  const provider = async batch => {
    calls.push(batch[0].id);
    const partial = batch[0].id === 3 && firstFailure;
    if (partial) firstFailure = false;
    const reply = await demoTranslator(partial ? batch.slice(0, 1) : batch);
    return { ...reply, usage: { input_tokens: 100, output_tokens: 10 } };
  };
  const result = await translateCues(cues, provider, { batchSize: 2, batchConcurrency: 1 }, {
    getBatch: index => cache.get(index), putBatch: (index, items) => {
      assert.equal(items.length, 2);
      cache.set(index, items);
    },
  });
  assert.deepEqual(calls, [1, 3, 3, 5]);
  assert.equal(cache.size, 3);
  assert.deepEqual(result.cues.map(c => [c.start, c.end]), cues.map(c => [c.start, c.end]));
  assert.deepEqual(result.usage, { input_tokens: 400, output_tokens: 40 });
});

test('repeated malformed output stops after one retry and quota errors are never retried', async () => {
  const cues = parseSubtitles(demoEnglish).slice(0, 2);
  for (const code of ['INCOMPLETE_TRANSLATION', 'INVALID_TRANSLATION', 'CODEX_USAGE_LIMIT']) {
    let calls = 0;
    let saves = 0;
    await assert.rejects(translateCues(cues, async () => { calls++; throw new AppError(code, 'Synthetic failure'); },
      { batchSize: 2, batchConcurrency: 1 }, { putBatch: () => { saves++; } }), error => error.code === code);
    assert.equal(calls, code === 'CODEX_USAGE_LIMIT' ? 1 : 2);
    assert.equal(saves, 0);
  }
});

test('job diagnostics retain only the video hints Stremio supplied for release verification', async t => {
  const f = await fixture(t);
  const extra = { filename: 'Episode.S02E09.mkv', videoHash: '0123456789abcdef', videoSize: '98765', secret: 'must-not-persist' };
  const job = await f.jobs.describe('series', 'tt1234567:2:9', extra, { ...english, sourceKind: 'fallback', label: 'English release' });
  const saved = JSON.parse(await readFile(resolve(f.config.dataDir, 'jobs', `${job.id}.json`), 'utf8'));
  assert.deepEqual(saved.video, { type: 'series', id: 'tt1234567:2:9', filename: extra.filename, videoHash: extra.videoHash, videoSize: extra.videoSize });
  assert.doesNotMatch(JSON.stringify(saved), /must-not-persist/);
  assert.equal(f.jobs.status(job).sourceKind, 'fallback');
  assert.equal(f.jobs.status(job).video.videoHash, extra.videoHash);
});

test('different releases and episodes never reuse the wrong subtitle file', async t => {
  const f = await fixture(t);
  const a = await f.jobs.describe('series', 'tt1234567:1:1', { filename: 'web.mkv' }, english);
  const b = await f.jobs.describe('series', 'tt1234567:1:1', { filename: 'bluray.mkv' }, english);
  const c = await f.jobs.describe('series', 'tt1234567:1:2', { filename: 'web.mkv' }, english);
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.id, c.id);
});

test('requests with and without video metadata translate identical source content only once', async t => {
  let release, downloaded, downloads = 0, calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const bothDownloaded = new Promise(resolve => { downloaded = resolve; });
  const source = { ...demoSource, download: async () => {
    if (++downloads === 2) downloaded();
    return demoEnglish;
  } };
  const f = await fixture(t, {}, source, async cues => {
    calls++;
    await gate;
    return { ...await demoTranslator(cues), usage: { input_tokens: 10, output_tokens: 5 } };
  });
  const beforeHash = await f.jobs.describe('series', 'tt1234567:2:9', { filename: 'web.mkv' }, english);
  const afterHash = await f.jobs.describe('series', 'tt1234567:2:9', { filename: 'web.mkv', videoHash: '0123456789abcdef' }, english);
  assert.notEqual(beforeHash.id, afterHash.id);
  try {
    await Promise.all([f.jobs.start(beforeHash), f.jobs.start(afterHash)]);
    await bothDownloaded;
    await new Promise(resolve => setImmediate(resolve));
  } finally { release(); }
  await Promise.all([f.jobs.wait(beforeHash, 5000), f.jobs.wait(afterHash, 5000)]);
  assert.equal(beforeHash.state, 'ready');
  assert.equal(afterHash.state, 'ready');
  assert.equal(calls, 3);
  assert.equal(beforeHash.completed, 6);
  assert.equal(afterHash.completed, 6);
  assert.equal(await f.jobs.result(beforeHash), await f.jobs.result(afterHash));
  assert.equal(beforeHash.usage.input_tokens + afterHash.usage.input_tokens, 30);
  assert.equal(beforeHash.usage.output_tokens + afterHash.usage.output_tokens, 15);
});

test('different source timings are translated separately even for the same episode', async t => {
  let calls = 0;
  const shifted = parseSubtitles(demoEnglish).map(cue => ({ ...cue, start: cue.start + 1000, end: cue.end + 1000 }));
  const source = { ...demoSource, download: async candidate => candidate.id === 'shifted' ? serializeSrt(shifted) : demoEnglish };
  const f = await fixture(t, {}, source, async cues => { calls++; return demoTranslator(cues); });
  const original = await f.jobs.describe('series', 'tt1234567:2:9', {}, english);
  const other = await f.jobs.describe('series', 'tt1234567:2:9', {}, { ...english, id: 'shifted' });
  await Promise.all([f.jobs.start(original), f.jobs.start(other)]);
  await Promise.all([f.jobs.wait(original, 5000), f.jobs.wait(other, 5000)]);
  assert.equal(original.state, 'ready');
  assert.equal(other.state, 'ready');
  assert.equal(calls, 6);
  assert.deepEqual(parseSubtitles(await f.jobs.result(original)).map(c => [c.start, c.end]), parseSubtitles(demoEnglish).map(c => [c.start, c.end]));
  assert.deepEqual(parseSubtitles(await f.jobs.result(other)).map(c => [c.start, c.end]), shifted.map(c => [c.start, c.end]));
});

test('a failed shared translation fails both requests and can be retried successfully', async t => {
  let release, downloaded, downloads = 0, fail = true, calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const bothDownloaded = new Promise(resolve => { downloaded = resolve; });
  const source = { ...demoSource, download: async () => {
    if (++downloads === 2) downloaded();
    return demoEnglish;
  } };
  const f = await fixture(t, { retryCooldownMs: 0 }, source, async cues => {
    calls++;
    await gate;
    if (fail) throw new AppError('MODEL_RATE_LIMIT', 'Limite simulato.');
    return demoTranslator(cues);
  });
  const a = await f.jobs.describe('series', 'tt1234567:2:9', {}, english);
  const b = await f.jobs.describe('series', 'tt1234567:2:9', { videoHash: '0123456789abcdef' }, english);
  try {
    await Promise.all([f.jobs.start(a), f.jobs.start(b)]);
    await bothDownloaded;
    await new Promise(resolve => setImmediate(resolve));
  } finally { release(); }
  await Promise.all([f.jobs.wait(a, 5000), f.jobs.wait(b, 5000)]);
  assert.equal(a.state, 'failed');
  assert.equal(b.state, 'failed');
  assert.equal(a.error.code, 'MODEL_RATE_LIMIT');
  assert.equal(b.error.code, 'MODEL_RATE_LIMIT');
  fail = false;
  const previousCalls = calls;
  await Promise.all([f.jobs.start(a), f.jobs.start(b)]);
  await Promise.all([f.jobs.wait(a, 5000), f.jobs.wait(b, 5000)]);
  assert.equal(a.state, 'ready');
  assert.equal(b.state, 'ready');
  assert.equal(calls - previousCalls, 3);
});

test('a completed file remains available after service restart without another translation', async t => {
  const f = await fixture(t);
  const job = await f.jobs.describe('movie', 'tt0000000', {}, english);
  await f.jobs.start(job);
  await f.jobs.wait(job, 5000);
  const reopened = new JobStore(f.config, demoSource, () => { throw new Error('must not call provider'); });
  await reopened.init();
  const cached = await reopened.get(job.id);
  await reopened.start(cached);
  assert.equal(cached.state, 'ready');
  assert.match(await reopened.result(cached), /konyhaablak/);
});

test('daily new-job limit persists across restarts', async t => {
  const f = await fixture(t, { maxDailyJobs: 1 });
  const a = await f.jobs.describe('movie', 'tt0000000', {}, english);
  await f.jobs.start(a);
  await f.jobs.wait(a, 5000);
  const changedSource = { ...demoSource, download: async () => demoEnglish.replace('keys?', 'wallet?') };
  let calls = 0;
  const reopened = new JobStore(f.config, changedSource, () => { calls++; throw new Error('Daily limit must block new model calls'); });
  await reopened.init();
  const b = await reopened.describe('movie', 'tt0000001', {}, english);
  await assert.rejects(reopened.start(b), error => error.code === 'DAILY_LIMIT');
  assert.equal(calls, 0);
});

test('daily limit still permits complete cached subtitles for new video metadata, but rejects partial cache', async t => {
  const f = await fixture(t, { model: 'gpt-6-luna', maxDailyJobs: 1, batchConcurrency: 1 });
  const original = await f.jobs.describe('movie', 'tt0000000', {}, english);
  await f.jobs.start(original); await f.jobs.wait(original, 5000);
  const usagePath = resolve(f.config.dataDir, 'daily-usage.json');
  const before = await readFile(usagePath, 'utf8');
  let calls = 0;
  const current = new JobStore({ ...f.config, reasoning: 'max', cacheReadyReasoning: 'low' }, demoSource,
    () => { calls++; throw new Error('Cache-only recovery must never call the provider'); });
  await current.init();
  const variant = await current.describe('movie', 'tt0000000', { videoHash: '0123456789abcdef' }, english);
  await current.start(variant);
  assert.equal(variant.state, 'ready');
  assert.equal(variant.completed, parseSubtitles(demoEnglish).length);
  assert.equal(await current.result(variant), await f.jobs.result(original));
  assert.equal(variant.translationReasoning, 'low');
  assert.deepEqual(variant.usage, { input_tokens: 0, output_tokens: 0 });
  await rm(resolve(f.config.dataDir, 'batches', `${original.sourceHash}-1.json`));
  const partial = await current.describe('movie', 'tt0000000', { videoHash: 'fedcba9876543210' }, english);
  await assert.rejects(current.start(partial), error => error.code === 'DAILY_LIMIT');
  await assert.rejects(current.result(partial), /ENOENT/);
  assert.equal(await readFile(usagePath, 'utf8'), before);
  assert.equal(calls, 0);
});

test('Stremio protocol: English discovery automatically returns a Hungarian file and correct headers', async t => {
  const f = await webFixture(t);
  const manifest = await (await fetch(`${f.base}/manifest.json`)).json();
  assert.deepEqual(manifest.resources, ['subtitles']);
  assert.match(manifest.name, /DEMO/);
  const response = await fetch(`${f.base}/subtitles/movie/tt0000000.json`);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  const listing = await response.json();
  assert.equal(listing.subtitles.length, 1);
  assert.equal(listing.subtitles[0].lang, 'hun');
  const file = await fetch(listing.subtitles[0].url);
  assert.equal(file.status, 200);
  assert.match(file.headers.get('content-type'), /application\/x-subrip.*utf-8/);
  assert.match(await file.text(), /Elhoztad a kulcsokat/);
});

test('an existing Hungarian subtitle avoids all translation work', async t => {
  const source = { ...demoSource, list: async () => [english, { id: 'hu', lang: 'hun', url: 'https://example.org/hu.srt' }] };
  const f = await webFixture(t, {}, source, () => { throw new Error('must not translate'); });
  const listing = await (await fetch(`${f.base}/subtitles/movie/tt0000000.json`)).json();
  assert.equal(listing.subtitles[0].url, 'https://example.org/hu.srt');
  assert.equal(f.jobs.jobs.size, 0);
});

test('AI mode translates English even when Hungarian exists and reuses the completed translation', async t => {
  let calls = 0;
  const source = { ...demoSource, list: async () => [
    { id: 'hu', lang: 'hun', url: 'https://example.org/hu.srt' }, english,
  ] };
  const f = await webFixture(t, { preferExisting: false, demo: false }, source,
    async cues => { calls++; return demoTranslator(cues); });
  const listing = await (await fetch(`${f.base}/subtitles/movie/tt0000000.json`)).json();
  assert.equal(listing.subtitles.length, 1);
  assert.equal(listing.subtitles[0].label, 'Hungarian · AI');
  assert.match(listing.subtitles[0].url, /\/subtitle\/[a-f0-9]{64}\.srt$/);
  const response = await fetch(listing.subtitles[0].url);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Elhoztad a kulcsokat/);
  const originalCalls = calls;
  assert.ok(originalCalls > 0);
  await fetch(`${f.base}/subtitles/movie/tt0000000.json`);
  await fetch(listing.subtitles[0].url);
  assert.equal(calls, originalCalls);
  assert.equal(f.jobs.jobs.size, 1);
  const page = await (await fetch(`${f.base}/install`)).text();
  assert.match(page, /even when the source already offers the target language/);
});

test('bad credentials, unknown videos and HEAD probes never initiate paid work', async t => {
  let lookups = 0;
  const source = { ...demoSource, list: async () => { lookups++; return [english]; } };
  const f = await webFixture(t, {}, source);
  assert.equal((await fetch(`${f.config.publicBase}/wrong/subtitles/movie/tt0000000.json`)).status, 404);
  assert.equal((await fetch(`${f.base}/subtitles/movie/nonsense.json`)).status, 400);
  assert.equal((await fetch(`${f.base}/subtitles/movie/tt0000000.json`, { method: 'HEAD' })).status, 200);
  assert.equal(lookups, 0);
});

test('slow translation returns a temporary error, never a cached placeholder or partial SRT', async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = await webFixture(t, { deliveryWaitMs: 5 }, demoSource, async cues => { await gate; return demoTranslator(cues); });
  const listing = await (await fetch(`${f.base}/subtitles/movie/tt0000000.json`)).json();
  try {
    const response = await fetch(listing.subtitles[0].url);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).error.code, 'TRANSLATION_PENDING');
  } finally { release(); }
  const [job] = f.jobs.jobs.values();
  await f.jobs.wait(job, 5000);
  assert.equal((await fetch(listing.subtitles[0].url)).status, 200);
});

test('model failures remain explicit and do not masquerade as complete translations', async t => {
  const f = await webFixture(t, {}, demoSource, async () => { throw new AppError('MODEL_RATE_LIMIT', 'Limite del provider.'); });
  const listing = await (await fetch(`${f.base}/subtitles/movie/tt0000000.json`)).json();
  const response = await fetch(listing.subtitles[0].url);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, 'MODEL_RATE_LIMIT');
  const [job] = f.jobs.jobs.values();
  await assert.rejects(f.jobs.result(job), /ENOENT/);
});


test('Mac migration reuses only complete legacy reasoning jobs without consuming new quota', async t => {
  const f = await fixture(t, { model: 'gpt-6-luna', batchConcurrency: 1 });
  const ready = await f.jobs.describe('movie', 'tt0000000', {}, english);
  await f.jobs.start(ready); await f.jobs.wait(ready, 5000);
  assert.equal(ready.state, 'ready');
  const pending = await f.jobs.describe('movie', 'tt0000001', {}, english);
  const before = await readFile(resolve(f.config.dataDir, 'daily-usage.json'), 'utf8');
  const current = new JobStore({ ...f.config, reasoning: 'max', cacheReadyReasoning: 'low' }, demoSource,
    () => { throw new Error('Complete legacy cache must not invoke the model'); });
  await current.init();
  const reused = await current.describe('movie', 'tt0000000', {}, english);
  assert.equal(reused.id, ready.id);
  await current.start(reused);
  assert.equal(await readFile(resolve(f.config.dataDir, 'daily-usage.json'), 'utf8'), before);
  assert.equal(await current.result(reused), await f.jobs.result(ready));
  const fresh = await current.describe('movie', 'tt0000001', {}, english);
  assert.notEqual(fresh.id, pending.id);
  await rm(resolve(f.config.dataDir, 'subtitles', `${ready.id}.srt`));
  const missing = await current.describe('movie', 'tt0000000', {}, english);
  assert.notEqual(missing.id, ready.id);
});

test('new video metadata reuses only a fully validated legacy content cache and records its actual reasoning', async t => {
  const f = await fixture(t, { model: 'gpt-6-luna', batchConcurrency: 1 });
  const original = await f.jobs.describe('movie', 'tt0000000', {}, english);
  await f.jobs.start(original); await f.jobs.wait(original, 5000);
  const current = new JobStore({ ...f.config, reasoning: 'max', cacheReadyReasoning: 'low' }, demoSource,
    () => { throw new Error('Complete identical source must not be translated again'); });
  await current.init();
  const variant = await current.describe('movie', 'tt0000000', { videoHash: '0123456789abcdef' }, english);
  assert.notEqual(variant.id, original.id);
  await current.start(variant); await current.wait(variant, 5000);
  assert.equal(variant.state, 'ready');
  assert.equal(await current.result(variant), await f.jobs.result(original));
  assert.deepEqual(variant.usage, { input_tokens: 0, output_tokens: 0 });
  assert.equal(variant.translationReasoning, 'low');
  assert.equal(variant.sourceHash, original.sourceHash);
  assert.equal(current.status(variant).reasoning, 'low');

  await rm(resolve(f.config.dataDir, 'batches', `${original.sourceHash}-1.json`));
  let calls = 0;
  const partial = new JobStore({ ...f.config, reasoning: 'max', cacheReadyReasoning: 'low' }, demoSource,
    async cues => { calls++; return demoTranslator(cues); });
  await partial.init();
  const fresh = await partial.describe('movie', 'tt0000000', { videoHash: 'fedcba9876543210' }, english);
  await partial.start(fresh); await partial.wait(fresh, 5000);
  assert.equal(fresh.state, 'ready');
  assert.equal(calls, Math.ceil(parseSubtitles(demoEnglish).length / f.config.batchSize));
  assert.equal(fresh.translationReasoning, 'max');
  assert.notEqual(fresh.sourceHash, original.sourceHash);
});
