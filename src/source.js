import { readPublicUrl } from './http-client.js';
import { matchesLanguage } from './languages.js';
import { AppError } from './errors.js';

export function sourceRequestUrl(manifest, type, id, extra = {}) {
  const base = manifest.replace(/\/manifest\.json\/?$/, '').replace(/\/$/, '');
  const allowed = new URLSearchParams();
  for (const key of ['videoHash', 'videoSize', 'filename']) {
    if (extra[key]) allowed.set(key, String(extra[key]));
  }
  const suffix = allowed.size ? `/${allowed.toString()}` : '';
  return `${base}/subtitles/${encodeURIComponent(type)}/${encodeURIComponent(id)}${suffix}.json`;
}

function language(candidate) { return String(candidate.lang ?? '').toLowerCase(); }
function usable(candidate) {
  if (!candidate || typeof candidate.url !== 'string' || typeof candidate.id !== 'string') return false;
  // Subtitle Sync exposes diagnostic notices as playable SRTs. They are not dialogue.
  if (/^notice(?:-|$)/i.test(candidate.id) || /^ℹ\uFE0F?\s/.test(candidate.label || '')) return false;
  try {
    const url = new URL(candidate.url);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

export function chooseSource(subtitles, sourceLanguage = 'eng') {
  // Keep the source addon's ranking, which can use the exact video hash.
  // Do not invent a synchronization confidence from a filename alone.
  const english = subtitles.filter(item => usable(item) && matchesLanguage(language(item), sourceLanguage));
  return english.find(item => !/\b(forced|signs[ ._-]*only|songs[ ._-]*only)\b/i.test(item.label ?? ''));
}

export function existingTarget(subtitles, targetLanguage = 'hun') {
  return subtitles.filter(item => usable(item) && matchesLanguage(language(item), targetLanguage));
}

export function createSource(manifest, read = readPublicUrl, { fallbackManifest = '', timeoutMs = 20_000, sourceLanguage = 'eng', targetLanguage = 'hun', preferExisting = false } = {}) {
  const options = { maxBytes: 2_000_000, timeoutMs };
  async function lookup(origin, type, id, extra) {
      const text = await read(sourceRequestUrl(origin, type, id, extra), options);
      let data;
      try { data = JSON.parse(text); }
      catch { throw new AppError('SOURCE_INVALID_RESPONSE', 'The source returned an invalid listing.'); }
      if (!Array.isArray(data.subtitles)) throw new AppError('SOURCE_INVALID_RESPONSE', 'The source returned invalid subtitles.');
      return data.subtitles.slice(0, 2000);
  }
  return {
    async list(type, id, extra) {
      let primary;
      try { primary = await lookup(manifest, type, id, extra); }
      catch (error) { if (!fallbackManifest) throw error; }
      if (!fallbackManifest) return primary;
      if (primary && (chooseSource(primary, sourceLanguage) || (preferExisting && existingTarget(primary, targetLanguage).length))) {
        return primary.map(candidate => ({ ...candidate, sourceKind: 'primary' }));
      }
      const fallback = await lookup(fallbackManifest, type, id, extra);
      return fallback.map(candidate => ({ ...candidate, sourceKind: 'fallback' }));
    },
    download(candidate) { return read(candidate.url, options); },
  };
}
