import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { ArrowUpRight, Pause, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Category } from '../../types'
import ProductMedia from './ProductMedia'

const editorialImages: Record<string, string> = {
  'brake-system': '/images/brake-hero.jpg',
  engine: '/images/engine-editorial.jpg',
}
const studioPanels: Record<string, string> = {
  filters: 'filters',
  suspension: 'suspension',
  electronics: 'electronics',
  oils: 'oils',
}

function CategoryTile({ category, index, duplicate = false }: { category: Category; index: number; duplicate?: boolean }) {
  const { t } = useTranslation()
  return <Link tabIndex={duplicate ? -1 : undefined} className="category-tile category-tile-illustrated" to={`/catalog?category_id=${category.id}`}>
    <span className="category-number">{String(index + 1).padStart(2, '0')}</span>
    <div className="category-visual">{editorialImages[category.slug] ? <img className="category-editorial-image" src={editorialImages[category.slug]} alt="" loading="lazy" /> : studioPanels[category.slug] ? <span className={`category-studio-panel category-studio-${studioPanels[category.slug]}`} aria-hidden="true" /> : <ProductMedia alt={category.name} categoryName={category.name} categorySlug={category.slug} />}</div>
    <div className="category-tile-copy"><h3>{t(category.name)}</h3><span>{t(category.description || 'Смотреть запчасти')}</span></div>
    <ArrowUpRight className="category-arrow" size={19} />
  </Link>
}

export default function CategoryTiles({ categories, pending, error, retry }: { categories?: Category[]; pending: boolean; error: boolean; retry: () => void }) {
  const { t } = useTranslation()
  const [paused, setPaused] = useState(false)
  if (pending) return <div className="category-marquee"><div className="category-marquee-track">{Array.from({ length: 6 }, (_, i) => <div key={i} className="category-skeleton skeleton" />)}</div></div>
  if (error) return <div className="commerce-empty" role="alert">{t('Категории временно недоступны.')} <button onClick={retry}>{t('Повторить')}</button></div>
  if (!categories?.length) return <div className="commerce-empty"><p>{t('Категории появятся после обновления каталога.')}</p><Link className="text-link" to="/catalog">{t('Открыть каталог')} <ArrowUpRight size={16} /></Link></div>

  const items = categories.slice(0, 6)

  return <div className={`category-ribbon ${paused ? 'is-paused' : ''}`} aria-label={t('Категории запчастей')}>
    <div className="category-ribbon-toolbar"><span>Подберите нужную систему</span><button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)} aria-label={paused ? 'Продолжить движение категорий' : 'Остановить движение категорий'}>{paused ? <Play size={14} /> : <Pause size={14} />}<span>{paused ? 'Продолжить' : 'Пауза'}</span></button></div>
    <div className="category-ribbon-window">
      <div className="category-ribbon-track">
        {[false, true].map(duplicate => <div className="category-ribbon-group" key={String(duplicate)} aria-hidden={duplicate || undefined}>
          {items.map((category, i) => <CategoryTile key={category.id} category={category} index={i} duplicate={duplicate} />)}
        </div>)}
      </div>
    </div>
  </div>
}
