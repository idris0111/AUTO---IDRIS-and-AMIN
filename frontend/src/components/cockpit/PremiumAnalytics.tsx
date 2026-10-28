import { useEffect, useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Sun, Moon, PanelLeftClose, PanelLeftOpen, Search, Activity, ArrowDownRight, ArrowLeft, ArrowUpRight, BarChart3, CalendarDays, ChevronRight, Clock3, Download, Layers3, Package, RefreshCw, ShieldCheck, ShoppingBag, Users, Wallet } from 'lucide-react'
import { Bar, BarChart, Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../lib/api'
import { useAuth } from '../../stores/auth'
import type { Category } from '../../types'
import type { AnalyticsReport, ReportSegment } from '../../types/analytics-report'
import './premium-analytics.css'
import { useApp } from '../../stores/app'
import { GlassPanel, GlassSidebar, GlassStatCard, GlassTable, GlassChartContainer, GlassSearch } from '../glass/Glass'

const names: Record<string, string> = { pending: 'Создан', awaiting_payment: 'Ожидает оплаты', confirmed: 'Подтверждён', processing: 'В обработке', packed: 'Упакован', shipped: 'Отправлен', delivered: 'Доставлен', completed: 'Завершён', cancelled: 'Отменён', returned: 'Возврат' }
const money = (value: string | number) => Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })
const dateLabel = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dushanbe', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
function initialRange(days = 30) {
  const end = today(), start = new Date(`${end}T12:00:00Z`)
  start.setUTCDate(start.getUTCDate() - days + 1)
  return { start_date: start.toISOString().slice(0, 10), end_date: end }
}
type AnalyticsPreferences = { range: { start_date: string; end_date: string }; grain: 'day' | 'week' | 'month'; comparison: 'previous_period' | 'previous_year'; compare: boolean; category: string; tab: string }
function readAnalyticsPreferences(): Partial<AnalyticsPreferences> {
  try {
    const value = JSON.parse(localStorage.getItem('au-analytics-preferences') || '{}') as Partial<AnalyticsPreferences>
    const validDate = (date: unknown) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))
    const span = value.range && validDate(value.range.start_date) && validDate(value.range.end_date)
      ? (Date.parse(value.range.end_date) - Date.parse(value.range.start_date)) / 86400000
      : -1
    if (!value.range || span < 0 || span >= 366) delete value.range
    if (!['day', 'week', 'month'].includes(value.grain || '')) delete value.grain
    if (!['previous_period', 'previous_year'].includes(value.comparison || '')) delete value.comparison
    if (!['overview', 'sales', 'products', 'customers', 'orders', 'finance'].includes(value.tab || '')) delete value.tab
    if (typeof value.category !== 'string') delete value.category
    if (typeof value.compare !== 'boolean') delete value.compare
    return value
  } catch { return {} }
}
function flatten(items: Category[] = []): Category[] { return items.flatMap(item => [item, ...flatten(item.children)]) }
const tabs = [
  { id: 'overview', name: 'Обзор', icon: Activity }, { id: 'sales', name: 'Продажи', icon: BarChart3 },
  { id: 'products', name: 'Товары и склад', icon: Package }, { id: 'customers', name: 'Покупатели', icon: Users },
  { id: 'orders', name: 'Заказы', icon: ShoppingBag }, { id: 'finance', name: 'Финансы', icon: Wallet },
]

