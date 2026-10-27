import { create } from 'zustand'

import { api, clearTokens, getAccessToken, getRefreshToken, setTokens } from '../lib/api'
import type { TokenPair, User } from '../types'
import { useCart } from './cart'
import { useGarage } from './garage'
import { useLoyalty } from './loyalty'
import { useNotifications } from './notifications'
import { useFavorites } from './favorites'

let sessionVersion = 0

type AuthState = {
  user: User | null
  loading: boolean
  initialized: boolean
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (payload: {
    email: string
    password: string
    first_name: string
    last_name: string
    phone?: string
  }) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  async initialize() {
    const version = sessionVersion
    if (!getAccessToken() || !getRefreshToken()) {
      set({ initialized: true })
      return
    }
    try {
      const user = await api.get<User>('/users/me')
      if (version !== sessionVersion) return
      set({ user, initialized: true })
    } catch {
      if (version !== sessionVersion) return
      clearTokens()
      set({ user: null, initialized: true })
    }
  },

  async login(email, password) {
    const version = ++sessionVersion
    set({ loading: true })
    try {
      const tokens = await api.post<TokenPair>('/auth/login', { email, password })
      if (version !== sessionVersion) return
      setTokens(tokens.access_token, tokens.refresh_token)
      const user = await api.get<User>('/users/me')
      if (version !== sessionVersion) return
      set({ user })
    } catch (error) {
      if (version === sessionVersion) clearTokens()
      throw error
    } finally {
      set({ loading: false })
    }
  },

  async register(payload) {
    const version = ++sessionVersion
    set({ loading: true })
    try {
      await api.post('/auth/register', payload)
      const tokens = await api.post<TokenPair>('/auth/login', {
        email: payload.email,
        password: payload.password,
      })
      if (version !== sessionVersion) return
      setTokens(tokens.access_token, tokens.refresh_token)
      const user = await api.get<User>('/users/me')
      if (version !== sessionVersion) return
      set({ user })
    } catch (error) {
      if (version === sessionVersion) clearTokens()
      throw error
    } finally {
      set({ loading: false })
    }
  },

  async logout() {
    const refresh = getRefreshToken()
    const access = getAccessToken()
    clearTokens()
    try {
      if (refresh) await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) },
        body: JSON.stringify({ refresh_token: refresh }),
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      // ignore network errors on logout
    }
  },

  async refreshUser() {
    if (!getAccessToken()) return
    try {
      const user = await api.get<User>('/users/me')
      set({ user })
    } catch {
      clearTokens()
      set({ user: null })
    }
  },
}))

window.addEventListener('au:session-ended', () => {
  sessionVersion += 1
  useAuth.setState({ user: null, loading: false, initialized: true })
  useCart.getState().clear()
  useGarage.getState().selectVehicle(null)
  useGarage.setState({ vehicles: [], loading: false })
  useLoyalty.getState().clear()
  useNotifications.getState().clear()
  useFavorites.getState().clear()
})
