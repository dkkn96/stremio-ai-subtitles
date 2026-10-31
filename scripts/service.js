import { mkdir, writeFile, rm, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runProcess, minimalEnvironment } from '../src/process.js';

export const xml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
export function launchAgent({ label, args, cwd, path, log }) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>
<key>Label</key><string>${xml(label)}</string>
<key>ProgramArguments</key><array>${args.map(arg => `<string>${xml(arg)}</string>`).join('')}</array>
<key>WorkingDirectory</key><string>${xml(cwd)}</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(path)}</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>15</integer>
<key>Umask</key><integer>63</integer>
<key>StandardOutPath</key><string>${xml(log + '.out.log')}</string>
<key>StandardErrorPath</key><string>${xml(log + '.err.log')}</string>
</dict></plist>\n`;
}
export async function service(action, { tunnelConfig = '', cloudflared = '', root = resolve(import.meta.dirname, '..') } = {}) {
  if (process.platform !== 'darwin') throw new Error('Automatic service installation is currently macOS-only. See docs/HOSTING.md.');
  const tunnel = Boolean(tunnelConfig);
  const label = `community.stremio-ai-subtitles.${tunnel ? 'tunnel' : 'app'}`;
  const runtime = join(root, 'runtime'); await mkdir(runtime, { recursive: true, mode: 0o700 });
  const destination = join(homedir(), 'Library/LaunchAgents', `${label}.plist`);
  const target = `gui/${process.getuid()}/${label}`;
  if (action === 'remove') {
    await runProcess('/bin/launchctl', ['bootout', target], { timeoutMs: 10000 });
    await rm(destination, { force: true }); console.log('Service removed. Configuration and translations preserved.'); return;
  }
  if (action === 'status') {
    const result = await runProcess('/bin/launchctl', ['print', target], { timeoutMs: 10000 });
    console.log(result.code === 0 ? 'Service registered; use doctor to verify health.' : 'Service not registered.'); return;
  }
  if (!['generate', 'install'].includes(action)) throw new Error('Use generate, install, status or remove.');
  if (tunnel && (!cloudflared || !cloudflared.startsWith('/'))) throw new Error('Provide --cloudflared with its absolute path (command -v cloudflared).');
  const args = tunnel ? [cloudflared, 'tunnel', '--no-autoupdate', '--config', resolve(tunnelConfig), 'run'] : ['/usr/bin/caffeinate', '-is', process.execPath, '--env-file-if-exists=.env', 'src/main.js'];
  const plist = launchAgent({ label, args, cwd: root, path: process.env.PATH || '/usr/bin:/bin', log: join(runtime, tunnel ? 'tunnel' : 'app') });
  const generated = join(runtime, `${label}.plist`); await writeFile(generated, plist, { mode: 0o600 });
  if (action === 'generate') { console.log('Prepared runtime service file. No service installed.'); return; }
  await access(tunnel ? resolve(tunnelConfig) : join(root, '.env'));
  await mkdir(join(homedir(), 'Library/LaunchAgents'), { recursive: true });
  try { await access(destination); throw new Error('Service already exists. Remove it explicitly before installing a replacement.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(destination, plist, { mode: 0o600, flag: 'wx' });
  const result = await runProcess('/bin/launchctl', ['bootstrap', `gui/${process.getuid()}`, destination], { env: minimalEnvironment(), timeoutMs: 15000 });
  if (result.code !== 0) { await rm(destination, { force: true }); throw new Error('macOS could not load the service. Check Background Items permission and your login session.'); }
  console.log('Service installed: starts after login and restarts after failure. Check npm run doctor.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const option = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : '';
  try { await service(process.argv[2] || 'generate', { tunnelConfig: option('--tunnel-config'), cloudflared: option('--cloudflared') }); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
