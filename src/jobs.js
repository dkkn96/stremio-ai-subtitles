import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { AppError, publicError } from './errors.js';
import { parseSubtitles, serializeSrt, qualityWarnings, validateTranslations } from './subtitles.js';
import { translateCues, PROMPT_VERSION } from './translator.js';

export const cacheIdentity = config => ({
  provider: config.provider || 'codex', model: config.model,
  sourceLanguage: config.sourceLanguage || 'eng', targetLanguage: config.targetLanguage || 'hun',
  endpoint: config.apiBaseUrl || '', tier: config.codexServiceTier || '',
});

export const digest = value => createHash('sha256').update(value).digest('hex');

async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function atomicWrite(path, content) {
  const temporary = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, path);
}

export class JobStore {
  constructor(config, source, provider) {
    this.config = config;
    this.source = source;
    this.provider = provider;
    this.jobs = new Map();
    this.loading = new Map();
    this.translations = new Map();
    this.queue = [];
    this.active = 0;
    this.admission = Promise.resolve();
  }

  async init() {
    for (const sub of ['jobs', 'batches', 'subtitles']) await mkdir(join(this.config.dataDir, sub), { recursive: true });
  }

  async describe(type, id, extra, candidate) {
    const keyFor = reasoning => digest(JSON.stringify({
      version: PROMPT_VERSION, identity: cacheIdentity(this.config), source: this.config.sourceManifest, model: this.config.model,
      reasoning, batchSize: this.config.batchSize,
      type, id, videoHash: extra.videoHash || '', filename: extra.filename || '',
      videoSize: extra.videoSize || '', sourceId: candidate.id, url: candidate.url,
    }));
    const key = keyFor(this.config.reasoning);
    // Preserve complete translations imported from the previous deployment.
    // Never resume an unfinished job under a different reasoning setting.
    if (this.config.cacheReadyReasoning && this.config.cacheReadyReasoning !== this.config.reasoning) {
      const previous = await this.get(keyFor(this.config.cacheReadyReasoning));
      if (previous?.state === 'ready') {
        try {
          await this.result(previous);
          previous.translationReasoning ??= this.config.cacheReadyReasoning;
          return previous;
        }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
    }
    let job = await this.get(key);
    if (!job) {
      // Concurrent describe calls can finish the disk read together.
      job = this.jobs.get(key);
      if (!job) {
        job = { id: key, state: 'idle', candidate,
          video: { type, id, filename: extra.filename || '', videoHash: extra.videoHash || '', videoSize: extra.videoSize || '' },
          createdAt: new Date().toISOString(), completed: 0, total: 0 };
        this.jobs.set(key, job);
        await this.save(job);
      }
    }
    return job;
  }

  async get(id) {
    if (!/^[a-f0-9]{64}$/.test(id)) return null;
    if (this.jobs.has(id)) return this.jobs.get(id);
    if (this.loading.has(id)) return this.loading.get(id);
    const pending = (async () => {
      const saved = await readJson(join(this.config.dataDir, 'jobs', `${id}.json`));
      if (!saved) return null;
      if (['queued', 'processing'].includes(saved.state)) saved.state = 'idle';
      this.jobs.set(id, saved);
      return saved;
    })();
    this.loading.set(id, pending);
    try { return await pending; } finally { this.loading.delete(id); }
  }

  save(job) {
    // Only completed/error transitions are persisted, so no competing progress writes.
    const { promise, resolve, ...record } = job;
    return atomicWrite(join(this.config.dataDir, 'jobs', `${job.id}.json`), JSON.stringify(record));
  }

  async start(job) {
    // Serialize quota admission, including the persistent daily counter.
    const admission = this.admission.then(async () => {
      if (job.state === 'ready' || job.promise) return;
      if (job.state === 'failed' && Date.now() - job.failedAt < this.config.retryCooldownMs) return;
      if (this.queue.length + this.active >= this.config.maxQueued + this.config.maxActive) {
        throw new AppError('QUEUE_FULL', 'The translation queue is full. Try again later.', 503);
      }
      const path = join(this.config.dataDir, 'daily-usage.json');
      const today = new Date().toISOString().slice(0, 10);
      const old = await readJson(path);
      const usage = old?.date === today ? old : { date: today, jobs: 0 };
      if (usage.jobs >= this.config.maxDailyJobs) {
        // A new video hash can identify a translation already fully cached.
        // This path validates every batch and can never invoke the provider.
        if (await this.restoreCompleteCache(job)) return;
        throw new AppError('DAILY_LIMIT', 'Daily new-translation admission limit reached.', 429);
      }
      usage.jobs++;
      await atomicWrite(path, JSON.stringify(usage));
      job.state = 'queued';
      job.error = undefined;
      job.promise = new Promise(resolve => { job.resolve = resolve; });
      await this.save(job);
      this.queue.push(job);
      this.pump();
    });
    this.admission = admission.catch(() => {});
    await admission;
    return job;
  }

  pump() {
    while (this.active < this.config.maxActive && this.queue.length) {
      const job = this.queue.shift();
      this.active++;
      this.run(job).finally(() => { this.active--; this.pump(); });
    }
  }

  async run(job) {
    try {
      job.state = 'processing';
      const original = await this.source.download(job.candidate);
      const cues = parseSubtitles(original, this.config.maxCues);
      job.total = cues.length;
      const keyFor = reasoning => digest(JSON.stringify({
        identity: cacheIdentity(this.config), source: original, model: this.config.model, reasoning,
        prompt: PROMPT_VERSION, batchSize: this.config.batchSize,
      }));
      let contentKey = keyFor(this.config.reasoning);
      let result;
      if (this.config.cacheReadyReasoning && this.config.cacheReadyReasoning !== this.config.reasoning) {
        const legacyKey = keyFor(this.config.cacheReadyReasoning);
        result = await this.completeCachedTranslation(cues, legacyKey);
        if (result) {
          contentKey = legacyKey;
          job.translationReasoning = this.config.cacheReadyReasoning;
          job.translationReused = true;
        }
      }
      if (!result) {
        result = await this.translateShared(job, cues, contentKey);
        job.translationReasoning = this.config.reasoning;
      }
      await this.saveResult(job, result, contentKey);
    } catch (error) {
      job.state = 'failed';
      job.failedAt = Date.now();
      job.error = publicError(error);
      try { await this.save(job); } catch { /* Keep the in-memory failure observable. */ }
    } finally {
      job.resolve?.();
      job.promise = undefined;
      job.resolve = undefined;
    }
  }

  async restoreCompleteCache(job) {
    const original = await this.source.download(job.candidate);
    const cues = parseSubtitles(original, this.config.maxCues);
    const settings = new Set([this.config.reasoning, this.config.cacheReadyReasoning].filter(Boolean));
    for (const reasoning of settings) {
      const key = digest(JSON.stringify({
        identity: cacheIdentity(this.config), source: original, model: this.config.model, reasoning,
        prompt: PROMPT_VERSION, batchSize: this.config.batchSize,
      }));
      const result = await this.completeCachedTranslation(cues, key);
      if (!result) continue;
      job.translationReasoning = reasoning;
      job.translationReused = true;
      await this.saveResult(job, result, key);
      return true;
    }
    return false;
  }

  async saveResult(job, result, contentKey) {
    await atomicWrite(join(this.config.dataDir, 'subtitles', `${job.id}.srt`), serializeSrt(result.cues));
    job.total = result.cues.length;
    job.completed = result.cues.length;
    job.warnings = qualityWarnings(result.cues);
    job.usage = result.usage;
    job.sourceHash = contentKey;
    job.error = undefined;
    job.state = 'ready';
    job.finishedAt = new Date().toISOString();
    await this.save(job);
  }

  async completeCachedTranslation(cues, contentKey) {
    const translated = [];
    for (let offset = 0; offset < cues.length; offset += this.config.batchSize) {
      const index = offset / this.config.batchSize;
      try {
        const batch = await readJson(join(this.config.dataDir, 'batches', `${contentKey}-${index}.json`));
        if (!batch) return null;
        translated.push(...validateTranslations(cues.slice(offset, offset + this.config.batchSize), batch));
      } catch (error) {
        if (error instanceof SyntaxError || ['INCOMPLETE_TRANSLATION', 'INVALID_TRANSLATION'].includes(error.code)) return null;
        throw error;
      }
    }
    return { cues: translated, usage: { input_tokens: 0, output_tokens: 0 } };
  }

  async translateShared(job, cues, contentKey) {
    // Stremio can request subtitles before and after discovering the video hash.
    // Keep their job identities separate, but translate identical source bytes
    // and settings only once while both requests are in flight.
    let work = this.translations.get(contentKey);
    const reused = Boolean(work);
    if (!work) {
      work = { jobs: new Set(), completed: 0, total: cues.length };
      this.translations.set(contentKey, work);
      work.promise = translateCues(cues, this.provider, this.config, {
        getBatch: index => readJson(join(this.config.dataDir, 'batches', `${contentKey}-${index}.json`)),
        putBatch: (index, items) => atomicWrite(join(this.config.dataDir, 'batches', `${contentKey}-${index}.json`), JSON.stringify(items)),
        onProgress: (completed, total) => {
          work.completed = completed;
          work.total = total;
          for (const waiting of work.jobs) { waiting.completed = completed; waiting.total = total; }
        },
      }).finally(() => { this.translations.delete(contentKey); });
    }
    work.jobs.add(job);
    job.completed = work.completed;
    job.total = work.total;
    try {
      const result = await work.promise;
      // Only the initiating job accounts for this provider usage.
      job.translationReused = reused;
      return { cues: result.cues, usage: reused ? { input_tokens: 0, output_tokens: 0 } : result.usage };
    } finally { work.jobs.delete(job); }
  }

  async wait(job, milliseconds) {
    if (job.state === 'ready' || job.state === 'failed' || !job.promise) return;
    let timer;
    try { await Promise.race([job.promise, new Promise(resolve => { timer = setTimeout(resolve, milliseconds); })]); }
    finally { clearTimeout(timer); }
  }

  result(job) { return readFile(join(this.config.dataDir, 'subtitles', `${job.id}.srt`), 'utf8'); }

  status(job) {
    return {
      id: job.id, state: job.state, completed: job.completed, total: job.total,
      sourceKind: job.candidate.sourceKind || 'primary', sourceLabel: job.candidate.label || '',
      video: job.video,
      model: this.config.model, error: job.error, warnings: job.warnings,
      reasoning: job.translationReasoning,
      usage: job.usage, demo: this.config.demo,
    };
  }
}
