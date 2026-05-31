import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'

import { API_BASE_URL, API_TIMEOUT, API_RETRY_ATTEMPTS, API_RETRY_DELAY } from '../constants'
import { authStorage } from './storage'
import type {
  ApiMessage,
  AdminEventUpdatePayload,
  AdminShowPerformer,
  AdminEventRevenueItem,
  AdminTicketTransactionHistory,
  AudienceDistribution,
  AuthResponse,
  CheckoutResponse,
  DashboardSummary,
  EventCard,
  EventDetailStats,
  EventDetail,
  PerformerDetail,
  ShowDetail,
  ShowSummary,
  LockSeatResponse,
  OccupancyItem,
  PerformerSuggestionItem,
  PaginatedAdminTicketSalesResponse,
  PaginatedAdminUsersResponse,
  QueueJoinResponse,
  QueueRequirementResponse,
  QueueStatusResponse,
  RevenuePoint,
  SeatMatrixResponse,
  ShowSeatPolygonItem,
  TicketItem,
  VenuePolygonItem,
  VenueDetail,
  VenueLayoutItem,
  VenueSeatItem,
  VenueSectionItem,
  VenueSummary,
  SeatMapResponse,
  SeatZone,
  SearchSuggestionItem,
  SiteSettings,
} from '../types'

const apiBaseURL = API_BASE_URL

type RetryableAuthRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
  skipAuthRefresh?: boolean
}

export const api = axios.create({
  baseURL: apiBaseURL,
  timeout: API_TIMEOUT,
})

let refreshPromise: Promise<string | null> | null = null

type RetryableRequest<T> = () => Promise<{ data: T }>
type ApiValidationError = {
  loc?: Array<string | number>
  msg?: string
}
type ApiErrorBody = {
  detail?: string | ApiValidationError[] | Record<string, unknown>
  message?: string
}
type VenueSeatSyncResponse = {
  created: Array<{ client_id: number; id: number; label: string; row_label: string; seat_number: number; x: number | null; y: number | null }>
  updated_ids: number[]
  deleted_ids: number[]
}
type EventSeatSyncResponse = {
  created: Array<{ client_id: number; id: number; seat_label: string; x: number | null; y: number | null }>
  updated_ids: number[]
  deleted_ids: number[]
}

function isRetryableError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  const statusCode = error.response?.status
  return !statusCode || statusCode >= 500 || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK'
}

async function withRetry<T>(request: RetryableRequest<T>, attempts = API_RETRY_ATTEMPTS): Promise<T> {
  let previousError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await request()
      return response.data
    } catch (error) {
      previousError = error
      if (attempt >= attempts || !isRetryableError(error)) {
        break
      }
      await new Promise((resolve) => window.setTimeout(resolve, API_RETRY_DELAY * attempt))
    }
  }

  throw previousError
}

export { withRetry }

export function postAuthorizedJsonKeepalive(path: string, payload: unknown): boolean {
  /**
   * Gửi một POST nền có `keepalive` để trình duyệt cố hoàn tất yêu cầu ngay cả khi
   * người dùng đang rời trang hoặc đóng tab.
   *
   * Đầu vào:
   * - `path`: đường dẫn API tương đối, ví dụ `/bookings/release`.
   * - `payload`: dữ liệu JSON gửi lên máy chủ ứng dụng.
   *
   * Đầu ra:
   * - `true` nếu giao diện người dùng đã bắt đầu yêu cầu nền.
   * - `false` nếu thiếu `fetch`, thiếu token hoặc không thể khởi tạo yêu cầu.
   *
   * Cách hoạt động:
   * - Lấy JWT đang đăng nhập từ local storage.
   * - Dùng `fetch(..., { keepalive: true })` để giảm nguy cơ yêu cầu bị hủy khi trang bị tháo khỏi giao diện.
   * - Không chờ phản hồi vì đây là nhánh dọn dẹp tài nguyên ở nền.
   */

  const token = authStorage.getToken()
  if (!token || typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return false
  }

  try {
    void window.fetch(`${apiBaseURL}${path}`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    return true
  } catch {
    return false
  }
}

export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback

  const typedError = error as AxiosError<ApiErrorBody>
  const detail = typedError.response?.data?.detail
  const message = typedError.response?.data?.message

  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = item.loc?.filter((part) => part !== 'body').join('.')
        return field ? `${field}: ${item.msg ?? 'Giá trị không hợp lệ'}` : item.msg ?? 'Giá trị không hợp lệ'
      })
      .join('; ')
  }
  if (message) return message

  if (typedError.code === 'ECONNABORTED') return 'Yêu cầu quá thời gian chờ. Vui lòng thử lại.'
  if (typedError.code === 'ERR_NETWORK') return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.'

  return fallback
}

