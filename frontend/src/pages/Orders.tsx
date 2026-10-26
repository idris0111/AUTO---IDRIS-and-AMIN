import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { PackageOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { api } from '../lib/api'
import type { PaginatedOrders, OrderListItem } from '../types'
import { useAuth } from '../stores/auth'
import GuestGate from '../components/layout/GuestGate'
import ShopEmptyState from '../components/layout/ShopEmptyState'

export const orderStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Ожидает',
    awaiting_payment: 'Ожидает оплаты',
    confirmed: 'Подтверждён',
    processing: 'В обработке',
    packed: 'Упакован',
    shipped: 'Отправлен',
    delivered: 'Доставлен',
    completed: 'Завершён',
    cancelled: 'Отменён',
    returned: 'Возврат',
  }
  return labels[status] ?? status
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'cancelled'
      ? 'bg-premium/15 text-premium'
      : status === 'completed' || status === 'delivered'
        ? 'bg-emerald-500/15 text-emerald-500'
        : 'bg-amber-500/15 text-amber-500'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{orderStatusLabel(status)}</span>
}

export default function Orders() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const orders = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get<PaginatedOrders>('/orders'),
    enabled: Boolean(user),
  })

  if (!user) return <GuestGate eyebrow="ВАШИ ПОКУПКИ" title={t('myOrders')} description="Войдите, чтобы видеть историю заказов и следить за их статусом." next="/orders" />

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-black">{t('myOrders')}</h1>

      {orders.isLoading && <div className="mt-6 text-sm muted">{t('loading')}</div>}

      {orders.data?.items.length === 0 && (
        <ShopEmptyState eyebrow="ИСТОРИЯ ПОКУПОК" title="Ваш первый заказ ещё впереди" description="Когда оформите заказ, здесь появятся его состав и статус. Начните с каталога деталей для вашего автомобиля." action={t('continueShopping')} icon={PackageOpen} visual="/images/brake-hero.jpg" />
      )}

      <ul className="mt-6 space-y-3">
        {(orders.data?.items ?? []).map((order: OrderListItem) => (
          <li key={order.id}>
            <Link
              to={`/orders/${order.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition hover:border-premium"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              <div>
                <div className="font-bold">{order.number}</div>
                <div className="mt-1 text-xs muted">
                  {new Date(order.created_at).toLocaleDateString('ru-RU')} · {order.items_count} поз.
                </div>
              </div>
              <StatusBadge status={order.status} />
              <div className="text-lg font-black">{Number(order.total).toFixed(2)} {order.currency}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
