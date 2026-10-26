import { useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Activity, ArrowDownRight, ArrowLeft, ArrowUpRight, BarChart3, CalendarDays, ChevronRight, Download, Layers3, Package, RefreshCw, ShieldCheck, ShoppingBag, Users, Wallet } from 'lucide-react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../lib/api'
import { useAuth } from '../../stores/auth'
import type { Category } from '../../types'
import type { AnalyticsReport, ReportSegment } from '../../types/analytics-report'
import './premium-analytics.css'

const names: Record<string, string> = { pending: 'Создан', awaiting_payment: 'Ожидает оплаты', confirmed: 'Подтверждён', processing: 'В обработке', packed: 'Упакован', shipped: 'Отправлен', delivered: 'Доставлен', completed: 'Завершён', cancelled: 'Отменён', returned: 'Возврат' }
const money = (value: string | number) => Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })
const dateLabel = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dushanbe', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
function initialRange(days = 30) {
  const end = today(), start = new Date(`${end}T12:00:00Z`)
  start.setUTCDate(start.getUTCDate() - days + 1)
  return { start_date: start.toISOString().slice(0, 10), end_date: end }
}
function flatten(items: Category[] = []): Category[] { return items.flatMap(item => [item, ...flatten(item.children)]) }
const tabs = [
  { id: 'overview', name: 'Обзор', icon: Activity }, { id: 'sales', name: 'Продажи', icon: BarChart3 },
  { id: 'products', name: 'Товары и склад', icon: Package }, { id: 'customers', name: 'Покупатели', icon: Users },
  { id: 'orders', name: 'Заказы', icon: ShoppingBag }, { id: 'finance', name: 'Финансы', icon: Wallet },
]

function Delta({ current, previous }: { current: number; previous: number }) {
  if (!previous) return <span className="pa-delta neutral">{current ? 'Нет базы сравнения' : 'Без изменений'}</span>
  const change = (current - previous) / previous * 100
  const Icon = change < 0 ? ArrowDownRight : ArrowUpRight
  return <span className={`pa-delta ${change < 0 ? 'down' : ''}`}><Icon size={13} />{change > 0 ? '+' : ''}{money(change)}% <small>к прошлому периоду</small></span>
}

function SegmentPanel({ title, rows, onSelect }: { title: string; rows: ReportSegment[]; onSelect?: (id: string) => void }) {
  const total = rows.reduce((sum, row) => sum + Number(row.item_value), 0)
  return <section className="pa-panel"><div className="pa-panel-head"><h2>{title}</h2><span>До скидок · TJS</span></div>{rows.length ? <div className="pa-segments">{rows.map((row, index) => <div key={row.id} className="pa-segment"><div><span className="pa-index">{String(index + 1).padStart(2, '0')}</span>{onSelect ? <button onClick={() => onSelect(row.id)}>{row.name}<ChevronRight size={14} /></button> : <strong>{row.name}</strong>}<span>{money(row.item_value)} <small>TJS</small></span></div><meter min={0} max={Math.max(total, 1)} value={Number(row.item_value)} aria-label={row.name} /><small>{row.units} шт. · {total ? money(Number(row.item_value) / total * 100) : 0}% показанных позиций</small></div>)}</div> : <Empty />}</section>
}
function Empty() { return <div className="pa-empty"><Layers3 size={27} strokeWidth={1.2} /><strong>Пока нет данных</strong><span>Выберите другой период или дождитесь заказов.</span></div> }

function StockWatch({ data }: { data: AnalyticsReport }) {
  return <section className="pa-panel"><div className="pa-panel-head"><h2>Требуют внимания</h2><span>{data.products_without_sales} SKU без продаж за период</span></div>{data.low_stock_products.length ? <div className="pa-table-wrap"><table><thead><tr><th>Товар / артикул</th><th>Остаток, шт.</th><th>Действие</th></tr></thead><tbody>{data.low_stock_products.map(product => <tr key={product.id}><td><Link to={`/catalog?q=${encodeURIComponent(product.sku)}`}>{product.name}<small>{product.sku}</small></Link></td><td><span className="pa-stock-badge low">{product.stock}</span></td><td>{product.stock > 0 ? 'Запланировать пополнение' : 'Нет в наличии'}</td></tr>)}</tbody></table></div> : <p className="pa-footnote">Нет товаров с остатком 5 шт. и менее.</p>}<p className="pa-footnote">До 50 товаров с наименьшим текущим остатком. «Без продаж» означает отсутствие позиций в действующих заказах периода, включая черновики и архив каталога.</p></section>
}

