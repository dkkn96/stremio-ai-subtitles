import { languageInfo } from './languages.js';
import { randomBytes } from 'node:crypto';

const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function installPage(config) {
  const target = languageInfo(config.targetLanguage || 'hun');
  const manifest = `${config.publicBase}/${config.token}/manifest.json`;
  const install = manifest.replace(/^https?:/, 'stremio:');
  const nonce = randomBytes(18).toString('base64');
  const availabilityNote = 'The host computer must stay powered on, awake and online. A permanent HTTPS hostname keeps the same installation link. Temporary tunnel addresses must be reinstalled when they change.';
  const accountNote = 'Install this addon in the Stremio account used on your playback devices.';
  const translationNote = config.preferExisting
    ? `An existing ${target.name} track is preferred. Otherwise the addon translates the configured source language.`
    : 'AI translations are requested even when the source already offers the target language. Completed translations are cached.';
  return {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
    },
    html: `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Subtitles · Connect Stremio</title>
<style>body{background:#f6f7f9;color:#17232a;font:17px/1.55 system-ui;margin:0;padding:6vh 22px}main{max-width:660px;margin:auto;background:white;border:1px solid #e2e7eb;border-radius:20px;padding:clamp(22px,5vw,44px)}.tag{color:#16704f;font-size:14px;font-weight:650}h1{font-size:34px;line-height:1.1;margin:12px 0 24px}h2{font-size:20px;margin-top:30px}p{color:#42515c}.button,button{display:inline-block;background:#146d50;color:white;border:0;border-radius:10px;padding:13px 18px;font:600 16px system-ui;text-decoration:none;cursor:pointer}button{background:#eaf3ee;color:#146d50;margin-top:10px}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #cfd9de;border-radius:8px;font:14px monospace}li{margin:12px 0}small{color:#596973}.note{border-left:3px solid #e1ad4b;padding-left:16px}</style>
<main><span class="tag">STREMIO AI SUBTITLES · PRIVATE ADDON</span><h1>${target.name} subtitles<br>in your Stremio.</h1>
<p>${accountNote}</p>
<a class="button" href="${escapeHtml(install)}">Open in Stremio</a>
<h2>If the button does not open the app</h2><ol><li>Copy the link below.</li><li>In Stremio, open Add-ons and paste it into the field for installing an addon from a URL.</li><li>Confirm the installation of <strong>AI Subtitles</strong>.</li></ol>
<label for="manifest">Private manifest link</label><input id="manifest" readonly value="${escapeHtml(manifest)}"><button id="copy" type="button">Copy link</button><p id="feedback" role="status"></p>
<h2>First test</h2><p>Open an episode and look for <strong>${target.name}</strong> in the subtitle languages, then select the track from <strong>AI Subtitles</strong>. ${translationNote}</p>
<p>The first translation takes time. If the player does not retry automatically, select the track again later. Check quality and synchronization against the video you selected.</p>
<p class="note">${availabilityNote}</p>
<small>Anyone with this link can use your addon quota. Keep it private.</small></main>
<script nonce="${nonce}">document.getElementById('copy').onclick=async()=>{const input=document.getElementById('manifest');try{await navigator.clipboard.writeText(input.value);document.getElementById('feedback').textContent='Link copied.';}catch{input.select();document.getElementById('feedback').textContent='Select and copy the link from the field.';}};</script></html>`,
  };
}
