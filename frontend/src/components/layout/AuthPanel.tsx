import { Link } from 'react-router-dom'
import { ArrowUpRight, Disc3 } from 'lucide-react'

export default function AuthPanel() {
  return <aside className="auth-art"><img src="/images/brake-hero.jpg" alt="Тормозной диск и суппорт" /><div className="auth-art-shade" /><div className="auth-art-content"><span><Disc3 size={21} /> AUTO UNIVERSE</span><h2>Всё для вашего автомобиля — в одном месте.</h2><p>Сохраните автомобиль, управляйте заказами и возвращайтесь к выбранным деталям.</p><Link to="/catalog">Открыть каталог <ArrowUpRight size={17} /></Link></div></aside>
}