function OrderJourney({ data }: { data: AnalyticsReport }) {
  const stages = ['confirmed', 'processing', 'packed', 'shipped', 'delivered', 'completed']
  return <section className="pa-panel"><div className="pa-panel-head"><h2>Путь заказа</h2><span>По истории переходов</span></div><div className="pa-status-row"><span>Созданы</span><meter min={0} max={Math.max(data.current.orders, 1)} value={data.current.orders} aria-label="Созданные заказы" /><strong>{data.current.orders}</strong></div>{stages.map(status => {
    const reached = data.reached_stages.find(row => row.status === status)
    const hours = data.processing_hours[status]
    return <div className="pa-status-row" key={status}><span>{names[status]}<small style={{ display: 'block', color: '#8292a7', marginTop: 5 }}>{hours == null ? 'Нет времени перехода' : `В среднем ${money(hours)} ч от создания`}</small></span><meter min={0} max={Math.max(data.current.orders, 1)} value={reached?.count || 0} aria-label={names[status]} /><strong>{reached?.count || 0}</strong></div>
  })}<p className="pa-footnote">Уникальные заказы выбранной когорты, достигшие этапа согласно сохранённой истории. Считаются переходы за всё время жизни заказа; пропущенные этапы не восстанавливаются. Оплаченные заказы не определяются по статусу доставки.</p></section>
}

function exportCsv(report: AnalyticsReport) {
  const rows = [['date', 'order_value_TJS', 'previous_order_value_TJS', 'orders', 'timezone'], ...report.series.map(row => [row.date, row.order_value, row.previous_order_value, row.orders, report.timezone])]
  const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a'); a.href = url; a.download = `analytics-${report.start_date}-${report.end_date}-${report.grain}.csv`; a.click(); URL.revokeObjectURL(url)
}

