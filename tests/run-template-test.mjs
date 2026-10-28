import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('./vitest.mjs', import.meta.resolve('vitest/package.json')));
const result = spawnSync(process.execPath, [cli, 'run'], {
  stdio: 'inherit',
  env: { ...process.env, FINANCE_TEMPLATE_TEST: '1' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
