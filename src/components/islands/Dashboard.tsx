import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, BarChart3, CalendarDays, Check, ChevronRight, CircleHelp, FileSpreadsheet, FolderOpen, LayoutDashboard, LockKeyhole, Plus, ShieldCheck, Trash2, TrendingUp, UploadCloud, Wallet } from 'lucide-react';
import ImportWorker from '@/lib/import.worker?worker';
import { Modal } from '@/components/common/Modal';
import { CategoryChart, TrendChart } from '@/components/islands/Charts';
import { categoryColors, categoryLabels } from '@/config/site.config';
import { categories, emptyData, mergeImports, money, monthLabel, numberFormat, totals, trendData } from '@/lib/finance';
import { clearData, loadData, saveData } from '@/lib/storage';
import type { Category, ImportResult, StoredData } from '@/types/finance';

function parseInWorker(file: File): Promise<ImportResult> {
  const id = crypto.randomUUID();
  const failure = (message: string): ImportResult => ({ id, source: file.name, months: [], errors: [message], notes: [] });
  if (!file.name.toLowerCase().endsWith('.xlsx')) return Promise.resolve(failure('僅支援 .xlsx 檔案。'));
  if (file.size > 10 * 1024 * 1024) return Promise.resolve(failure('單一檔案不可超過 10 MB。'));
  return new Promise(resolve => {
    let worker: Worker;
    try { worker = new ImportWorker(); }
    catch { resolve(failure('無法啟動檔案解析，請確認瀏覽器支援 Web Worker。')); return; }
    const finish = (result: ImportResult) => { clearTimeout(timeout); worker.terminate(); resolve(result); };
    const timeout = window.setTimeout(() => finish(failure('解析逾時，請確認檔案內容或減少資料量。')), 20000);
    worker.onmessage = (event: MessageEvent<ImportResult>) => finish(event.data);
    worker.onerror = () => finish(failure('解析失敗，請確認檔案完整且沒有加密。'));
    file.arrayBuffer().then(buffer => worker.postMessage({ buffer, source: file.name, id }, [buffer])).catch(() => finish(failure('無法讀取檔案，請重新選取。')));
  });
}

