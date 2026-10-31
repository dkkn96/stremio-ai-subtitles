import { loadConfig } from '../src/config.js';
try {
  const config = await loadConfig(process.env, process.argv.includes('--demo'));
  console.log('PRIVATE: anyone with this link can use your addon quota. Do not publish it.');
  console.log(`${config.publicBase}/${config.token}/install`);
  console.log(`${config.publicBase}/${config.token}/manifest.json`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
