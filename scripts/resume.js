import { loadConfig } from '../src/config.js';
import { resumeProvider } from '../src/provider.js';
try {
  if (!process.argv.includes('--confirm')) throw new Error('Check the provider quota first. Then run npm run resume -- --confirm and restart the addon.');
  await resumeProvider(await loadConfig());
  console.log('Pause marker cleared. Restart the addon to clear its in-memory pause.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
