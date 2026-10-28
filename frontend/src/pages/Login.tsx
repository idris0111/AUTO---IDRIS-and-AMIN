import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react'

import { useAuth } from '../stores/auth'
import { useCart } from '../stores/cart'
import AuthPanel from '../components/layout/AuthPanel'
import { formError } from '../lib/formError'

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { login, loading } = useAuth()
  const { mergeGuestCart } = useCart()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (loading) return
    setError('')
    try {
      await login(email.trim(), password)
      await mergeGuestCart()
      const next = params.get('next') || '/'
      navigate(next.startsWith('/') && !next.startsWith('//') ? next : '/')
    } catch (err) {
      setError(formError(err, 'Не удалось войти в аккаунт'))
    }
  }

  return (
    <div className="auth-layout commerce-container">
      <AuthPanel />
      <div className="au-auth-card">
        <div className="au-auth-head">
          <span className="au-auth-icon"><LogIn size={22} /></span>
          <span className="mp-kicker">{t('ЛИЧНЫЙ КАБИНЕТ')}</span>
          <h1>{t('login')}</h1>
          <p>{t('Войдите, чтобы видеть свои заказы, избранное и гараж.')}</p>
        </div>

        <form onSubmit={submit} className="au-auth-form">
          <label className="au-field">
            <span>{t('email')}</span>
            <div className="au-input-wrap">
              <Mail size={15} />
              <input type="email" required autoComplete="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label={t('email')} />
            </div>
          </label>

          <label className="au-field">
            <span>{t('password')}</span>
            <div className="au-input-wrap">
              <Lock size={15} />
              <input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder={t('Введите пароль')} value={password} onChange={(e) => setPassword(e.target.value)} aria-label={t('password')} />
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
            <span>{loading ? t('loading') : t('login')}</span>
            <ArrowRight size={15} />
          </button>
        </form>

        <div className="au-auth-foot">
          {t('noAccount')}{' '}
          <Link to="/register">{t('freeRegistration')}</Link>
        </div>
      </div>
    </div>
  )
}
