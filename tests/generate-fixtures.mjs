// Disposable synthetic workbooks for browser QA. Never served by the website.
import XLSX from 'xlsx';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const output = new URL('./.generated/', import.meta.url);
mkdirSync(output, { recursive: true });
for (const year of [2024, 2025]) {
  const workbook = XLSX.read(readFileSync(new URL('../實用表單 _ 資產負債表_方修改版.xlsx', import.meta.url)));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  sheet.F1 = { t: 's', v: `${year}年` };
  for (const [index, column] of ['F', 'G', 'I', 'J', 'K', 'L'].entries()) {
    const step = index + (year - 2024) * 6;
    for (const [row, value] of [[4, 180000 + step * 8000], [5, 320000], [14, 850000 + step * 25000], [24, 6500000], [27, 18000], [33, 3800000 - step * 18000]]) sheet[`${column}${row}`] = { t: 'n', v: value };
  }
  const insurance = workbook.Sheets['保險概況'];
  insurance.E4 = { t: 's', v: '測試家庭的人壽保險' };
  insurance.F6 = { t: 's', v: '20年' };
  insurance.G6 = { t: 'n', v: year === 2024 ? 12000 : 13500 };
  insurance.H6 = { t: 's', v: '2020/01' };
  insurance.J6 = { t: 's', v: '瀏覽器測試用虛構保障' };
  insurance.G8 = { t: 'n', v: 8000 };
  insurance.G20 = { t: 'n', v: 6000 };
  writeFileSync(new URL(`qa-${year}.xlsx`, output), XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}
writeFileSync(new URL('invalid.xlsx', output), 'invalid test workbook');
console.log('Created disposable browser fixtures in tests/.generated/');
