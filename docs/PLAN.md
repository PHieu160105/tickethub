# Plan: Refactor `event` -> parent entity, `show` -> sellable ticket unit

## Summary
- Save this plan as `docs/event-show-refactor-plan.md` after approval, then implement in one refactor pass without dual-mode compatibility.
- `event` becomes the parent container: keep `title`, `description`, `category`, `cover_image_url`, `start_date`, `end_date`.
- `show` becomes the sellable unit: owns venue/date-time/seat map/queue/pricing/seat planner/ticket lifecycle.
- Customer flow stays event-first: user opens event detail as before, sees a list of shows in the info tab, then clicks `Đặt vé` on one show to enter queue and booking for that show.
- Existing data is migrated as `1 old event -> 1 new show`, with old ticketing state moved to that show.
- Admin notification optimization is scoped to admin only: show latest ticket purchases and help activity in the bell dropdown.

## Key Changes

### 1. Data model and migration
- Add `shows` table with:
  - `id`
  - `event_id`
  - `title`
  - `description`
  - `venue`
  - `start_at`
  - `end_at`
  - `status`
  - `hold_minutes`
  - `queue_enabled`
  - `queue_release_batch`
  - `max_active_queue_tokens`
  - `venue_id`
  - `venue_layout_id`
  - `created_by_user_id`
  - `is_deleted`
- Change `events` to store date-only fields:
  - replace current event-level datetime usage with `start_date` and `end_date`
  - keep `title`, `description`, `category`, `cover_image_url`, `status`, `is_deleted`
  - remove event-level venue/queue/hold/layout responsibility from service/API usage
- Move sellable relations from `event_id` to `show_id`:
  - `seat_zones.show_id`
  - `seats.show_id`
  - `queue_entries.show_id`
  - `orders.show_id`
  - `ticket_cancellations.show_id`
- Keep parent event available through `show.event_id`; do not preserve transactional logic on `event_id`.
- Migration/backfill:
  - create one show per old event
  - copy old event’s venue, datetime, queue config, layout references into that show
  - move zones, seats, queue entries, orders, cancellations to `show_id`
  - derive `event.start_date/end_date` from old event datetime range
  - for migrated show, use old event title/description/venue/time so current business meaning is preserved

### 2. Backend API and service refactor
- Simplify admin event create/update payloads:
  - event create/edit uses `title`, `description`, `category`, `cover_image_url`, `start_date`, `end_date`, `status`
- Add admin show CRUD under event:
  - `GET /admin/events/{eventKey}/shows`
  - `POST /admin/events/{eventKey}/shows`
  - `PATCH /admin/events/{eventKey}/shows/{showId}`
  - `DELETE /admin/events/{eventKey}/shows/{showId}`
  - `GET /admin/events/{eventKey}/shows/{showId}`
- Move seat/zone/planner routes from event to show:
  - `.../shows/{showId}/zones`
  - `.../shows/{showId}/seats/...`
  - seat planner data loaders use `showId`
- Public event detail response includes `shows` summary list for display on the customer event page.
- Queue routes become show-based:
  - `/shows/{showId}/queue/join`
  - `/shows/{showId}/queue/status/{token}`
  - `/shows/{showId}/queue/heartbeat/{token}`
- Booking payloads become show-based:
  - `lock`, `release`, `checkout` accept `show_id`
  - seat lookup, queue access, checkout, ticket issuance all validate by `show_id`
- Public seat map endpoints become show-based:
  - `/shows/{showId}/seats`
  - `/shows/{showId}/seatmap`
- Ticket/history/admin analytics responses include both `event_title` and `show_title`, and use show datetime as the ticket date/time reference.
- Dashboard, occupancy, ticket sales, revenue, queue metrics pivot to show-level aggregation with parent event name attached.

### 3. Frontend admin changes
- Admin event cards:
  - remove `Seat Planner` action from the event card
  - add `Detail` action
- Admin event create/edit modal:
  - keep event metadata only
  - remove venue, queue, hold, zone bootstrap, layout binding from event form
- Add admin event detail page/modal:
  - list all shows of the event
  - show actions: create, edit, delete, seat planner, stats if applicable
- Add admin show form:
  - `title`, `description`, `venue`
  - `show_date` constrained inside event date range
  - `start_time`, `end_time`
  - queue fields
  - seat map mode: classic grid or venue layout
- Move seat planner route to show scope:
  - `admin/events/:eventKey/shows/:showId/seating`
- Update admin analytics/tickets tables to display:
  - event name
  - show name
  - show datetime
  - venue from show

### 4. Frontend customer changes
- Keep event detail route unchanged: `/event/:eventKey`
- In event info tab, render show cards under event summary:
  - show title
  - venue
  - show date/time
  - `Đặt vé` button
- `Đặt vé` navigates into show booking flow:
  - queue page receives `showId`
  - seat selection page is show-based
  - checkout and confirmation carry `show_id`
- Update types/hooks/API clients:
  - add `ShowSummary`, `ShowDetail` as needed
  - event detail now contains `shows`
  - ticket item shows event title + show title + show datetime
- Any current event-seat assumptions in `SeatSelection`, queue storage, seatmap loading, checkout, confirmation must switch to `show_id`.

### 5. Admin notifications
- Replace static admin bell indicator in `AdminLayout` with real dropdown data.
- Notification sources:
  - latest ticket purchases from admin ticket-sales endpoint
  - latest help activity from admin help threads
- Notification rules:
  - ticket notification item = newest sales rows
  - help notification item = threads with `unread_admin > 0`, ordered by latest message
- Use polling on the admin layout; no backend notification table in this phase.
- Persist seen state in admin local storage only.
- Reuse one shared FE notification/toast utility for admin bell rendering and transient success/error messages where touched by this refactor.

## Public Interfaces / Type Changes
- `EventDetail` gains `shows: ShowSummary[]`
- New `ShowSummary` includes `id`, `event_id`, `title`, `description`, `venue`, `start_at`, `end_at`, `status`, `queue_enabled`
- Booking contracts switch from `event_id` to `show_id`
- Queue contracts switch from `eventKey` to `showId`
- Seat matrix / seatmap contracts switch from event-scoped keys to show-scoped keys
- Admin ticket/analytics DTOs add `show_id`, `show_title`, `show_start_at`, `show_end_at`

## Test Plan
- Migration test: old event with seats/orders/queue becomes one show and all foreign keys are backfilled correctly.
- Validation test: show date must stay within event date range; show end must be after show start.
- Booking test: queue, lock, release, checkout, cancel ticket all work by `show_id`.
- Planner test: both classic-grid and venue-layout shows can create/edit seats after the refactor.
- Customer flow test: event detail shows show list, `Đặt vé` enters the correct queue and seat map for that show.
- Admin analytics test: ticket sales, occupancy, revenue, and dashboard summaries aggregate by show and display the parent event name.
- Admin notification test: bell dropdown shows latest ticket sales and unread help threads, updates on poll, and clears seen state locally.

## Assumptions and Defaults
- No temporary dual support for old event-based booking APIs after the migration is applied.
- `event` keeps `category` and `cover_image_url`; venue/queue/hold/layout move entirely to `show`.
- `event` is date-range based; `show` is datetime based.
- Admin show management lives behind the event `Detail` action, not on a separate global shows page.
- Analytics are show-first, always labeled with the parent event.
- Notification optimization in this phase is admin-only and does not add a new backend notifications subsystem.
