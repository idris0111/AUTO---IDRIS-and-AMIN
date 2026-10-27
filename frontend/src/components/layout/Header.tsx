import { GlassNavbar } from '../glass/Glass'
import { CarFront, Bell, CheckCheck, Coins, GitCompare, Heart, LogOut, Moon, Package, Search, ShoppingCart, Sun, User as UserIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { api } from '../../lib/api'
import type { PaginatedProducts, ProductBrief } from '../../types'
import { useApp } from '../../stores/app'
import { useAuth } from '../../stores/auth'
import { useCart } from '../../stores/cart'
import { useGarage } from '../../stores/garage'
import { useComparison } from '../../stores/comparison'
import { useLoyalty } from '../../stores/loyalty'
import { useNotifications } from '../../stores/notifications'
import BrandEmblem from '../common/BrandEmblem'

export default function Header() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { locale, setLocale, theme, toggleTheme } = useApp()
  const { user, logout } = useAuth()
  const { cart, fetchCart } = useCart()
  const { selectedVehicleId, vehicles, loadGarage } = useGarage()
  const comparisonIds = useComparison((state) => state.ids)
  const loyaltyAccount = useLoyalty((state) => state.account)
  const loadLoyalty = useLoyalty((state) => state.loadLoyalty)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<ProductBrief[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const prevCount = useRef(0)
  const [badgePop, setBadgePop] = useState(false)
  const [notifsOpen, setNotifsOpen] = useState(false)
  const notifsWrapRef = useRef<HTMLDivElement>(null)
  const notifications = useNotifications((state) => state.items)
  const unreadCount = useNotifications((state) => state.unreadCount)
  const loadNotifications = useNotifications((state) => state.loadNotifications)
  const loadUnreadCount = useNotifications((state) => state.loadUnreadCount)
  const markAsRead = useNotifications((state) => state.markAsRead)
  const markAllAsRead = useNotifications((state) => state.markAllAsRead)

  useEffect(() => {
    void fetchCart()
    if (user) {
      void loadGarage().catch(() => undefined)
      void loadLoyalty()
      void loadUnreadCount()
      const interval = setInterval(() => { void loadUnreadCount() }, 30000)
      return () => clearInterval(interval)
    }
  }, [fetchCart, user, loadGarage, loadLoyalty, loadUnreadCount])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifsWrapRef.current && !notifsWrapRef.current.contains(e.target as Node)) setNotifsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) { setSuggestions([]); setSuggestionsOpen(false); return }
    let cancelled = false
    const timer = setTimeout(() => {
      api.get<PaginatedProducts>('/catalog/products', { q: trimmed, limit: 5 }).then(page => {
        if (cancelled) return
        setSuggestions(page.items)
        setSuggestionsOpen(true)
      }).catch(() => { if (!cancelled) setSuggestions([]) })
    }, 280)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  useEffect(() => {
    if (cart && cart.count > prevCount.current && prevCount.current !== 0) {
      setBadgePop(true)
      const timer = setTimeout(() => setBadgePop(false), 350)
      return () => clearTimeout(timer)
    }
    prevCount.current = cart?.count ?? 0
  }, [cart])

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target as Node)) setSuggestionsOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const selected = vehicles.find((v) => v.id === selectedVehicleId)

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    setSuggestionsOpen(false)
    navigate(`/catalog?q=${encodeURIComponent(trimmed)}`)
  }

  function openSuggestion(product: ProductBrief) {
    setSuggestionsOpen(false)
    setQuery('')
    navigate(`/product/${product.slug}`)
  }

  const [scrolled, setScrolled] = useState(false)
  const [headerHidden, setHeaderHidden] = useState(false)
  useEffect(() => {
    let lastY = window.scrollY
    const handleScroll = () => {
      const y = window.scrollY
      setScrolled(y > 20)
      if (y > 140 && y > lastY + 6) setHeaderHidden(true)
      else if (y < lastY - 6 || y < 80) setHeaderHidden(false)
      lastY = y
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <GlassNavbar onKeyDown={event => { if (event.key === 'Escape') { setNotifsOpen(false); setSuggestionsOpen(false) } }} className={`commerce-header store-header sticky top-0 z-50 ${scrolled ? 'is-scrolled au-header-scrolled' : ''} ${headerHidden ? 'au-header-hidden' : ''}`}>
      <div className="commerce-header-main flex items-center gap-3 px-4">
        <Link to="/" className="commerce-header-brand flex shrink-0 items-center gap-2.5">
          <span className="au-monogram"><BrandEmblem size={32} /></span>
          <span className="brand-wordmark">AUTO<span className="text-premium">UNIVERSE</span></span>
        </Link>

        <div ref={searchWrapRef} className="commerce-header-search relative hidden min-w-0 flex-1 md:block">
          <form onSubmit={submitSearch}>
            <div className="flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 transition focus-within:border-premium" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
              <Search className="size-4 shrink-0 muted" aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)} placeholder={t('search')} aria-label={t('search')} className="w-full bg-transparent text-[13px] outline-none" />
              <button type="submit" className="shrink-0 rounded-md bg-premium px-2.5 py-1 text-xs font-semibold text-premium transition hover:brightness-110">{t('searchShort')}</button>
            </div>
          </form>
          {suggestionsOpen && suggestions.length > 0 && (
            <div className="au-dropdown absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border shadow-[var(--shadow-lg)]" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              {suggestions.map(item => (
                <button key={item.id} type="button" onClick={() => openSuggestion(item)} className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition hover:bg-[var(--surface-2)]">
                  <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-[var(--surface-2)]">{item.image_url ? <img src={item.image_url} alt="" className="size-full object-cover" /> : <span className="text-[9px] font-black muted">AU</span>}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold">{item.name}</span><span className="block text-[10px] muted">{item.brand.name} · {item.sku}</span></span>
                  <span className="shrink-0 text-[12px] font-bold">{Number(item.price).toFixed(2)} TJS</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="commerce-header-actions ml-auto flex shrink-0 items-center gap-1.5">
          <select aria-label="Language" value={locale} onChange={(e) => setLocale(e.target.value as 'ru' | 'tg' | 'en')} className="hd-lang"><option value="ru">RU</option><option value="tg">TG</option><option value="en">EN</option></select>
          <button type="button" className="hd-icon-btn hd-theme" onClick={toggleTheme} aria-label={theme === 'dark' ? t('Светлая тема') : t('Тёмная тема')} title={theme === 'dark' ? t('Светлая тема') : t('Тёмная тема')}>{theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
          <Link to="/garage" className="hd-icon-btn" title={selected ? selected.name : t('garage')} aria-label={t('garage')}><CarFront className="size-4" /></Link>
          <Link to="/compare" className="hd-icon-btn relative" aria-label={t('compare')} title={t('comparison')}><GitCompare className="size-4" />{comparisonIds.length > 0 && <span className="hd-badge">{comparisonIds.length}</span>}</Link>
          <Link to="/favorites" className="hd-icon-btn" aria-label={t('Избранное')} title={t('Избранное')}><Heart className="size-4" /></Link>
          {user?.role && ['admin', 'super_admin', 'manager', 'order_manager'].includes(user.role) && (
            <Link to={user.role === 'order_manager' ? '/cockpit' : '/admin'} className="hd-icon-btn hd-admin" title="Admin" aria-label="Admin">AD</Link>
          )}
          <Link to="/cart" className="hd-icon-btn relative" aria-label={t('cart')} title={t('cart')}><ShoppingCart className="size-4" />{cart && cart.count > 0 && <span key={cart.count} className={`hd-badge hd-badge-amber ${badgePop ? 'pop-badge' : ''}`}>{cart.count}</span>}</Link>
          {user && (
            <div ref={notifsWrapRef} className="relative">
              <button type="button" onClick={() => { const n = !notifsOpen; setNotifsOpen(n); if (n) void loadNotifications() }} aria-label={t('Уведомления')} className="hd-icon-btn relative" title={t('Уведомления')}><Bell className="size-4" />{unreadCount > 0 && <span className="hd-badge hd-badge-amber">{unreadCount > 99 ? '99+' : unreadCount}</span>}</button>
              {notifsOpen && (
                <div className="au-dropdown absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border shadow-2xl" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                  <div className="flex items-center justify-between border-b px-3 py-1.5" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[11px] font-bold">{t('Уведомления')}</span>
                    {unreadCount > 0 && <button type="button" onClick={() => void markAllAsRead()} className="flex items-center gap-1 text-[10px] muted transition hover:text-premium"><CheckCheck className="size-3" /><span>{t('Прочитать все')}</span></button>}
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
                    {notifications.length === 0 ? <div className="py-5 text-center text-[11px] muted">{t('Пока нет уведомлений.')}</div> : notifications.map(it => (
                      <div key={it.id} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click() } }} onClick={() => { if (!it.is_read) void markAsRead(it.id); if (it.link) { navigate(it.link); setNotifsOpen(false) } }} className={`flex items-start gap-2 px-2.5 py-2 text-[11px] transition cursor-pointer hover:bg-white/5 ${!it.is_read ? 'bg-premium/5' : ''}`}>
                        <div className="mt-0.5 shrink-0 rounded-md p-1 bg-white/5 border border-white/10 text-premium">{it.type === 'loyalty_bonus' ? <Coins className="size-3 text-amber-400" /> : it.type.startsWith('order') ? <Package className="size-3 text-emerald-400" /> : <Bell className="size-3 text-sky-400" />}</div>
                        <div className="min-w-0 flex-1"><span className={`font-semibold truncate block ${!it.is_read ? 'text-premium' : 'text-muted'}`}>{it.title}</span><p className="mt-0.5 text-muted line-clamp-1 leading-snug">{it.message}</p></div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t px-2 py-1 text-center" style={{ borderColor: 'var(--border)' }}><Link to="/profile" onClick={() => setNotifsOpen(false)} className="text-[10px] font-semibold text-premium hover:underline">{t('Центр уведомлений →')}</Link></div>
                </div>
              )}
            </div>
          )}
          {user ? (
            <div className="flex items-center gap-1.5 pl-1">
              <Link to="/profile" className="hd-user" title={user.first_name}><UserIcon className="size-4" /><span className="hidden xl:inline max-w-20 truncate text-[12px]">{user.first_name}</span></Link>
              {loyaltyAccount && <Link to="/profile" className="hd-coins" title={t('Бонусные баллы')}><Coins className="size-3" />{loyaltyAccount.points_balance}</Link>}
              <button type="button" onClick={() => { void logout(); navigate('/') }} className="hd-logout" title={t('logout')} aria-label={t('logout')}><LogOut size={16} /><span>{t('logout')}</span></button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 pl-1">
              <Link to="/login" className="hd-login">{t('login')}</Link>
              <Link to="/register" className="hd-register">{t('register')}</Link>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={submitSearch} className="commerce-mobile-search md:hidden" role="search"><Search size={17} aria-hidden /><input value={query} onChange={e => setQuery(e.target.value)} aria-label={t('search')} placeholder={t('Найти запчасть или артикул')} /><button type="submit" aria-label={t('Найти')}><Search size={16} /></button></form>
    </GlassNavbar>
  )
}
