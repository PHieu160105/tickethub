import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { signInWithGoogle } from '@/lib/firebase'
import { authApi, extractApiErrorMessage } from '@/lib/api'
import { authStorage } from '@/lib/storage'
import { API_BASE_URL } from '@/constants'
import type { User as ApiUser } from '@/types'

export interface User extends ApiUser {
  name: string
  avatar?: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<User>
  loginWithGoogle: () => Promise<User>
  startDiscordLogin: () => void
  acceptExternalAuth: (payload: { access_token: string; user: ApiUser }) => User
  register: (
    email: string,
    password: string,
    fullName: string,
    options?: { gender?: 'male' | 'female' | 'other'; age?: number },
  ) => Promise<User>
  updateProfile: (payload: { full_name: string; gender: 'male' | 'female' | 'other'; age: number }) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function enrichUser(user: ApiUser): User {
  return {
    ...user,
    name: user.full_name,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = authStorage.getUser()
    return storedUser ? enrichUser(storedUser) : null
  })

  const isAuthenticated = Boolean(user && authStorage.getToken())
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    const bootstrap = async () => {
      const token = authStorage.getToken()
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        const profile = await authApi.me()
        authStorage.setUser(profile)
        setUser(enrichUser(profile))
      } catch {
        authStorage.clearAll()
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    void bootstrap()
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await authApi.login(email, password)
      authStorage.setToken(response.access_token)
      authStorage.setUser(response.user)
      const enrichedUser = enrichUser(response.user)
      setUser(enrichedUser)
      return enrichedUser
    } catch (error) {
      throw new Error(extractApiErrorMessage(error, 'Đăng nhập thất bại. Vui lòng thử lại.'))
    } finally {
      setIsLoading(false)
    }
  }

  const loginWithGoogle = async () => {
    setIsLoading(true)
    try {
      const idToken = await signInWithGoogle()
      const response = await authApi.firebaseTokenLogin(idToken)
      authStorage.setToken(response.access_token)
      authStorage.setUser(response.user)
      const enrichedUser = enrichUser(response.user)
      setUser(enrichedUser)
      return enrichedUser
    } catch (error) {
      throw new Error(extractApiErrorMessage(error, 'Đăng nhập Google thất bại. Vui lòng thử lại.'))
    } finally {
      setIsLoading(false)
    }
  }

  const startDiscordLogin = () => {
    window.location.assign(`${API_BASE_URL}/auth/discord/login`)
  }

  const acceptExternalAuth = (payload: { access_token: string; user: ApiUser }) => {
    authStorage.setToken(payload.access_token)
    authStorage.setUser(payload.user)
    const enrichedUser = enrichUser(payload.user)
    setUser(enrichedUser)
    return enrichedUser
  }

  const register = async (
    email: string,
    password: string,
    fullName: string,
    options?: { gender?: 'male' | 'female' | 'other'; age?: number },
  ) => {
    setIsLoading(true)
    try {
      const response = await authApi.register({
        full_name: fullName,
        email,
        password,
        gender: options?.gender ?? 'other',
        age: options?.age ?? 18,
      })
      authStorage.setToken(response.access_token)
      authStorage.setUser(response.user)
      const enrichedUser = enrichUser(response.user)
      setUser(enrichedUser)
      return enrichedUser
    } catch (error) {
      throw new Error(extractApiErrorMessage(error, 'Đăng ký thất bại. Vui lòng thử lại.'))
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    authStorage.clearAll()
    setUser(null)
  }

  const updateProfile = useCallback(async (payload: { full_name: string; gender: 'male' | 'female' | 'other'; age: number }) => {
    const profile = await authApi.updateMe(payload)
    const enrichedUser = enrichUser(profile)
    authStorage.setUser(profile)
    setUser(enrichedUser)
    return enrichedUser
  }, [])

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      isAdmin,
      login,
      loginWithGoogle,
      startDiscordLogin,
      acceptExternalAuth,
      register,
      updateProfile,
      logout,
    }),
    [user, isLoading, isAuthenticated, isAdmin, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth phải được dùng bên trong AuthProvider')
  }
  return context
}
