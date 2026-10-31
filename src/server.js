import { languageInfo } from './languages.js';
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { chooseSource, existingTarget } from './source.js';
import { AppError, publicError } from './errors.js';
import { installPage } from './install-page.js';

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

function send(res, status, body, headers = {}, head = false) {
  if (res.destroyed) return;
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    ...commonHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(head ? undefined : text);
}

function authorized(given, expected) {
  const left = Buffer.from(given || '');
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function parseRequest(type, id, rawExtra, query) {
  if (!['movie', 'series'].includes(type)
      || !(type === 'series' ? /^tt\d{5,12}:\d{1,3}:\d{1,4}$/ : /^tt\d{5,12}$/).test(id)) {
    throw new AppError('INVALID_VIDEO', 'Invalid movie or episode identifier.', 400);
  }
  const params = new URLSearchParams(rawExtra || query);
  const extra = {};
  const hash = params.get('videoHash');
  const size = params.get('videoSize');
  const filename = params.get('filename');
  if (hash && /^[a-fA-F0-9]{16}$/.test(hash)) extra.videoHash = hash.toLowerCase();
  if (size && /^\d{1,16}$/.test(size)) extra.videoSize = size;
  if (filename) {
    if (filename.length > 500 || /[\u0000-\u001f]/.test(filename)) throw new AppError('INVALID_FILENAME', 'Invalid filename.', 400);
    extra.filename = filename;
  }
  return { type, id, extra };
}

export function makeServer(config, source, jobs) {
  const target = languageInfo(config.targetLanguage || 'hun');
  const sourceLang = languageInfo(config.sourceLanguage || 'eng');
  const listingCache = new Map();
  async function list(request) {
    const key = JSON.stringify(request);
    const existing = listingCache.get(key);
    if (existing && existing.expires > Date.now()) return existing.promise;
    const promise = source.list(request.type, request.id, request.extra);
    listingCache.set(key, { promise, expires: Date.now() + 60_000 });
    if (listingCache.size > 250) listingCache.delete(listingCache.keys().next().value);
    try { return await promise; }
    catch (error) { listingCache.delete(key); throw error; }
  }

  return createServer({ maxHeaderSize: 8192 }, async (req, res) => {
    const head = req.method === 'HEAD';
    try {
      if (req.url.length > 4096) return send(res, 414, { error: 'URL too long.' }, {}, head);
      if (req.method === 'OPTIONS') return send(res, 204, '', {}, true);
      if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: 'Method not allowed.' }, { Allow: 'GET, HEAD, OPTIONS' });
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health') return send(res, 200, { status: 'ok', demo: config.demo }, {}, head);
      if (url.pathname === '/') return send(res, 200, {
        name: 'Stremio AI Subtitles', version: '0.3.0', demo: config.demo,
        message: 'Use your private manifest. See README.md for setup.',
      }, {}, head);
      const parts = url.pathname.split('/').slice(1);
      if (!authorized(parts[0], config.token)) return send(res, 404, { error: 'Not found.' }, {}, head);
      if (parts.length === 2 && parts[1] === 'install') {
        const page = installPage(config);
        return send(res, 200, page.html, page.headers, head);
      }
      if (parts.length === 2 && parts[1] === 'manifest.json') {
        return send(res, 200, {
          id: `community.ai.subtitles.${config.instanceId || 'local'}.${target.code}${config.demo ? '.demo' : ''}`,
          version: '0.3.0', name: `AI Subtitles · ${target.name}${config.demo ? ' DEMO' : ''}`,
          description: config.demo
            ? 'Synthetic demo; no AI translation is performed.'
            : `${sourceLang.name} → ${target.name}. AI translations; first playback may require waiting.`,
          resources: ['subtitles'], types: ['movie', 'series'], catalogs: [], idPrefixes: ['tt'],
        }, { 'Cache-Control': 'private, max-age=3600' }, head);
      }
      if (parts[1] === 'subtitles' && [4, 5].includes(parts.length) && parts.at(-1).endsWith('.json')) {
        // A HEAD request must never trigger provider work or a billable translation.
        if (head) return send(res, 200, '', {}, true);
        const type = decodeURIComponent(parts[2]);
        const id = decodeURIComponent(parts.length === 4 ? parts[3].slice(0, -5) : parts[3]);
        const rawExtra = parts.length === 5 ? parts[4].slice(0, -5) : '';
        const request = parseRequest(type, id, rawExtra, url.search);
        const candidates = await list(request);
        if (config.preferExisting) {
          const available = existingTarget(candidates, target.code);
          if (available.length) return send(res, 200, {
            subtitles: available.map(candidate => ({
              id: `existing-${candidate.id}`, lang: target.code,
              label: candidate.label || target.name, url: candidate.url,
            })), cacheMaxAge: 0,
          });
        }
        const candidate = chooseSource(candidates, sourceLang.code);
        if (!candidate) return send(res, 200, { subtitles: [], cacheMaxAge: 0 });
        const job = await jobs.describe(type, id, request.extra, candidate);
        if (config.autoStart) await jobs.start(job);
        return send(res, 200, {
          subtitles: [{
            id: `${target.code}-${job.id}`, lang: target.code,
            label: `${target.name} · ${config.demo ? 'DEMO' : 'AI'}`,
            url: `${config.publicBase}/${config.token}/subtitle/${job.id}.srt`,
          }], cacheMaxAge: 0,
        });
      }
      if (parts.length === 3 && ['subtitle', 'status'].includes(parts[1])) {
        const extension = parts[1] === 'subtitle' ? '.srt' : '.json';
        if (!parts[2].endsWith(extension)) return send(res, 404, { error: 'Not found.' }, {}, head);
        const job = await jobs.get(parts[2].slice(0, -extension.length));
        if (!job) return send(res, 404, { error: 'Not found.' }, {}, head);
        if (parts[1] === 'status') return send(res, 200, jobs.status(job), {}, head);
        if (!head) {
          await jobs.start(job);
          await jobs.wait(job, config.deliveryWaitMs);
        }
        if (job.state === 'failed') return send(res, 502, { error: job.error }, { 'Retry-After': String(Math.ceil(config.retryCooldownMs / 1000)) }, head);
        if (job.state !== 'ready') return send(res, 503, {
          error: { code: 'TRANSLATION_PENDING', message: 'Translation pending. Reselect the subtitle when ready.' },
        }, { 'Retry-After': '10' }, head);
        return send(res, 200, head ? '' : await jobs.result(job), {
          'Content-Type': 'application/x-subrip; charset=utf-8',
          'Cache-Control': 'private, max-age=86400',
        }, head);
      }
      return send(res, 404, { error: 'Not found.' }, {}, head);
    } catch (error) {
      if (error instanceof URIError) return send(res, 400, { error: 'Invalid URL.' }, {}, head);
      return send(res, error instanceof AppError ? error.status : 500, { error: publicError(error) }, {}, head);
    }
  });
}
