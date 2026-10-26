import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, BookOpen, GitCompare, Heart, Layers, Sparkles, Truck, User, X } from 'lucide-react'
import { api } from '../../lib/api'
import type { Category } from '../../types'

const navItems = [
  { to: '/garage', label: 'Подбор по авто', icon: Truck },
  { to: '/catalog?has_discount=true', label: 'Акции', icon: Sparkles },
  { to: '/ai-mechanic', label: 'AI Механик', icon: Sparkles },
  { to: '/compare', label: 'Сравнение', icon: GitCompare },
  { to: '/favorites', label: 'Избранное', icon: Heart },
  { to: '/blog', label: 'База знаний', icon: BookOpen },
  { to: '/support', label: 'Поддержка', icon: User },
  { to: '/profile', label: 'Личный кабинет', icon: User },
]

export default function CategorySidebar() {
  const [open, setOpen] = useState(false)
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/catalog/categories') })

  return <>
    <button
      type="button"
      className={`cs-fab${open ? ' cs-fab-open' : ''}`}
      aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
      aria-expanded={open}
      onClick={() => setOpen(v => !v)}
    >
      {open ? <X size={20} /> : <Layers size={20} />}
      <span>Меню</span>
    </button>

    <div className={`cs-backdrop${open ? ' cs-backdrop-open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />

    <aside className={`cs-panel${open ? ' cs-panel-open' : ''}`} aria-hidden={!open} inert={!open}>
      <div className="cs-head">
        <div>
          <span className="mp-kicker">AUTO UNIVERSE</span>
          <h2>Навигация</h2>
        </div>
        <button type="button" aria-label="Закрыть" onClick={() => setOpen(false)}><X size={19} /></button>
      </div>

      <nav className="cs-section" aria-label="Основная навигация">
        {navItems.map(item => {
          const Icon = item.icon
          return <Link key={item.to + item.label} to={item.to} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>
            <Icon size={16} className="cs-nav-icon" />
            <span>{item.label}</span>
            <ArrowUpRight size={14} className="cs-arrow" />
          </Link>
        })}
      </nav>

      <div className="cs-subhead"><Layers size={14} /><span>Категории</span></div>

      <nav className="cs-list" aria-label="Категории запчастей">
        {categories?.map((category, i) => (
          <Link key={category.id} to={`/catalog?category_id=${category.id}`} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>
            <span className="cs-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="cs-body"><strong>{category.name}</strong><small>{category.description || 'Смотреть запчасти'}</small></span>
            <ArrowUpRight size={16} className="cs-arrow" />
          </Link>
        ))}
        {!categories?.length && <p className="cs-empty">Категории загружаются…</p>}
      </nav>

      <Link className="cs-all" to="/catalog" onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>Весь каталог <ArrowUpRight size={16} /></Link>
    </aside>
  </>
}
