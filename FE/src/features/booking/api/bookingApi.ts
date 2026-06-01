import { api, withRetry } from '../../../lib/api'
import type { ApiMessage, CheckoutResponse, LockSeatResponse, OrderStatusResponse, TicketItem } from '../../../types'

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
  buyer_name: string
  buyer_email: string
  buyer_phone: string
}

export interface MyTicketsParams {
  search?: string
  start_from?: string
  end_to?: string
}

export const bookingApi = {
  async lock(payload: LockSeatsPayload): Promise<LockSeatResponse> {
    return withRetry(
      () =>
        api.post<LockSeatResponse>('/bookings/lock', {
          show_id: payload.show_id,
          seat_ids: payload.seat_ids,
          queue_token: payload.queue_token,
        }),
      2,
    )
  },

  async release(payload: ReleaseSeatsPayload): Promise<ApiMessage> {
    const response = await api.post<ApiMessage>('/bookings/release', {
      show_id: payload.show_id,
      seat_ids: payload.seat_ids,
    })
    return response.data
  },

  async checkout(payload: CheckoutPayload): Promise<CheckoutResponse> {
    const response = await api.post<CheckoutResponse>('/bookings/checkout', {
      show_id: payload.show_id,
      queue_token: payload.queue_token,
      buyer_name: payload.buyer_name,
      buyer_email: payload.buyer_email,
      buyer_phone: payload.buyer_phone,
    })
    return response.data
  },

  async getOrderStatus(orderId: number): Promise<OrderStatusResponse> {
    const response = await api.get<OrderStatusResponse>(`/bookings/orders/${orderId}`)
    return response.data
  },

  async myTickets(params?: MyTicketsParams): Promise<TicketItem[]> {
    return withRetry(() => api.get<TicketItem[]>('/bookings/my-tickets', { params }))
  },
}
