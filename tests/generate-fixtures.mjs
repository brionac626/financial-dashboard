// Disposable synthetic workbooks for browser QA. Never served by the website.
import XLSX from 'xlsx';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fixture } from './workbook.ts';

const output = new URL('./.generated/', import.meta.url);
mkdirSync(output, { recursive: true });
for (const year of [2024, 2025]) {
  const workbook = fixture(year);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  for (const [index, column] of ['F', 'G', 'H'].entries()) {
    for (const [row, value] of [[4, 180000 + index * 8000], [5, 320000], [7, 850000], [8, 6500000], [10, 18000], [11, 3800000]]) {
      sheet[`${column}${row}`] = { t: 'n', v: value };
    }
  }
  writeFileSync(new URL(`qa-${year}.xlsx`, output), XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}
for (const [name, asset, debt] of [['zero', 0, 0], ['negative', -100, 300]]) {
  const workbook = fixture(name === 'negative' ? 2025 : 2024);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  for (const row of [4, 5, 7, 8, 10, 11]) {
    for (const column of ['F', 'G', 'H']) delete sheet[`${column}${row}`];
    sheet[`F${row}`] = { t: 'n', v: row === 4 ? asset : row === 10 ? debt : 0 };
  }
  writeFileSync(new URL(`qa-${name}.xlsx`, output), XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}
writeFileSync(new URL('invalid.xlsx', output), 'invalid test workbook');
console.log('Created disposable browser fixtures in tests/.generated/');
