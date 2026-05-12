/**
 * Queue API functions
 */

import { api, withRetry } from '../../../lib/api'
import type { QueueJoinResponse, QueueStatusResponse } from '../../../types'

export const queueApi = {
  /**
   * Join queue for a show
   */
  async join(showId: number) {
    const response = await api.post<QueueJoinResponse>(`/shows/${showId}/queue/join`)
    return response.data
  },

  /**
   * Get queue status
   */
  async status(showId: number, token: string) {
    return withRetry(() => api.get<QueueStatusResponse>(`/shows/${showId}/queue/status/${token}`))
  },

  /**
   * Send heartbeat to keep queue session alive
   */
  async heartbeat(showId: number, token: string) {
    await api.post(`/shows/${showId}/queue/heartbeat/${token}`)
  },
}
