import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP, BlockList } from 'node:net';
import { AppError } from './errors.js';

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 3]
]) blocked.addSubnet(address, prefix, 'ipv4');
const ipv6Global = new BlockList();
ipv6Global.addSubnet('2000::', 3, 'ipv6');
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16]]) {
  blocked.addSubnet(address, prefix, 'ipv6');
}

export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  if (family === 6) return ipv6Global.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
  return false;
}

// Resolve and pin every hop: untrusted subtitle URLs must not reach a local service.
export async function readPublicUrl(value, { maxBytes = 2_000_000, timeoutMs = 20_000, redirects = 3 } = {}) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
      || (url.port && !['80', '443'].includes(url.port))) {
    throw new AppError('SOURCE_URL_REJECTED', 'Subtitle source URL rejected.');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const records = await lookup(hostname, { all: true });
  if (!records.length || records.some(record => !isPublicAddress(record.address))) {
    throw new AppError('SOURCE_URL_REJECTED', 'Subtitle sources must use public Internet addresses.');
  }
  const address = records.find(record => record.family === 4) ?? records[0];
  const response = await new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.get(url, {
      agent: false,
      family: address.family,
      lookup: (_host, options, callback) => options?.all
        ? callback(null, [address]) : callback(null, address.address, address.family),
      headers: { 'User-Agent': 'StremioAISubtitles/0.3', 'Accept-Encoding': 'identity' },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve({ redirect: new URL(res.headers.location, url).href });
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new AppError('SOURCE_HTTP_ERROR', `The subtitle source returned HTTP ${res.statusCode}.`));
        return;
      }
      const chunks = [];
      let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > maxBytes) {
          res.destroy(new AppError('SOURCE_TOO_LARGE', 'The source response exceeds the size limit.'));
        } else chunks.push(chunk);
      });
      res.on('end', () => resolve({ body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    const timer = setTimeout(() => req.destroy(new AppError('SOURCE_TIMEOUT', 'The subtitle source timed out.')), timeoutMs);
    req.on('error', reject);
    req.on('close', () => clearTimeout(timer));
  });
  if (response.redirect) {
    if (!redirects) throw new AppError('SOURCE_REDIRECT_LIMIT', 'Too many source redirects.');
    return readPublicUrl(response.redirect, { maxBytes, timeoutMs, redirects: redirects - 1 });
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(response.body); }
  catch { throw new AppError('SOURCE_ENCODING', 'The source must contain UTF-8 text.'); }
}
