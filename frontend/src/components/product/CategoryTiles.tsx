import { ArrowUpRight } from 'lucide-react'
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

function CategoryTile({ category, index }: { category: Category; index: number }) {
  return <Link className="category-tile category-tile-illustrated" to={`/catalog?category_id=${category.id}`}>
    <span className="category-number">{String(index + 1).padStart(2, '0')}</span>
    <div className="category-visual">{editorialImages[category.slug] ? <img className="category-editorial-image" src={editorialImages[category.slug]} alt="" loading="lazy" /> : studioPanels[category.slug] ? <span className={`category-studio-panel category-studio-${studioPanels[category.slug]}`} aria-hidden="true" /> : <ProductMedia alt={category.name} categoryName={category.name} categorySlug={category.slug} />}</div>
    <div className="category-tile-copy"><h3>{category.name}</h3><span>{category.description || 'Смотреть запчасти'}</span></div>
    <ArrowUpRight className="category-arrow" size={19} />
  </Link>
}

export default function CategoryTiles({ categories, pending, error, retry }: { categories?: Category[]; pending: boolean; error: boolean; retry: () => void }) {
  if (pending) return <div className="category-marquee"><div className="category-marquee-track">{Array.from({ length: 6 }, (_, i) => <div key={i} className="category-skeleton skeleton" />)}</div></div>
  if (error) return <div className="commerce-empty" role="alert">Категории временно недоступны. <button onClick={retry}>Повторить</button></div>
  if (!categories?.length) return <div className="commerce-empty"><p>Категории появятся после обновления каталога.</p><Link className="text-link" to="/catalog">Открыть каталог <ArrowUpRight size={16} /></Link></div>

  const items = categories.slice(0, 6)
  const loop = [...items, ...items, ...items]

  return <div className="category-marquee" aria-label="Категории запчастей">
    <div className="category-marquee-track">
      {loop.map((category, i) => <CategoryTile key={`${category.id}-${i}`} category={category} index={i % items.length} />)}
    </div>
  </div>
}
