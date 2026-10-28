import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compactMoney, money, trendData } from '@/lib/finance';
import type { MonthlySnapshot } from '@/types/finance';

export function TrendChart({ months }: { months: MonthlySnapshot[] }) {
  return <div className="chart trend-chart" role="img" aria-label="總資產、淨值與總負債趨勢；完整數值請展開下方圖表資料表。">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={trendData(months)} margin={{ top: 16, right: 20, bottom: 8, left: 0 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e7ece8" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#75837c' }} axisLine={false} tickLine={false} minTickGap={35} dy={8} />
        <YAxis tickFormatter={compactMoney} tick={{ fontSize: 11, fill: '#75837c' }} axisLine={false} tickLine={false} width={65} />
        <Tooltip formatter={value => money(Number(value))} labelFormatter={label => `${label} · 月底餘額`} contentStyle={{ borderRadius: 12, borderColor: '#e0e7e2' }} />
        <Line type="linear" name="總資產" dataKey="assets" stroke="#177b69" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
        <Line type="linear" name="淨值" dataKey="netWorth" stroke="#80a18c" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
        <Line type="linear" name="總負債" dataKey="liabilities" stroke="#c18660" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
export function CategoryChart({ data, count = false }: { data: { name: string; value: number; color: string }[]; count?: boolean }) {
  return <div className="chart category-chart" role="img" aria-label={count ? '保險分類筆數；數值列於下方。' : '分類金額；數值列於下方。'}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={data.map(item => ({ ...item, fill: item.color }))} layout="vertical" margin={{ left: 0, right: 16 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 5" horizontal={false} stroke="#e7ece8" />
        <XAxis type="number" tickFormatter={count ? String : compactMoney} tick={{ fontSize: 11, fill: '#75837c' }} axisLine={false} tickLine={false} allowDecimals={!count} />
        <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 12, fill: '#5d6d64' }} axisLine={false} tickLine={false} />
        <Tooltip formatter={value => count ? `${value} 筆` : money(Number(value))} cursor={{ fill: '#f3f6f3' }} contentStyle={{ borderRadius: 12, borderColor: '#e0e7e2' }} />
        <Bar dataKey="value" name={count ? '紀錄筆數' : '金額'} barSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  </div>;
}
