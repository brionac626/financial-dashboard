import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { read } from 'xlsx';
import { parseWorkbook } from '@/lib/import';

it('指定的原始空白範本可解析，公式小計不建立月份', () => {
  const path = process.env.FINANCE_TEMPLATE_PATH;
  if (!path) throw new Error('請設定 FINANCE_TEMPLATE_PATH 為原始空白範本路徑。');
  const result = parseWorkbook(read(readFileSync(path)), '範本.xlsx', 'original');
  expect(result.errors).toEqual([]);
  expect(result.months).toHaveLength(0);
  expect(result.insurance).toBeUndefined();
  expect(result.notes[0]).toContain('尚無有效資料');
});
