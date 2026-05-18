/**
 * Hằng số cấu hình kết nối API.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8000/ws'

export const API_TIMEOUT = 15000

export const API_RETRY_ATTEMPTS = 2

export const API_RETRY_DELAY = 280

/**
 * Hằng số phân trang dùng chung.
 */
export const PAGINATION = {
  DEFAULT_LIMIT: 30,
  MIN_LIMIT: 1,
  MAX_LIMIT: 100,
  DEFAULT_OFFSET: 0,
} as const

/**
 * Hằng số hàng đợi ảo.
 */
export const QUEUE = {
  HEARTBEAT_INTERVAL: 30000, // 30 giây
  STATUS_POLL_INTERVAL: 5000, // 5 giây
} as const

/**
 * Hằng số thao tác đặt vé.
 */
export const BOOKING = {
  LOCK_DURATION_MINUTES: 10,
  CHECKOUT_TIMEOUT: 10000,
} as const

/**
 * Hằng số xác thực và localStorage.
 */
export const AUTH = {
  TOKEN_KEY: 'ticketrush_token',
  USER_KEY: 'ticketrush_user',
  STORAGE_PREFIX: 'ticketrush_',
} as const

/**
 * Danh sách endpoint backend theo từng nhóm nghiệp vụ.
 */
export const ENDPOINTS = {
  // Đường dẫn xác thực.
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    ME: '/auth/me',
    UPDATE_ME: '/auth/me',
  },
  // Đường dẫn sự kiện.
  EVENTS: {
    LIST: '/events',
    DETAIL: (eventKey: string) => `/events/${eventKey}`,
    SEATS: (showId: string | number) => `/shows/${showId}/seats`,
  },
  // Đường dẫn hàng đợi.
  QUEUE: {
    JOIN: (showId: string | number) => `/shows/${showId}/queue/join`,
    STATUS: (showId: string | number, token: string) => `/shows/${showId}/queue/status/${token}`,
    HEARTBEAT: (showId: string | number, token: string) => `/shows/${showId}/queue/heartbeat/${token}`,
  },
  // Đường dẫn đặt vé.
  BOOKINGS: {
    LOCK: '/bookings/lock',
    RELEASE: '/bookings/release',
    CHECKOUT: '/bookings/checkout',
    MY_TICKETS: '/bookings/my-tickets',
  },
  // Đường dẫn quản trị.
  ADMIN: {
    EVENTS: '/admin/events',
    EVENT_DETAIL: (eventKey: string | number) => `/admin/events/${eventKey}`,
    EVENT_STATS: (eventKey: string | number) => `/admin/events/${eventKey}/stats`,
    UPLOAD_IMAGE: '/admin/events/upload-image',
    DASHBOARD_SUMMARY: '/admin/dashboard/summary',
    DASHBOARD_REVENUE: '/admin/dashboard/revenue',
    DASHBOARD_AUDIENCE: '/admin/dashboard/audience',
    DASHBOARD_OCCUPANCY: '/admin/dashboard/occupancy',
  },
} as const
