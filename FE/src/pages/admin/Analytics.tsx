import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { adminApi, extractApiErrorMessage } from '@/lib/api'
import type { AudienceDistribution, OccupancyItem } from '@/types'
import { BarChart3, PieChart, RefreshCcw, Users } from 'lucide-react'

function normalizeLabel(value: string) {
  return value.replaceAll('_', ' ')
}

export default function AdminAnalytics() {
  const [audience, setAudience] = useState<AudienceDistribution | null>(null)
  const [occupancy, setOccupancy] = useState<OccupancyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalAudience = useMemo(
    () => Object.values(audience?.age_groups ?? {}).reduce((sum, value) => sum + value, 0),
    [audience],
  )

  async function loadAnalyticsData(isRefresh = false) {
    setError(null)
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const [audienceRes, occupancyRes] = await Promise.all([adminApi.audience(), adminApi.occupancy()])
      setAudience(audienceRes)
      setOccupancy(occupancyRes)
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể tải dữ liệu analytics.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadAnalyticsData()
  }, [])

  if (loading) {
    return <GlobalLoader />
  }

  const ageEntries = Object.entries(audience?.age_groups ?? {})
  const genderEntries = Object.entries(audience?.gender_groups ?? {})

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold admin-text-header">Thống kê khán giả</h2>
        </div>
        <Button variant="outline" onClick={() => void loadAnalyticsData(true)} isLoading={refreshing}>
          <RefreshCcw className="h-4 w-4" />
          Làm mới
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="pt-6 text-sm text-red-200">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-3">
            <p className="text-sm font-bold admin-text-body">Tổng khán giả</p>
            <p className="text-2xl font-bold text-red-400 mt-2">{totalAudience.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3">
            <p className="text-sm font-bold admin-text-body">Nhóm tuổi</p>
            <p className="text-2xl font-bold text-brand-yellow mt-2">{ageEntries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3">
            <p className="text-sm font-bold admin-text-body">Nhóm giới tính</p>
            <p className="text-2xl font-bold text-cyan-400 mt-2">{genderEntries.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChart className="h-5 w-5 text-brand-red" />
              Phân bố độ tuổi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ageEntries.length === 0 ? (
              <p className="text-sm admin-text-body">Chưa có dữ liệu độ tuổi.</p>
            ) : (
              ageEntries.map(([ageRange, count]) => {
                const percentage = totalAudience > 0 ? (count / totalAudience) * 100 : 0
                return (
                  <div key={ageRange} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="admin-text-body">{normalizeLabel(ageRange)}</span>
                      <span className="text-green-500">
                        {count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 rounded bg-white/10 overflow-hidden">
                      <div
                        className="h-full"
                        style={{background: `linear-gradient(to right, var(--admin-bg-opt), var(--admin-bg-opp))`, width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-cyan-400" />
              Phân bố giới tính
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {genderEntries.length === 0 ? (
              <p className="text-sm text-gray-400">Chưa có dữ liệu giới tính.</p>
            ) : (
              genderEntries.map(([gender, count]) => {
                const percentage = totalAudience > 0 ? (count / totalAudience) * 100 : 0
                return (
                  <div key={gender} className="rounded-lg border border-gray bg-space-700/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="admin-text-body">{normalizeLabel(gender)}</span>
                      <Badge variant="info" size="sm">
                        {percentage.toFixed(1)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{count} người</p>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-brand-yellow" />
            Occupancy theo sự kiện
          </CardTitle>
        </CardHeader>
        <CardContent>
          {occupancy.length === 0 ? (
            <p className="text-sm text-gray-400">Chưa có dữ liệu sự kiện.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b admin-text-body text-left">
                    <th className="pb-3 font-medium">Sự kiện</th>
                    <th className="pb-3 font-medium">Show</th>
                    <th className="pb-3 font-medium">Sold</th>
                    <th className="pb-3 font-medium">Locked</th>
                    <th className="pb-3 font-medium">Tổng ghế</th>
                    <th className="pb-3 font-medium text-right">Occupancy</th>
                  </tr>
                </thead>
                <tbody>
                  {occupancy.map((item) => (
                    <tr key={item.show_id} className="border-b border-white/5">
                      <td className="py-3 admin-text-body max-w-[220px] align-top">{item.event_title}</td>
                      <td className="py-3 admin-text-body align-top">
                        <div>{item.show_title}</div>
                        <div className="text-xs text-gray-400">{new Date(item.show_start_at).toLocaleString('vi-VN')}</div>
                        <div className="text-xs text-gray-500">{item.venue}</div>
                      </td>
                      <td className="py-3 admin-text-body">{item.sold_seats}</td>
                      <td className="py-3 admin-text-body">{item.locked_seats}</td>
                      <td className="py-3 admin-text-body">{item.total_seats}</td>
                      <td className="py-3 text-right text-yellow-600">{item.occupancy_rate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
