import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
test('workflow permits only main push/manual deployment and rejects every PR', () => {
  const workflow = readFileSync(join(repo, '.github/workflows/deploy.yml'), 'utf8');
  const expression = workflow.match(/^\s+if: (.+)$/m)?.[1];
  assert.ok(expression, 'Deployment guard is missing.');
  const permitted = new Function('github', `return (${expression});`);
  for (const [event, ref, expected] of [
    ['push', 'refs/heads/main', true],
    ['workflow_dispatch', 'refs/heads/main', true],
    ['push', 'refs/heads/feature', false],
    ['workflow_dispatch', 'refs/heads/feature', false],
    ['pull_request', 'refs/pull/1/merge', false],
    ['pull_request', 'refs/heads/main', false],
    ['push', 'refs/tags/main', false],
  ]) assert.equal(permitted({ event_name: event, ref }), expected, `${event}: ${ref}`);
});
const isWindows = process.platform === 'win32';
const available = command => spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 10000 }).status === 0;
const linuxPath = path => path.replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`).replaceAll('\\', '/');
const runners = [];
if (available('pwsh')) runners.push({ name: 'PowerShell', kind: 'ps' });
if (!isWindows && available('bash')) runners.push({ name: 'Linux Bash', kind: 'bash' });
if (isWindows) {
  const wsl = spawnSync('wsl.exe', ['-d', 'Ubuntu-20.04', '--exec', 'bash', '-c', 'exit 0'], { timeout: 15000 });
  if (wsl.status === 0) runners.push({ name: 'WSL Linux Bash', kind: 'wsl' });
  else if (existsSync('C:/Program Files/Git/bin/bash.exe')) runners.push({ name: 'Git Bash', kind: 'gitbash' });
}
assert.ok(runners.length, 'No supported shell found for deployment verification.');
if (isWindows && !runners.some(runner => runner.kind === 'wsl')) console.warn('Linux runtime unavailable; only available Windows/Git Bash shells are verified.');

const cases = [
  { name: 'dry run needs no credentials and never invokes Wrangler', dry: true, credentials: false, expected: 0, log: ['npm test', 'npm run build'] },
  { name: 'production deploy uses the overridden project and main', expected: 0, project: 'custom-finance', log: ['npm test', 'npm run build', 'pages deploy dist --project-name custom-finance --branch main'] },
  { name: 'missing credentials stops before test/build/upload', credentials: false, expected: 1, log: [] },
  { name: 'test failure preserves exit code and stops build/upload', testExit: 17, expected: 17, log: ['npm test'] },
  { name: 'build failure preserves exit code and stops upload', buildExit: 23, expected: 23, log: ['npm test', 'npm run build'] },
  { name: 'upload failure preserves exit code', deployExit: 31, expected: 31, log: ['npm test', 'npm run build', 'pages deploy dist'] },
  { name: 'missing build output stops upload', noDist: true, expected: 1, log: ['npm test', 'npm run build'] },
  { name: 'invalid project name stops before commands', project: 'invalid project', expected: 1, log: [] },
  { name: 'local preview builds and only starts localhost', local: true, credentials: false, expected: 0, log: ['npm run build', 'pages dev dist --ip 127.0.0.1 --port 8790'] },
  { name: 'local build failure stops preview and preserves exit code', local: true, buildExit: 29, expected: 29, log: ['npm run build'] },
];

for (const runner of runners) {
  for (const scenario of cases) test(`${runner.name}: ${scenario.name}`, () => {
    const temporary = mkdtempSync(join(tmpdir(), 'finance deployment test '));
    const project = join(temporary, 'project with spaces');
    const bin = join(temporary, 'mock bin');
    const logPath = join(temporary, 'commands.log');
    try {
      mkdirSync(join(project, 'scripts'), { recursive: true });
      mkdirSync(join(project, 'node_modules/wrangler/bin'), { recursive: true });
      mkdirSync(bin);
      writeFileSync(join(project, 'node_modules/wrangler/bin/wrangler.js'), '// Must never execute the real CLI in these tests.\n');
      copyFileSync(join(repo, 'wrangler.jsonc'), join(project, 'wrangler.jsonc'));
      for (const file of ['deploy-local.ps1', 'deploy-remote.ps1', 'deploy-local.sh', 'deploy-remote.sh']) copyFileSync(join(repo, 'scripts', file), join(project, 'scripts', file));
      if (!scenario.noDist) { mkdirSync(join(project, 'dist')); writeFileSync(join(project, 'dist/index.html'), 'synthetic test output'); }

      writeFileSync(join(bin, 'npm'), '#!/usr/bin/env bash\nprintf "npm %s\\n" "$*" >> "$MOCK_LOG"\nif [[ "$1" == test ]]; then exit "$MOCK_TEST_EXIT"; fi\nexit "$MOCK_BUILD_EXIT"\n', { mode: 0o755 });
      writeFileSync(join(bin, 'node'), '#!/usr/bin/env bash\nif [[ "$1" == -e ]]; then printf "%s" "$MOCK_PROJECT_NAME"; exit 0; fi\nprintf "node %s [CI=%s]\\n" "$*" "${CI:-}" >> "$MOCK_LOG"\nexit "$MOCK_DEPLOY_EXIT"\n', { mode: 0o755 });
      writeFileSync(join(bin, 'npm.cmd'), '@echo off\r\necho npm %*>>"%MOCK_LOG%"\r\nif "%~1"=="test" exit /b %MOCK_TEST_EXIT%\r\nexit /b %MOCK_BUILD_EXIT%\r\n');
      writeFileSync(join(bin, 'node.cmd'), '@echo off\r\nif "%~1"=="-e" (\r\n echo %MOCK_PROJECT_NAME%\r\n exit /b 0\r\n)\r\necho node %* [CI=%CI%]>>"%MOCK_LOG%"\r\nexit /b %MOCK_DEPLOY_EXIT%\r\n');
      const mockEnv = {
        MOCK_LOG: runner.kind === 'wsl' ? linuxPath(logPath) : logPath,
        MOCK_PROJECT_NAME: scenario.project ?? 'financial-dashboard',
        MOCK_TEST_EXIT: String(scenario.testExit ?? 0),
        MOCK_BUILD_EXIT: String(scenario.buildExit ?? 0),
        MOCK_DEPLOY_EXIT: String(scenario.deployExit ?? 0),
        CLOUDFLARE_PROJECT_NAME: scenario.project ?? '',
        CLOUDFLARE_API_TOKEN: scenario.credentials === false ? '' : 'fake-token-must-not-be-printed',
        CLOUDFLARE_ACCOUNT_ID: scenario.credentials === false ? '' : 'fake-account',
      };
      let command; let args;
      const scriptName = scenario.local ? 'deploy-local' : 'deploy-remote';
      if (runner.kind === 'ps') {
        command = 'pwsh'; args = ['-NoLogo', '-NoProfile', '-File', join(project, 'scripts', `${scriptName}.ps1`), ...(scenario.local ? ['-Port', '8790'] : scenario.dry ? ['-DryRun'] : [])];
      } else {
        const script = join(project, 'scripts', `${scriptName}.sh`);
        const flags = scenario.local ? ['--port', '8790'] : scenario.dry ? ['--dry-run'] : [];
        if (runner.kind === 'wsl') {
          command = 'wsl.exe'; args = ['-d', 'Ubuntu-20.04', '--exec', 'env', `PATH=${linuxPath(bin)}:/usr/local/bin:/usr/bin:/bin`, ...Object.entries(mockEnv).map(([key, value]) => `${key}=${value}`), 'bash', linuxPath(script), ...flags];
        } else { command = runner.kind === 'gitbash' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash'; args = [script, ...flags]; }
      }
      const result = spawnSync(command, args, { cwd: tmpdir(), env: { ...process.env, ...mockEnv, PATH: `${bin}${isWindows ? ';' : ':'}${process.env.PATH}` }, encoding: 'utf8', timeout: 30000 });
      assert.ifError(result.error);
      const output = `${result.stdout}\n${result.stderr}`;
      assert.equal(result.status, scenario.expected, output);
      assert.ok(!output.includes('fake-token-must-not-be-printed'), 'Token appeared in command output.');
      const commands = existsSync(logPath) ? readFileSync(logPath, 'utf8').trim().split(/\r?\n/) : [];
      assert.equal(commands.length, scenario.log.length, JSON.stringify(commands));
      scenario.log.forEach((expected, index) => assert.ok(commands[index].includes(expected), `${commands[index]} does not include ${expected}`));
      if (commands.some(line => line.includes('pages deploy'))) assert.match(commands.at(-1), /\[CI=true\]/);
      if (scenario.dry) assert.match(output, /Dry run completed/);
      if (scenario.expected !== 0) assert.ok(!output.includes('Deployment completed.'));
    } finally {
      // Only remove this test's exact, freshly allocated temp directory.
      assert.equal(dirname(resolve(temporary)), resolve(tmpdir()));
      assert.ok(basename(temporary).startsWith('finance deployment test '));
      rmSync(temporary, { recursive: true, force: true });
    }
  });
}
