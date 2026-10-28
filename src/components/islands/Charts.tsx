import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { balanceComposition, compactMoney, money, trendData } from '@/lib/finance';
import type { FinancialSummary, MonthlySnapshot } from '@/types/finance';

export function BalancePieChart({ summary, period }: { summary: FinancialSummary | null; period: string }) {
  const composition = balanceComposition(summary);
  const messages = {
    empty: '匯入財務紀錄後，即可查看資產與負債占比。',
    zero: '資產與負債皆為零，無可繪製金額。',
    negative: '總額含負數，不適用圓餅圖；原始金額如下。',
    ready: '',
  };
  return <figure className="panel balance-pie-panel" aria-label={`${period}資產與負債占比`}>
    <figcaption className="panel-heading"><div><h3>資產與負債占比</h3><p>{period}</p></div><span className="unit-label">TWD</span></figcaption>
    {composition.state === 'ready' ? <div className="balance-pie-chart chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart accessibilityLayer>
          <Pie data={composition.items.filter(item => item.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="85%" stroke="#fff" strokeWidth={3} isAnimationActive={false} />
          <Tooltip formatter={(value, name) => {
            const item = composition.items.find(entry => entry.name === name);
            return `${money(Number(value))}（${item?.percentage?.toFixed(1)}%）`;
          }} contentStyle={{ borderRadius: 12, borderColor: '#e0e7e2' }} />
        </PieChart>
      </ResponsiveContainer>
    </div> : <div className="pie-empty"><p>{messages[composition.state]}</p></div>}
    {!!composition.items.length && <dl className="category-values pie-values">{composition.items.map(item => <div key={item.name}>
      <dt><i style={{ background: item.fill }} />{item.name}</dt><dd>{money(item.value)}<span>{item.percentage === null ? '占比不適用' : `${item.percentage.toFixed(1)}%`}</span></dd>
    </div>)}</dl>}
    <p className="pie-explanation">圓餅占比＝各項金額 ÷（總資產＋總負債），與「負債 ÷ 資產」的資產負債比不同。</p>
  </figure>;
}

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
        <Line type="linear" name="總負債" dataKey="liabilities" stroke="var(--color-liability)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
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
