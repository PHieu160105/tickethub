import { useEffect, useMemo, useState } from 'react'

import { AdminSidebar } from '../components/AdminSidebar'
import { useAuth } from '../hooks/useAuth'
import { useWebSocketHeartbeat } from '../hooks/useWebSocketHeartbeat'
import { adminApi, extractApiErrorMessage } from '../lib/api'
import type { AudienceDistribution, DashboardSummary, OccupancyItem, RevenuePoint } from '../types'

const summaryDefault: DashboardSummary = {
  total_revenue: 0,
  tickets_sold: 0,
  cancelled_tickets: 0,
  active_events: 0,
  waiting_queue_users: 0,
}

export function AdminDashboardPage() {
  const { token } = useAuth()

  const [summary, setSummary] = useState<DashboardSummary>(summaryDefault)
  const [revenue, setRevenue] = useState<RevenuePoint[]>([])
  const [audience, setAudience] = useState<AudienceDistribution>({ age_groups: {}, gender_groups: {} })
  const [occupancy, setOccupancy] = useState<OccupancyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const wsBase = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8000/ws'

  useWebSocketHeartbeat({
    url: token ? `${wsBase}/admin/dashboard?token=${token}` : null,
    onMessage: (event) => {
      try {
        const message = JSON.parse(event.data) as { type: string; payload: DashboardSummary }
        if (message.type === 'dashboard_update') {
          setSummary(message.payload)
        }
      } catch {
        // noop
      }
    },
  })

  const fetchDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const [summaryRes, revenueRes, audienceRes, occupancyRes] = await Promise.allSettled([
        adminApi.summary(),
        adminApi.revenue(14),
        adminApi.audience(),
        adminApi.occupancy(),
      ])

      const errorMessages: string[] = []

      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value)
      } else {
        errorMessages.push(extractApiErrorMessage(summaryRes.reason, 'Summary unavailable'))
      }

      if (revenueRes.status === 'fulfilled') {
        setRevenue(revenueRes.value)
      } else {
        errorMessages.push(extractApiErrorMessage(revenueRes.reason, 'Revenue chart unavailable'))
      }

      if (audienceRes.status === 'fulfilled') {
        setAudience(audienceRes.value)
      } else {
        errorMessages.push(extractApiErrorMessage(audienceRes.reason, 'Audience chart unavailable'))
      }

      if (occupancyRes.status === 'fulfilled') {
        setOccupancy(occupancyRes.value)
      } else {
        errorMessages.push(extractApiErrorMessage(occupancyRes.reason, 'Occupancy table unavailable'))
      }

      if (errorMessages.length > 0) {
        setError(errorMessages.slice(0, 2).join(' | '))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchDashboard()
  }, [])

  const maxRevenue = useMemo(() => Math.max(...revenue.map((item) => item.revenue), 1), [revenue])
  const topOccupancy = useMemo(
    () => [...occupancy].sort((first, second) => second.occupancy_rate - first.occupancy_rate).slice(0, 4),
    [occupancy],
  )

  return (
    <main className="admin-shell">
      <AdminSidebar />

      <section className="admin-content">
        <header className="section-head section-head--hero admin-hero-head">
          <h1>Market Performance</h1>
          <p>Real-time dashboard for seat occupancy, queue pressure and revenue.</p>
        </header>

        {loading && <p className="state-text">Loading dashboard...</p>}
        {error && <p className="state-text state-text--error">{error}</p>}
        {error && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void fetchDashboard()}>
            Retry Dashboard Load
          </button>
        )}

        <section className="dashboard-showcase panel">
          <img
            src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80"
            alt="Live audience and stage lighting"
          />
          <div className="dashboard-showcase__body">
            <h2>Live Commerce Pulse</h2>
            <p>Revenue is net of cancellations. Ticket cancellation trends are tracked in real time for operation planning.</p>
            <div className="dashboard-showcase__chips">
              <span className="chip chip-primary">Real-time feed</span>
              <span className="chip chip-ghost">Queue intelligence</span>
              <span className="chip chip-ghost">Cancellation monitor</span>
            </div>
          </div>
        </section>

        <section className="kpi-grid">
          <article className="kpi-card">
            <p>Total Revenue</p>
            <h3>${summary.total_revenue.toLocaleString()}</h3>
          </article>
          <article className="kpi-card">
            <p>Tickets Sold</p>
            <h3>{summary.tickets_sold.toLocaleString()}</h3>
          </article>
          <article className="kpi-card kpi-card--danger">
            <p>Cancelled Tickets</p>
            <h3>{summary.cancelled_tickets.toLocaleString()}</h3>
          </article>
          <article className="kpi-card">
            <p>Active Events</p>
            <h3>{summary.active_events}</h3>
          </article>
          <article className="kpi-card">
            <p>Waiting Queue Users</p>
            <h3>{summary.waiting_queue_users}</h3>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="panel">
            <h2>Revenue (14 days)</h2>
            <div className="bar-chart">
              {revenue.map((item) => (
                <div key={item.date} className="bar-chart__item" title={`${item.date}: $${item.revenue}`}>
                  <div className="bar-chart__bar" style={{ height: `${(item.revenue / maxRevenue) * 100}%` }} />
                  <span>{item.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <h2>Top Occupancy Radar</h2>
            <div className="occupancy-radar">
              {topOccupancy.map((item) => (
                <div key={item.event_id} className="occupancy-radar__item">
                  <div>
                    <strong>{item.event_title}</strong>
                    <p>{item.sold_seats} sold / {item.total_seats} seats</p>
                  </div>
                  <div className="occupancy-radar__meter">
                    <span style={{ width: `${Math.min(item.occupancy_rate, 100)}%` }} />
                  </div>
                  <em>{item.occupancy_rate}%</em>
                </div>
              ))}
              {topOccupancy.length === 0 && <p className="state-text">No occupancy data yet.</p>}
            </div>
          </article>

          <article className="panel">
            <h2>Audience Demographics</h2>
            <div className="demographic-grid">
              <div>
                <h3>Age</h3>
                <ul>
                  {Object.entries(audience.age_groups).map(([label, value]) => (
                    <li key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Gender</h3>
                <ul>
                  {Object.entries(audience.gender_groups).map(([label, value]) => (
                    <li key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>

          <article className="panel panel-full">
            <h2>Seat Occupancy Snapshot</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Total Seats</th>
                    <th>Sold</th>
                    <th>Locked</th>
                    <th>Occupancy</th>
                  </tr>
                </thead>
                <tbody>
                  {occupancy.map((item) => (
                    <tr key={item.event_id}>
                      <td>{item.event_title}</td>
                      <td>{item.total_seats}</td>
                      <td>{item.sold_seats}</td>
                      <td>{item.locked_seats}</td>
                      <td>{item.occupancy_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </section>
    </main>
  )
}
