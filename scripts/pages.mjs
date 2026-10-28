import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadPagesConfig, settingNames } from './pages-config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [action, ...flags] = process.argv.slice(2);
const dryRun = flags.length === 1 && flags[0] === '--dry-run';
class CommandFailed extends Error {
  constructor(code) { super('Command failed.'); this.code = code; }
}
function run(command, args, environment, shell = false) {
  let result;
  try { result = spawnSync(command, args, { cwd: root, env: environment, stdio: 'inherit', shell }); }
  catch { throw new Error('Unable to start a required command. Check command arguments and environment settings.'); }
  if (result.error) throw new Error('Unable to start a required command. Check Node.js and npm installation.');
  if (result.status !== 0) throw new CommandFailed(result.status ?? 1);
}

try {
  if (!['setup', 'deploy'].includes(action) || (flags.length && !dryRun)) {
    throw new Error('Usage: node scripts/pages.mjs <setup|deploy> [--dry-run]');
  }
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node.js 24 or newer is required.');
  const wrangler = join(root, 'node_modules/wrangler/bin/wrangler.js');
  if (!existsSync(wrangler)) throw new Error('Install dependencies first: npm ci --allow-remote=root');
  const settings = loadPagesConfig(root);
  const projectName = settings.CLOUDFLARE_PROJECT_NAME;
  const buildEnvironment = Object.fromEntries(Object.entries(process.env)
    .filter(([name]) => !settingNames.includes(name.toUpperCase())));
  if (!dryRun) {
    const missing = settingNames.slice(0, 2).filter(name => !settings[name]);
    if (missing.length) throw new Error(`Missing required settings: ${missing.join(', ')}. Set them in .env or the terminal environment.`);
  }
  console.log(`Target: ${projectName} | production branch: main`);
  if (action === 'deploy') {
    // Loaded credentials belong only to the Wrangler child, never npm tests/builds.
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    // On Windows only trusted, fixed npm arguments are sent through cmd.exe.
    for (const args of [['test'], ['run', 'build']]) {
      if (process.platform === 'win32') run(`${npmCommand} ${args.join(' ')}`, [], buildEnvironment, true);
      else run(npmCommand, args, buildEnvironment);
    }
    if (!existsSync(join(root, 'dist/index.html'))) throw new Error('Build did not produce dist/index.html.');
  }
  const args = action === 'setup'
    ? ['pages', 'project', 'create', projectName, '--production-branch', 'main']
    : ['pages', 'deploy', 'dist', '--project-name', projectName, '--branch', 'main'];
  console.log(`Command: node node_modules/wrangler/bin/wrangler.js ${args.join(' ')}`);
  if (dryRun) console.log('Dry run completed. No Cloudflare request was made.');
  else {
    run(process.execPath, [wrangler, ...args], { ...buildEnvironment, ...settings, CI: 'true', WRANGLER_SEND_METRICS: 'false' });
    console.log(action === 'setup' ? 'Pages project created. No site assets were uploaded.' : 'Deployment completed. See the deployment URL returned by Wrangler above.');
  }
} catch (error) {
  if (!(error instanceof CommandFailed)) console.error(error.message);
  process.exitCode = error instanceof CommandFailed ? error.code : 1;
}
