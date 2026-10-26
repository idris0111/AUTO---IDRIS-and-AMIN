import { ArrowUpRight, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

interface ShopEmptyStateProps {
  eyebrow: string
  title: string
  description: string
  action: string
  icon: LucideIcon
  to?: string
  visual?: string
}

export default function ShopEmptyState({ eyebrow, title, description, action, icon: Icon, to = '/catalog', visual = '/images/precision-brake-studio.jpg' }: ShopEmptyStateProps) {
  return (
    <section className="shop-empty-state">
      <div className="shop-empty-copy">
        <span className="mp-kicker"><Icon size={15} aria-hidden="true" /> {eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
        <Link to={to}>{action}<ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
      <div className="shop-empty-visual" aria-hidden="true">
        <img src={visual} alt="" loading="lazy" />
        <span>AUTO UNIVERSE / ЗАПЧАСТИ ДЛЯ ВАШЕГО АВТО</span>
      </div>
    </section>
  )
}
