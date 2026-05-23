/* eslint-disable react-refresh/only-export-components */

import { createContext, useCallback, useContext, useMemo, useState } from 'react'

import { authApi } from '../lib/api'
import { authStorage } from '../lib/storage'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<User>
  register: (payload: {
    full_name: string
    email: string
    password: string
    gender: 'male' | 'female' | 'other'
    age: number
  }) => Promise<User>
  updateProfile: (payload: { full_name: string; gender: 'male' | 'female' | 'other'; age: number }) => Promise<User>
  logout: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(authStorage.getUser())
  const [token, setToken] = useState<string | null>(authStorage.getToken())

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password)
    authStorage.setToken(response.access_token)
    authStorage.setRefreshToken(response.refresh_token)
    authStorage.setUser(response.user)
    setToken(response.access_token)
    setUser(response.user)
    return response.user
  }, [])

  const register = useCallback(
    async (payload: {
      full_name: string
      email: string
      password: string
      gender: 'male' | 'female' | 'other'
      age: number
    }) => {
      const response = await authApi.register(payload)
      authStorage.setToken(response.access_token)
      authStorage.setRefreshToken(response.refresh_token)
      authStorage.setUser(response.user)
      setToken(response.access_token)
      setUser(response.user)
      return response.user
    },
    [],
  )

  const logout = useCallback(() => {
    authStorage.clearAll()
    setToken(null)
    setUser(null)
  }, [])

  const updateProfile = useCallback(async (payload: { full_name: string; gender: 'male' | 'female' | 'other'; age: number }) => {
    const profile = await authApi.updateMe(payload)
    authStorage.setUser(profile)
    setUser(profile)
    return profile
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!authStorage.getToken()) return

    try {
      const profile = await authApi.me()
      authStorage.setUser(profile)
      setUser(profile)
    } catch {
      logout()
    }
  }, [logout])

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isAdmin: user?.role === 'admin',
      login,
      register,
      updateProfile,
      logout,
      refreshProfile,
    }),
    [user, token, login, logout, refreshProfile, register, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth phải được dùng bên trong AuthProvider')
  }
  return context
}
