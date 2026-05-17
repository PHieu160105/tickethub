/**
 * Tập hợp các hàm gọi API liên quan đến giữ ghế, thanh toán và vé của người dùng.
 */

import { api, withRetry } from '../../../lib/api'
import type { LockSeatResponse, CheckoutResponse, TicketItem, ApiMessage } from '../../../types'

export interface LockSeatsPayload {
  show_id: number
  seat_ids: number[]
  queue_token?: string
}

export interface ReleaseSeatsPayload {
  show_id: number
  seat_ids: number[]
}

export interface CheckoutPayload {
  show_id: number
  queue_token?: string
  discount_code?: string
}

export interface MyTicketsParams {
  search?: string
  start_from?: string
  end_to?: string
}

export const bookingApi = {
  /**
   * Gửi yêu cầu giữ ghế cho một show.
   */
  async lock(payload: LockSeatsPayload): Promise<LockSeatResponse> {
    const response = await withRetry(
      () =>
        api.post<LockSeatResponse>('/bookings/lock', {
          show_id: payload.show_id,
          seat_ids: payload.seat_ids,
          queue_token: payload.queue_token,
        }),
      2,
    )
    return response
  },

  /**
   * Gửi yêu cầu trả lại các ghế đang giữ.
   */
  async release(payload: ReleaseSeatsPayload): Promise<ApiMessage> {
    const response = await api.post<ApiMessage>('/bookings/release', {
      show_id: payload.show_id,
      seat_ids: payload.seat_ids,
    })
    return response.data
  },

  /**
   * Gửi yêu cầu checkout để chuyển ghế đang giữ thành vé đã mua.
   */
  async checkout(payload: CheckoutPayload): Promise<CheckoutResponse> {
    const response = await api.post<CheckoutResponse>('/bookings/checkout', {
      show_id: payload.show_id,
      queue_token: payload.queue_token,
      discount_code: payload.discount_code,
    })
    return response.data
  },

  /**
   * Lấy danh sách vé hiện tại của người dùng đăng nhập.
   */
  async myTickets(params?: MyTicketsParams): Promise<TicketItem[]> {
    const response = await withRetry(() => api.get<TicketItem[]>('/bookings/my-tickets', { params }))
    return response 
  },

  /**
   * Hủy một vé theo mã định danh của vé.
   */
  async cancelTicket(ticketId: number): Promise<ApiMessage> {
    const response = await api.delete<ApiMessage>(`/bookings/my-tickets/${ticketId}`)
    return response.data
  },
}
