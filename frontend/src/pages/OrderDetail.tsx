import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CheckCircle2, MapPin, PackageOpen, RotateCcw, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { api } from '../lib/api'
import type { Cart, Order } from '../types'
import { useAuth } from '../stores/auth'
import { useCart } from '../stores/cart'
import { StatusBadge, orderStatusLabel } from './Orders'
import GuestGate from '../components/layout/GuestGate'
import ShopEmptyState from '../components/layout/ShopEmptyState'

export default function OrderDetail() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { fetchCart } = useCart()
  const [message, setMessage] = useState(params.get('created') ? t('orderSuccess') : '')
  const [showCancelForm, setShowCancelForm] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const order = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<Order>(`/orders/${id}`),
    enabled: Boolean(user && id),
  })

  const payment = useQuery({
    queryKey: ['order-payment', id, order.data?.status],
    queryFn: () => api.get<{ message: string; verification_status: string }>(`/orders/${id}/payment`),
    enabled: Boolean(user && order.data),
  })

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => api.post<Order>(`/orders/${id}/cancel`, { reason }),
    onSuccess: () => {
      setMessage('Заказ отменён, товары возвращены на склад.')
      setShowCancelForm(false)
      void order.refetch()
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : 'Не удалось отменить заказ'),
  })

  const reorderMutation = useMutation({
    mutationFn: () => api.post<Cart>(`/orders/${id}/reorder`),
    async onSuccess() {
      await fetchCart()
      setMessage('Товары добавлены в корзину.')
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : 'Не удалось повторить заказ'),
  })

  if (!user) {
    return <GuestGate eyebrow="ВАШИ ПОКУПКИ" title="Детали заказа" description="Войдите в аккаунт, чтобы просмотреть состав и статус заказа." next={`/orders/${id}`} />
  }

  if (order.isLoading) return <div className="mx-auto max-w-4xl px-4 py-10 text-sm muted">{t('loading')}</div>

  if (order.isError || !order.data) {
    return (
      <div className="commerce-container shop-empty-page"><ShopEmptyState headingLevel={1} eyebrow="ИСТОРИЯ ПОКУПОК" title="Не удалось открыть заказ" description="Проверьте ссылку или выберите заказ из списка в личном кабинете." action="К списку заказов" icon={PackageOpen} to="/orders" /></div>
    )
  }

  const data = order.data
  const cancellable = ['pending', 'awaiting_payment', 'confirmed', 'processing', 'packed'].includes(data.status)

  return (
    <div className="order-detail-page commerce-container py-8 sm:py-12">
      <Link to="/orders" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-premium"><ArrowLeft size={16} /> Все заказы</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-premium">ИСТОРИЯ ПОКУПОК / ДЕТАЛИ ЗАКАЗА</div>
          <h1 className="text-2xl font-black tracking-tight text-premium sm:text-4xl">Заказ {data.number}</h1>
          <div className="mt-2 text-sm muted">Создан {new Date(data.created_at).toLocaleString('ru-RU')}</div>
        </div>
        <StatusBadge status={data.status} />
      </div>

      {message && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm font-medium text-emerald-700" role="status"><CheckCircle2 size={20} className="shrink-0" />{message}</div>
      )}

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="order-detail-panel rounded-2xl border bg-[var(--surface)] p-5 shadow-sm sm:p-7" style={{ borderColor: 'var(--border)' }}>
          <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-5"><div><div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-premium">СОСТАВ ЗАКАЗА</div><h2 className="text-xl font-bold text-premium">Товары <span className="text-muted">· {data.items.length}</span></h2></div><PackageOpen className="text-muted" size={24} /></div>
          <ul className="divide-y text-sm" style={{ borderColor: 'var(--border)' }}>
            {data.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 py-5 first:pt-1">
                <div className="min-w-0">
                  <div className="font-semibold leading-snug text-premium">{item.product_name}</div>
                  <div className="mt-1.5 text-xs muted">Артикул {item.product_sku} · {item.quantity} шт.</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-bold text-premium">{Number(item.line_total).toFixed(2)} TJS</div>
                  <div className="text-xs muted">{Number(item.unit_price).toFixed(2)} TJS/шт.</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t pt-5 text-sm" style={{ borderColor: 'var(--border)' }}>
            <span className="muted">{t('shippingMethod')}</span>
            <span>{data.shipping_method === 'pickup' ? t('pickup') : t('courier')}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="muted">{t('paymentMethod')}</span>
            <span>{data.payment_method === 'cash_on_delivery' ? t('cashOnDelivery') : t('bankTransfer')}</span>
          </div>
          <div className="mt-4 rounded-lg border p-4 text-sm leading-relaxed" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }} role="status">
            <strong className="block mb-1" style={{ color: 'var(--text)' }}>Подтверждение оплаты</strong>
            {payment.isPending ? 'Проверяем доступную информацию…' : payment.isError ? <span>Не удалось получить состояние оплаты. <button type="button" className="underline" onClick={() => void payment.refetch()}>Повторить</button></span> : payment.data?.message}
          </div>
          {Number(data.shipping_cost) > 0 && <div className="mt-1 flex justify-between text-sm"><span className="muted">Стоимость доставки</span><span>{Number(data.shipping_cost).toFixed(2)} {data.currency}</span></div>}
          {Number(data.discount) > 0 && <div className="mt-1 flex justify-between text-sm text-emerald-700"><span>Скидка</span><span>−{Number(data.discount).toFixed(2)} {data.currency}</span></div>}
          <div className="mt-5 flex justify-between border-t pt-5 text-xl font-black text-premium" style={{ borderColor: 'var(--border)' }}>
            <span>{t('total')}</span>
            <span>{Number(data.total).toFixed(2)} {data.currency}</span>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => reorderMutation.mutate()}
              disabled={reorderMutation.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-5 py-2 text-sm font-semibold transition hover:border-premium hover:text-premium disabled:opacity-50"
              style={{ borderColor: 'var(--border)' }}
            >
              <RotateCcw size={16} />{t('reorder')}
            </button>
            {cancellable && (
              <button
                type="button"
                onClick={() => setShowCancelForm(value => !value)}
                className="min-h-11 rounded-xl border border-premium px-5 py-2 text-sm font-semibold text-premium transition hover:bg-premium/10 disabled:opacity-50"
              >
                {showCancelForm ? 'Не отменять' : t('cancelOrder')}
              </button>
            )}
          </div>
          {cancellable && showCancelForm && <div className="mt-4 grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_auto]" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
            <label className="grid gap-2 text-xs font-semibold text-premium">Почему отменяете заказ?
              <select value={cancelReason} onChange={event => setCancelReason(event.target.value)} className="min-h-11 rounded-lg border px-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <option value="">Выберите причину</option>
                {['Покупатель изменил решение', 'Нашёл товар в другом месте', 'Заказ оформлен ошибочно', 'Нужна другая деталь', 'Другая причина'].map(reason => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => cancelMutation.mutate(cancelReason)} disabled={!cancelReason || cancelMutation.isPending} className="min-h-11 self-end rounded-lg border border-rose-500/50 px-4 text-sm font-bold text-rose-400 disabled:opacity-40">
              {cancelMutation.isPending ? 'Отменяем…' : 'Подтвердить отмену'}
            </button>
          </div>}
        </section>

        <aside className="space-y-5">
          <div className="order-detail-panel rounded-2xl border bg-[var(--surface)] p-6 text-sm shadow-sm" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--canvas)] text-premium">{data.shipping_method === 'pickup' ? <MapPin size={19} /> : <Truck size={19} />}</span><h2 className="text-base font-bold text-premium">{data.shipping_method === 'pickup' ? 'Самовывоз' : 'Доставка'}</h2></div>
            <div className="font-semibold text-premium">{data.contact_name}</div>
            <div className="mt-1 muted">{data.contact_phone}</div>
            <div className="mt-3 border-t border-[var(--border)] pt-3 muted">{data.shipping_method === 'pickup' ? 'Место и время выдачи уточнят после оформления заказа.' : `${data.shipping_city}, ${data.shipping_street}`}</div>
            {data.shipping_method !== 'pickup' && data.shipping_postal_code && <div className="muted">{data.shipping_postal_code}</div>}
            {data.customer_note && <div className="mt-2 muted">«{data.customer_note}»</div>}
          </div>

          <div className="order-detail-panel rounded-2xl border bg-[var(--surface)] p-6 text-sm shadow-sm" style={{ borderColor: 'var(--border)' }}>
            <h2 className="mb-5 text-base font-bold text-premium">{t('status')}</h2>
            <ol className="space-y-3">
              {[...data.status_history].reverse().map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span className={`mt-1 size-2 shrink-0 rounded-full ${['cancelled', 'returned'].includes(event.to_status) ? 'bg-rose-400' : ['delivered', 'completed'].includes(event.to_status) ? 'bg-emerald-400' : 'bg-premium'}`} aria-hidden />
                  <div>
                    <div className="font-medium">
                      {event.from_status ? `${orderStatusLabel(event.from_status)} → ` : ''}{orderStatusLabel(event.to_status)}
                    </div>
                    <div className="text-xs muted">{new Date(event.created_at).toLocaleString('ru-RU')}</div>
                    {event.note && <div className="text-xs muted">{event.note}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  )
}
