import type { Category, ImportResult, MonthlySnapshot, StoredData } from '@/types/finance';

export const categories: Category[] = ['cash', 'investment', 'nonCurrentAsset', 'currentLiability', 'nonCurrentLiability'];
export const emptyData = (): StoredData => ({ version: 1, months: [], insurance: [], preferences: { month: '', insuranceId: '' } });
export const numberFormat = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 });
export const money = (amount: number) => `${amount < 0 ? '-' : ''}NT$${numberFormat.format(Math.abs(amount))}`;
export const compactMoney = (amount: number) => Math.abs(amount) >= 10000 ? `${new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 1 }).format(amount / 10000)}萬` : new Intl.NumberFormat('zh-TW').format(amount);
export const monthLabel = (month: string) => `${month.slice(0, 4)} 年 ${Number(month.slice(5))} 月`;
export function totals(snapshot: MonthlySnapshot) {
  const grouped = Object.fromEntries(categories.map(key => [key, 0])) as Record<Category, number>;
  for (const account of snapshot.accounts) grouped[account.category] += account.amount;
  const assets = grouped.cash + grouped.investment + grouped.nonCurrentAsset;
  const liabilities = grouped.currentLiability + grouped.nonCurrentLiability;
  return { grouped, assets, liabilities, netWorth: assets - liabilities, debtRatio: assets === 0 ? null : liabilities / assets * 100 };
}
export function mergeImports(data: StoredData, results: ImportResult[]) {
  const months = new Map(data.months.map(month => [month.month, month]));
  const insurance = [...data.insurance];
  for (const result of results) {
    if (result.errors.length) continue;
    for (const month of result.months) if (!months.has(month.month)) months.set(month.month, month);
    if (result.insurance?.records.length && !insurance.some(item => item.id === result.insurance?.id)) insurance.push(result.insurance);
  }
  const sorted = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
  return { version: 1 as const, months: sorted, insurance, preferences: { month: sorted.at(-1)?.month ?? '', insuranceId: insurance.at(-1)?.id ?? '' } };
}
export function trendData(months: MonthlySnapshot[]) {
  if (!months.length) return [];
  const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month));
  const indexed = new Map(sorted.map(item => [item.month, item]));
  const start = sorted[0].month.split('-').map(Number);
  const end = sorted[sorted.length - 1].month.split('-').map(Number);
  const rows = [];
  for (let index = start[0] * 12 + start[1] - 1; index <= end[0] * 12 + end[1] - 1; index++) {
    const month = `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;
    const snapshot = indexed.get(month);
    rows.push({ month, ...(snapshot ? totals(snapshot) : { assets: null, liabilities: null, netWorth: null }) });
  }
  return rows;
}
