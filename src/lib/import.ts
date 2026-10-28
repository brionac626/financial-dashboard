import { read, utils, type CellObject, type WorkBook, type WorkSheet } from 'xlsx';
import type { AccountBalance, Category, ImportResult, InsuranceCategory, InsuranceRecord } from '@/types/finance';

const text = (cell?: CellObject) => cell?.v == null ? '' : String(cell.v).trim();
const normalized = (value: string) => value.normalize('NFKC').replace(/\s/g, '');
const cellAt = (sheet: WorkSheet, row: number, col: number): CellObject | undefined => sheet[utils.encode_cell({ r: row, c: col })];
function bounds(sheet: WorkSheet) {
  const range = utils.decode_range(sheet['!ref'] || 'A1');
  if (range.e.r > 5000 || range.e.c > 100) throw new Error('工作表超過支援範圍（5,001 列、101 欄）。請使用資產負債表範本。');
  return range;
}
function identifyCategory(value: string): Category | undefined {
  const label = normalized(value);
  if (label.startsWith('非流動資產')) return 'nonCurrentAsset';
  if (label.startsWith('非流動負債')) return 'nonCurrentLiability';
  if (label.startsWith('流動資產1')) return 'cash';
  if (label.startsWith('流動資產2')) return 'investment';
  if (label.startsWith('流動負債')) return 'currentLiability';
}
function amount(cell: CellObject | undefined, location: string): number | null {
  if (cell?.f && (cell.t !== 'n' || typeof cell.v !== 'number' || !Number.isFinite(cell.v))) {
    throw new Error(`${location}：公式沒有有效數值快取，請在 Excel 重算並儲存後重新匯入。`);
  }
  if (!cell || cell.v == null || cell.v === '') return null;
  if (cell.t === 'e' || cell.t === 'b' || cell.t === 'd') throw new Error(`${location}：金額必須為有效數字。`);
  let value: number;
  if (typeof cell.v === 'number') value = cell.v;
  else {
    const raw = String(cell.v).trim();
    if (!raw) return null;
    if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw)) throw new Error(`${location}：無法辨識金額「${raw}」。`);
    value = Number(raw.replaceAll(',', ''));
  }
  if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error(`${location}：金額超過支援範圍（正負一兆）。`);
  return value;
}
function balanceSheet(sheet: WorkSheet, sheetName: string, result: ImportResult) {
  const range = bounds(sheet);
  let headerRow = -1;
  let typeCol = -1;
  const headers: Record<string, number> = {};
  const years = new Set<number>();
  for (let r = 0; r <= Math.min(range.e.r, 10); r++) {
    for (let c = 0; c <= range.e.c; c++) {
      const value = normalized(text(cellAt(sheet, r, c)));
      if (/^(19\d{2}|20\d{2}|21\d{2})年$/.test(value)) years.add(Number(value.slice(0, 4)));
      if (value === '類型') { headerRow = r; typeCol = c; }
    }
  }
  if (years.size !== 1) throw new Error(`${sheetName}：請提供唯一且明確的西元年份，例如「2024年」。`);
  if (headerRow < 0) throw new Error(`${sheetName}：找不到「類型」欄位。`);
  for (let c = 0; c <= range.e.c; c++) headers[normalized(text(cellAt(sheet, headerRow, c)))] = c;
  for (const field of ['帳戶', '功能', '目標/用途']) if (headers[field] === undefined) throw new Error(`${sheetName}：缺少「${field}」表頭。`);
  const monthColumns = new Map<number, number>();
  for (let r = 0; r <= headerRow; r++) {
    for (let c = 0; c <= range.e.c; c++) {
      const match = normalized(text(cellAt(sheet, r, c))).match(/^(\d{1,2})月$/);
      if (match) {
        const month = Number(match[1]);
        if (month < 1 || month > 12 || monthColumns.has(month)) throw new Error(`${sheetName}：月份表頭重複或無效。`);
        monthColumns.set(month, c);
      }
    }
  }
  if (!monthColumns.size) throw new Error(`${sheetName}：找不到月份表頭。`);
  const seenCategories = new Set<Category>();
  const rows: { row: number; category: Category; account: string; purpose: string; goal: string }[] = [];
  let currentCategory: Category | undefined;
  for (let row = headerRow + 1; row <= range.e.r; row++) {
    const label = text(cellAt(sheet, row, typeCol));
    const category = identifyCategory(label);
    if (category) { currentCategory = category; seenCategories.add(category); }
    else if (label) {
      if (/總計|合計|淨值/.test(label)) { currentCategory = undefined; continue; }
      throw new Error(`${sheetName}!${utils.encode_cell({ r: row, c: typeCol })}：無法辨識分類「${label}」。`);
    }
    if (!currentCategory) continue;
    const account = text(cellAt(sheet, row, headers['帳戶']));
    const hasAmount = [...monthColumns.values()].some(col => { const cell = cellAt(sheet, row, col); return !!cell?.f || text(cell) !== ''; });
    if (!account) {
      if (hasAmount) throw new Error(`${sheetName}!${utils.encode_cell({ r: row, c: headers['帳戶'] })}：有金額但缺少帳戶名稱。`);
      continue;
    }
    rows.push({ row, category: currentCategory, account, purpose: text(cellAt(sheet, row, headers['功能'])), goal: text(cellAt(sheet, row, headers['目標/用途'])) });
  }
  if (seenCategories.size !== 5) throw new Error(`${sheetName}：須包含流動資產1、流動資產2、非流動資產、流動負債、非流動負債五個分類。`);
  for (const [month, col] of monthColumns) {
    let populated = false;
    const accounts: AccountBalance[] = rows.map(({ row, ...record }) => {
      const value = amount(cellAt(sheet, row, col), `${sheetName}!${utils.encode_cell({ r: row, c: col })}`);
      if (value !== null) populated = true;
      return { ...record, id: `${sheetName}:${row + 1}`, amount: value ?? 0 };
    });
    const key = `${[...years][0]}-${String(month).padStart(2, '0')}`;
    if (populated) result.months.push({ month: key, source: result.source, accounts });
    else result.notes.push(`${key}：全空白，已略過。`);
  }
}
function insuranceSheet(sheet: WorkSheet, sheetName: string): InsuranceRecord[] {
  const range = bounds(sheet);
  const records: InsuranceRecord[] = [];
  let category: InsuranceCategory = '人壽保險';
  let holder = '';
  let headers: { col: number; name: string }[] = [];
  let kindCol = -1;
  for (let row = 0; row <= range.e.r; row++) {
    const values = Array.from({ length: range.e.c + 1 }, (_, col) => text(cellAt(sheet, row, col)));
    const title = values.find(value => /人壽保險|產物保險|政府保險/.test(value));
    if (title) {
      category = title.includes('產物') ? '產物保險' : title.includes('政府') ? '政府保險' : '人壽保險';
      if (category === '人壽保險') holder = title;
      headers = []; kindCol = -1; continue;
    }
    if (values.includes('種類')) {
      kindCol = values.indexOf('種類');
      headers = values.map((name, col) => ({ name, col })).filter(item => item.col > kindCol && item.name !== '');
      continue;
    }
    if (kindCol < 0 || !values[kindCol]) continue;
    const fields: Record<string, string> = {};
    for (const { name, col } of headers) {
      const cell = cellAt(sheet, row, col);
      if (cell?.f) amount(cell, `${sheetName}!${utils.encode_cell({ r: row, c: col })}`);
      if (cell?.t === 'e') throw new Error(`${sheetName}!${utils.encode_cell({ r: row, c: col })}：儲存格含有 Excel 錯誤，請修正後匯入。`);
      fields[name] = cell ? (cell.w ?? text(cell)).trim() : '';
    }
    if (Object.values(fields).some(value => value !== '')) records.push({ category, holder, kind: values[kindCol], fields });
  }
  return records;
}
export function parseWorkbook(workbook: WorkBook, source: string, id: string): ImportResult {
  const result: ImportResult = { source, id, months: [], errors: [], notes: [] };
  try {
    const candidates = workbook.SheetNames.filter(name => name.includes('資產負債'));
    if (candidates.length !== 1) throw new Error('請提供唯一一張名稱包含「資產負債」的工作表。');
    balanceSheet(workbook.Sheets[candidates[0]], candidates[0], result);
    const insuranceNames = workbook.SheetNames.filter(name => name.includes('保險概況'));
    if (insuranceNames.length > 1) throw new Error('保險概況工作表超過一張，無法判斷來源。');
    if (insuranceNames.length) {
      const records = insuranceSheet(workbook.Sheets[insuranceNames[0]], insuranceNames[0]);
      if (records.length) result.insurance = { id, source, importedAt: new Date().toISOString(), records };
      else result.notes.push('保險概況沒有已填寫的保單。');
    } else result.notes.push('沒有保險概況工作表；僅匯入財務資料。');
    if (!result.months.length && !result.insurance) result.notes.unshift('這份檔案尚無有效資料，請填寫金額或保險內容後再匯入。');
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : '無法解析檔案。');
    result.months = [];
    result.insurance = undefined;
  }
  return result;
}
export function parseFile(buffer: ArrayBuffer, source: string, id: string): ImportResult {
  try {
    if (!source.toLowerCase().endsWith('.xlsx')) throw new Error('僅支援 .xlsx 檔案。');
    if (buffer.byteLength > 10 * 1024 * 1024) throw new Error('單一檔案不可超過 10 MB。');
    const signature = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
    if (signature[0] !== 0x50 || signature[1] !== 0x4b) throw new Error('不是有效的 .xlsx 檔案，或檔案已加密。');
    return parseWorkbook(read(buffer, { type: 'array', cellFormula: true, cellText: true }), source, id);
  } catch (error) {
    return { id, source, months: [], errors: [error instanceof Error ? error.message : '檔案無法讀取，請確認格式及密碼保護。'], notes: [] };
  }
}
