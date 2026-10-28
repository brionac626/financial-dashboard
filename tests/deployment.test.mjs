import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const { loadPagesConfig, settingNames } = await import(pathToFileURL(join(repo, 'scripts/pages-config.mjs')).href);
const isWindows = process.platform === 'win32';
const hash = value => value ? createHash('sha256').update(value).digest('hex') : null;
const linuxPath = path => path.replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`).replaceAll('\\', '/');
const available = command => spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 10000 }).status === 0;
const runtimeRoot = join(repo, 'tests/.generated/linux-node');
const runtimeDir = existsSync(runtimeRoot) ? readdirSync(runtimeRoot).find(name => /^node-v24\..*-linux-x64$/.test(name)) : undefined;
const linuxNode = process.env.PAGES_TEST_LINUX_NODE || (runtimeDir ? linuxPath(join(runtimeRoot, runtimeDir, 'bin/node')) : 'node');
const runners = [];
if (available('pwsh')) runners.push({ name: 'PowerShell', kind: 'ps' });
if (!isWindows && available('bash')) runners.push({ name: 'Linux Bash', kind: 'bash' });
if (isWindows) {
  const wsl = spawnSync('wsl.exe', ['-d', 'Ubuntu-20.04', '--exec', linuxNode, '--version'], { timeout: 15000 });
  if (wsl.status === 0) runners.push({ name: 'WSL Linux Bash', kind: 'wsl' });
  else if (existsSync('C:/Program Files/Git/bin/bash.exe')) runners.push({ name: 'Git Bash', kind: 'gitbash' });
}
assert.ok(runners.length, 'No supported shell found for deployment verification.');
if (isWindows && !runners.some(runner => runner.kind === 'wsl')) console.warn('Linux Node 24 unavailable; using available Windows/Git Bash shells. Set PAGES_TEST_LINUX_NODE to a Linux node executable to test WSL.');

test('workflow permits only main push/manual deployment and rejects every PR', () => {
  const workflow = readFileSync(join(repo, '.github/workflows/deploy.yml'), 'utf8');
  const expression = workflow.match(/^\s+if: (.+)$/m)?.[1];
  assert.ok(expression);
  const permitted = new Function('github', `return (${expression});`);
  for (const [event, ref, expected] of [
    ['push', 'refs/heads/main', true], ['workflow_dispatch', 'refs/heads/main', true],
    ['push', 'refs/heads/feature', false], ['workflow_dispatch', 'refs/heads/feature', false],
    ['pull_request', 'refs/pull/1/merge', false], ['pull_request', 'refs/heads/main', false], ['push', 'refs/tags/main', false],
  ]) assert.equal(permitted({ event_name: event, ref }), expected);
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.ok(!/["']\.env["']|pages\.mjs/.test(workflow), 'CI must continue using Secrets, not a local .env loader.');
});

const baseToken = 'fake-token-must-not-be-printed';
const fileToken = 'fake-file-token-never-printed';
const dotenv = `# Synthetic credentials only\nCLOUDFLARE_API_TOKEN='${fileToken}'\nCLOUDFLARE_ACCOUNT_ID="file-account"\nCLOUDFLARE_PROJECT_NAME=file-finance # comment\n`;
const specialToken = 'quoted # token $HOME $(touch PAGES_ENV_EXECUTED) `touch PAGES_ENV_EXECUTED` & echo unsafe %COMSPEC%';
const cases = [
  { name: 'dry run needs no file or credentials, never calls Wrangler', dry: true, credentials: false, expected: 0, log: ['npm test', 'npm run build'] },
  { name: 'production deploy uses external project and main', project: 'custom-finance', expected: 0, log: ['npm test', 'npm run build', 'pages deploy dist --project-name custom-finance --branch main'] },
  { name: 'missing credentials stops before commands', credentials: false, expected: 1, log: [] },
  { name: 'test failure stops build and upload', testExit: 17, expected: 17, log: ['npm test'] },
  { name: 'build failure stops upload', buildExit: 23, expected: 23, log: ['npm test', 'npm run build'] },
  { name: 'upload failure preserves exit code', wranglerExit: 31, expected: 31, log: ['npm test', 'npm run build', 'pages deploy dist'] },
  { name: 'missing build output stops upload', noDist: true, expected: 1, log: ['npm test', 'npm run build'] },
  { name: 'invalid project name stops commands', project: 'invalid project', expected: 1, log: [] },
  { name: 'local preview only builds and starts localhost', local: true, credentials: false, expected: 0, log: ['npm run build', 'pages dev dist --ip 127.0.0.1 --port 8790'] },
  { name: 'local build failure preserves exit code', local: true, buildExit: 29, expected: 29, log: ['npm run build'] },
  { name: 'setup dry run does not build or require credentials', setup: true, dry: true, credentials: false, expected: 0, log: [] },
  { name: 'setup loads .env and creates main without build or deploy', setup: true, credentials: false, dotenv, expected: 0, token: fileToken, account: 'file-account', log: ['pages project create file-finance --production-branch main'] },
  { name: 'setup failure or existing project is not success', setup: true, wranglerExit: 39, expected: 39, wranglerError: 'Project already exists.', log: ['pages project create financial-dashboard --production-branch main'] },
  { name: 'setup missing account reports only missing setting names', setup: true, credentials: false, dotenv: `CLOUDFLARE_API_TOKEN=${fileToken}\n`, expected: 1, missing: 'CLOUDFLARE_ACCOUNT_ID', log: [] },
  { name: 'deployment reads the same .env settings as setup', credentials: false, dotenv, expected: 0, token: fileToken, account: 'file-account', log: ['npm test', 'npm run build', 'pages deploy dist --project-name file-finance --branch main'] },
  { name: 'external nonempty values override .env', dotenv, project: 'external-finance', expected: 0, log: ['npm test', 'npm run build', 'pages deploy dist --project-name external-finance --branch main'] },
  { name: 'whitespace external values fall back to .env', setup: true, dotenv, credentials: false, externalWhitespace: true, expected: 0, token: fileToken, account: 'file-account', log: ['pages project create file-finance --production-branch main'] },
  { name: 'blank .env project falls back to wrangler config', setup: true, dotenv: 'CLOUDFLARE_PROJECT_NAME=" "\n', expected: 0, log: ['pages project create financial-dashboard --production-branch main'] },
  { name: 'special values stay literal and unrelated keys are not forwarded', setup: true, credentials: false, dotenv: `CLOUDFLARE_API_TOKEN='${specialToken}'\nCLOUDFLARE_ACCOUNT_ID="account with spaces"\nNODE_OPTIONS=--require=do-not-execute\nPAGES_ENV_INJECTION_TEST=$(touch PAGES_ENV_EXECUTED)\n`, token: specialToken, account: 'account with spaces', expected: 0, log: ['pages project create financial-dashboard --production-branch main'] },
  { name: 'missing installed Wrangler gives install guidance', setup: true, noWrangler: true, expected: 1, log: [] },
];