export function isWaitingRoomRequiredError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  const detail = (error as AxiosError<ApiErrorBody>).response?.data?.detail
  return error.response?.status === 429 && typeof detail === 'object' && detail !== null && !Array.isArray(detail) && detail['code'] === 'WAITING_ROOM_REQUIRED'
}

export function getWaitingRoomQueueUrl(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback
  const detail = (error as AxiosError<ApiErrorBody>).response?.data?.detail
  if (typeof detail === 'object' && detail !== null && !Array.isArray(detail) && typeof detail['queue_url'] === 'string') {
    return detail['queue_url']
  }
  return fallback
}

api.interceptors.request.use((config: RetryableAuthRequestConfig) => {
  const token = authStorage.getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = authStorage.getRefreshToken()
  if (!refreshToken) return null

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await api.post<AuthResponse>(
          '/auth/refresh',
          { refresh_token: refreshToken },
          { skipAuthRefresh: true } as RetryableAuthRequestConfig,
        )
        authStorage.setToken(response.data.access_token)
        authStorage.setRefreshToken(response.data.refresh_token)
        authStorage.setUser(response.data.user)
        return response.data.access_token
      } catch {
        authStorage.clearAll()
        return null
      } finally {
        refreshPromise = null
      }
    })()
  }

  return refreshPromise
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const originalRequest = error.config as RetryableAuthRequestConfig | undefined
    if (!originalRequest || originalRequest.skipAuthRefresh || error.response?.status !== 401 || originalRequest._retry) {
      throw error
    }

    originalRequest._retry = true
    const nextAccessToken = await refreshAccessToken()
    if (!nextAccessToken) {
      throw error
    }

    originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`
    return api(originalRequest)
  },
)

export const authApi = {
  async login(email: string, password: string) {
    return withRetry(
      () => api.post<AuthResponse>('/auth/login', { email, password }, { timeout: 10000, skipAuthRefresh: true } as RetryableAuthRequestConfig),
      2,
    )
  },
  async register(payload: {
    full_name: string
    email: string
    password: string
    gender: 'MALE' | 'FEMALE' | 'OTHER'
    age: number
  }) {
    const response = await api.post<AuthResponse>('/auth/register', payload, { skipAuthRefresh: true } as RetryableAuthRequestConfig)
    return response.data
  },
  async googleTokenLogin(accessToken: string) {
    const response = await api.post<AuthResponse>(
      '/auth/google-token',
      { access_token: accessToken },
      { skipAuthRefresh: true } as RetryableAuthRequestConfig,
    )
    return response.data
  },
  async refresh(refreshToken: string) {
    const response = await api.post<AuthResponse>(
      '/auth/refresh',
      { refresh_token: refreshToken },
      { skipAuthRefresh: true } as RetryableAuthRequestConfig,
    )
    return response.data
  },
  async me() {
    return withRetry(() => api.get<AuthResponse['user']>('/auth/me', { timeout: 8000 }), 2)
  },
  async updateMe(payload: { full_name: string; gender: 'MALE' | 'FEMALE' | 'OTHER'; age: number }) {
    const response = await api.patch<AuthResponse['user']>('/auth/me', payload)
    return response.data
  },
}

export const eventApi = {
  async list(params?: { search?: string; category?: string; start_from?: string; end_to?: string; limit?: number; offset?: number }) {
    return withRetry(() => api.get<EventCard[]>('/events', { params }))
  },
  async detail(eventKey: string) {
    return withRetry(() => api.get<EventDetail>(`/events/${eventKey}`))
  },
  async show(showId: number) {
    return withRetry(() => api.get<ShowDetail>(`/shows/${showId}`))
  },
  async seats(showId: number, queueToken?: string) {
    return withRetry(() => api.get<SeatMatrixResponse>(`/shows/${showId}/seats`, {
      headers: queueToken ? { 'X-Queue-Token': queueToken } : undefined,
    }))
  },
}

export const seatmapApi = {
  async get(showId: number, queueToken?: string) {
    return withRetry(() => api.get<SeatMapResponse>(`/shows/${showId}/seatmap`, {
      headers: queueToken ? { 'X-Queue-Token': queueToken } : undefined,
    }))
  },
}

export const queueApi = {
  async check(showId: number) {
    return withRetry(() => api.get<QueueRequirementResponse>(`/shows/${showId}/queue/check`))
  },
  async join(showId: number) {
    const response = await api.post<QueueJoinResponse>(`/shows/${showId}/queue/join`)
    return response.data
  },
  async status(showId: number, token: string) {
    return withRetry(() => api.get<QueueStatusResponse>(`/shows/${showId}/queue/status/${token}`))
  },
  async heartbeat(showId: number, token: string) {
    await api.post(`/shows/${showId}/queue/heartbeat/${token}`)
  },
  async leave(showId: number, token: string) {
    await api.post(`/shows/${showId}/queue/leave/${token}`)
  },
}

export const bookingApi = {
  async lock(showId: number, seatIds: number[], queueToken?: string) {
    return withRetry(
      () =>
        api.post<LockSeatResponse>('/bookings/lock', {
          show_id: showId,
          seat_ids: seatIds,
          queue_token: queueToken,
        }),
      2,
    )
  },
  async release(showId: number, seatIds: number[]) {
    const response = await api.post<ApiMessage>('/bookings/release', {
      show_id: showId,
      seat_ids: seatIds,
    })
    return response.data
  },
  async checkout(showId: number, queueToken?: string) {
    const response = await api.post<CheckoutResponse>('/bookings/checkout', {
      show_id: showId,
      queue_token: queueToken,
    })
    return response.data
  },
  async checkoutWithDiscount(showId: number, queueToken: string | undefined, discountCode: string | undefined) {
    const response = await api.post<CheckoutResponse>('/bookings/checkout', {
      show_id: showId,
      queue_token: queueToken,
      discount_code: discountCode,
    })
    return response.data
  },
  async myTickets(params?: { search?: string; start_from?: string; end_to?: string; limit?: number; offset?: number }) {
    return withRetry(() => api.get<TicketItem[]>('/bookings/my-tickets', { params }))
  },
}

export const adminApi = {
  async listEvents(params?: { search?: string; category?: string; start_from?: string; end_to?: string }) {
    return withRetry(() => api.get<EventCard[]>('/admin/events', { params }))
  },
  async getEvent(eventKey: string | number) {
    return withRetry(() => api.get<EventDetail>(`/admin/events/${eventKey}`))
  },
  async createEvent(payload: unknown) {
    const response = await api.post<EventDetail>('/admin/events', payload)
    return response.data
  },
  async updateEvent(eventKey: string | number, payload: AdminEventUpdatePayload) {
    const response = await api.patch<EventDetail>(`/admin/events/${eventKey}`, payload)
    return response.data
  },
  async deleteEvent(eventKey: string | number) {
    const response = await api.delete<ApiMessage>(`/admin/events/${eventKey}`)
    return response.data
  },
  async listShows(eventKey: string | number) {
    return withRetry(() => api.get<ShowSummary[]>(`/admin/events/${eventKey}/shows`))
  },
  async getShow(eventKey: string | number, showId: number) {
    return withRetry(() => api.get<ShowDetail>(`/admin/events/${eventKey}/shows/${showId}`))
  },
  async createShow(eventKey: string | number, payload: unknown) {
    const response = await api.post<ShowDetail>(`/admin/events/${eventKey}/shows`, payload)
    return response.data
  },
  async updateShow(eventKey: string | number, showId: number, payload: unknown) {
    const response = await api.patch<ShowDetail>(`/admin/events/${eventKey}/shows/${showId}`, payload)
    return response.data
  },
  async deleteShow(eventKey: string | number, showId: number) {
    const response = await api.delete<ApiMessage>(`/admin/events/${eventKey}/shows/${showId}`)
    return response.data
  },
  async showStats(eventKey: string | number, showId: number) {
    return withRetry(() => api.get<EventDetailStats>(`/admin/events/${eventKey}/shows/${showId}/stats`))
  },
  async uploadEventImage(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<{ image_url: string }>('/admin/events/upload-image', formData)
    return response.data
  },
  async getShowPerformers(showId: number) {
    return withRetry(() => api.get<AdminShowPerformer[]>(`/admin/shows/${showId}/performers`))
  },
  async updateShowPerformers(showId: number, payload: { performers: unknown[] }) {
    const response = await api.put<AdminShowPerformer[]>(`/admin/shows/${showId}/performers`, payload)
    return response.data
  },
  async suggestPerformers(q: string, limit = 8) {
    return withRetry(() => api.get<PerformerSuggestionItem[]>('/admin/performers/suggest', { params: { q, limit } }))
  },
  async getPerformerDetail(performerId: number) {
    return withRetry(() => api.get<PerformerDetail>(`/admin/performers/${performerId}`))
  },
  async uploadPerformerImage(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<{ image_url: string }>('/admin/performers/upload-image', formData)
    return response.data
  },
  async summary() {
    return withRetry(() => api.get<DashboardSummary>('/admin/dashboard/summary'))
  },
  async revenue(days = 14) {
    return withRetry(() => api.get<RevenuePoint[]>('/admin/dashboard/revenue', { params: { days } }))
  },
  async audience() {
    return withRetry(() => api.get<AudienceDistribution>('/admin/dashboard/audience'))
  },
  async occupancy() {
    return withRetry(() => api.get<OccupancyItem[]>('/admin/dashboard/occupancy'))
  },
  async users(params?: { search?: string; user_type?: string; limit?: number; offset?: number }) {
    return withRetry(() => api.get<PaginatedAdminUsersResponse>('/admin/users', { params }))
  },
  async ticketSales(params?: { event_id?: number; status_filter?: string; limit?: number; offset?: number }) {
    return withRetry(() => api.get<PaginatedAdminTicketSalesResponse>('/admin/tickets/sales', { params }))
  },
  async ticketTransactionHistory(ticketId: number) {
    return withRetry(() => api.get<AdminTicketTransactionHistory>(`/admin/tickets/sales/${ticketId}/transaction-history`))
  },
  async revenueByEvent() {
    return withRetry(() => api.get<AdminEventRevenueItem[]>('/admin/tickets/revenue-by-show'))
  },
  async listVenues(params?: { search?: string; limit?: number; offset?: number }) {
    return withRetry(() => api.get<VenueSummary[]>('/admin/venues', { params }))
  },
  async getVenue(venueId: number) {
    return withRetry(() => api.get<VenueDetail>(`/admin/venues/${venueId}`))
  },
  async createVenue(payload: {
    name: string
    address?: string | null
  }) {
    const response = await api.post<VenueDetail>('/admin/venues', payload)
    return response.data
  },
  async updateVenue(
    venueId: number,
    payload: Partial<{
      name: string
      address: string | null
      is_active: boolean
    }>,
  ) {
    const response = await api.patch<VenueDetail>(`/admin/venues/${venueId}`, payload)
    return response.data
  },
  async deleteVenue(venueId: number) {
    const response = await api.delete(`/admin/venues/${venueId}`)
    return response.data
  },
  async uploadVenueBackground(venueId: number, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<{ detail: string; venue_id: number; background_type: string; content_type: string; width: number; height: number }>(
      `/admin/venues/${venueId}/upload-background`,
      formData,
    )
    return response.data
  },
  async listLayouts(venueId: number) {
    return withRetry(() => api.get<VenueLayoutItem[]>(`/admin/venues/${venueId}/layouts`))
  },
  async listVenueSeats(venueId: number, layoutId?: number | null) {
    return withRetry(() => api.get<VenueSeatItem[]>(`/admin/venues/${venueId}/seats`, {
      params: { layout_id: layoutId ?? undefined },
    }))
  },
  async createLayout(
    venueId: number,
    payload: { name: string; description?: string | null },
  ) {
    const response = await api.post<VenueLayoutItem>(`/admin/venues/${venueId}/layouts`, payload)
    return response.data
  },
  async updateLayout(
    layoutId: number,
    payload: { name?: string; description?: string | null },
  ) {
    const response = await api.patch<VenueLayoutItem>(`/admin/layouts/${layoutId}`, payload)
    return response.data
  },
  async deleteLayout(layoutId: number) {
    const response = await api.delete(`/admin/layouts/${layoutId}`)
    return response.data
  },
  async listLayoutSections(layoutId: number) {
    return withRetry(() => api.get<VenueSectionItem[]>(`/admin/layouts/${layoutId}/sections`))
  },
  async createLayoutSection(
    layoutId: number,
    payload: { name: string; code: string; color?: string; price_base: number; sort_order?: number },
  ) {
    const response = await api.post<VenueSectionItem>(`/admin/layouts/${layoutId}/sections`, payload)
    return response.data
  },
  async updateSection(
    sectionId: number,
    payload: Partial<{ name: string; code: string; color: string; price_base: number; sort_order: number }>,
  ) {
    const response = await api.patch<VenueSectionItem>(`/admin/sections/${sectionId}`, payload)
    return response.data
  },
  async deleteSection(sectionId: number) {
    const response = await api.delete(`/admin/sections/${sectionId}`)
    return response.data
  },
  async createVenueSeatSingle(
    venueId: number,
    payload: { layout_id?: number | null; label: string; row_label?: string | null; seat_number?: number | null; x: number; y: number },
  ) {
    const response = await api.post<VenueSeatItem>(`/admin/venues/${venueId}/seats/single`, payload)
    return response.data
  },
  async createVenueSeatBulk(
    venueId: number,
    payload: {
      layout_id?: number | null
      pattern: 'straight' | 'arc' | 'zigzag'
      rows: number
      cols: number
      gap_x: number
      gap_y: number
      start_x: number
      start_y: number
      label_prefix: string
      arc_config?: { center_x: number; center_y: number; radius: number; start_angle: number; end_angle: number } | null
    },
  ) {
    const response = await api.post<{ created_count: number; seats: VenueSeatItem[] }>(`/admin/venues/${venueId}/seats/bulk`, payload)
    return response.data
  },
  async updateVenueSeat(
    seatId: number,
    payload: Partial<{ label: string; row_label: string | null; seat_number: number | null; x: number; y: number }>,
  ) {
    const response = await api.patch<VenueSeatItem>(`/admin/seats/${seatId}`, payload)
    return response.data
  },
  async syncVenueSeats(
    venueId: number,
    payload: {
      layout_id?: number | null
      create: Array<{ client_id: number; label: string; row_label: string | null; seat_number: number | null; x: number; y: number }>
      update: Array<{ id: number; label: string; row_label: string | null; seat_number: number | null; x: number; y: number }>
      delete_ids: number[]
    },
  ) {
    const response = await api.post<VenueSeatSyncResponse>(`/admin/venues/${venueId}/seats/sync`, payload)
    return response.data
  },
  async deleteVenueSeat(seatId: number) {
    const response = await api.delete<ApiMessage>(`/admin/seats/${seatId}`)
    return response.data
  },
  async listVenuePolygons(venueId: number, layoutId?: number | null) {
    return withRetry(() =>
      api.get<VenuePolygonItem[]>(`/admin/venues/${venueId}/polygons`, {
        params: { layout_id: layoutId ?? undefined },
      }),
    )
  },
  async createVenuePolygon(
    venueId: number,
    payload: { layout_id?: number | null; section_id?: number | null; label?: string | null; points: Array<{ x: number; y: number }> },
  ) {
    const response = await api.post<VenuePolygonItem>(`/admin/venues/${venueId}/polygons`, payload)
    return response.data
  },
  async updateVenuePolygon(
    polygonId: number,
    payload: Partial<{ section_id: number | null; label: string | null; points: Array<{ x: number; y: number }> }>,
  ) {
    const response = await api.patch<VenuePolygonItem>(`/admin/polygons/${polygonId}`, payload)
    return response.data
  },
  async deleteVenuePolygon(polygonId: number) {
    const response = await api.delete<ApiMessage>(`/admin/polygons/${polygonId}`)
    return response.data
  },
  async getShowZones(eventKey: string | number, showId: number) {
    return withRetry(() => api.get<SeatZone[]>(`/admin/events/${eventKey}/shows/${showId}/zones`))
  },
  async createZone(
    eventKey: string | number,
    showId: number,
    payload: Omit<SeatZone, 'id'> & { generate_seats?: boolean },
  ) {
    const response = await api.post<SeatZone>(`/admin/events/${eventKey}/shows/${showId}/zones`, payload)
    return response.data
  },
  async createInitialZone(
    eventKey: string | number,
    showId: number,
    payload: Omit<SeatZone, 'id'>,
  ) {
    const response = await api.post<SeatZone>(`/admin/events/${eventKey}/shows/${showId}/zones/initial`, payload)
    return response.data
  },
  async updateZone(
    eventKey: string | number,
    showId: number,
    zoneId: number,
    payload: Omit<SeatZone, 'id'> & { regenerate_seats?: boolean },
  ) {
    const response = await api.patch<SeatZone>(`/admin/events/${eventKey}/shows/${showId}/zones/${zoneId}`, payload)
    return response.data
  },
  async deleteZone(eventKey: string | number, showId: number, zoneId: number) {
    const response = await api.delete(`/admin/events/${eventKey}/shows/${showId}/zones/${zoneId}`)
    return response.data
  },
  async createShowPolygon(
    eventKey: string | number,
    showId: number,
    payload: { zone_id?: number | null; label?: string | null; points: Array<{ x: number; y: number }> },
  ) {
    const response = await api.post<ShowSeatPolygonItem>(`/admin/events/${eventKey}/shows/${showId}/polygons`, payload)
    return response.data
  },
  async updateShowPolygon(
    polygonId: number,
    payload: Partial<{ zone_id: number | null; label: string | null; points: Array<{ x: number; y: number }> }>,
  ) {
    const response = await api.patch<ShowSeatPolygonItem>(`/admin/show-polygons/${polygonId}`, payload)
    return response.data
  },
  async deleteShowPolygon(polygonId: number) {
    const response = await api.delete<ApiMessage>(`/admin/show-polygons/${polygonId}`)
    return response.data
  },
  async createEventSeatSingle(
    eventKey: string | number,
    showId: number,
    payload: { seat_label: string; x: number; y: number; rotation?: number; zone_id?: number | null; section_id?: number | null; price?: number | null; is_admin_locked?: boolean },
  ) {
    const response = await api.post(`/admin/events/${eventKey}/shows/${showId}/seats/single`, payload)
    return response.data
  },
  async createEventSeatBulk(
    eventKey: string | number,
    showId: number,
    payload: {
      zone_id?: number | null
      section_id?: number | null
      pattern: 'straight' | 'arc'
      rows: number
      cols: number
      gap_x: number
      gap_y: number
      start_x: number
      start_y: number
      label_prefix: string
      arc_config?: { center_x: number; center_y: number; radius: number; start_angle: number; end_angle: number } | null
    },
  ) {
    const response = await api.post(`/admin/events/${eventKey}/shows/${showId}/seats/bulk`, payload)
    return response.data
  },
  async updateEventSeat(
    eventKey: string | number,
    showId: number,
    seatId: number,
    payload: Partial<{ seat_label: string; x: number; y: number; rotation: number; zone_id: number | null; section_id: number | null; price: number | null; is_admin_locked: boolean }>,
  ) {
    const response = await api.patch(`/admin/events/${eventKey}/shows/${showId}/seats/${seatId}`, payload)
    return response.data
  },
  async syncEventSeats(
    eventKey: string | number,
    showId: number,
    payload: {
      create: Array<{ client_id: number; seat_label: string; x: number; y: number; rotation: number; zone_id: number | null; section_id: number | null; price: number | null; is_admin_locked: boolean }>
      update: Array<{ id: number; seat_label: string; x: number; y: number; rotation: number; zone_id: number | null; section_id: number | null; price: number | null; is_admin_locked: boolean }>
      delete_ids: number[]
    },
  ) {
    const response = await api.post<EventSeatSyncResponse>(`/admin/events/${eventKey}/shows/${showId}/seats/sync`, payload)
    return response.data
  },
  async deleteEventSeat(eventKey: string | number, showId: number, seatId: number) {
    const response = await api.delete<ApiMessage>(`/admin/events/${eventKey}/shows/${showId}/seats/${seatId}`)
    return response.data
  },
}

export const siteSettingsApi = {
  async public() {
    return withRetry(() => api.get<SiteSettings>('/settings/site'))
  },
  async admin() {
    return withRetry(() => api.get<SiteSettings>('/admin/settings/site'))
  },
  async update(payload: SiteSettings) {
    const response = await api.put<SiteSettings>('/admin/settings/site', payload)
    return response.data
  },
}

export const searchApi = {
  async suggest(q: string, scope = 'global') {
    return withRetry(() => api.get<SearchSuggestionItem[]>('/search/suggest', { params: { q, scope } }))
  },
}
