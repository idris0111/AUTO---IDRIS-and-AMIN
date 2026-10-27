import { create } from 'zustand'
import i18n from '../i18n'

type Theme = 'dark' | 'light'

type AppState = {
  theme: Theme
  locale: 'ru' | 'tg' | 'en'
  toggleTheme: () => void
  setLocale: (locale: 'ru' | 'tg' | 'en') => void
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  localStorage.setItem('au_theme', theme)
}

const initialTheme: Theme =
  localStorage.getItem('au_theme') === 'dark' ? 'dark' : 'light'

const savedLocale = localStorage.getItem('au_locale')
const initialLocale: AppState['locale'] = savedLocale === 'en' || savedLocale === 'tg' ? savedLocale : 'ru'
document.documentElement.lang = initialLocale

if (i18n.language !== initialLocale) {
  void i18n.changeLanguage(initialLocale)
}

export const useApp = create<AppState>((set) => ({
  theme: initialTheme,
  locale: initialLocale,

  toggleTheme() {
    set((state) => {
      const theme: Theme = state.theme === 'dark' ? 'light' : 'dark'
      applyTheme(theme)
      return { theme }
    })
  },

  setLocale(locale) {
    document.documentElement.lang = locale
    localStorage.setItem('au_locale', locale)
    void i18n.changeLanguage(locale)
    set({ locale })
  },
}))

applyTheme(initialTheme)