// Real Node runs the shared loader/runner. Only npm and the Wrangler entry are replaced.
const recorder = `const fs = require('node:fs');
const crypto = require('node:crypto');
const raw = process.argv.slice(2);
const kind = raw[0] === 'npm' ? 'npm' : 'wrangler';
const args = kind === 'npm' ? raw.slice(1) : raw;
const digest = value => value ? crypto.createHash('sha256').update(value).digest('hex') : null;
fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify({kind,args,tokenHash:digest(process.env.CLOUDFLARE_API_TOKEN),accountHash:digest(process.env.CLOUDFLARE_ACCOUNT_ID),project:process.env.CLOUDFLARE_PROJECT_NAME || '',ci:process.env.CI,unexpected:process.env.PAGES_ENV_INJECTION_TEST || null}) + '\\n');
if(kind === 'npm') process.exit(Number(args[0] === 'test' ? process.env.MOCK_TEST_EXIT : process.env.MOCK_BUILD_EXIT));
if(process.env.MOCK_WRANGLER_ERROR) console.error(process.env.MOCK_WRANGLER_ERROR);
process.exit(Number(process.env.MOCK_WRANGLER_EXIT));
`;

for (const runner of runners) for (const scenario of cases) test(`${runner.name}: ${scenario.name}`, () => {
  const temporary = mkdtempSync(join(tmpdir(), 'finance deployment test '));
  const project = join(temporary, 'project with spaces');
  const bin = join(temporary, 'mock bin');
  const logPath = join(temporary, 'commands.log');
  const isWsl = runner.kind === 'wsl';
  try {
    mkdirSync(join(project, 'scripts'), { recursive: true });
    mkdirSync(bin);
    copyFileSync(join(repo, 'wrangler.jsonc'), join(project, 'wrangler.jsonc'));
    for (const file of ['pages.mjs', 'pages-config.mjs', 'setup-pages.ps1', 'setup-pages.sh', 'deploy-remote.ps1', 'deploy-remote.sh', 'deploy-local.ps1', 'deploy-local.sh']) copyFileSync(join(repo, 'scripts', file), join(project, 'scripts', file));
    if (!scenario.noWrangler) { mkdirSync(join(project, 'node_modules/wrangler/bin'), { recursive: true }); writeFileSync(join(project, 'node_modules/wrangler/bin/wrangler.js'), recorder); }
    if (!scenario.noDist) { mkdirSync(join(project, 'dist')); writeFileSync(join(project, 'dist/index.html'), 'synthetic build'); }
    if (scenario.dotenv) writeFileSync(join(project, '.env'), scenario.dotenv);
    const recorderPath = join(temporary, 'record.cjs'); writeFileSync(recorderPath, recorder);
    writeFileSync(join(bin, 'npm'), '#!/usr/bin/env bash\nexec "$MOCK_NODE" "$MOCK_RECORDER" npm "$@"\n', { mode: 0o755 });
    writeFileSync(join(bin, 'npm.cmd'), '@echo off\r\n"%MOCK_NODE%" "%MOCK_RECORDER%" npm %*\r\nexit /b %errorlevel%\r\n');
    const mockEnv = {
      MOCK_LOG: isWsl ? linuxPath(logPath) : logPath,
      MOCK_NODE: isWsl ? linuxNode : process.execPath,
      MOCK_RECORDER: isWsl ? linuxPath(recorderPath) : recorderPath,
      MOCK_TEST_EXIT: String(scenario.testExit ?? 0), MOCK_BUILD_EXIT: String(scenario.buildExit ?? 0), MOCK_WRANGLER_EXIT: String(scenario.wranglerExit ?? 0), MOCK_WRANGLER_ERROR: scenario.wranglerError ?? '',
      CLOUDFLARE_PROJECT_NAME: scenario.externalWhitespace ? '  ' : scenario.project ?? '',
      CLOUDFLARE_API_TOKEN: scenario.externalWhitespace ? ' ' : scenario.credentials === false ? '' : baseToken,
      CLOUDFLARE_ACCOUNT_ID: scenario.externalWhitespace ? ' ' : scenario.credentials === false ? '' : 'fake-account',
      PAGES_ENV_INJECTION_TEST: '',
    };
    let command; let args;
    const name = scenario.setup ? 'setup-pages' : scenario.local ? 'deploy-local' : 'deploy-remote';
    if (runner.kind === 'ps') {
      command = 'pwsh'; args = ['-NoLogo', '-NoProfile', '-File', join(project, 'scripts', `${name}.ps1`), ...(scenario.local ? ['-Port', '8790'] : scenario.dry ? ['-DryRun'] : [])];
    } else {
      const flags = scenario.local ? ['--port', '8790'] : scenario.dry ? ['--dry-run'] : [];
      const script = join(project, 'scripts', `${name}.sh`);
      if (isWsl) {
        command = 'wsl.exe'; args = ['-d', 'Ubuntu-20.04', '--exec', 'env', `PATH=${linuxPath(bin)}:${dirname(linuxNode)}:/usr/local/bin:/usr/bin:/bin`, ...Object.entries(mockEnv).map(([key, value]) => `${key}=${value}`), 'bash', '-c', 'cd -- "$1"; shift; exec bash "$@"', 'deployment-test', linuxPath(temporary), linuxPath(script), ...flags];
      } else { command = runner.kind === 'gitbash' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash'; args = [script, ...flags]; }
    }
    const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path'));
    // WSL's Windows launcher can retain its cwd handle after the Linux child exits.
    const result = spawnSync(command, args, { cwd: isWsl ? tmpdir() : temporary, env: { ...inherited, ...mockEnv, PATH: `${bin}${isWindows ? ';' : ':'}${process.env.PATH}` }, encoding: 'utf8', timeout: 30000 });
    assert.ifError(result.error);
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, scenario.expected, output);
    const rawLog = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
    for (const token of [baseToken, fileToken, specialToken]) assert.ok(!(output + rawLog).includes(token), 'Token leaked into output or command log.');
    const commands = rawLog.trim() ? rawLog.trim().split(/\r?\n/).map(line => JSON.parse(line)) : [];
    assert.equal(commands.length, scenario.log.length, JSON.stringify(commands.map(item => item.args)));
    scenario.log.forEach((expected, index) => {
      const entry = commands[index];
      assert.ok(`${entry.kind === 'npm' ? 'npm ' : ''}${entry.args.join(' ')}`.includes(expected), expected);
      if (entry.kind === 'npm' && !scenario.local) {
        assert.equal(entry.tokenHash, null); assert.equal(entry.accountHash, null); assert.equal(entry.project, '');
      } else if (!scenario.local) {
        assert.equal(entry.tokenHash, hash(scenario.token ?? baseToken));
        assert.equal(entry.accountHash, hash(scenario.account ?? 'fake-account'));
        assert.equal(entry.ci, 'true'); assert.equal(entry.unexpected, null);
      }
    });
    assert.ok(!existsSync(join(project, 'PAGES_ENV_EXECUTED')));
    assert.ok(!existsSync(join(temporary, 'PAGES_ENV_EXECUTED')));
    if (scenario.dry) assert.match(output, /Dry run completed/);
    if (scenario.noWrangler) assert.match(output, /npm ci --allow-remote=root/);
    if (scenario.missing) assert.match(output, new RegExp(`Missing required settings: ${scenario.missing}\\.`));
    if (scenario.wranglerError) assert.ok(output.includes(scenario.wranglerError));
    if (scenario.expected !== 0) { assert.ok(!output.includes('Deployment completed.')); assert.ok(!output.includes('Pages project created.')); }
  } finally {
    assert.equal(dirname(resolve(temporary)), resolve(tmpdir()));
    assert.ok(basename(temporary).startsWith('finance deployment test '));
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('loader preserves caller settings, whitelists .env and supports CRLF, comments and quotes', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'finance deployment test '));
  try {
    writeFileSync(join(temporary, '.env'), dotenv.replaceAll('\n', '\r\n') + 'NODE_OPTIONS=forbidden\r\n');
    const caller = { CLOUDFLARE_PROJECT_NAME: 'terminal-project' };
    const config = loadPagesConfig(temporary, caller);
    assert.equal(config.CLOUDFLARE_API_TOKEN, fileToken);
    assert.equal(config.CLOUDFLARE_PROJECT_NAME, 'terminal-project');
    assert.deepEqual(Object.keys(config), settingNames);
    assert.deepEqual(caller, { CLOUDFLARE_PROJECT_NAME: 'terminal-project' });
  } finally {
    assert.equal(dirname(resolve(temporary)), resolve(tmpdir()));
    assert.ok(basename(temporary).startsWith('finance deployment test '));
    rmSync(temporary, { recursive: true, force: true });
  }
});
