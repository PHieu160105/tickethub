import type { User } from '../types'

const TOKEN_KEY = 'ticketrush_token'
const USER_KEY = 'ticketrush_user'
const QUEUE_TOKEN_PREFIX = 'ticketrush_queue_'
const CHECKOUT_RETURN_SEATS_PREFIX = 'ticketrush_checkout_return_seats_'

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

export const checkoutReturnSeatStorage = {
  /**
   * Đọc danh sách ghế cần khôi phục khi người dùng quay từ trang thanh toán về trang chọn ghế.
   *
   * Đầu vào:
   * - `showKey`: mã buổi diễn dùng để cô lập dữ liệu giữa các show.
   *
   * Đầu ra:
   * - Mảng ID ghế hợp lệ. Nếu dữ liệu lưu tạm bị hỏng hoặc không tồn tại thì trả mảng rỗng.
   */
  get(showKey: string | number): number[] {
    const raw = sessionStorage.getItem(`${CHECKOUT_RETURN_SEATS_PREFIX}${showKey}`)
    if (!raw) return []

    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    } catch {
      return []
    }
  },
  /**
   * Lưu tạm danh sách ghế vừa được trả lock để trang chọn ghế đánh dấu lại như lựa chọn nháp.
   *
   * Đầu vào:
   * - `showKey`: mã buổi diễn.
   * - `seatIds`: danh sách ghế lấy từ phiên checkout hiện tại.
   *
   * Đầu ra:
   * - Không trả dữ liệu. Hàm chỉ cập nhật sessionStorage của tab hiện tại.
   */
  set(showKey: string | number, seatIds: number[]) {
    const normalizedSeatIds = [...new Set(seatIds)]
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)

    if (normalizedSeatIds.length === 0) {
      this.clear(showKey)
      return
    }

    sessionStorage.setItem(`${CHECKOUT_RETURN_SEATS_PREFIX}${showKey}`, JSON.stringify(normalizedSeatIds))
  },
  /**
   * Xóa lựa chọn nháp sau khi trang chọn ghế đã khôi phục xong hoặc sau khi thanh toán thành công.
   */
  clear(showKey: string | number) {
    sessionStorage.removeItem(`${CHECKOUT_RETURN_SEATS_PREFIX}${showKey}`)
  },
}
