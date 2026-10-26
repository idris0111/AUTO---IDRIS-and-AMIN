import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function GuestGate({ eyebrow, title, description, next }: { eyebrow: string; title: string; description: string; next: string }) {
  return <section className="commerce-container guest-gate"><div className="guest-gate-copy"><span className="mp-kicker">{eyebrow}</span><h1>{title}</h1><p>{description}</p><div><Link className="guest-gate-primary" to={`/login?next=${encodeURIComponent(next)}`}>Войти <ArrowRight size={17} /></Link><Link className="guest-gate-secondary" to="/catalog">Открыть каталог <ArrowUpRight size={16} /></Link></div></div><div className="guest-gate-visual"><img src="/images/engine-editorial.jpg" alt="Детали двигателя автомобиля" loading="lazy" /><span>AUTO UNIVERSE · ВАШИ ДЕТАЛИ</span></div></section>
}
