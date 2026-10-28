import type { ReactNode } from 'react';
import { Percent, TrendingUp, Wallet } from 'lucide-react';
import { BalancePieChart } from '@/components/islands/Charts';
import { money, numberFormat } from '@/lib/finance';
import type { FinancialSummary as Summary } from '@/types/finance';

// The head sits on the upper right; the handle extends toward the lower left.
function GavelIcon({ size = 19 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m14 4 6 6-4 4-6-6zM13 3l8 8M9 7l8 8M12 10 3.5 18.5a1.4 1.4 0 0 0 2 2L14 12" />
  </svg>;
}

export function FinancialSummarySection({ id, title, period, note, summary, previous, previousMonth, control }: {
  id: string;
  title: string;
  period: string;
  note: string;
  summary: Summary | null;
  previous?: Summary | null;
  previousMonth?: string;
  control?: ReactNode;
}) {
  const cards = [
    { label: '總資產', english: 'TOTAL ASSETS', value: summary?.assets, previous: previous?.assets, icon: Wallet, className: '' },
    { label: '總負債', english: 'TOTAL LIABILITIES', value: summary?.liabilities, previous: previous?.liabilities, icon: GavelIcon, className: '' },
    { label: '資產淨值', english: 'NET WORTH', value: summary?.netWorth, previous: previous?.netWorth, icon: TrendingUp, className: summary && summary.netWorth < 0 ? 'featured is-negative' : 'featured' },
  ];
  return <section className="summary-section" aria-labelledby={`${id}-heading`}>
    <div className="summary-heading">
      <div><h2 id={`${id}-heading`}>{title}</h2><p className="summary-period">{period}</p><p className="summary-note">{note}</p></div>
      {control}
    </div>
    <div className="summary-layout">
      <div className="metric-grid" aria-label={`${title}數據卡片`}>
        {cards.map(card => <article className={`metric-card ${card.className}`} key={card.label}>
          <div className="metric-heading"><span>{card.label}</span><card.icon size={19} /></div>
          <span className="metric-value">{card.value === undefined ? '—' : <><small>NT$</small>{numberFormat.format(card.value)}</>}</span>
          <div className="metric-bottom">{card.value !== undefined && card.previous !== undefined && previousMonth
            ? <span>較 {previousMonth} <strong>{card.value - card.previous >= 0 ? '+' : ''}{money(card.value - card.previous)}</strong></span>
            : <span>{summary ? (id === 'history' ? '所有有效月份餘額加總' : '此月份的月底餘額') : '等待匯入財務紀錄'}</span>}</div>
          <span className="metric-english">{card.english}</span>
        </article>)}
        <article className="metric-card">
          <div className="metric-heading"><span>資產負債比</span><Percent size={19} aria-hidden="true" /></div>
          <span className="metric-value ratio-value">{summary ? summary.debtRatio === null ? '無法計算' : `${summary.debtRatio.toFixed(1)}%` : '—'}</span>
          <div className="ratio-track"><div style={{ width: `${Math.min(100, Math.max(0, summary?.debtRatio ?? 0))}%` }} /></div>
          <div className="metric-bottom">負債 ÷ 資產</div>
          <span className="metric-english">DEBT TO ASSETS</span>
        </article>
      </div>
      <BalancePieChart summary={summary} period={period} />
    </div>
  </section>;
}
