import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react'

import { useAuth } from '../stores/auth'
import { useCart } from '../stores/cart'
import AuthPanel from '../components/layout/AuthPanel'
import { formError } from '../lib/formError'

export default function Register() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { register, loading } = useAuth()
  const { mergeGuestCart } = useCart()
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (loading) return
    setError('')
    try {
      await register({ ...form, email: form.email.trim(), phone: form.phone || undefined })
      await mergeGuestCart()
      navigate('/profile')
    } catch (err) {
      setError(formError(err, 'Не удалось зарегистрироваться'))
    }
  }

  return (
    <div className="auth-layout commerce-container">
      <AuthPanel />
      <div className="au-auth-card">
        <div className="au-auth-head">
          <span className="au-auth-icon"><User size={22} /></span>
          <span className="mp-kicker">{t('НОВЫЙ АККАУНТ')}</span>
          <h1>{t('register')}</h1>
          <p>{t('Создайте аккаунт, чтобы сохранить автомобиль и отслеживать заказы.')}</p>
        </div>

        <form onSubmit={submit} className="au-auth-form">
          <div className="au-field-row">
            <label className="au-field">
              <span>{t('firstName')}</span>
              <div className="au-input-wrap">
                <User size={15} />
                <input required autoComplete="given-name" maxLength={100} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
            </label>
            <label className="au-field">
              <span>{t('lastName')}</span>
              <div className="au-input-wrap">
                <User size={15} />
                <input required autoComplete="family-name" maxLength={100} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </label>
          </div>

          <label className="au-field">
            <span>{t('email')}</span>
            <div className="au-input-wrap">
              <Mail size={15} />
              <input type="email" required autoComplete="email" placeholder="name@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </label>

          <label className="au-field">
            <span>{t('contactPhone')}</span>
            <div className="au-input-wrap">
              <Phone size={15} />
              <input type="tel" autoComplete="tel" maxLength={32} placeholder="+992…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </label>

          <label className="au-field">
            <span>{t('password')}</span>
            <div className="au-input-wrap">
              <Lock size={15} />
              <input type={showPassword ? 'text' : 'password'} required minLength={10} autoComplete="new-password" placeholder={t('Минимум 10 символов')} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" className="password-toggle" aria-label={t(showPassword ? 'Скрыть пароль' : 'Показать пароль')} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
          </label>

          {error && (
            <div className="au-alert" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="au-btn-primary au-shine" disabled={loading}>
            <span>{loading ? t('loading') : t('register')}</span>
            <ArrowRight size={15} />
          </button>
        </form>

        <div className="au-auth-foot">
          {t('haveAccount')}{' '}
          <Link to="/login">{t('login')}</Link>
        </div>
      </div>
    </div>
  )
}
