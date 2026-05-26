/**
 * Tập hợp các hàm gọi API xác thực.
 */

import { api, withRetry } from '../../../lib/api'
import type { AxiosRequestConfig } from 'axios'
import type { AuthResponse } from '../../../types'

export interface RegisterPayload {
  full_name: string
  email: string
  password: string
  gender: 'male' | 'female' | 'other'
  age: number
}

export interface UpdateProfilePayload {
  full_name: string
  gender: 'male' | 'female' | 'other'
  age: number
}

export const authApi = {
  /**
   * Đăng nhập bằng email và mật khẩu.
   */
  async login(email: string, password: string) {
    const config = { timeout: 10000, skipAuthRefresh: true } as AxiosRequestConfig & { skipAuthRefresh: boolean }
    return withRetry(() => api.post<AuthResponse>('/auth/login', { email, password }, config), 2)
  },

  /**
   * Đăng ký tài khoản mới.
   */
  async register(payload: RegisterPayload) {
    const config = { skipAuthRefresh: true } as AxiosRequestConfig & { skipAuthRefresh: boolean }
    const response = await api.post<AuthResponse>('/auth/register', payload, config)
    return response.data
  },

  /**
   * Lấy hồ sơ của người dùng hiện tại.
   */
  async me() {
    return withRetry(() => api.get<AuthResponse['user']>('/auth/me', { timeout: 8000 }), 2)
  },

  /**
   * Cập nhật hồ sơ của người dùng hiện tại.
   */
  async updateMe(payload: UpdateProfilePayload) {
    const response = await api.patch<AuthResponse['user']>('/auth/me', payload)
    return response.data
  },
}
