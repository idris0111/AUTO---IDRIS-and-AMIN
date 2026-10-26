import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Bell,
  CheckCircle2,
  Coins,
  Crown,
  History,
  Lock,
  Mail,
  Package,
  Smartphone,
  Trash2,
  User as UserIcon,
  Car,
  Globe,
  Sun,
  Moon,
} from 'lucide-react'
import type { NotificationItem, NotificationListResponse, NotificationPreference } from '../types'

import { api } from '../lib/api'
import { useAuth } from '../stores/auth'
import { useApp } from '../stores/app'
import { useLoyalty } from '../stores/loyalty'
import GuestGate from '../components/layout/GuestGate'

const loyaltyTierName = (tier: string) => {
  const names: Record<string, string> = { silver: 'Серебряный', gold: 'Золотой', platinum: 'Платиновый' }
  return names[tier] ?? tier
}

export default function Profile() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, logout, refreshUser } = useAuth()
  const { theme, toggleTheme, locale, setLocale } = useApp()
  const { account: loyalty, loadLoyalty } = useLoyalty()

  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    phone: user?.phone ?? '',
  })
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const [preferences, setPreferences] = useState<NotificationPreference | null>(null)
  const [notifHistory, setNotifHistory] = useState<NotificationItem[]>([])
  const [loadingNotifs, setLoadingNotifs] = useState(false)
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all')

  const loadPreferencesAndHistory = async () => {
    try {
      setLoadingNotifs(true)
      const [prefsData, notifsData] = await Promise.all([
        api.get<NotificationPreference>('/notifications/preferences'),
        api.get<NotificationListResponse>('/notifications?limit=50'),
      ])
      setPreferences(prefsData)
      setNotifHistory(notifsData.items)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingNotifs(false)
    }
  }

  const updatePref = async (key: keyof NotificationPreference, val: boolean) => {
    if (!preferences) return
    const updated = { ...preferences, [key]: val }
    setPreferences(updated)
    try {
      await api.put('/notifications/preferences', { [key]: val })
    } catch (e) {
      console.error(e)
    }
  }

  const markItemRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifHistory((prev) => prev.map((it) => (it.id === id ? { ...it, is_read: true } : it)))
    } catch (e) {
      console.error(e)
    }
  }

  const deleteItem = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`)
      setNotifHistory((prev) => prev.filter((it) => it.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (user) {
      void loadLoyalty()
      void loadPreferencesAndHistory()
      setForm({
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
        phone: user.phone ?? '',
      })
    }
  }, [user, loadLoyalty])

  if (!user) return <GuestGate eyebrow="ВАШ АККАУНТ" title="Личный кабинет" description="Войдите, чтобы управлять профилем, адресами, заказами и автомобилями." next="/profile" />

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSavingProfile(true)
    try {
      await api.patch('/users/me', { ...form, phone: form.phone || null })
      await refreshUser()
      setMessage('Данные профиля успешно обновлены')
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения данных')
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsChangingPassword(true)
    try {
      await api.post('/users/me/change-password', passwords)
      setPasswords({ current_password: '', new_password: '' })
      setMessage('Пароль успешно изменён. Все сессии обновлены.')
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка смены пароля')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const filteredNotifs = notifFilter === 'unread' ? notifHistory.filter((n) => !n.is_read) : notifHistory
  const unreadCount = notifHistory.filter((n) => !n.is_read).length

  return (
    <div className="customer-profile min-h-screen bg-[var(--canvas)] text-ink pb-24 selection:bg-premium selection:text-white">
      {/* Background Aurora / Ambient */}
      <div className="pointer-events-none fixed inset-0" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Cockpit Status Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-premium">
              <span className="size-2 rounded-full bg-premium animate-pulse" />
              <span>ЛИЧНЫЙ КАБИНЕТ</span>
              <span className="text-ink/20">/</span>
              <span>ПОКУПКИ И ПРОФИЛЬ</span>
              <span className="text-ink/20">/</span>
              <span className="text-slate-400">ID: AU-{user.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <h1 className="mt-2 text-3xl font-black text-ink tracking-tight">
              Личный кабинет
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Ваши данные, заказы, адреса и настройки аккаунта.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                await logout()
                navigate('/')
              }}
              className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 font-mono text-xs font-bold text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/60 transition"
            >
              {t('logout')}
            </button>
          </div>
        </div>

        {/* Global Alert Notification */}
        {(message || error) && (
          <div
            className={`mt-6 flex items-center gap-3 rounded-xl border p-4 text-xs font-medium ${
              error
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{error || message}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* 1. AU CLUB MEMBERSHIP METALLIC FOIL CARD & TELEMETRY ROW       */}
        {/* ============================================================== */}
        {loyalty && <section className="profile-loyalty" aria-label="Программа лояльности">
          <div className="profile-loyalty-intro"><span className="mp-kicker">AUTO UNIVERSE · БОНУСЫ</span><h2>Ваши бонусы</h2><p>Баланс и условия по вашему аккаунту.</p></div>
          <div className="profile-loyalty-stat"><span>Доступно баллов</span><strong>{loyalty.points_balance}</strong></div>
          <div className="profile-loyalty-stat"><span>Уровень</span><strong>{loyaltyTierName(loyalty.tier_info.current_tier)}</strong></div>
          <div className="profile-loyalty-stat"><span>Кэшбэк</span><strong>{loyalty.tier_info.cashback_percent}%</strong></div>
          <div className="profile-loyalty-stat"><span>Сумма покупок</span><strong>{Number(loyalty.total_spent).toLocaleString('ru-RU')} TJS</strong></div>
          {loyalty.tier_info.next_tier && <p className="profile-loyalty-next">До уровня «{loyaltyTierName(loyalty.tier_info.next_tier)}»: {Number(loyalty.tier_info.spent_needed_for_next).toLocaleString('ru-RU')} TJS</p>}
        </section>}

        {/* ============================================================== */}
        {/* 2. PERSONAL DATA & SECURITY DUAL COCKPIT                       */}
        {/* ============================================================== */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Left: Personal Dossier */}
          <form
            onSubmit={saveProfile}
            className="profile-card rounded-2xl border border-white/10 bg-[#12161D] p-6 shadow-xl relative overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg bg-[#0080FF]/10 text-premium border border-[#0080FF]/30">
                  <UserIcon className="size-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-ink">Персональные данные</h2>
                  <p className="font-mono text-[11px] text-slate-400">{user.email} · {user.role.toUpperCase()}</p>
                </div>
              </div>
              <span className="rounded-md border border-[#10B981]/30 bg-[#10B981]/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#10B981]">
                АККАУНТ
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
                  {t('firstName')}
                </label>
                <input
                  required
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#07090C] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-premium focus:ring-1 focus:ring-[#00F0FF]"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
                  {t('lastName')}
                </label>
                <input
                  required
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#07090C] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-premium focus:ring-1 focus:ring-[#00F0FF]"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
                  {t('contactPhone')}
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+992 90 000 00 00"
                  className="w-full rounded-xl border border-white/10 bg-[#07090C] px-3.5 py-2.5 text-sm font-mono text-ink outline-none transition focus:border-premium focus:ring-1 focus:ring-[#00F0FF]"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingProfile}
                className="profile-save-button w-full mt-2 rounded-xl py-3 text-xs font-bold transition disabled:opacity-50"
              >
                {isSavingProfile ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </form>

          {/* Right: Security & Credentials + Preferences */}
          <div className="space-y-6">
            <form
              onSubmit={changePassword}
              className="profile-card rounded-2xl border border-white/10 bg-[#12161D] p-6 shadow-xl"
            >
              <div className="flex items-center gap-2.5 border-b border-white/10 pb-4 mb-5">
                <div className="grid size-8 place-items-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <Lock className="size-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-ink">Безопасность учетной записи</h2>
                  <p className="font-mono text-[11px] text-slate-400">Смена мастер-пароля (минимум 8 символов)</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
                    Текущий пароль
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={passwords.current_password}
                    onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#07090C] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
                    Новый безопасный пароль
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={passwords.new_password}
                    onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#07090C] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="profile-password-button w-full mt-2 rounded-xl py-3 text-xs font-bold transition disabled:opacity-50"
                >
                  {isChangingPassword ? 'Обновление...' : 'Обновить пароль'}
                </button>
              </div>
            </form>

            {/* Interface & Garage Quick Links */}
            <div className="profile-card rounded-2xl border border-white/10 bg-[#12161D] p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-[#07090C] px-4 py-3 text-xs hover:border-premium/50 transition"
                >
                  <span className="flex items-center gap-2 text-slate-300">
                    {theme === 'dark' ? <Moon className="size-4 text-premium" /> : <Sun className="size-4 text-amber-400" />}
                    Тема оформления
                  </span>
                  <span className="font-mono font-bold text-ink">
                    {theme === 'dark' ? 'Obsidian' : 'Light'}
                  </span>
                </button>

                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#07090C] px-4 py-3 text-xs">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Globe className="size-4 text-[#10B981]" />
                    Язык
                  </span>
                  <select
                    value={locale}
                    onChange={(e) => {
                      const val = e.target.value as 'ru' | 'tg' | 'en'
                      setLocale(val)
                      void i18n.changeLanguage(val)
                    }}
                    className="bg-transparent font-mono font-bold text-premium outline-none cursor-pointer"
                  >
                    <option value="ru" className="bg-[#12161D] text-ink">Русский (RU)</option>
                    <option value="tg" className="bg-[#12161D] text-ink">Тоҷикӣ (TG)</option>
                    <option value="en" className="bg-[#12161D] text-ink">English (EN)</option>
                  </select>
                </div>
              </div>

              <Link
                to="/garage"
                className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-[#07090C] px-4 py-3 text-xs hover:border-[#E32636]/60 transition group"
              >
                <div className="flex items-center gap-2.5 text-slate-300">
                  <Car className="size-4 text-premium" />
                  <span>Перейти в мой цифровой гараж</span>
                </div>
                <span className="font-mono text-xs font-bold text-premium group-hover:translate-x-1 transition-transform">
                  ГАРАЖ →
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. NOTIFICATION CENTER & DISPATCH PREFERENCES                 */}
        {/* ============================================================== */}
        <div className="profile-card mt-8 rounded-2xl border border-white/10 bg-[#12161D] p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-premium/10 text-premium border border-premium/30">
                <Bell className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-ink">Центр уведомлений & Каналы доставки</h2>
                <p className="text-xs text-slate-400">Настройка каналов информирования для {user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNotifFilter(notifFilter === 'all' ? 'unread' : 'all')}
                className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition ${
                  notifFilter === 'unread'
                    ? 'border-premium bg-premium/20 text-premium'
                    : 'border-white/10 bg-[#07090C] text-slate-400 hover:text-ink'
                }`}
              >
                {notifFilter === 'unread' ? `Только новые (${unreadCount})` : 'Все уведомления'}
              </button>

              <button
                type="button"
                onClick={() => void loadPreferencesAndHistory()}
                className="rounded-lg border border-white/10 bg-[#07090C] px-3 py-1.5 font-mono text-xs font-bold text-slate-400 hover:text-ink transition"
              >
                Обновить
              </button>
            </div>
          </div>

          {/* Preferences Grid */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {/* Orders */}
            <div className="rounded-xl border border-white/10 bg-[#07090C] p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-ink mb-3">
                <Package className="size-4 text-[#10B981]" />
                Статусы заказов
              </div>
              <div className="space-y-3 text-xs">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Smartphone className="size-3.5 text-slate-500" /> В приложении
                  </span>
                  <input
                    type="checkbox"
                    className="size-4 accent-[#00F0FF] cursor-pointer"
                    checked={preferences?.order_updates_in_app ?? true}
                    onChange={(e) => updatePref('order_updates_in_app', e.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Mail className="size-3.5 text-slate-500" /> По email
                  </span>
                  <input
                    type="checkbox"
                    className="size-4 accent-[#00F0FF] cursor-pointer"
                    checked={preferences?.order_updates_email ?? true}
                    onChange={(e) => updatePref('order_updates_email', e.target.checked)}
                  />
                </label>
              </div>
            </div>

            {/* Loyalty */}
            <div className="rounded-xl border border-white/10 bg-[#07090C] p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-ink mb-3">
                <Coins className="size-4 text-amber-400" />
                Бонусы и кэшбэк
              </div>
              <div className="space-y-3 text-xs">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Smartphone className="size-3.5 text-slate-500" /> В приложении
                  </span>
                  <input
                    type="checkbox"
                    className="size-4 accent-[#00F0FF] cursor-pointer"
                    checked={preferences?.loyalty_in_app ?? true}
                    onChange={(e) => updatePref('loyalty_in_app', e.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Mail className="size-3.5 text-slate-500" /> По email
                  </span>
                  <input
                    type="checkbox"
                    className="size-4 accent-[#00F0FF] cursor-pointer"
                    checked={preferences?.loyalty_email ?? true}
                    onChange={(e) => updatePref('loyalty_email', e.target.checked)}
                  />
                </label>
              </div>
            </div>

            {/* VIP Promotions */}
            <div className="rounded-xl border border-white/10 bg-[#07090C] p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-ink mb-3">
                <Crown className="size-4 text-purple-400" />
                Спецпредложения
              </div>
              <div className="space-y-3 text-xs">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Smartphone className="size-3.5 text-slate-500" /> В приложении
                  </span>
                  <input
                    type="checkbox"
                    className="size-4 accent-[#00F0FF] cursor-pointer"
                    checked={preferences?.promotions_in_app ?? true}
                    onChange={(e) => updatePref('promotions_in_app', e.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Mail className="size-3.5 text-slate-500" /> По email
                  </span>
                  <input
                    type="checkbox"
                    className="size-4 accent-[#00F0FF] cursor-pointer"
                    checked={preferences?.promotions_email ?? false}
                    onChange={(e) => updatePref('promotions_email', e.target.checked)}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* History Feed */}
          <div className="mt-6 border-t border-white/10 pt-5">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3">
              Журнал входящих сообщений
            </h3>

            {loadingNotifs ? (
              <p className="text-xs text-slate-400 py-4">Синхронизация оповещений...</p>
            ) : filteredNotifs.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-[#07090C] p-8 text-center text-xs text-slate-400">
                Нет сообщений для отображения.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {filteredNotifs.map((n) => (
                  <div
                    key={n.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border text-xs transition ${
                      !n.is_read
                        ? 'border-premium/40 bg-premium/5'
                        : 'border-white/5 bg-[#07090C]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${!n.is_read ? 'text-ink' : 'text-slate-400'}`}>
                          {n.title}
                        </span>
                        {!n.is_read && (
                          <span className="rounded bg-premium/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-premium">
                            NEW
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-mono ml-auto sm:ml-0">
                          {new Date(n.created_at).toLocaleString('ru-RU')}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-400 leading-relaxed">{n.message}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {n.link && (
                        <Link
                          to={n.link}
                          onClick={() => {
                            if (!n.is_read) void markItemRead(n.id)
                          }}
                          className="rounded-lg border border-premium/30 bg-premium/10 px-2.5 py-1 text-xs font-mono font-bold text-premium hover:bg-premium/20 transition"
                        >
                          Открыть →
                        </Link>
                      )}
                      {!n.is_read && (
                        <button
                          type="button"
                          onClick={() => void markItemRead(n.id)}
                          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-mono text-slate-400 hover:text-ink transition"
                        >
                          Прочитано
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void deleteItem(n.id)}
                        className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:text-rose-400 transition"
                        title="Удалить"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* 4. BONUS LEDGER & TRANSACTION HISTORY                          */}
        {/* ============================================================== */}
        <div className="profile-card mt-8 rounded-2xl border border-white/10 bg-[#12161D] p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink uppercase tracking-wider font-mono">
              <History className="size-4 text-premium" />
              Журнал транзакций AU Club
            </h3>
            <span className="font-mono text-xs text-slate-400">
              Баланс: <strong className="text-amber-400">{loyalty ? loyalty.points_balance : '—'} баллов</strong>
            </span>
          </div>

          {loyalty?.recent_transactions && loyalty.recent_transactions.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#07090C]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 bg-white/5 text-slate-400 font-mono">
                  <tr>
                    <th className="px-4 py-3">ДАТА / ВРЕМЯ</th>
                    <th className="px-4 py-3">ТИП ОПЕРАЦИИ</th>
                    <th className="px-4 py-3">ОПИСАНИЕ</th>
                    <th className="px-4 py-3 text-right">СУММА</th>
                    <th className="px-4 py-3 text-right">ОСТАТОК</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {loyalty.recent_transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/5 transition">
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.type === 'accrual' && (
                          <span className="rounded-md border border-[#10B981]/30 bg-[#10B981]/10 px-2 py-0.5 text-[#10B981] font-bold">
                            Начисление
                          </span>
                        )}
                        {tx.type === 'redemption' && (
                          <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-400 font-bold">
                            Списание
                          </span>
                        )}
                        {tx.type === 'refund' && (
                          <span className="rounded-md border border-[#0080FF]/30 bg-[#0080FF]/10 px-2 py-0.5 text-premium font-bold">
                            Возврат
                          </span>
                        )}
                        {tx.type === 'welcome' && (
                          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-400 font-bold">
                            Приветственный
                          </span>
                        )}
                        {tx.type === 'admin_adjust' && (
                          <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-purple-400 font-bold">
                            Корректировка
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-sans">{tx.description}</td>
                      <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                        {tx.amount > 0 ? (
                          <span className="text-[#10B981]">+{tx.amount} б.</span>
                        ) : (
                          <span className="text-rose-400">{tx.amount} б.</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 whitespace-nowrap">
                        {tx.balance_after} б.
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 bg-[#07090C] p-6 text-center text-xs text-slate-400">
              {loyalty ? 'Пока нет операций по бонусному счёту.' : 'Данные бонусного счёта пока недоступны.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
