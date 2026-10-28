import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: process.env.FINANCE_TEMPLATE_TEST === '1' ? ['tests/template.compat.ts'] : ['tests/**/*.test.ts'] },
});
