import { describe, expect, it } from 'vitest';
import { balanceComposition, cumulativeTotals, emptyData, mergeImports, totals } from '@/lib/finance';
import type { MonthlySnapshot } from '@/types/finance';

function snapshot(month: string, assets: number, debt: number): MonthlySnapshot {
  return { month, source: 'summary-test.xlsx', accounts: [
    { id: 'cash', category: 'cash', account: '活存', purpose: '', goal: '', amount: assets },
    { id: 'debt', category: 'currentLiability', account: '信用卡', purpose: '', goal: '', amount: debt },
  ] };
}
describe('歷史累計與圓餅圖計算', () => {
  it('跨年度加總所有月份，按總額計算比例而非加總或平均各月比例', () => {
    const months = [snapshot('2025-01', 300, 0), snapshot('2024-12', 100, 50)];
    const result = cumulativeTotals(months)!;
    expect(result.assets).toBe(400);
    expect(result.liabilities).toBe(50);
    expect(result.netWorth).toBe(350);
    expect(result.debtRatio).toBe(12.5);
    expect(result.grouped.cash).toBe(400);
    expect(result.grouped.currentLiability).toBe(50);
  });
  it('切換所選月份不影響歷史累計且不改寫原資料', () => {
    const data = emptyData(); data.months = [snapshot('2024-01', 100, 50), snapshot('2024-02', 300, 0)];
    const before = structuredClone(data.months);
    const history = cumulativeTotals(data.months);
    for (const month of data.months) {
      data.preferences.month = month.month;
      expect(totals(month).assets).toBe(month.accounts[0].amount);
      expect(cumulativeTotals(data.months)).toEqual(history);
    }
    expect(data.months).toEqual(before);
  });
  it('匯入新月份會更新，重複月份不重算，清除後回到空狀態', () => {
    const data = emptyData(); data.months = [snapshot('2024-01', 100, 50)];
    const merged = mergeImports(data, [{ id: 'import', source: 'test.xlsx', errors: [], notes: [], months: [snapshot('2024-01', 999, 0), snapshot('2024-02', 300, 0)] }]);
    expect(cumulativeTotals(merged.months)?.assets).toBe(400);
    expect(cumulativeTotals(emptyData().months)).toBeNull();
    expect(balanceComposition(null)).toEqual({ state: 'empty', items: [] });
  });
  it('資產負債比與圓餅占比使用不同分母', () => {
    const result = totals(snapshot('2024-01', 100, 50));
    const composition = balanceComposition(result);
    expect(result.debtRatio).toBe(50);
    expect(composition.state).toBe('ready');
    expect(composition.items[0].percentage).toBeCloseTo(66.6667);
    expect(composition.items[1].percentage).toBeCloseTo(33.3333);
    expect(composition.items.reduce((sum, item) => sum + item.percentage!, 0)).toBeCloseTo(100);
  });
  it.each([[100, 0, 100, 0], [0, 100, 0, 100]])('單一有效扇區 %s / %s', (assets, debt, assetShare, debtShare) => {
    const result = balanceComposition(totals(snapshot('2024-01', assets, debt)));
    expect(result.state).toBe('ready');
    expect(result.items.map(item => item.percentage)).toEqual([assetShare, debtShare]);
  });
  it('兩者皆零不繪製圓餅，零資產比例為 null', () => {
    const result = cumulativeTotals([snapshot('2024-01', 0, 0)])!;
    expect(result.debtRatio).toBeNull();
    expect(balanceComposition(result).state).toBe('zero');
    expect(balanceComposition(result).items.every(item => item.percentage === null)).toBe(true);
  });
  it.each([[-100, 50], [100, -50], [-100, -50]])('負值 %s / %s 保留原金額且不繪製圓餅', (assets, debt) => {
    const result = balanceComposition(totals(snapshot('2024-01', assets, debt)));
    expect(result.state).toBe('negative');
    expect(result.items.map(item => item.value)).toEqual([assets, debt]);
    expect(result.items.every(item => item.percentage === null)).toBe(true);
  });
});
