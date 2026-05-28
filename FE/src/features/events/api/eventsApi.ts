/**
 * Các hàm gọi API sự kiện.
 */

import { api, withRetry } from '../../../lib/api'
import type { EventCard, EventDetail, SeatMatrixResponse, ShowDetail } from '../../../types'

export interface EventListParams {
  search?: string
  category?: string
  start_from?: string
  end_to?: string
  limit?: number
  offset?: number
}

export const eventsApi = {
  /**
   * Lấy danh sách sự kiện kèm bộ lọc tùy chọn.
   */
  async list(params?: EventListParams): Promise<EventCard[]> {
    const response = await withRetry(() => api.get<EventCard[]>('/events', { params }))
    return response as EventCard[]
  },

  /**
   * Lấy chi tiết sự kiện bằng slug hoặc id.
   */
  async detail(eventKey: string): Promise<EventDetail> {
    const response = await withRetry(() => api.get<EventDetail>(`/events/${eventKey}`))
    return response as EventDetail
  },

  /**
   * Lấy chi tiết một buổi diễn.
   */
  async show(showId: number): Promise<ShowDetail> {
    const response = await withRetry(() => api.get<ShowDetail>(`/shows/${showId}`))
    return response as ShowDetail
  },
  async seats(showId: number, queueToken?: string): Promise<SeatMatrixResponse> {
    const response = await withRetry(() => api.get<SeatMatrixResponse>(`/shows/${showId}/seats`, {
      headers: queueToken ? { 'X-Queue-Token': queueToken } : undefined,
    }))
    return response as SeatMatrixResponse
  },
}
