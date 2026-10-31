import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { loadConfig } from '../src/config.js';
import { codexEnvironment } from '../src/codex.js';
import { cliEnvironment, prepareAccount } from '../src/cli-provider.js';
try {
  const flag = process.argv.indexOf('--provider');
  const selected = flag >= 0 ? process.argv[flag + 1] : '';
  const config = await loadConfig(selected ? { ...process.env, AI_PROVIDER: selected, AI_MODEL: 'login-only' } : process.env);
  if (config.provider.endsWith('-api')) throw new Error('API mode uses your local key. There is no subscription login. See docs/PROVIDERS.md.');
  await prepareAccount(config);
  await mkdir(config.codexHome, { recursive: true, mode: 0o700 });
  const args = process.argv.includes('--interactive') ? [] : { codex: ['-c', 'forced_login_method="chatgpt"', '-c', 'cli_auth_credentials_store="file"', 'login'], gemini: [], claude: ['auth', 'login'], grok: ['login'], opencode: ['auth', 'login'] }[config.provider];
  console.log('Complete the official client login personally. For Gemini, choose Google login and exit the client when connected. Credentials stay in data/accounts.');
  const env = config.provider === 'codex' ? codexEnvironment(config) : cliEnvironment(config);
  delete env.GROK_DEFAULT_MODEL; // Let the personal login/model picker use its own catalog.
  const child = spawn(config.provider === 'codex' ? config.codexBinary : config.cliBinary, args, { cwd: config.accountDir, env, stdio: 'inherit', shell: false });
  child.on('error', () => { console.error('Client not installed. See docs/PROVIDERS.md.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code || 0; });
} catch (error) { console.error(error.message); process.exitCode = 1; }
