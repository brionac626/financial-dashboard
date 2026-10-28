import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { read, utils, type WorkBook } from 'xlsx';
import { parseFile, parseWorkbook } from '@/lib/import';
import { emptyData, mergeImports, totals, trendData } from '@/lib/finance';
import { clearData, loadData, saveData, STORAGE_KEY } from '@/lib/storage';

function fixture(year = 2024): WorkBook {
  const workbook = utils.book_new();
  const sheet = utils.aoa_to_sheet([
    ['家庭財務健康檢查表', null, null, null, null, `${year}年`],
    [null, null, null, null, null, '1月', '2月', '3月'],
    ['類型', '帳戶', '功能', '目標/用途'],
    ['流動資產1', '活存', '家用', '預備金', null, 1000, null, 1300],
    [null, '定存', '', '', null, 500],
    ['現金資產總計', null, null, null, null, 999999],
    ['流動資產2', '證券', '退休', '', null, 2000],
    ['非流動資產', '房屋', '', '', null, 10000],
    ['資產金額總計', null, null, null, null, 999999],
    ['流動負債', '信用卡', '', '', null, 300],
    ['非流動負債', '房貸', '', '', null, 5000],
    ['負債金額總計', null, null, null, null, 999999],
    ['資產淨值', null, null, null, null, 999999],
  ]);
  utils.book_append_sheet(workbook, sheet, '資產負債表（範例）');
  utils.book_append_sheet(workbook, utils.aoa_to_sheet([
    [null, null, null, null, 'XX的人壽保險'],
    [null, null, null, null, '種類', '年期', '保費', '投保年月', '終身/定期', '保障內容', '繳費狀態', '保險公司'],
    [null, null, null, null, '壽險', '20年', 12000, '2024/01', '定期', '基本保障', '繳費中', '範例公司'],
    [null, null, null, null, '意外險'],
    [null, null, null, null, '產物保險'],
    [null, null, null, null, '種類', '年期', '保費'],
    [null, null, null, null, '車險', '1年', 0],
    [null, null, null, null, '政府保險'],
    [null, null, null, null, '種類', '年期', '保費', '保額', '保障內容'],
    [null, null, null, null, '勞工保險', '', '依薪資', 100000, '保障'],
  ]), '保險概況');
  return workbook;
}
const parse = (book = fixture(), id = 'a') => parseWorkbook(book, `${id}.xlsx`, id);

describe('Excel 欄位與計算', () => {
  it('原始範本空白不會將公式小計的零當成月份資料', () => {
    const buffer = readFileSync(new URL('../實用表單 _ 資產負債表_方修改版.xlsx', import.meta.url));
    const result = parseWorkbook(read(buffer), '範本.xlsx', 'original');
    expect(result.errors).toEqual([]);
    expect(result.months).toHaveLength(0);
    expect(result.insurance).toBeUndefined();
    expect(result.notes[0]).toContain('尚無有效資料');
  });
  it('現金計入總資產，忽略錯誤小計並正確計算淨值', () => {
    const result = parse();
    expect(result.errors).toEqual([]);
    const total = totals(result.months[0]);
    expect(total.assets).toBe(13500);
    expect(total.liabilities).toBe(5300);
    expect(total.netWorth).toBe(8200);
    expect(total.debtRatio).toBeCloseTo(39.259);
    expect(total.grouped.cash).toBe(1500);
  });
  it('全空白月份略過，已填月份其他帳戶補零', () => {
    const result = parse();
    expect(result.months.map(month => month.month)).toEqual(['2024-01', '2024-03']);
    expect(totals(result.months[1]).assets).toBe(1300);
    expect(result.months[1].accounts[1].amount).toBe(0);
  });
  it('明確零值可匯入，零總資產比例為 null', () => {
    const workbook = fixture();
    workbook.Sheets[workbook.SheetNames[0]].G4 = { t: 'n', v: 0 };
    const february = parse(workbook).months.find(month => month.month === '2024-02');
    expect(february).toBeDefined();
    expect(totals(february!).debtRatio).toBeNull();
  });
  it('分類內可增加帳戶，並保留重名帳戶', () => {
    const workbook = fixture();
    const rows = utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    rows.splice(5, 0, [null, '活存', '新增帳戶', '', null, 250]);
    workbook.Sheets[workbook.SheetNames[0]] = utils.aoa_to_sheet(rows);
    const result = parse(workbook);
    expect(result.months[0].accounts.filter(account => account.account === '活存')).toHaveLength(2);
    expect(new Set(result.months[0].accounts.map(account => account.id)).size).toBe(7);
    expect(totals(result.months[0]).grouped.cash).toBe(1750);
  });
  it('接受千分位與負值', () => {
    const workbook = fixture();
    workbook.Sheets[workbook.SheetNames[0]].F4 = { t: 's', v: '-1,250.50' };
    expect(parse(workbook).months[0].accounts[0].amount).toBe(-1250.5);
  });
  it.each(['abc', '1,2', '100元'])('拒絕無效金額 %s 並指出儲存格', raw => {
    const workbook = fixture();
    workbook.Sheets[workbook.SheetNames[0]].F4 = { t: 's', v: raw };
    const result = parse(workbook);
    expect(result.errors[0]).toContain('F4');
    expect(result.months).toEqual([]);
    expect(result.insurance).toBeUndefined();
  });
  it('明細公式只有有效數字快取才能匯入', () => {
    const workbook = fixture();
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    sheet.F4 = { t: 'n', f: 'SUM(1,2)', v: 3 };
    expect(parse(workbook).months[0].accounts[0].amount).toBe(3);
    sheet.F4 = { t: 'n', f: 'SUM(1,2)' };
    expect(parse(workbook).errors[0]).toContain('公式沒有有效數值快取');
  });
  it.each(['F1', 'D3', 'A8'])('缺少年份、表頭或分類 %s 時拒絕匯入', address => {
    const workbook = fixture();
    delete workbook.Sheets[workbook.SheetNames[0]][address];
    expect(parse(workbook).errors.length).toBeGreaterThan(0);
  });
  it('不允許有金額卻沒有帳戶名稱', () => {
    const workbook = fixture();
    delete workbook.Sheets[workbook.SheetNames[0]].B4;
    expect(parse(workbook).errors[0]).toContain('缺少帳戶名稱');
  });
  it('拒絕不支援的檔案與假 xlsx', () => {
    expect(parseFile(new ArrayBuffer(2), 'test.csv', 'x').errors[0]).toContain('.xlsx');
    expect(parseFile(new ArrayBuffer(2), 'test.xlsx', 'x').errors[0]).toContain('不是有效');
  });
});

