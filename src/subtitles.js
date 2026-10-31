import { AppError } from './errors.js';

const stamp = '(?:\\d{1,3}:)?\\d{2}:\\d{2}[,.]\\d{3}';
const timingPattern = new RegExp(`^(${stamp})\\s+-->\\s+(${stamp})(?:\\s+.*)?$`);

function milliseconds(value) {
  const parts = value.replace(',', '.').split(':');
  if (parts.length === 2) parts.unshift('0');
  const [hours, minutes, rest] = parts;
  const [seconds, ms] = rest.split('.');
  if (+minutes > 59 || +seconds > 59) throw new AppError('INVALID_SUBTITLE', 'Invalid subtitle timestamp.');
  return ((+hours * 60 + +minutes) * 60 + +seconds) * 1000 + +ms;
}

function formatTime(value) {
  const ms = value % 1000;
  const seconds = Math.floor(value / 1000) % 60;
  const minutes = Math.floor(value / 60000) % 60;
  const hours = Math.floor(value / 3600000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

// Normalize styling without allowing provider text to create new SRT cues.
export function plainText(value) {
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim();
}

export function parseSubtitles(input, maxCues = 4000) {
  let text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  const vtt = /^WEBVTT(?:\s|$)/.test(text);
  if (vtt) text = text.replace(/^WEBVTT[^\n]*(?:\n(?!\n)[^\n]*)*\n?/, '').trim();
  const blocks = text.split(/\n[ \t]*\n+/);
  const cues = [];
  for (const block of blocks) {
    if (vtt && /^(NOTE(?:\s|$)|STYLE(?:\s|$)|REGION(?:\s|$))/.test(block)) continue;
    const lines = block.split('\n');
    let timeIndex = 0;
    if (!timingPattern.test(lines[0]?.trim())) timeIndex = 1;
    const match = lines[timeIndex]?.trim().match(timingPattern);
    if (!match) throw new AppError('UNSUPPORTED_SUBTITLE', 'The source must supply valid text SRT or WebVTT. ASS, images and archives are not supported.');
    const start = milliseconds(match[1]);
    const end = milliseconds(match[2]);
    const body = plainText(lines.slice(timeIndex + 1).join('\n'));
    if (end <= start || !body || body.length > 3000) {
      throw new AppError('INVALID_SUBTITLE', 'Subtitle is empty, too long or has invalid timing.');
    }
    cues.push({ id: cues.length + 1, start, end, text: body });
    if (cues.length > maxCues) throw new AppError('SUBTITLE_TOO_LARGE', 'Subtitle exceeds the configured cue limit.');
  }
  if (!cues.length) throw new AppError('EMPTY_SUBTITLE', 'The source contains no subtitle cues.');
  return cues;
}

export function readableText(value, width = 42) {
  // Preserve separate speakers; other line breaks may be reflowed for readability.
  const paragraphs = plainText(value).split(/\n(?=\s*[-–—]\s)/);
  return paragraphs.map(paragraph => wrapLine(paragraph, width)).join('\n');
}

function wrapLine(value, width) {
  const words = value.replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && (line + ' ' + word).length > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

export function validateTranslations(cues, items) {
  if (!Array.isArray(items) || items.length !== cues.length) {
    throw new AppError('INCOMPLETE_TRANSLATION', 'The model returned the wrong number of cues.');
  }
  const byId = new Map();
  const expected = new Set(cues.map(cue => cue.id));
  for (const item of items) {
    if (!Number.isInteger(item?.id) || !expected.has(item.id) || byId.has(item.id)
      || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 4000
      || item.text.includes('-->')) {
      throw new AppError('INVALID_TRANSLATION', 'The model returned missing, duplicate or invalid cues.');
    }
    const normalized = readableText(item.text);
    if (!normalized) throw new AppError('INVALID_TRANSLATION', 'The model returned an empty cue.');
    byId.set(item.id, normalized);
  }
  return cues.map(cue => ({ ...cue, text: byId.get(cue.id) }));
}

export function serializeSrt(cues) {
  return cues.map((cue, index) => `${index + 1}\n${formatTime(cue.start)} --> ${formatTime(cue.end)}\n${cue.text}\n`).join('\n') + '\n';
}

export function qualityWarnings(cues) {
  return cues.filter(cue => cue.text.split('\n').length > 2
    || cue.text.replace(/\s/g, '').length / ((cue.end - cue.start) / 1000) > 20)
    .map(cue => ({ cue: cue.id, reason: 'Controllare lunghezza e velocita di lettura.' }));
}