function Delta({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (!previous) return <span className="pa-delta neutral">{current ? 'Нет базы сравнения' : 'Без изменений'}</span>
  const change = (current - previous) / previous * 100
  const Icon = change < 0 ? ArrowDownRight : ArrowUpRight
  return <span className={`pa-delta ${change < 0 ? 'down' : ''}`}><Icon size={13} />{change > 0 ? '+' : ''}{money(change)}% <small>{label}</small></span>
}

function SegmentPanel({ title, rows, onSelect }: { title: string; rows: ReportSegment[]; onSelect?: (id: string) => void }) {
  const total = rows.reduce((sum, row) => sum + Number(row.item_value), 0)
  return <GlassPanel className="pa-panel"><div className="pa-panel-head"><h2>{title}</h2><span>До скидок · TJS</span></div>{rows.length ? <div className="pa-segments">{rows.map((row, index) => <div key={row.id} className="pa-segment"><div><span className="pa-index">{String(index + 1).padStart(2, '0')}</span>{onSelect ? <button onClick={() => onSelect(row.id)}>{row.name}<ChevronRight size={14} /></button> : <strong>{row.name}</strong>}<span>{money(row.item_value)} <small>TJS</small></span></div><meter min={0} max={Math.max(total, 1)} value={Number(row.item_value)} aria-label={row.name} /><small>{row.units} шт. · {total ? money(Number(row.item_value) / total * 100) : 0}% показанных позиций</small></div>)}</div> : <Empty />}</GlassPanel>
}
function Empty() { return <div className="pa-empty"><Layers3 size={27} strokeWidth={1.2} /><strong>Пока нет данных</strong><span>Выберите другой период или дождитесь заказов.</span></div> }

function ActionCenter({ data }: { data: AnalyticsReport }) {
  const urgentStock = data.procurement_signals.filter(item => item.stock <= 5)
  const watchCount = urgentStock.length + data.slow_movers.length + data.stale_orders.length
  return <GlassPanel className="pa-panel pa-action-center">
    <div className="pa-panel-head"><div><span className="pa-eyebrow">СЛЕДУЮЩИЕ ДЕЙСТВИЯ</span><h2>Центр действий</h2></div><span>{watchCount} требуют внимания</span></div>
    <div className="pa-action-columns">
      <div className="pa-action-group"><h3><Package size={16} /> Остаток и скорость продаж <span>{urgentStock.length}</span></h3>
        {data.procurement_signals.length ? <ul>{data.procurement_signals.slice(0, 6).map(item => <li key={item.id}>
          <Link to={`/catalog?q=${encodeURIComponent(item.sku)}`}><strong>{item.name}</strong><small>{item.sku}</small></Link>
          <span className={item.stock <= 5 ? 'pa-action-alert' : ''}>{item.stock} шт.<small>{item.days_cover == null ? 'нет продаж за 30 дней' : `≈ ${money(item.days_cover)} дн. запаса`}</small></span>
        </li>)}</ul> : <p className="pa-action-empty">Срочных сигналов по запасам нет.</p>}
        <p className="pa-footnote">Темп рассчитан по списаниям со склада за 30 дней. Порог внимания — 5 шт.; срок поставки пока не задан, это не точка заказа.</p>
      </div>
      <div className="pa-action-group"><h3><Package size={16} /> Нет продаж за 30 дней <span>{data.slow_movers.length}</span></h3>
        {data.slow_movers.length ? <ul>{data.slow_movers.slice(0, 6).map(item => <li key={item.id}>
          <Link to={`/catalog?q=${encodeURIComponent(item.sku)}`}><strong>{item.name}</strong><small>{item.sku}</small></Link>
          <span>{item.stock} шт.<small>на складе</small></span>
        </li>)}</ul> : <p className="pa-action-empty">Нет складских позиций без продаж за этот период.</p>}
        <p className="pa-footnote">Это отсутствие списаний за 30 дней, а не полная оценка оборачиваемости или срока хранения.</p>
      </div>
      <div className="pa-action-group"><h3><Clock3 size={16} /> Заказы без обновления 48+ ч <span>{data.stale_orders.length}</span></h3>
        {data.stale_orders.length ? <ul>{data.stale_orders.slice(0, 6).map(order => <li key={order.id}>
          <Link to={`/admin?tab=orders&order_id=${encodeURIComponent(order.id)}`}><strong>{order.number}</strong><small>{names[order.status] || order.status}</small></Link>
          <span className="pa-action-alert">{order.idle_hours} ч<small>без обновления</small></span>
        </li>)}</ul> : <p className="pa-action-empty">Нет активных заказов без обновления дольше 48 часов.</p>}
        <p className="pa-footnote">Сигнал основан на времени последнего изменения заказа; проверьте статус и историю перед действием.</p>
      </div>
    </div>
  </GlassPanel>
}

function ReasonPanel({ title, rows }: { title: string; rows: { reason: string; count: number }[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  return <GlassPanel className="pa-panel pa-reasons"><div className="pa-panel-head"><h2>{title}</h2><span>{total} заказов</span></div>{rows.length ? rows.map(row => <div className="pa-status-row" key={row.reason}><span>{row.reason}</span><meter min={0} max={Math.max(total, 1)} value={row.count} aria-label={row.reason} /><strong>{row.count}</strong></div>) : <p className="pa-action-empty">За выбранный период причин пока нет.</p>}</GlassPanel>
}

function StockWatch({ data }: { data: AnalyticsReport }) {
  return <GlassPanel className="pa-panel"><div className="pa-panel-head"><h2>Требуют внимания</h2><span>{data.products_without_sales} SKU без продаж за период</span></div>{data.low_stock_products.length ? <div className="pa-table-wrap"><GlassTable><thead><tr><th>Товар / артикул</th><th>Остаток, шт.</th><th>Действие</th></tr></thead><tbody>{data.low_stock_products.map(product => <tr key={product.id}><td><Link to={`/catalog?q=${encodeURIComponent(product.sku)}`}>{product.name}<small>{product.sku}</small></Link></td><td><span className="pa-stock-badge low">{product.stock}</span></td><td>{product.stock > 0 ? 'Запланировать пополнение' : 'Нет в наличии'}</td></tr>)}</tbody></GlassTable></div> : <p className="pa-footnote">Нет товаров с остатком 5 шт. и менее.</p>}<p className="pa-footnote">До 50 товаров с наименьшим текущим остатком. «Без продаж» означает отсутствие позиций в действующих заказах периода, включая черновики и архив каталога.</p></GlassPanel>
}

function OrderJourney({ data }: { data: AnalyticsReport }) {
  const stages = ['confirmed', 'processing', 'packed', 'shipped', 'delivered', 'completed']
  return <GlassPanel className="pa-panel"><div className="pa-panel-head"><h2>Путь заказа</h2><span>По истории переходов</span></div><div className="pa-status-row"><span>Созданы</span><meter min={0} max={Math.max(data.current.orders, 1)} value={data.current.orders} aria-label="Созданные заказы" /><strong>{data.current.orders}</strong></div>{stages.map(status => {
    const reached = data.reached_stages.find(row => row.status === status)
    const hours = data.processing_hours[status]
    return <div className="pa-status-row" key={status}><span>{names[status]}<small style={{ display: 'block', color: 'var(--text-muted)', marginTop: 5 }}>{hours == null ? 'Нет времени перехода' : `В среднем ${money(hours)} ч от создания`}</small></span><meter min={0} max={Math.max(data.current.orders, 1)} value={reached?.count || 0} aria-label={names[status]} /><strong>{reached?.count || 0}</strong></div>
  })}<p className="pa-footnote">Уникальные заказы выбранной когорты, достигшие этапа согласно сохранённой истории. Считаются переходы за всё время жизни заказа; пропущенные этапы не восстанавливаются. Оплаченные заказы не определяются по статусу доставки.</p></GlassPanel>
}

function exportCsv(report: AnalyticsReport) {
  const rows: (string | number)[][] = [
    ['Отчёт Auto Universe'], ['Период', report.start_date, report.end_date], ['Сравнение', report.comparison === 'previous_year' ? 'Тот же период прошлого года' : 'Предыдущий период', report.previous_start_date, report.previous_end_date], ['Часовой пояс', report.timezone], ['Валюта', report.currency], ['Шаг графика', report.grain], ['Демо-заказы периода', report.demo_orders_in_period], ['Валовая прибыль (симуляция 28%), TJS', report.demo_gross_profit],
    [], ['Сводка', 'Текущий период', 'Предыдущий период'],
    ...([['Стоимость заказов, TJS', report.current.order_value, report.previous.order_value], ['Заказы', report.current.orders, report.previous.orders], ['Действующие заказы', report.current.valid_orders, report.previous.valid_orders], ['Средний чек, TJS', report.current.average_order_value, report.previous.average_order_value], ['Покупатели', report.current.buyers, report.previous.buyers], ['Повторные покупатели', report.current.repeat_buyers, report.previous.repeat_buyers], ['Продано деталей', report.current.units, report.previous.units]] as (string | number)[][]),
    [], ['Динамика', 'Стоимость, TJS', 'Сравнение, TJS', 'Заказы'], ...report.series.map(row => [row.date, row.order_value, row.previous_order_value, row.orders]),
    [], ['Товары', 'Артикул', 'Продано за период', 'Стоимость до скидок, TJS', 'Остаток'], ...report.products.map(row => [row.name, row.sku, row.units, row.item_value, row.stock]),
    [], ['Склад: скорость за 30 дней', 'Артикул', 'Продано за 30 дней', 'Среднее в день', 'Остаток', 'Запас, дней'], ...report.procurement_signals.map(row => [row.name, row.sku, row.sold_30d, row.daily_rate, row.stock, row.days_cover ?? 'Нет продаж']),
    [], ['Нет продаж 30 дней', 'Артикул', 'Остаток'], ...report.slow_movers.map(row => [row.name, row.sku, row.stock]),
    [], ['Заказы без обновления 48+ часов', 'Статус', 'Простой, часов', 'Обновлён'], ...report.stale_orders.map(row => [row.number, names[row.status] || row.status, row.idle_hours, row.updated_at]),
    [], ['Причины отмен', 'Заказы'], ...report.cancellation_reasons.map(row => [row.reason, row.count]),
    [], ['Причины возвратов', 'Заказы'], ...report.return_reasons.map(row => [row.reason, row.count]),
  ]
  const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a'); a.href = url; a.download = `analytics-${report.start_date}-${report.end_date}-${report.grain}.csv`; a.click(); URL.revokeObjectURL(url)
}

export default function PremiumAnalytics({ embedded = false }: { embedded?: boolean }) {
  const { user, initialized } = useAuth()
  const { theme, toggleTheme } = useApp()
  const [collapsed, setCollapsed] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterId = useId()
  const [productSearch, setProductSearch] = useState('')
  const [productPage, setProductPage] = useState(1)
  const allowed = Boolean(user && ['admin', 'super_admin', 'manager', 'order_manager'].includes(user.role))
  const [preferences] = useState(readAnalyticsPreferences)
  const [tab, setTab] = useState(preferences.tab || 'overview')
  const [range, setRange] = useState(() => preferences.range || initialRange())
  const [draft, setDraft] = useState(range)
  const [grain, setGrain] = useState<'day' | 'week' | 'month'>(preferences.grain || 'day')
  const [comparison, setComparison] = useState<'previous_period' | 'previous_year'>(preferences.comparison || 'previous_period')
  const [compare, setCompare] = useState(preferences.compare ?? true)
  const [category, setCategory] = useState(preferences.category || '')
  const [sort, setSort] = useState<'units' | 'item_value' | 'stock'>('units')
  const [dateError, setDateError] = useState('')
  const gradient = useId().replaceAll(':', '')
  const report = useQuery({ queryKey: ['analytics-report', range, grain, comparison, category, user?.id], queryFn: () => api.get<AnalyticsReport>('/admin/analytics/report', { ...range, grain, comparison, category_id: category || undefined, timezone: 'Asia/Dushanbe' }), enabled: initialized && allowed, retry: false })
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/catalog/categories'), enabled: allowed })
  useEffect(() => {
    try { localStorage.setItem('au-analytics-preferences', JSON.stringify({ range, grain, comparison, compare, category, tab })) } catch { /* Storage may be disabled; analytics still works for this visit. */ }
  }, [range, grain, comparison, compare, category, tab])
  const Main = embedded ? 'div' : 'main'
  const data = report.data
  const chart = useMemo(() => data?.series.map(row => ({ ...row, order_value: Number(row.order_value), previous_order_value: Number(row.previous_order_value) })) || [], [data])
  const products = useMemo(() => [...(data?.products || [])].filter(item => `${item.name} ${item.sku}`.toLocaleLowerCase('ru').includes(productSearch.toLocaleLowerCase('ru'))).sort((a, b) => Number(b[sort]) - Number(a[sort])), [data, sort, productSearch])
  const pageCount = Math.max(1, Math.ceil(products.length / 8))
  const activePage = Math.min(productPage, pageCount)
  const visibleProducts = products.slice((activePage - 1) * 8, activePage * 8)
  function preset(days: number) { const next = initialRange(days); setRange(next); setDraft(next); setDateError('') }
  if (!initialized) return <div className="pa-root"><div className="pa-loading skeleton" role="status" aria-label="Загрузка сессии" /></div>
  if (!allowed) return <div className="pa-root pa-access"><ShieldCheck size={40} /><h1>Аналитика магазина</h1><p>Для просмотра необходимо право доступа к статистике.</p><Link to={user ? '/' : '/login'}>{user ? 'На главную' : 'Войти в аккаунт'} <ArrowUpRight size={16} /></Link></div>

  return <div className={`pa-root ${embedded ? 'pa-embedded' : ''} ${collapsed ? 'pa-collapsed' : ''}`}>
    {!embedded && <GlassSidebar className="pa-sidebar"><button className="pa-collapse" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'} aria-expanded={!collapsed}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button><Link to="/" className="pa-logo"><span>AU</span><div>AUTO UNIVERSE<small>COMMERCE INTELLIGENCE</small></div></Link><div className="pa-workspace"><span className="pa-workspace-icon"><Layers3 size={17} /></span><div>Центр управления<small>Таджикистан · TJS</small></div></div><span className="pa-nav-label">АНАЛИТИКА</span><nav aria-label="Разделы аналитики">{tabs.map(({ id, name, icon: Icon }) => <button key={id} title={name} aria-label={name} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><Icon size={18} />{name}{tab === id && <span />}</button>)}</nav><Link className="pa-admin-link" to="/admin"><ShoppingBag size={17} />Управление магазином<ArrowUpRight size={14} /></Link><div className="pa-sidebar-bottom"><ShieldCheck size={17} /><div>Данные из базы<small>Расчёт по записям базы</small></div></div></GlassSidebar>}
    <div className="pa-body"><header className="pa-topbar"><div><span>WORKSPACE</span><ChevronRight size={14} /><strong>Аналитика</strong></div><nav className="pa-topnav" aria-label="Быстрый переход по аналитике">{tabs.map(item => <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}>{item.name}</button>)}</nav><div><button className="pa-theme" onClick={toggleTheme} aria-label={theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button><span className="pa-live-dot" />{report.isFetching ? 'Обновление…' : 'Серверные данные'}<Link to="/admin" aria-label="Вернуться к управлению"><ArrowLeft size={16} /></Link></div></header>
      <Main className="pa-main"><div className="pa-title"><div><span className="pa-eyebrow">THE BIG PICTURE</span><h1>{tab === 'overview' ? `Добро пожаловать, ${user?.first_name}.` : tabs.find(item => item.id === tab)?.name}<span>{tab === 'overview' ? '' : ' магазина'}</span></h1><p>Понимайте движение бизнеса. От заказа до каждой детали.</p></div><div className="pa-title-actions"><button onClick={() => void report.refetch()} disabled={report.isFetching} aria-label="Обновить аналитику"><RefreshCw size={16} /></button><button className="pa-export" disabled={!data || report.isFetching} onClick={() => data && exportCsv(data)}><Download size={15} />Экспорт CSV</button></div></div>
      {embedded && <nav className="pa-mobile-tabs" aria-label="Разделы аналитики">{tabs.map(item => <button key={item.id} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.name}</button>)}</nav>}
      {!embedded && <nav className="pa-mobile-tabs pa-only-mobile" aria-label="Разделы аналитики">{tabs.map(item => <button key={item.id} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.name}</button>)}</nav>}
      <button className="pa-filter-toggle" aria-expanded={filtersOpen} aria-controls={filterId} onClick={() => setFiltersOpen(value => !value)}><CalendarDays size={17} /><span>Период и фильтры<small>{range.start_date} — {range.end_date}</small></span><ChevronRight size={17} /></button><div id={filterId} className={`pa-filters ${filtersOpen ? 'is-open' : ''}`}><div className="pa-presets">{[7, 30, 90].map(days => <button key={days} aria-pressed={Math.round((Date.parse(range.end_date) - Date.parse(range.start_date)) / 86400000) + 1 === days} onClick={() => preset(days)}>{days} дней</button>)}</div><form onSubmit={event => { event.preventDefault(); const days = (Date.parse(draft.end_date) - Date.parse(draft.start_date)) / 86400000; if (!Number.isFinite(days) || days < 0 || days >= 366) { setDateError('Выберите период от 1 до 366 дней.'); return } setDateError(''); setRange(draft) }}><CalendarDays size={15} /><label><span className="sr-only">Начало периода</span><input type="date" required value={draft.start_date} onChange={event => setDraft({ ...draft, start_date: event.target.value })} /></label><span>—</span><label><span className="sr-only">Конец периода</span><input type="date" required value={draft.end_date} onChange={event => setDraft({ ...draft, end_date: event.target.value })} /></label><button type="submit">Применить</button></form><label className="pa-category"><span className="sr-only">Категория заказов</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="">Все категории</option>{flatten(categories.data).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="pa-category pa-comparison"><span className="sr-only">Сравнить период с</span><select aria-label="Сравнить период с" value={comparison} onChange={event => setComparison(event.target.value as typeof comparison)}><option value="previous_period">Предыдущий период</option><option value="previous_year">Тем же периодом год назад</option></select></label></div>
      {dateError && <p className="pa-error" role="alert">{dateError}</p>}
      {data && data.demo_orders_in_period > 0 && <div className="pa-demo-banner" role="note"><ShieldCheck size={17}/><div><strong>Демонстрационные данные</strong><span>{data.demo_orders_in_period} заказов периода созданы для проверки интерфейса и не являются реальными продажами.</span></div></div>}
      <div className="pa-context"><span>Asia/Dushanbe · UTC+5</span><span>{range.start_date} — {range.end_date}</span><span>Сравнение: {comparison === 'previous_year' ? 'год к году' : 'предыдущий период'}</span>{category && <button onClick={() => setCategory('')}>Заказы с выбранной категорией ×</button>}</div>
      {report.isPending && <div className="pa-kpis" aria-label="Загрузка аналитики">{[0, 1, 2, 3].map(i => <div className="pa-loading skeleton" key={i} />)}</div>}
      {report.isError && <div className="pa-error" role="alert"><h2>Не удалось загрузить данные</h2><p>{report.error.message}</p><button onClick={() => void report.refetch()}>Повторить</button></div>}
      {data && <><div className="pa-kpis">{[
        { label: 'Стоимость заказов', value: data.current.order_value, previous: data.previous.order_value, unit: 'TJS', icon: Wallet },
        { label: 'Всего заказов', value: data.current.orders, previous: data.previous.orders, icon: ShoppingBag },
        { label: 'Средний чек', value: data.current.average_order_value, previous: data.previous.average_order_value, unit: 'TJS', icon: BarChart3 },
        { label: 'Покупатели', value: data.current.buyers, previous: data.previous.buyers, icon: Users },
      ].map(({ label, value, previous, unit, icon: Icon }, i) => <GlassStatCard className={`pa-kpi ${i === 0 ? 'pa-kpi-featured' : ''}`} key={label}><div><span>{label}</span><Icon size={17} /></div><strong>{money(value)}<small>{unit}</small></strong><Delta current={Number(value)} previous={Number(previous)} label={comparison === 'previous_year' ? 'к прошлому году' : 'к прошлому периоду'} /></GlassStatCard>)}</div>
      <p className="pa-footnote">Стоимость заказов включает доставку и вычитает скидки; отмены и возвраты исключены. Это не подтверждённая оплата.{category && ' Показаны полные суммы заказов, содержащих выбранную категорию.'}</p>
      {['overview', 'sales', 'finance'].includes(tab) && <div className="pa-chart-grid"><GlassChartContainer className="pa-panel pa-chart-panel"><div className="pa-panel-head"><div><span className="pa-eyebrow">ORDER VALUE</span><h2>Динамика стоимости заказов</h2></div><div className="pa-grain" aria-label="Масштаб графика">{(['day', 'week', 'month'] as const).map((value, index) => <button aria-pressed={grain === value} key={value} onClick={() => setGrain(value)}>{['День', 'Неделя', 'Месяц'][index]}</button>)}</div></div><div className="pa-chart-meta"><strong>{money(data.current.order_value)} <small>TJS</small></strong><label><input type="checkbox" checked={compare} onChange={event => setCompare(event.target.checked)} /> Показать линию сравнения</label></div><div className="pa-chart" role="img" aria-label="График стоимости заказов в TJS. Таблица данных ниже."><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chart} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} accessibilityLayer><defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-primary)" stopOpacity={0.22} /><stop offset="95%" stopColor="var(--chart-primary)" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" /><XAxis dataKey="date" tickFormatter={dateLabel} minTickGap={40} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={value => money(value)} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={65} /><Tooltip labelFormatter={value => dateLabel(String(value))} formatter={(value, name) => [`${money(Number(value))} TJS`, name === 'order_value' ? 'Выбранный период' : comparison === 'previous_year' ? 'Тот же период год назад' : 'Предыдущий период']} contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }} /><Area type="monotone" dataKey="order_value" stroke="var(--chart-primary)" strokeWidth={2.5} fill={`url(#${gradient})`} isAnimationActive={false} />{compare && <Line type="monotone" dataKey="previous_order_value" stroke="var(--chart-secondary)" strokeWidth={1.5} strokeDasharray="4 5" dot={false} isAnimationActive={false} />}</ComposedChart></ResponsiveContainer></div><div className="pa-chart-caption"><span><i />Выбранный период</span>{compare && <span><i />{data.previous_start_date} — {data.previous_end_date} · {comparison === 'previous_year' ? 'год назад' : 'предыдущий период'}</span>}<span>TJS / {grain === 'day' ? 'день' : grain === 'week' ? 'неделя' : 'месяц'}</span></div><details className="pa-data"><summary>Данные графика</summary><div className="pa-table-wrap"><table><thead><tr><th>Период</th><th>Стоимость, TJS</th><th>Предыдущий, TJS</th><th>Заказы</th></tr></thead><tbody>{data.series.map(row => <tr key={row.date}><td>{row.date}</td><td>{money(row.order_value)}</td><td>{money(row.previous_order_value)}</td><td>{row.orders}</td></tr>)}</tbody></table></div></details></GlassChartContainer><GlassPanel className="pa-panel pa-pulse"><span className="pa-eyebrow">BUSINESS PULSE</span><h2>Пульс магазина</h2><div className="pa-mini-chart" role="img" aria-label="Количество заказов по датам выбранного периода"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><Bar dataKey="orders" fill="var(--signal)" radius={[4,4,4,4]} maxBarSize={12} isAnimationActive={false}/></BarChart></ResponsiveContainer></div><div className="pa-pulse-total"><Package size={28} strokeWidth={1} /><strong>{money(data.current.units)}<small>деталей в заказах</small></strong></div>{[
        ['Заказы без отмен и возвратов', data.current.valid_orders], ['Повторные покупатели', data.current.repeat_buyers], ['Отмены', data.current.cancelled], ['Возвращённые заказы', data.current.returned],
      ].map(([label, value]) => <div className="pa-stat-line" key={label}><span>{label}</span><strong>{value}</strong></div>)}<p>Повторный покупатель имел заказ до начала выбранного периода.</p></GlassPanel></div>}
      {tab === 'overview' && <ActionCenter data={data} />}
      {['overview', 'sales'].includes(tab) && <div className="pa-two-columns"><SegmentPanel title="Продажи по категориям" rows={data.categories} onSelect={setCategory} /><SegmentPanel title="Продажи по брендам" rows={data.brands} /></div>}
      {['overview', 'products'].includes(tab) && <><GlassPanel className="pa-stock-strip">{[['В наличии, SKU', data.stock.in_stock], ['Критический остаток, SKU', data.stock.low_stock], ['Нет в наличии, SKU', data.stock.out_of_stock], ['Всего деталей, шт.', data.stock.total_units]].map(([name, value]) => <div key={name}><span>{name}</span><strong>{money(value)}</strong></div>)}</GlassPanel><GlassPanel className="pa-panel"><div className="pa-panel-head"><div><span className="pa-eyebrow">PRODUCT PERFORMANCE</span><h2>Лидеры продаж</h2></div><label>Сортировать <select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="units">По количеству</option><option value="item_value">По стоимости</option><option value="stock">По остатку</option></select></label></div><GlassSearch className="pa-product-search"><Search size={16} /><input type="search" aria-label="Поиск по товарам отчёта" placeholder="Название или артикул" value={productSearch} onChange={event => { setProductSearch(event.target.value); setProductPage(1) }} /></GlassSearch>{products.length ? <div className="pa-table-wrap"><table><thead><tr><th>Товар / артикул</th><th>Заказано, шт.</th><th>Стоимость до скидок, TJS</th><th>Остаток, шт.</th></tr></thead><tbody>{visibleProducts.map((product, i) => <tr key={product.id}><td><span className="pa-index">{String((activePage - 1) * 8 + i + 1).padStart(2, '0')}</span><Link to={`/catalog?q=${encodeURIComponent(product.sku)}`}>{product.name}<small>{product.sku}</small></Link></td><td>{product.units}</td><td>{money(product.item_value)}</td><td><span className={`pa-stock-badge ${product.stock <= 5 ? 'low' : ''}`}>{product.stock}</span></td></tr>)}</tbody></table></div> : <Empty />}<nav className="pa-pagination" aria-label="Страницы товаров отчёта"><button disabled={activePage === 1} onClick={() => setProductPage(activePage - 1)}>Назад</button><span aria-live="polite">{activePage} / {pageCount} · {products.length} товаров</span><button disabled={activePage === pageCount} onClick={() => setProductPage(activePage + 1)}>Далее</button></nav><p className="pa-footnote">До 50 товаров по объёму продаж. Остатки — на текущий момент; критический порог — 5 шт.</p></GlassPanel></>}
      {tab === 'customers' && <GlassPanel className="pa-panel"><div className="pa-panel-head"><h2>Покупатели периода</h2><Users size={20} /></div><div className="pa-stock-strip"><div><span>С первым заказом в периоде</span><strong>{data.current.buyers - data.current.repeat_buyers}</strong></div><div><span>Покупали ранее</span><strong>{data.current.repeat_buyers}</strong></div><div><span>Заказов на покупателя</span><strong>{data.current.buyers ? money(data.current.valid_orders / data.current.buyers) : '—'}</strong></div><div><span>Стоимость на покупателя, TJS</span><strong>{data.current.buyers ? money(Number(data.current.order_value) / data.current.buyers) : '—'}</strong></div></div><p className="pa-footnote">Учитываются покупатели с заказами без отмен и возвратов. Когортное удержание и RFM ещё не реализованы; эти показатели не заменяются демографическими предположениями.</p></GlassPanel>}
      {tab === 'orders' && <GlassPanel className="pa-panel"><div className="pa-panel-head"><h2>Распределение по текущему статусу</h2><span>Текущее состояние</span></div>{data.statuses.length ? data.statuses.map(row => <div className="pa-status-row" key={row.status}><span>{names[row.status] || row.status}</span><meter min={0} max={Math.max(data.current.orders, 1)} value={row.count} aria-label={names[row.status] || row.status} /><strong>{row.count}</strong></div>) : <Empty />}<p className="pa-footnote">Когорта сформирована по дате создания заказа. Ниже показаны сохранённые переходы и время до этапов.</p></GlassPanel>}
      {tab === 'orders' && <div className="pa-two-columns"><ReasonPanel title="Причины отмен" rows={data.cancellation_reasons} /><ReasonPanel title="Причины возвратов" rows={data.return_reasons} /></div>}
      {tab === 'finance' && <GlassPanel className="pa-panel"><div className="pa-panel-head"><h2>Финансовые составляющие заказов</h2><span>TJS</span></div>{[['Скидки и списанные бонусы', data.current.discounts], ['Доставка в действующих заказах', data.current.shipping], ['Стоимость возвращённых заказов', data.current.returned_order_value]].map(([label, value]) => <div className="pa-stat-line" key={label}><span>{label}</span><strong>{money(value)} TJS</strong></div>)}<p className="pa-footnote">Стоимость возвращённых заказов не подтверждает перечисление возврата. Период относится к созданию заказа, а не дате возврата.</p></GlassPanel>}
      {tab === 'products' && <StockWatch data={data} />}
      {tab === 'orders' && <OrderJourney data={data} />}
      <details className="pa-methodology"><summary><ShieldCheck size={16} />Методика и доступность данных<ChevronRight size={15} /></summary><p>Источник: orders, order_items, order_status_history, products, categories, brands. Денежные итоги только в TJS. Период включает обе выбранные даты по Душанбе. Сравнение — с непосредственно предшествующим периодом или с теми же датами прошлого года. Для 29 февраля используется 28 февраля невисокосного года. Недельные интервалы начинаются в понедельник, крайние интервалы могут быть неполными.</p>{Object.values(data.unavailable).map(reason => <p key={reason}>{reason}</p>)}<p>Детальная методика: docs/ANALYTICS_METRICS.md в проекте.</p></details>
      <footer className="pa-footer"><span>AUTO UNIVERSE / INTELLIGENCE</span><span>Из базы данных · {data.currency} · {data.timezone}</span></footer></>}
      </Main></div>
  </div>
}
