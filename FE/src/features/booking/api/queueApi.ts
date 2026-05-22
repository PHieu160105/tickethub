/**
 * Các hàm gọi API hàng đợi ảo.
 *
 * Ghi chú:
 * - File này thuộc frontend, chỉ bọc URL và trả dữ liệu cho page/hook dùng lại.
 * - Logic nghiệp vụ thật như cấp lượt, hết hạn token, tính vị trí nằm ở backend.
 */

import { api, withRetry } from '../../../lib/api'
import type { QueueJoinResponse, QueueStatusResponse } from '../../../types'

export const queueApi = {
  /**
   * Tham gia hàng đợi của một buổi diễn.
   */
  async join(showId: number) {
    return withRetry(() => api.post<QueueJoinResponse>(`/shows/${showId}/queue/join`, undefined, { timeout: 30000 }), 2)
  },

  /**
   * Lấy trạng thái hiện tại của token hàng đợi.
   */
  async status(showId: number, token: string) {
    return withRetry(() => api.get<QueueStatusResponse>(`/shows/${showId}/queue/status/${token}`, { timeout: 30000 }), 2)
  },

  /**
   * Gửi heartbeat để backend biết người dùng vẫn còn mở phiên hàng đợi.
   */
  async heartbeat(showId: number, token: string) {
    await api.post(`/shows/${showId}/queue/heartbeat/${token}`)
  },

  /**
   * Rời hàng đợi/lượt vào khi người dùng thoát khỏi luồng mua vé.
   */
  async leave(showId: number, token: string) {
    await api.post(`/shows/${showId}/queue/leave/${token}`)
  },
}
