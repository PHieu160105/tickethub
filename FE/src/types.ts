export type UserType = 'CUSTOMER' | 'EVENT_STAFF' | 'SYSTEM_ADMIN'
export type Gender = 'MALE' | 'FEMALE' | 'OTHER'
export type EventStatus = 'DRAFT' | 'LIVE' | 'CLOSED'
export type EventCategory = 'MUSIC' | 'THEATER' | 'DANCE' | 'TRADITIONAL' | 'COMEDY' | 'CIRCUS' | 'OTHER'
export type SeatStatus = 'AVAILABLE' | 'LOCKED' | 'SOLD'
export type QueueStatus = 'WAITING' | 'ADMITTED' | 'EXPIRED' | 'COMPLETED'
export type PerformerRole = 'MAIN' | 'GUEST' | 'BACKUP'
export type SeatSource = 'LAYOUT' | 'FREE_FORM'

export interface User {
  id: number
  full_name: string
  email: string
  user_type: UserType
  gender: Gender
  age: number
}

export interface SiteSettings {
  site_name: string
  contact_email: string
  contact_phone: string
  website: string
  address: string
  description: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export interface EventCard {
  id: number
  slug: string
  title: string
  description: string
  category: EventCategory
  venue: string
  start_at: string
  end_at: string
  cover_image_url: string
  status: EventStatus
  created_at: string
  max_price: number
}

export interface ShowSummary {
  id: number
  event_id: number
  title: string
  description: string
  location: string
  start_at: string
  end_at: string
  status: EventStatus
  seat_source: SeatSource
  performers: ShowPerformer[]
  venue_layout_id?: number | null
}

export interface ShowPerformer {
  performer_id: number
  stage_name: string
  artist_type: string | null
  image_url: string | null
  role: PerformerRole
  sort_order: number
}

export interface AdminShowPerformer extends ShowPerformer {
  show_performer_id: number
  show_id: number
}

export interface PerformerSuggestionItem {
  id: number
  stage_name: string
  artist_type: string | null
  show_count: number
  has_image: boolean
}

export interface PerformerDetail {
  id: number
  stage_name: string
  artist_type: string | null
  image_url: string | null
}

export interface VenueSummary {
  id: number
  name: string
  is_active: boolean
  created_at: string
}

export interface VenueDetail extends VenueSummary {
  address: string | null
  width: number
  height: number
  background_source: string | null
  background_type: 'svg' | 'raster' | null
  created_by_staff_id: number | null
  updated_at: string
}

export interface VenueLayoutItem {
  id: number
  venue_id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface VenueSeatItem {
  id: number
  venue_layout_id: number | null
  label: string
  row_label: string | null
  seat_number: number | null
  x: number | null
  y: number | null
}

export interface TicketTier {
  id: number
  code: string
  name: string
  description: string | null
  base_price: number
  color: string
  is_active: boolean
}

export interface EventDetail extends EventCard {
  shows: ShowSummary[]
}

export interface ShowDetail extends ShowSummary {
  event_slug: string
  event_title: string
  hold_minutes: number
  ticket_tiers: TicketTier[]
}

export interface Seat {
  id: number
  ticket_tier_id: number | null
  row_index: number
  row_label: string
  seat_number: number
  seat_label: string
  price: number
  status: SeatStatus
  lock_expires_at: string | null
  is_locked_by_me: boolean
  is_admin_locked: boolean
  locked_by_user?: SeatUserInfo | null
  sold_to_user?: SeatPurchaseInfo | null
}

export interface SeatUserInfo {
  user_id: number
  full_name: string
  email: string
  gender: Gender
  age: number
}

export interface SeatPurchaseInfo {
  user: SeatUserInfo
  order_id: number
  ticket_code: string | null
  issued_at: string | null
}

export interface SeatMatrixResponse {
  show_id: number
  show_title: string
  event_id: number
  event_slug: string
  event_title: string
  queue_required: boolean
  ticket_tiers: TicketTier[]
  seats: Seat[]
}

export interface SeatMapTicketTier {
  id: number
  name: string
  code: string
  color: string
  price: number
}

export interface SeatMapBackground {
  source: string | null
  type: 'svg' | 'raster' | null
  width: number | null
  height: number | null
}

export interface SeatMapSeat {
  id: number
  label: string
  x: number | null
  y: number | null
  ticket_tier_id: number | null
  ticket_tier_name: string | null
  price: number
  status: SeatStatus
  lock_expires_at: string | null
  is_locked_by_me: boolean
  is_admin_locked: boolean
}

export interface SeatMapResponse {
  show_id: number
  show_title: string
  event_id: number
  event_slug: string
  event_title: string
  venue_name: string
  queue_required: boolean
  background: SeatMapBackground | null
  ticket_tiers: SeatMapTicketTier[]
  seats: SeatMapSeat[]
  seat_count: number
}

export interface QueueJoinResponse {
  token: string
  status: QueueStatus
  position: number
  message: string
  admitted_until: string | null
}

export interface QueueStatusResponse {
  token: string
  status: QueueStatus
  position?: number | null
  admitted_until?: string | null
  message: string
}

export interface QueueRequirementResponse {
  required: boolean
  active_users: number
  threshold: number
  message: string
}

export interface LockSeatResponse {
  locked_seat_ids: number[]
  failed_seat_ids: number[]
  message: string
}

export interface CheckoutItem {
  seat_id: number
  seat_label: string
  ticket_tier_name: string
  price: number
  ticket_code: string
  qr_payload: string
}

export interface CheckoutResponse {
  order_id: number
  order_status: 'PENDING_PAYMENT' | 'PAID' | 'PAYMENT_FAILED' | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED' | 'REFUND_FAILED'
  total_amount: number
  payment_url: string
  gateway_order_ref: string
  payment_expires_at?: string | null
  paid_at?: string | null
  items: CheckoutItem[]
}

export interface OrderStatusResponse {
  order_id: number
  order_code?: string | null
  order_status: 'PENDING_PAYMENT' | 'PAID' | 'PAYMENT_FAILED' | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED' | 'REFUND_FAILED'
  total_amount: number
  payment_provider?: string | null
  gateway_order_ref?: string | null
  gateway_transaction_id?: string | null
  payment_expires_at?: string | null
  paid_at?: string | null
  refunded_at?: string | null
  items: CheckoutItem[]
}

export interface TicketItem {
  ticket_id?: number
  ticket_code: string
  qr_payload?: string
  event_id: number
  event_slug: string
  event_title: string
  show_id: number
  show_title: string
  show_start_at: string
  show_end_at: string
  event_cover_image_url: string
  venue: string
  seat_label: string
  ticket_tier_name: string
  price: number
  order_id?: number
  seat_status: SeatStatus
  ticket_status: 'active'
  issued_at?: string
}

export interface DashboardSummary {
  total_revenue: number
  tickets_sold: number
  active_events: number
  waiting_queue_users: number
}

export interface RevenuePoint {
  date: string
  revenue: number
}

export interface AudienceDistribution {
  age_groups: Record<string, number>
  gender_groups: Record<string, number>
}

export interface OccupancyItem {
  event_id: number
  event_title: string
  show_id: number
  show_title: string
  show_start_at: string
  venue: string
  total_seats: number
  sold_seats: number
  locked_seats: number
  occupancy_rate: number
}

export interface DashboardRealtimePayload {
  summary: DashboardSummary
  revenue: RevenuePoint[]
  occupancy: OccupancyItem[]
}

export interface AdminEventUpdatePayload {
  title?: string
  description?: string
  category?: EventCategory | string
  seat_source?: SeatSource
  start_date?: string
  end_date?: string
  cover_image_url?: string
  status?: EventStatus
}

export interface EventTicketTierStats {
  ticket_tier_id: number
  ticket_tier_code: string
  ticket_tier_name: string
  color: string
  total_seats: number
  sold_seats: number
  locked_seats: number
  available_seats: number
  occupancy_rate: number
  min_price: number
  max_price: number
}

export interface EventDetailStats {
  event_id: number
  event_title: string
  show_id: number
  show_title: string
  show_start_at: string
  show_end_at: string
  total_seats: number
  sold_seats: number
  locked_seats: number
  available_seats: number
  occupancy_rate: number
  tickets_issued: number
  total_revenue: number
  ticket_tier_stats: EventTicketTierStats[]
}

export interface ApiMessage {
  detail: string
}

export interface SearchSuggestionItem {
  label: string
  value: string
  item_type: string
  meta: Record<string, string | number | null>
}

export interface AdminUserItem {
  id: number
  full_name: string
  email: string
  user_type: string
  gender: string
  age: number
  total_tickets: number
  registered_at: string
}

export interface AdminTicketSaleItem {
  id: number
  event_id: number
  event_title: string
  show_id: number
  show_title: string
  show_start_at: string
  customer_name: string
  seat_label: string
  ticket_tier_name: string
  venue: string
  price: number
  purchased_at: string
  order_status: string
}

export interface AdminTransactionLogItem {
  id: number
  action: string
  status: string
  payment_method?: string | null
  gateway_transaction_id?: string | null
  gateway_response_code?: string | null
  amount?: number | null
  message?: string | null
  raw_payload?: string | null
  created_at: string
}

export interface AdminTicketTransactionHistory {
  ticket_id: number
  seat_label: string
  ticket_tier_name: string
  price: number
  show_id: number
  show_title: string
  show_start_at: string
  event_id: number
  event_title: string
  venue: string
  order_id: number
  order_code?: string | null
  order_status: string
  payment_provider?: string | null
  gateway_order_ref?: string | null
  gateway_transaction_id?: string | null
  payment_started_at?: string | null
  payment_expires_at?: string | null
  paid_at?: string | null
  buyer_name?: string | null
  buyer_email?: string | null
  buyer_phone?: string | null
  logs: AdminTransactionLogItem[]
}

export interface AdminEventRevenueItem {
  event_id: number
  event_title: string
  show_id: number
  show_title: string
  show_start_at: string
  tickets_sold: number
  revenue: number
}

export interface PaginatedAdminUsersResponse {
  items: AdminUserItem[]
  total: number
  limit: number
  offset: number
}

export interface PaginatedAdminTicketSalesResponse {
  items: AdminTicketSaleItem[]
  total: number
  limit: number
  offset: number
}

export interface EventStaffItem {
  user_id: number
  full_name: string
  email: string
  staff_code: string
  is_active: boolean
  created_at: string
}

export interface AssignedEventStaffItem {
  user_id: number
  full_name: string
  staff_code: string
}

export interface EventAssignmentOverviewItem {
  event_id: number
  event_slug: string
  event_title: string
  event_status: EventStatus
  assigned_staff: AssignedEventStaffItem[]
}