describe('保險與跨檔合併', () => {
  it('排除空白預設險種，保留原始保費與政府保險欄位', () => {
    const records = parse().insurance!.records;
    expect(records).toHaveLength(3);
    expect(records[0].fields['保費']).toBe('12000');
    expect(records[1].fields['保費']).toBe('0');
    expect(records[2].fields['保費']).toBe('依薪資');
    expect(records[2].fields['保額']).toBe('100000');
  });
  it('缺少保險工作表仍可匯入財務資料', () => {
    const workbook = fixture(); workbook.SheetNames.pop();
    const result = parse(workbook);
    expect(result.errors).toEqual([]);
    expect(result.months).toHaveLength(2);
    expect(result.insurance).toBeUndefined();
  });
  it('重複月份保留既有紀錄，同批以順序優先，保險獨立保存', () => {
    const first = parse(); const other = parse(fixture(), 'b');
    other.months[0].accounts[0].amount = 999;
    const merged = mergeImports(emptyData(), [first, other]);
    expect(merged.months).toHaveLength(2);
    expect(merged.months[0].accounts[0].amount).toBe(1000);
    expect(merged.insurance).toHaveLength(2);
    expect(mergeImports(merged, [other]).months[0].accounts[0].amount).toBe(1000);
  });
  it('跨年排序，缺漏月份保留 null 斷點', () => {
    const merged = mergeImports(emptyData(), [parse(fixture(2025), 'next'), parse()]);
    expect(merged.months.map(month => month.month)).toEqual(['2024-01', '2024-03', '2025-01', '2025-03']);
    expect(merged.preferences.month).toBe('2025-03');
    const trend = trendData(merged.months);
    expect(trend).toHaveLength(15);
    expect(trend[1].assets).toBeNull();
  });
  it('錯誤檔案不影響其他有效檔案', () => {
    const invalid = parse(fixture(), 'bad'); invalid.errors.push('bad');
    const merged = mergeImports(emptyData(), [invalid, parse()]);
    expect(merged.months).toHaveLength(2);
    expect(merged.insurance).toHaveLength(1);
  });
});

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}
describe('儲存容錯', () => {
  it('重新載入保留正規化資料與選項', () => {
    const storage = memoryStorage(); const data = mergeImports(emptyData(), [parse()]);
    expect(saveData(storage, data)).toBe('');
    expect(loadData(storage).data).toEqual(data);
  });
  it.each(['invalid json', '{}', '{"version":9}', '{"version":1,"months":[{}],"insurance":[],"preferences":{"month":"","insuranceId":""}}'])('損壞紀錄不覆寫，回報警告', raw => {
    const storage = memoryStorage(); storage.setItem(STORAGE_KEY, raw);
    expect(loadData(storage).writable).toBe(false);
    expect(loadData(storage).warning).not.toBe('');
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it('寫入配額失敗、禁止存取及清除失敗都有提示', () => {
    const storage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(saveData(storage, emptyData())).toContain('保存失敗');
    expect(loadData(storage).writable).toBe(false);
    expect(clearData(storage)).toContain('無法清除');
  });
  it('清除僅移除本程式的鍵', () => {
    const storage = memoryStorage(); storage.setItem('other-app', 'keep'); saveData(storage, emptyData());
    expect(clearData(storage)).toBe('');
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem('other-app')).toBe('keep');
  });
});
