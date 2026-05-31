import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, BarChart3, CalendarDays, DollarSign, RefreshCcw, Ticket, Users } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { useWebSocketHeartbeat } from '@/hooks/useWebSocketHeartbeat'
import { WS_BASE_URL } from '@/constants'
import { adminApi, extractApiErrorMessage } from '@/lib/api'
import { authStorage } from '@/lib/storage'
import { useAuth } from '@/context/AuthContext'
import type { DashboardRealtimePayload, DashboardSummary, OccupancyItem, RevenuePoint } from '@/types'

const DEFAULT_SUMMARY: DashboardSummary = {
  total_revenue: 0,
  tickets_sold: 0,
  active_events: 0,
  waiting_queue_users: 0,
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const isSystemAdmin = user?.user_type === 'SYSTEM_ADMIN'
  const [summary, setSummary] = useState<DashboardSummary>(DEFAULT_SUMMARY)
  const [revenue, setRevenue] = useState<RevenuePoint[]>([])
  const [occupancy, setOccupancy] = useState<OccupancyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  const authToken = authStorage.getToken()
  const dashboardWsUrl = authToken && isSystemAdmin ? `${WS_BASE_URL}/admin/dashboard?token=${encodeURIComponent(authToken)}` : null

  const maxRevenue = useMemo(
    () => revenue.reduce((max, point) => (point.revenue > max ? point.revenue : max), 0),
    [revenue],
  )

  async function loadDashboardData(isRefresh = false) {
    setError(null)
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const [summaryRes, revenueRes, occupancyRes] = await Promise.all([
        adminApi.summary(),
        adminApi.revenue(14),
        adminApi.occupancy(),
      ])
      setSummary(summaryRes)
      setRevenue(revenueRes)
      setOccupancy(occupancyRes)
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể tải dashboard.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadDashboardData()
  }, [])

  const handleDashboardUpdate = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as { type?: string; payload?: Partial<DashboardRealtimePayload> }
      if (message.type !== 'dashboard_update' || !message.payload) return

      if (message.payload.summary) setSummary(message.payload.summary)
      if (Array.isArray(message.payload.revenue)) setRevenue(message.payload.revenue)
      if (Array.isArray(message.payload.occupancy)) setOccupancy(message.payload.occupancy)
      setError(null)
    } catch {
      // Bỏ qua gói tin WebSocket không đúng định dạng để dashboard tiếp tục nhận lần cập nhật tiếp theo.
    }
  }, [])

  useWebSocketHeartbeat({
    url: dashboardWsUrl,
    onMessage: handleDashboardUpdate,
    onOpen: () => setRealtimeStatus('connected'),
    onClose: () => setRealtimeStatus('disconnected'),
  })

  if (loading) {
    return <GlobalLoader />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold admin-text-header">{isSystemAdmin ? 'Báo cáo tổng thể hệ thống' : 'Tổng quan sự kiện được phân công'}</h2>
          <p className="admin-text-body mt-1">{isSystemAdmin ? 'Dữ liệu tổng hợp toàn hệ thống.' : 'Dữ liệu chỉ bao gồm các sự kiện bạn đang tham gia.'}</p>
        </div>
        <div className="flex items-center gap-2">
          {isSystemAdmin ? (
            <Badge variant={realtimeStatus === 'connected' ? 'success' : 'warning'} size="sm">
              {realtimeStatus === 'connected' ? 'Realtime đang bật' : realtimeStatus === 'connecting' ? 'Đang kết nối' : 'Mất realtime'}
            </Badge>
          ) : null}
          <Button variant="outline" onClick={() => void loadDashboardData(true)} isLoading={refreshing}>
            <RefreshCcw className="h-4 w-4" />
            Làm mới
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="pt-6 text-red-200 text-sm">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-2">
            <p className="text-sm font-bold admin-text-body">Tổng doanh thu</p>
            <p className="text-xl font-bold text-green-400 mt-2">{formatCurrency(summary.total_revenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-2">
            <p className="text-sm font-bold admin-text-body">Vé đã bán</p>
            <p className="text-xl font-bold text-primary mt-2">{summary.tickets_sold.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-2">
            <p className="text-sm font-bold admin-text-body">Show đang mở</p>
            <p className="text-xl font-bold text-cyan-400 mt-2">{summary.active_events}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-2">
            <p className="text-sm font-bold admin-text-body">Người trong queue</p>
            <p className="text-xl font-bold text-brand-red mt-2">{summary.waiting_queue_users}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-green-400" />
              Doanh thu 14 ngày
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenue.length === 0 ? (
              <p className="text-sm admin-text-body">Chưa có dữ liệu doanh thu.</p>
            ) : (
              <div className="space-y-3">
                {revenue.map((point) => {
                  const width = maxRevenue > 0 ? Math.max((point.revenue / maxRevenue) * 100, 2) : 0
                  return (
                    <div key={point.date} className="space-y-1">
                      <div className="flex items-center justify-between text-xs admin-text-body">
                        <span>{point.date}</span>
                        <span>{formatCurrency(point.revenue)}</span>
                      </div>
                      <div className="h-2 rounded bg-white/10 overflow-hidden">
                        <div className="h-full" style={{ background: `linear-gradient(to right, var(--admin-bg-opt), var(--admin-bg-opp))`, width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-brand-yellow" />
              Tỷ lệ lấp đầy theo show
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {occupancy.length === 0 ? (
              <p className="text-sm admin-text-body">Chưa có dữ liệu occupancy.</p>
            ) : (
              occupancy.map((item) => (
                <div key={item.show_id} className="rounded-lg border border-white/10 p-3 bg-space-700/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium admin-text-body">{item.show_title}</p>
                      <p className="text-xs text-gray-400 mt-1">{item.event_title}</p>
                      <p className="text-xs admin-text-body mt-1">
                        {item.sold_seats}/{item.total_seats} đã bán, {item.locked_seats} đang giữ
                      </p>
                    </div>
                    <Badge variant={item.occupancy_rate >= 70 ? 'success' : 'warning'} size="sm">
                      {item.occupancy_rate.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="h-2 rounded bg-white/10 mt-2 overflow-hidden">
                    <div
                      className="h-full"
                      style={{ background: `linear-gradient(to right, var(--admin-bg-opt), var(--admin-bg-opp))`, width: `${Math.min(item.occupancy_rate, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {!isSystemAdmin ? (
        <Card>
          <CardContent className="pt-3 flex items-center gap-3">
            <Ticket className="h-5 w-5 text-red-400" />
            <Link to="/admin/tickets" className="text-sm font-bold admin-text-body hover:text-white underline-offset-2 hover:underline">
              Đi tới Vé
            </Link>
          </CardContent>
        </Card>
        ) : null}
        {isSystemAdmin ? (
        <Card>
          <CardContent className="pt-3 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-green-400" />
            <Link to="/admin/analytics" className="text-sm font-bold admin-text-body hover:text-white underline-offset-2 hover:underline">
              Đi tới Thống kê
            </Link>
          </CardContent>
        </Card>
        ) : null}
        {isSystemAdmin ? (
        <Card>
          <CardContent className="pt-3 flex items-center gap-3">
            <Users className="h-5 w-5 text-cyan-400" />
            <Link to="/admin/users" className="text-sm font-bold admin-text-body hover:text-white underline-offset-2 hover:underline">
              Đi tới Người dùng
            </Link>
          </CardContent>
        </Card>
        ) : null}
      </div>

      <div className="text-xs text-gray-500 flex items-center gap-2">
        <CalendarDays className="h-4 w-4" />
        {isSystemAdmin ? 'Dữ liệu tự cập nhật khi backend phát sinh thay đổi; nút Làm mới dùng làm fallback.' : 'Dữ liệu được giới hạn theo assignment; dùng Làm mới để lấy trạng thái mới nhất.'}
      </div>
    </div>
  )
}
