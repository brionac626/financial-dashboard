import { utils, type WorkBook } from 'xlsx';

export function fixture(year = 2024): WorkBook {
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
export function blankFixture(): WorkBook {
  const workbook = fixture();
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  for (const row of [4, 5, 7, 8, 10, 11]) {
    for (const column of ['F', 'G', 'H']) delete sheet[`${column}${row}`];
  }
  sheet.F6 = { t: 'n', f: 'SUM(F4:F5)', v: 0 };
  delete workbook.Sheets['保險概況'];
  workbook.SheetNames = workbook.SheetNames.filter(name => name !== '保險概況');
  return workbook;
}
