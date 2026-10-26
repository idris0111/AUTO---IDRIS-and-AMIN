import { useQuery } from '@tanstack/react-query'
import { Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import ProductCard from '../components/product/ProductCard'
import { api } from '../lib/api'
import type { ProductBrief } from '../types'
import { useAuth } from '../stores/auth'
import GuestGate from '../components/layout/GuestGate'
import ShopEmptyState from '../components/layout/ShopEmptyState'

export default function Favorites() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const favorites = useQuery({
    queryKey: ['favorites'],
    queryFn: () => api.get<ProductBrief[]>('/favorites'),
    enabled: Boolean(user),
  })

  if (!user) return <GuestGate eyebrow="СОХРАНЁННЫЕ ДЕТАЛИ" title="Избранное" description="Войдите, чтобы сохранять нужные товары и быстро возвращаться к ним." next="/favorites" />

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-black">Избранное</h1>
      {favorites.isLoading && <div className="mt-6 text-sm muted">{t('loading')}</div>}
      {favorites.data?.length === 0 && (
        <ShopEmptyState eyebrow="СОХРАНЁННЫЕ ТОВАРЫ" title="Избранное пока пусто" description="Сохраняйте подходящие детали, чтобы быстро найти их, когда будете готовы к покупке." action={t('continueShopping')} icon={Heart} visual="/images/lighting-editorial.jpg" />
      )}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {(favorites.data ?? []).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}
