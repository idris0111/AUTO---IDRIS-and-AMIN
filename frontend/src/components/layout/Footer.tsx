import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Car } from 'lucide-react'
import { Link } from 'react-router-dom'
import BrandEmblem from '../common/BrandEmblem'

export default function Footer() {
  const { t } = useTranslation()
  return <footer className="commerce-footer"><div className="commerce-container">
    <div className="footer-main"><div className="footer-brand"><Link to="/" className="brand-wordmark"><BrandEmblem size={40} /><span>AUTO<b>UNIVERSE</b></span></Link><p>{t('Точность в каждой детали.')}<br />{t('Запчасти и забота о вашем автомобиле.')}</p><span className="footer-location">{t('Таджикистан · Цены в сомони')}</span></div>
      <div><h3>{t('Ваш автомобиль')}</h3><Link to="/catalog">{t('Каталог запчастей')}</Link><Link to="/garage">{t('Мой гараж')}</Link><Link to="/catalog?has_discount=true">{t('Предложения')}</Link><Link to="/compare">{t('Сравнение деталей')}</Link></div>
      <div><h3>{t('Покупателю')}</h3><Link to="/orders">{t('Мои заказы')}</Link><Link to="/favorites">{t('Избранное')}</Link><Link to="/profile">{t('Личный кабинет')}</Link><Link to="/support">{t('Служба поддержки')}</Link></div>
      <div className="footer-help"><Car size={28} strokeWidth={1.2} /><h3>{t('Нужна помощь с выбором?')}</h3><p>{t('Уточните артикул и совместимость перед заказом.')}</p><Link to="/support">{t('Задать вопрос')} <ArrowUpRight size={16} /></Link><Link to="/blog">{t('База знаний')} <ArrowUpRight size={16} /></Link><Link to="/ai-mechanic">{t('Помощник по симптомам')} <ArrowUpRight size={16} /></Link></div>
    </div><div className="footer-bottom"><span>© {new Date().getFullYear()} AUTO UNIVERSE</span><span>{t('При получении · Банковский перевод')}</span><span>TJS / СОМОНИ</span></div>
  </div></footer>
}