export function Dashboard() {
  const [data, setData] = useState<StoredData>(emptyData);
  const [ready, setReady] = useState(false);
  const [writable, setWritable] = useState(true);
  const [warning, setWarning] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [help, setHelp] = useState(false);
  const [tab, setTab] = useState<'overview' | 'accounts' | 'insurance'>('overview');
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try { const loaded = loadData(window.localStorage); setData(loaded.data); setWarning(loaded.warning); setWritable(loaded.writable); }
    catch { setWarning('瀏覽器禁止本機儲存，目前僅使用記憶體；關閉頁面後資料會消失。'); setWritable(false); }
    setReady(true);
  }, []);
  function commit(next: StoredData) {
    setData(next);
    if (!writable) return;
    try { setWarning(saveData(window.localStorage, next)); }
    catch { setWarning('本機保存失敗，目前資料僅保留於本次頁面。'); }
  }
  async function importFiles(files: File[]) {
    if (busyRef.current || !files.length) return;
    if (files.length > 20) { setMessage('一次最多匯入 20 份檔案，請分批操作。'); return; }
    busyRef.current = true; setBusy(true); setMessage('正在裝置上解析檔案…');
    try {
      const parsed: ImportResult[] = [];
      for (const file of files) parsed.push(await parseInWorker(file));
      setResults(parsed);
      setChosen(parsed.filter(result => !result.errors.length && (result.months.length || result.insurance)).map(result => result.id));
      setMessage('解析完成，請檢查匯入預覽。');
    } finally { busyRef.current = false; setBusy(false); }
  }
  const current = data.months.find(item => item.month === data.preferences.month) ?? data.months.at(-1);
  const summary = current ? totals(current) : null;
  const previous = current ? data.months.filter(item => item.month < current.month).at(-1) : undefined;
  const previousSummary = previous ? totals(previous) : null;
  const insurance = data.insurance.find(item => item.id === data.preferences.insuranceId) ?? data.insurance.at(-1);
  const insuranceCounts = ['人壽保險', '產物保險', '政府保險'].map((name, index) => ({ name, value: insurance?.records.filter(item => item.category === name).length ?? 0, color: ['#177b69', '#80a18c', '#c18660'][index] }));
  const period = data.months.length ? `${data.months[0].month} — ${data.months.at(-1)?.month}` : '尚未建立財務紀錄';
  const selectedResults = results?.filter(result => chosen.includes(result.id)) ?? [];
  const projected = mergeImports(data, selectedResults);
  const addedMonths = projected.months.length - data.months.length;
  const addedInsurance = projected.insurance.length - data.insurance.length;
  const occupied = new Set(data.months.map(item => item.month));
  const chartRows = (keys: Category[]) => keys.map(key => ({ name: categoryLabels[key], value: summary?.grouped[key] ?? 0, color: categoryColors[key] }));
  function chooseFiles() { inputRef.current?.click(); }
  function clearAll() {
    let error = '';
    try { error = clearData(window.localStorage); } catch { error = '無法清除本機紀錄，請允許瀏覽器儲存權限後重試。'; }
    if (error) { setWarning(error); setConfirmClear(false); return; }
    setData(emptyData()); setWarning(''); setWritable(true); setResults(null); setChosen([]); setTab('overview'); setFilter('all'); setConfirmClear(false); setMessage('已清除所有財務與保險紀錄。');
    if (inputRef.current) inputRef.current.value = '';
  }
  const cards = [
    { label: '總資產', english: 'TOTAL ASSETS', value: summary?.assets, previous: previousSummary?.assets, icon: Wallet, className: '' },
    { label: '總負債', english: 'TOTAL LIABILITIES', value: summary?.liabilities, previous: previousSummary?.liabilities, icon: ArrowDownToLine, className: '' },
    { label: '資產淨值', english: 'NET WORTH', value: summary?.netWorth, previous: previousSummary?.netWorth, icon: TrendingUp, className: 'featured' },
  ];
  return <>
    <header className="site-header"><div className="header-inner">
      <a href="#main" className="brand"><span className="brand-mark"><BarChart3 size={23} /></span><span>家計<span className="brand-en">FINANCIAL DASHBOARD</span></span></a>
      <div className="header-actions"><span className="privacy-tag"><span className="status-dot" />資料只在你的裝置</span><button className="icon-button" onClick={() => setHelp(true)} aria-label="使用說明"><CircleHelp size={20} /></button></div>
    </div></header>
    <main id="main" className={`dashboard-shell ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); if (event.dataTransfer.types.includes('Files')) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); if (ready) void importFiles(Array.from(event.dataTransfer.files)); }}>
      <input ref={inputRef} type="file" accept=".xlsx" multiple className="sr-only" tabIndex={-1} aria-label="選擇 Excel 檔案" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void importFiles(files); }} />
      <section className="page-heading">
        <div><div className="eyebrow">YOUR MONEY, IN PERSPECTIVE</div><h1>財務全貌，一目瞭然<span className="title-dot">。</span></h1><p>整理每一筆累積，讓下一步更有方向。</p></div>
        <div className="heading-actions"><button className="button secondary" onClick={() => setConfirmClear(true)} disabled={!ready || busy || (!data.months.length && !data.insurance.length && !warning)}><Trash2 size={16} />清除紀錄</button><button className="button primary" disabled={!ready || busy} onClick={chooseFiles}><Plus size={18} />{busy ? '解析中…' : '匯入 Excel'}</button></div>
      </section>
      <div className="privacy-strip"><ShieldCheck size={18} /><span>你的財務，你自己掌握。<span className="privacy-detail">檔案不會上傳，解析後的資料僅儲存在此瀏覽器。</span></span><span className="local-label">LOCAL ONLY</span></div>
      {warning && <div className="notice warning" role="alert">{warning}</div>}
      <div className="live-message" role="status" aria-live="polite">{message}</div>
      <div className="toolbar"><nav aria-label="報表檢視" className="tabs">{([{ key: 'overview', label: '財務總覽', icon: LayoutDashboard }, { key: 'accounts', label: '帳戶明細', icon: Wallet }, { key: 'insurance', label: '保險概況', icon: ShieldCheck }] as const).map(item => <button key={item.key} aria-current={tab === item.key ? 'page' : undefined} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}><item.icon size={17} />{item.label}</button>)}</nav>
        <label className="month-select"><CalendarDays size={16} /><span className="sr-only">報表月份</span><select value={current?.month ?? ''} disabled={!current} onChange={event => commit({ ...data, preferences: { ...data.preferences, month: event.target.value } })}>{!current && <option value="">選擇月份</option>}{[...data.months].reverse().map(item => <option key={item.month} value={item.month}>{monthLabel(item.month)}</option>)}</select></label>
      </div>
      {tab === 'overview' && <>
        <section className="metric-grid" aria-label="財務摘要">{cards.map(card => <article className={`metric-card ${card.className}`} key={card.label}><div className="metric-heading"><span>{card.label}</span><card.icon size={19} /></div><span className="metric-value">{card.value === undefined ? '—' : <><small>NT$</small>{numberFormat.format(card.value)}</>}</span><div className="metric-bottom">{card.value !== undefined && card.previous !== undefined && previous ? <span>較 {previous.month} <strong>{card.value - card.previous >= 0 ? '+' : ''}{money(card.value - card.previous)}</strong></span> : <span>{current ? '累積更多月份，查看資產變化' : '等待匯入你的第一份紀錄'}</span>}</div><span className="metric-english">{card.english}</span></article>)}<article className="metric-card"><div className="metric-heading"><span>負債占資產</span><BarChart3 size={19} /></div><span className="metric-value">{summary ? summary.debtRatio === null ? '無法計算' : `${summary.debtRatio.toFixed(1)}%` : '—'}</span><div className="ratio-track"><div style={{ width: `${Math.min(100, Math.max(0, summary?.debtRatio ?? 0))}%` }} /></div><span className="metric-english">DEBT TO ASSETS</span></article></section>
        {!current && <section className="upload-panel">
          <div className="upload-copy"><span className="section-kicker">從一份紀錄開始</span><h2>讓你的 Excel，<br />變成看得懂的財務全貌。</h2><p>匯入家庭資產負債表，將每月餘額整理為圖表。<br className="desktop-break" />多份年度紀錄，也能串起長期的資產變化。</p><div className="upload-features"><span><Check size={15} />支援多份檔案</span><span><Check size={15} />不需註冊帳號</span></div></div>
          <div className="drop-target"><div className="file-icon"><FileSpreadsheet size={32} strokeWidth={1.4} /></div><h3>{busy ? '正在解析你的檔案…' : '將 Excel 拖曳至這裡'}</h3><p>或從你的裝置選擇檔案</p><button className="button primary" disabled={!ready || busy} onClick={chooseFiles}><UploadCloud size={17} />選擇 Excel 檔案<ArrowRight size={16} /></button><small>.xlsx 格式 · 每份上限 10 MB · 每次最多 20 份</small></div>
        </section>}
        <section className="panel trend-panel"><div className="panel-heading"><div><h2>資產變化趨勢</h2><p>{current ? `${period} · ${data.months.length} 個月份的累積` : '讓每個月的努力，都有跡可循'}</p></div><div className="chart-legend"><span><i style={{ background: '#177b69' }} />總資產</span><span><i style={{ background: '#80a18c' }} />淨值</span><span><i style={{ background: '#c18660' }} />總負債</span></div></div>
          {current ? <><TrendChart months={data.months} /><details className="data-details"><summary>查看圖表資料表</summary><div className="table-scroll"><table><caption className="sr-only">每月資產、負債與淨值</caption><thead><tr><th>年月</th><th>總資產</th><th>總負債</th><th>淨值</th></tr></thead><tbody>{trendData(data.months).map(row => <tr key={row.month}><td>{row.month}</td><td>{row.assets === null ? '無紀錄' : money(row.assets)}</td><td>{row.liabilities === null ? '無紀錄' : money(row.liabilities)}</td><td>{row.netWorth === null ? '無紀錄' : money(row.netWorth)}</td></tr>)}</tbody></table></div></details></> : <div className="empty-chart"><div className="empty-grid" /><div className="empty-chart-copy"><TrendingUp size={26} /><strong>你的財務軌跡，從這裡開始</strong><span>匯入至少一個月份，即可查看趨勢圖</span></div></div>}
        </section>
        <div className="two-columns">{[{ title: '資產配置', subtitle: '每一份資產，各有其位置', keys: categories.slice(0, 3) }, { title: '負債結構', subtitle: '看清負債組成，掌握財務現況', keys: categories.slice(3) }].map(section => <section className="panel" key={section.title}><div className="panel-heading"><div><h2>{section.title}</h2><p>{section.subtitle}</p></div><span className="unit-label">TWD</span></div>{summary ? <><CategoryChart data={chartRows(section.keys)} /><dl className="category-values">{section.keys.map(key => <div key={key}><dt><i style={{ background: categoryColors[key] }} />{categoryLabels[key]}</dt><dd>{money(summary.grouped[key])}</dd></div>)}</dl></> : <div className="small-empty"><BarChart3 size={28} /><p>匯入後，查看{section.title}</p><span>依照 Excel 的資產負債分類自動整理</span></div>}</section>)}</div>
      </>}
      {tab === 'accounts' && <section className="panel"><div className="panel-heading"><div><h2>帳戶明細</h2><p>{current ? `${monthLabel(current.month)} · 來源：${current.source}` : '按月份查看各帳戶的餘額與用途'}</p></div><label><span className="sr-only">篩選分類</span><select className="select" value={filter} onChange={event => setFilter(event.target.value as Category | 'all')}><option value="all">所有分類</option>{categories.map(key => <option key={key} value={key}>{categoryLabels[key]}</option>)}</select></label></div>{current ? <div className="table-scroll"><table><caption className="sr-only">帳戶分類、用途與金額</caption><thead><tr><th>類型</th><th>帳戶</th><th>功能</th><th>目標／用途</th><th className="numeric">金額（TWD）</th></tr></thead><tbody>{current.accounts.filter(account => filter === 'all' || account.category === filter).map(account => <tr key={account.id}><td><span className="category-tag">{categoryLabels[account.category]}</span></td><th scope="row">{account.account}</th><td>{account.purpose || '—'}</td><td>{account.goal || '—'}</td><td className="numeric">{money(account.amount)}</td></tr>)}</tbody></table></div> : <EmptySection onImport={chooseFiles} disabled={!ready || busy} text="尚無帳戶資料" />}</section>}
      {tab === 'insurance' && <section className="panel"><div className="panel-heading insurance-heading"><div><h2>保險概況</h2><p>依來源檔案獨立保存，保費以原始填寫金額呈現。</p></div>{insurance && <label><span className="sr-only">保險來源檔案</span><select className="select insurance-select" value={insurance.id} onChange={event => commit({ ...data, preferences: { ...data.preferences, insuranceId: event.target.value } })}>{data.insurance.map((snapshot, index) => <option key={snapshot.id} value={snapshot.id}>{index + 1}. {snapshot.source}</option>)}</select></label>}</div>{insurance ? <><div className="insurance-summary"><div><span className="section-kicker">已填寫的保障紀錄</span><strong>{insurance.records.length}<small>筆</small></strong><p>保費週期未定義，不加總、不年化。</p></div><CategoryChart data={insuranceCounts} count /><dl className="category-values">{insuranceCounts.map(item => <div key={item.name}><dt>{item.name}</dt><dd>{item.value} 筆</dd></div>)}</dl></div>{insuranceCounts.filter(item => item.value > 0).map(group => { const records = insurance.records.filter(record => record.category === group.name); const fields = [...new Set(records.flatMap(record => Object.keys(record.fields)))]; return <div className="insurance-group" key={group.name}><h3>{group.name}<span>{records.length} 筆紀錄</span></h3><div className="table-scroll"><table><caption className="sr-only">{group.name}原始保單明細</caption><thead><tr><th>種類</th>{group.name === '人壽保險' && <th>保單區段</th>}{fields.map(field => <th key={field}>{field === '保費' ? '保費（原始金額）' : field}</th>)}</tr></thead><tbody>{records.map((record, index) => <tr key={index}><th scope="row">{record.kind}</th>{group.name === '人壽保險' && <td>{record.holder || '—'}</td>}{fields.map(field => <td key={field}>{record.fields[field] || '—'}</td>)}</tr>)}</tbody></table></div></div>; })}</> : <EmptySection onImport={chooseFiles} disabled={!ready || busy} text="尚無已填寫的保險紀錄" />}</section>}
      <section className="bottom-guide"><div className="guide-icon"><FolderOpen size={21} /></div><div><h3>把每個月，串成更長遠的視野。</h3><p>可持續加入不同年份的 Excel；重複月份會保留原紀錄，不覆蓋既有資料。</p></div><button className="text-button" onClick={() => setHelp(true)}>了解匯入規則<ChevronRight size={16} /></button></section>
      <footer className="footer"><span>家計 <span className="footer-divider">/</span> 把財務整理好，把生活留給自己。</span><span><LockKeyhole size={13} />本機儲存 · 無帳號 · 無雲端上傳</span></footer>
    </main>
    {results && <Modal title="確認匯入資料" onClose={() => setResults(null)}><p className="modal-description">依下列順序匯入；重複月份保留原紀錄。取消勾選即可略過整份檔案。</p><div className="import-results">{results.map(result => { const selected = chosen.includes(result.id); const months = result.months.map(month => { const duplicate = occupied.has(month.month); if (selected && !result.errors.length) occupied.add(month.month); return { month: month.month, duplicate }; }); return <article className="import-result" key={result.id}><label className="file-choice"><input type="checkbox" checked={selected} disabled={!!result.errors.length || (!result.months.length && !result.insurance)} onChange={event => setChosen(previous => event.target.checked ? [...previous, result.id] : previous.filter(id => id !== result.id))} /><FileSpreadsheet size={18} /><strong>{result.source}</strong></label>{result.errors.map(error => <p className="error-text" key={error}>{error}</p>)}<div className="month-chips">{months.map(item => <span className={item.duplicate ? 'skipped' : ''} key={item.month}>{item.month}{item.duplicate ? ' · 重複略過' : ' · 可匯入'}</span>)}</div>{result.insurance && <p>保險概況：{result.insurance.records.length} 筆，獨立保存。</p>}{result.notes.length > 0 && <details open={!result.months.length && !result.insurance}><summary>解析說明（{result.notes.length}）</summary><ul>{result.notes.map(note => <li key={note}>{note}</li>)}</ul></details>}</article>; })}</div><div className="modal-actions"><span>新增 {addedMonths} 個月份、{addedInsurance} 份保險快照</span><button className="button secondary" onClick={() => setResults(null)}>取消</button><button className="button primary" disabled={!addedMonths && !addedInsurance} onClick={() => { commit(projected); setResults(null); setMessage(`已載入 ${addedMonths} 個月份與 ${addedInsurance} 份保險快照。`); if (!projected.months.length && addedInsurance) setTab('insurance'); }}>確認匯入<ArrowRight size={16} /></button></div></Modal>}
    {confirmClear && <Modal title="清除所有紀錄？" onClose={() => setConfirmClear(false)}><p className="modal-description">這會清除此瀏覽器中的所有財務月份、保險快照與檢視設定。你的原始 Excel 檔案不受影響，之後可重新匯入。</p><div className="modal-actions"><button className="button secondary" onClick={() => setConfirmClear(false)}>保留紀錄</button><button className="button danger" onClick={clearAll}><Trash2 size={16} />確認清除</button></div></Modal>}
    {help && <Modal title="讓紀錄順利成為報表" onClose={() => setHelp(false)}><ol className="help-list"><li><strong>使用相同格式的資產負債表</strong><p>保留「資產負債」工作表名稱、西元年份、月份與五大分類。可調整帳戶名稱及在分類內新增明細列。</p></li><li><strong>每個月份填寫月底餘額</strong><p>全空白月份略過；已填月份內的空白帳戶視為零。總資產包含現金，網站從明細重新計算，不使用 Excel 的小計與 Total。</p></li><li><strong>累積年度紀錄，不覆蓋舊月份</strong><p>一次可匯入多份 .xlsx，預覽順序決定重複月份先後。若需修正既有資料，清除紀錄後重新匯入正確檔案。</p></li><li><strong>保險概況獨立保存</strong><p>各檔案的保險快照可切換查看。保費沒有定義繳費週期，因此只顯示原始金額，不換算年度費用。</p></li><li><strong>資料留在這台裝置</strong><p>金額皆以新臺幣呈現，外幣資產請先換算。此頁不傳送你的檔案與財務資料。瀏覽器清除網站資料後，需重新匯入；共用裝置使用完畢可點「清除紀錄」。</p></li></ol><button className="button primary" onClick={() => setHelp(false)}>我知道了<Check size={16} /></button></Modal>}
  </>;
}
function EmptySection({ text, onImport, disabled }: { text: string; onImport: () => void; disabled: boolean }) {
  return <div className="section-empty"><FileSpreadsheet size={36} strokeWidth={1.3} /><h3>{text}</h3><p>匯入已填寫的 Excel，即可在這裡查看。</p><button className="button primary" onClick={onImport} disabled={disabled}><Plus size={17} />匯入 Excel</button></div>;
}
