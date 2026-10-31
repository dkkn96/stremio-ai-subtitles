import { loadConfig } from '../src/config.js';
import { prepareTranslator } from '../src/provider.js';
import { parseSubtitles } from '../src/subtitles.js';
import { demoEnglish } from '../src/demo.js';
try {
  if (!process.argv.includes('--confirm')) throw new Error('This probe sends two invented subtitle lines to your chosen AI and uses its quota (API billing if selected). Run npm run probe -- --confirm to proceed.');
  const config = await loadConfig();
  const { translator } = await prepareTranslator(config);
  const started = Date.now();
  const result = await translator(parseSubtitles(demoEnglish).slice(0, 2), { before: [], after: [] });
  console.log(JSON.stringify({ provider: config.provider, model: config.model, target: config.targetLanguage, validCues: result.cues.length, elapsedSeconds: Math.round((Date.now() - started) / 1000), usage: result.usage }));
  for (const cue of result.cues) console.log(`${cue.id}. ${cue.text}`);
  console.log('Transport/format passed. Check translation quality, then test a real episode in Stremio.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
