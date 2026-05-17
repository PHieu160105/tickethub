import type { User } from '../types'

const TOKEN_KEY = 'ticketrush_token'
const USER_KEY = 'ticketrush_user'
const QUEUE_TOKEN_PREFIX = 'ticketrush_queue_'

function clearAllQueueTokensFromSessionStorage() {
  const queueKeys: string[] = []

  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index)
    if (key?.startsWith(QUEUE_TOKEN_PREFIX)) {
      queueKeys.push(key)
    }
  }

  queueKeys.forEach((key) => sessionStorage.removeItem(key))
}

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
    clearAllQueueTokensFromSessionStorage()
  },
}

export const queueStorage = {
  getToken(showKey: string | number): string | null {
    return sessionStorage.getItem(`${QUEUE_TOKEN_PREFIX}${showKey}`)
  },
  setToken(showKey: string | number, token: string) {
    sessionStorage.setItem(`${QUEUE_TOKEN_PREFIX}${showKey}`, token)
  },
  clearToken(showKey: string | number) {
    sessionStorage.removeItem(`${QUEUE_TOKEN_PREFIX}${showKey}`)
  },
  clearAll() {
    clearAllQueueTokensFromSessionStorage()
  },
}
