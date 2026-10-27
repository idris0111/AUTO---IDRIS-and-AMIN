import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Disc3 } from 'lucide-react'

export default function AuthPanel() {
  const { t } = useTranslation()
  return <aside className="auth-art"><img src="/images/brake-hero.jpg" alt={t('Тормозной диск и суппорт')} /><div className="auth-art-shade" /><div className="auth-art-content"><span><Disc3 size={21} /> AUTO UNIVERSE</span><h2>{t('Всё для вашего автомобиля — в одном месте.')}</h2><p>{t('Сохраните автомобиль, управляйте заказами и возвращайтесь к выбранным деталям.')}</p><Link to="/catalog">{t('Открыть каталог')} <ArrowUpRight size={17} /></Link></div></aside>
}