export default function PremiumAnalytics({ embedded = false }: { embedded?: boolean }) {
  const { user, initialized } = useAuth()
  const allowed = Boolean(user && ['admin', 'super_admin', 'manager', 'order_manager'].includes(user.role))
  const [tab, setTab] = useState('overview')
  const [range, setRange] = useState(initialRange)
  const [draft, setDraft] = useState(range)
  const [grain, setGrain] = useState<'day' | 'week' | 'month'>('day')
  const [compare, setCompare] = useState(true)
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<'units' | 'item_value' | 'stock'>('units')
  const [dateError, setDateError] = useState('')
  const gradient = useId().replaceAll(':', '')
  const report = useQuery({ queryKey: ['analytics-report', range, grain, category, user?.id], queryFn: () => api.get<AnalyticsReport>('/admin/analytics/report', { ...range, grain, category_id: category || undefined, timezone: 'Asia/Dushanbe' }), enabled: initialized && allowed, retry: false })
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/catalog/categories'), enabled: allowed })
  const data = report.data
  const chart = useMemo(() => data?.series.map(row => ({ ...row, order_value: Number(row.order_value), previous_order_value: Number(row.previous_order_value) })) || [], [data])
  const products = useMemo(() => [...(data?.products || [])].sort((a, b) => Number(b[sort]) - Number(a[sort])), [data, sort])
  function preset(days: number) { const next = initialRange(days); setRange(next); setDraft(next); setDateError('') }
  if (!initialized) return <div className="pa-root"><div className="pa-loading skeleton" role="status" aria-label="Загрузка сессии" /></div>
  if (!allowed) return <div className="pa-root pa-access"><ShieldCheck size={40} /><h1>Аналитика магазина</h1><p>Для просмотра необходимо право доступа к статистике.</p><Link to={user ? '/' : '/login'}>{user ? 'На главную' : 'Войти в аккаунт'} <ArrowUpRight size={16} /></Link></div>

  return <div className={`pa-root ${embedded ? 'pa-embedded' : ''}`}>
    {!embedded && <aside className="pa-sidebar"><Link to="/" className="pa-logo"><span>AU</span><div>AUTO UNIVERSE<small>COMMERCE INTELLIGENCE</small></div></Link><div className="pa-workspace"><span className="pa-workspace-icon"><Layers3 size={17} /></span><div>Центр управления<small>Таджикистан · TJS</small></div></div><span className="pa-nav-label">АНАЛИТИКА</span><nav aria-label="Разделы аналитики">{tabs.map(({ id, name, icon: Icon }) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><Icon size={18} />{name}{tab === id && <span />}</button>)}</nav><Link className="pa-admin-link" to="/admin"><ShoppingBag size={17} />Управление магазином<ArrowUpRight size={14} /></Link><div className="pa-sidebar-bottom"><ShieldCheck size={17} /><div>Данные из базы<small>Расчёт по записям базы</small></div></div></aside>}
    <div className="pa-body"><header className="pa-topbar"><div><span>WORKSPACE</span><ChevronRight size={14} /><strong>Аналитика</strong></div><div><span className="pa-live-dot" />{report.isFetching ? 'Обновление…' : 'Серверные данные'}<Link to="/admin" aria-label="Вернуться к управлению"><ArrowLeft size={16} /></Link></div></header>
      <main className="pa-main"><div className="pa-title"><div><span className="pa-eyebrow">THE BIG PICTURE</span><h1>{tabs.find(item => item.id === tab)?.name}<span> магазина</span></h1><p>Понимайте движение бизнеса. От заказа до каждой детали.</p></div><div className="pa-title-actions"><button onClick={() => void report.refetch()} disabled={report.isFetching} aria-label="Обновить аналитику"><RefreshCw size={16} /></button><button className="pa-export" disabled={!data || report.isFetching} onClick={() => data && exportCsv(data)}><Download size={15} />Экспорт CSV</button></div></div>
      {embedded && <nav className="pa-mobile-tabs" aria-label="Разделы аналитики">{tabs.map(item => <button key={item.id} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.name}</button>)}</nav>}
      {!embedded && <nav className="pa-mobile-tabs pa-only-mobile" aria-label="Разделы аналитики">{tabs.map(item => <button key={item.id} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.name}</button>)}</nav>}
      <div className="pa-filters"><div className="pa-presets">{[7, 30, 90].map(days => <button key={days} onClick={() => preset(days)}>{days} дней</button>)}</div><form onSubmit={event => { event.preventDefault(); const days = (Date.parse(draft.end_date) - Date.parse(draft.start_date)) / 86400000; if (!Number.isFinite(days) || days < 0 || days >= 366) { setDateError('Выберите период от 1 до 366 дней.'); return } setDateError(''); setRange(draft) }}><CalendarDays size={15} /><label><span className="sr-only">Начало периода</span><input type="date" required value={draft.start_date} onChange={event => setDraft({ ...draft, start_date: event.target.value })} /></label><span>—</span><label><span className="sr-only">Конец периода</span><input type="date" required value={draft.end_date} onChange={event => setDraft({ ...draft, end_date: event.target.value })} /></label><button type="submit">Применить</button></form><label className="pa-category"><span className="sr-only">Категория заказов</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="">Все категории</option>{flatten(categories.data).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
      {dateError && <p className="pa-error" role="alert">{dateError}</p>}
      <div className="pa-context"><span>Asia/Dushanbe · UTC+5</span><span>{range.start_date} — {range.end_date}</span>{category && <button onClick={() => setCategory('')}>Заказы с выбранной категорией ×</button>}</div>
      {report.isPending && <div className="pa-kpis" aria-label="Загрузка аналитики">{[0, 1, 2, 3].map(i => <div className="pa-loading skeleton" key={i} />)}</div>}
      {report.isError && <div className="pa-error" role="alert"><h2>Не удалось загрузить данные</h2><p>{report.error.message}</p><button onClick={() => void report.refetch()}>Повторить</button></div>}
      {data && <><div className="pa-kpis">{[
        { label: 'Стоимость заказов', value: data.current.order_value, previous: data.previous.order_value, unit: 'TJS', icon: Wallet },
        { label: 'Всего заказов', value: data.current.orders, previous: data.previous.orders, icon: ShoppingBag },
        { label: 'Средний чек', value: data.current.average_order_value, previous: data.previous.average_order_value, unit: 'TJS', icon: BarChart3 },
        { label: 'Покупатели', value: data.current.buyers, previous: data.previous.buyers, icon: Users },
      ].map(({ label, value, previous, unit, icon: Icon }, i) => <article className={`pa-kpi ${i === 0 ? 'pa-kpi-featured' : ''}`} key={label}><div><span>{label}</span><Icon size={17} /></div><strong>{money(value)}<small>{unit}</small></strong><Delta current={Number(value)} previous={Number(previous)} /></article>)}</div>
      <p className="pa-footnote">Стоимость заказов включает доставку и вычитает скидки; отмены и возвраты исключены. Это не подтверждённая оплата.{category && ' Показаны полные суммы заказов, содержащих выбранную категорию.'}</p>
      {['overview', 'sales', 'finance'].includes(tab) && <div className="pa-chart-grid"><section className="pa-panel pa-chart-panel"><div className="pa-panel-head"><div><span className="pa-eyebrow">ORDER VALUE</span><h2>Динамика стоимости заказов</h2></div><div className="pa-grain" aria-label="Масштаб графика">{(['day', 'week', 'month'] as const).map((value, index) => <button aria-pressed={grain === value} key={value} onClick={() => setGrain(value)}>{['День', 'Неделя', 'Месяц'][index]}</button>)}</div></div><div className="pa-chart-meta"><strong>{money(data.current.order_value)} <small>TJS</small></strong><label><input type="checkbox" checked={compare} onChange={event => setCompare(event.target.checked)} /> Сравнить с прошлым периодом</label></div><div className="pa-chart" role="img" aria-label="График стоимости заказов в TJS. Таблица данных ниже."><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chart} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} accessibilityLayer><defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#cbd5df" stopOpacity={0.22} /><stop offset="95%" stopColor="#cbd5df" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#2a2e35" strokeDasharray="3 5" /><XAxis dataKey="date" tickFormatter={dateLabel} minTickGap={40} tick={{ fill: '#9099a5', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={value => money(value)} tick={{ fill: '#9099a5', fontSize: 11 }} axisLine={false} tickLine={false} width={65} /><Tooltip labelFormatter={value => dateLabel(String(value))} formatter={(value, name) => [`${money(Number(value))} TJS`, name === 'order_value' ? 'Выбранный период' : 'Предыдущий период (по смещению)']} contentStyle={{ background: '#20252d', border: '1px solid #57616e', borderRadius: 8, color: '#f2f4f7', fontSize: 12 }} /><Area type="monotone" dataKey="order_value" stroke="#e1e7ee" strokeWidth={2.5} fill={`url(#${gradient})`} isAnimationActive={false} />{compare && <Line type="monotone" dataKey="previous_order_value" stroke="#7b8999" strokeWidth={1.5} strokeDasharray="4 5" dot={false} isAnimationActive={false} />}</ComposedChart></ResponsiveContainer></div><div className="pa-chart-caption"><span><i />Выбранный период</span>{compare && <span><i />{data.previous_start_date} — {data.previous_end_date}</span>}<span>TJS / {grain === 'day' ? 'день' : grain === 'week' ? 'неделя' : 'месяц'}</span></div><details className="pa-data"><summary>Данные графика</summary><div className="pa-table-wrap"><table><thead><tr><th>Период</th><th>Стоимость, TJS</th><th>Предыдущий, TJS</th><th>Заказы</th></tr></thead><tbody>{data.series.map(row => <tr key={row.date}><td>{row.date}</td><td>{money(row.order_value)}</td><td>{money(row.previous_order_value)}</td><td>{row.orders}</td></tr>)}</tbody></table></div></details></section><section className="pa-panel pa-pulse"><span className="pa-eyebrow">BUSINESS PULSE</span><h2>В деталях</h2><div className="pa-pulse-total"><Package size={28} strokeWidth={1} /><strong>{money(data.current.units)}<small>деталей в заказах</small></strong></div>{[
        ['Заказы без отмен и возвратов', data.current.valid_orders], ['Повторные покупатели', data.current.repeat_buyers], ['Отмены', data.current.cancelled], ['Возвращённые заказы', data.current.returned],
      ].map(([label, value]) => <div className="pa-stat-line" key={label}><span>{label}</span><strong>{value}</strong></div>)}<p>Повторный покупатель имел заказ до начала выбранного периода.</p></section></div>}
      {['overview', 'sales'].includes(tab) && <div className="pa-two-columns"><SegmentPanel title="Продажи по категориям" rows={data.categories} onSelect={setCategory} /><SegmentPanel title="Продажи по брендам" rows={data.brands} /></div>}
      {['overview', 'products'].includes(tab) && <><section className="pa-stock-strip">{[['В наличии, SKU', data.stock.in_stock], ['Критический остаток, SKU', data.stock.low_stock], ['Нет в наличии, SKU', data.stock.out_of_stock], ['Всего деталей, шт.', data.stock.total_units]].map(([name, value]) => <div key={name}><span>{name}</span><strong>{money(value)}</strong></div>)}</section><section className="pa-panel"><div className="pa-panel-head"><div><span className="pa-eyebrow">PRODUCT PERFORMANCE</span><h2>Лидеры продаж</h2></div><label>Сортировать <select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="units">По количеству</option><option value="item_value">По стоимости</option><option value="stock">По остатку</option></select></label></div>{products.length ? <div className="pa-table-wrap"><table><thead><tr><th>Товар / артикул</th><th>Заказано, шт.</th><th>Стоимость до скидок, TJS</th><th>Остаток, шт.</th></tr></thead><tbody>{products.map((product, i) => <tr key={product.id}><td><span className="pa-index">{String(i + 1).padStart(2, '0')}</span><Link to={`/catalog?q=${encodeURIComponent(product.sku)}`}>{product.name}<small>{product.sku}</small></Link></td><td>{product.units}</td><td>{money(product.item_value)}</td><td><span className={`pa-stock-badge ${product.stock <= 5 ? 'low' : ''}`}>{product.stock}</span></td></tr>)}</tbody></table></div> : <Empty />}<p className="pa-footnote">До 50 товаров по объёму продаж. Остатки — на текущий момент; критический порог — 5 шт.</p></section></>}
      {tab === 'customers' && <section className="pa-panel"><div className="pa-panel-head"><h2>Покупатели периода</h2><Users size={20} /></div><div className="pa-stock-strip"><div><span>С первым заказом в периоде</span><strong>{data.current.buyers - data.current.repeat_buyers}</strong></div><div><span>Покупали ранее</span><strong>{data.current.repeat_buyers}</strong></div><div><span>Заказов на покупателя</span><strong>{data.current.buyers ? money(data.current.valid_orders / data.current.buyers) : '—'}</strong></div><div><span>Стоимость на покупателя, TJS</span><strong>{data.current.buyers ? money(Number(data.current.order_value) / data.current.buyers) : '—'}</strong></div></div><p className="pa-footnote">Учитываются покупатели с заказами без отмен и возвратов. Когортное удержание и RFM ещё не реализованы; эти показатели не заменяются демографическими предположениями.</p></section>}
      {tab === 'orders' && <section className="pa-panel"><div className="pa-panel-head"><h2>Распределение по текущему статусу</h2><span>Текущее состояние</span></div>{data.statuses.length ? data.statuses.map(row => <div className="pa-status-row" key={row.status}><span>{names[row.status] || row.status}</span><meter min={0} max={Math.max(data.current.orders, 1)} value={row.count} aria-label={names[row.status] || row.status} /><strong>{row.count}</strong></div>) : <Empty />}<p className="pa-footnote">Когорта сформирована по дате создания заказа. Ниже показаны сохранённые переходы и время до этапов.</p></section>}
      {tab === 'finance' && <section className="pa-panel"><div className="pa-panel-head"><h2>Финансовые составляющие заказов</h2><span>TJS</span></div>{[['Скидки и списанные бонусы', data.current.discounts], ['Доставка в действующих заказах', data.current.shipping], ['Стоимость возвращённых заказов', data.current.returned_order_value]].map(([label, value]) => <div className="pa-stat-line" key={label}><span>{label}</span><strong>{money(value)} TJS</strong></div>)}<p className="pa-footnote">Стоимость возвращённых заказов не подтверждает перечисление возврата. Период относится к созданию заказа, а не дате возврата.</p></section>}
      {tab === 'products' && <StockWatch data={data} />}
      {tab === 'orders' && <OrderJourney data={data} />}
      <details className="pa-methodology"><summary><ShieldCheck size={16} />Методика и доступность данных<ChevronRight size={15} /></summary><p>Источник: orders, order_items, order_status_history, products, categories, brands. Денежные итоги только в TJS. Период включает обе выбранные даты по Душанбе. Сравнение — с непосредственно предшествующим периодом той же длины. Недельные интервалы начинаются в понедельник, крайние интервалы могут быть неполными.</p>{Object.values(data.unavailable).map(reason => <p key={reason}>{reason}</p>)}<p>Детальная методика: docs/ANALYTICS_METRICS.md в проекте.</p></details>
      <footer className="pa-footer"><span>AUTO UNIVERSE / INTELLIGENCE</span><span>Из базы данных · {data.currency} · {data.timezone}</span></footer></>}
      </main></div>
  </div>
}
