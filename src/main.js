import { loadConfig } from './config.js';
import { createSource } from './source.js';
import { prepareTranslator } from './provider.js';
import { demoSource } from './demo.js';
import { JobStore } from './jobs.js';
import { makeServer } from './server.js';
import lockfile from 'proper-lockfile';

try {
  const config = await loadConfig(process.env, process.argv.includes('--demo'));
  const release = await lockfile.lock(config.dataDir, { realpath: false, stale: 30000, retries: 0 });
  const source = config.demo ? demoSource : createSource(config.sourceManifest, undefined, {
    fallbackManifest: config.fallbackSourceManifest, timeoutMs: config.sourceTimeoutMs,
    sourceLanguage: config.sourceLanguage, targetLanguage: config.targetLanguage, preferExisting: config.preferExisting,
  });
  // Already prepared subtitles remain usable even if the AI login expires.
  let prepared;
  const translator = async (...args) => {
    prepared ||= prepareTranslator(config).catch(error => { prepared = undefined; throw error; });
    return (await prepared).translator(...args);
  };
  const jobs = new JobStore(config, source, translator);
  await jobs.init();
  const server = makeServer(config, source, jobs);
  let stopping = false;
  const stop = () => {
    if (stopping) return; stopping = true;
    server.close(async () => { await release(); process.exit(0); });
    // On forced shutdown the lease becomes stale; unfinished jobs resume on demand.
    setTimeout(() => process.exit(0), 5000).unref();
  };
  server.on('error', async error => {
    console.error(`Server could not start (${error.code || 'unknown'}). Check the port with npm run doctor.`);
    await release(); process.exitCode = 1;
  });
  server.listen(config.port, config.host, () => {
    console.log(`Stremio AI Subtitles 0.3.0${config.demo ? ' · SYNTHETIC DEMO (no AI)' : ''}`);
    console.log(`${config.sourceLanguageName} → ${config.targetLanguageName} · ${config.provider} · ${config.model}`);
    console.log(`Health: http://127.0.0.1:${config.port}/health`);
    console.log('Run npm run link in another terminal for your private installation link.');
  });
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
} catch (error) {
  console.error(error.code === 'ELOCKED' ? 'Another server already owns this data directory.' : error.message);
  process.exitCode = 1;
}
