import type { User } from '../types'

const TOKEN_KEY = 'ticketrush_token'
const USER_KEY = 'ticketrush_user'

export const authStorage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  },
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token)
  },
  clearToken() {
    localStorage.removeItem(TOKEN_KEY)
  },
  getUser(): User | null {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null

    try {
      return JSON.parse(raw) as User
    } catch {
      return null
    }
  },
  setUser(user: User) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clearUser() {
    localStorage.removeItem(USER_KEY)
  },
  clearAll() {
    this.clearToken()
    this.clearUser()
  },
}

export const queueStorage = {
  getToken(showKey: string | number): string | null {
    return sessionStorage.getItem(`ticketrush_queue_${showKey}`)
  },
  setToken(showKey: string | number, token: string) {
    sessionStorage.setItem(`ticketrush_queue_${showKey}`, token)
  },
  clearToken(showKey: string | number) {
    sessionStorage.removeItem(`ticketrush_queue_${showKey}`)
  },
}
