import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Users,
  TrendingUp,
  PieChart,
  BarChart3,
  Calendar,
  Venus,
  Mars
} from 'lucide-react';

const ageGroupData = [
  { range: '16-20', count: 245, percentage: 19.6, color: 'from-pink-500 to-rose-500' },
  { range: '21-25', count: 412, percentage: 33.0, color: 'from-brand-red to-orange-500' },
  { range: '26-30', count: 298, percentage: 23.9, color: 'from-brand-yellow to-amber-500' },
  { range: '31-40', count: 187, percentage: 15.0, color: 'from-green-500 to-emerald-500' },
  { range: '41-50', count: 78, percentage: 6.3, color: 'from-blue-500 to-cyan-500' },
  { range: '50+', count: 27, percentage: 2.2, color: 'from-purple-500 to-violet-500' },
];

const genderData = [
  { gender: 'Nam', count: 523, percentage: 41.9, color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Mars },
  { gender: 'Nữ', count: 687, percentage: 55.1, color: 'text-pink-400', bg: 'bg-pink-500/20', icon: Venus },
  { gender: 'Khác', count: 37, percentage: 3.0, color: 'text-purple-400', bg: 'bg-purple-500/20', icon: Users },
];

const topEventsByAudience = [
  { eventName: 'Hòa nhạc Âm vang Mùa xuân', attendees: 850, avgAge: 24, maleRatio: 45, femaleRatio: 55 },
  { eventName: 'Festival Âm nhạc Quốc tế', attendees: 1200, avgAge: 26, maleRatio: 52, femaleRatio: 48 },
  { eventName: 'Live Show Ca sĩ nổi tiếng', attendees: 320, avgAge: 22, maleRatio: 35, femaleRatio: 65 },
  { eventName: 'Buổi diễn Kịch Nghệ thuật', attendees: 500, avgAge: 35, maleRatio: 48, femaleRatio: 52 },
];

const monthlyTrends = [
  { month: 'Tháng 1', tickets: 450, revenue: 45000000 },
  { month: 'Tháng 2', tickets: 520, revenue: 52000000 },
  { month: 'Tháng 3', tickets: 680, revenue: 68000000 },
  { month: 'Tháng 4', tickets: 890, revenue: 89000000 },
];

export default function AdminAnalytics() {
  const totalAttendees = ageGroupData.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Thống kê & Phân tích</h2>
          <p className="text-gray-400 mt-1">Phân tích khán giả theo độ tuổi, giới tính và thị hiếu</p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Tổng khán giả</p>
                <p className="text-2xl font-bold text-white">{totalAttendees.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-brand-red/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-brand-red" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Độ tuổi trung bình</p>
                <p className="text-2xl font-bold text-brand-yellow">25.4</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-brand-yellow/20 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-brand-yellow" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Khán giả nữ</p>
                <p className="text-2xl font-bold text-pink-400">55.1%</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-pink-500/20 flex items-center justify-center">
                <Venus className="h-6 w-6 text-pink-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Khán giả nam</p>
                <p className="text-2xl font-bold text-blue-400">41.9%</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Mars className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Age Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-brand-red" />
              Phân bố độ tuổi khán giả
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ageGroupData.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white font-medium">Độ tuổi {item.range}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">{item.count} người</span>
                      <span className="text-brand-yellow font-medium w-12 text-right">{item.percentage}%</span>
                    </div>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-500`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 rounded-lg bg-brand-red/10 border border-brand-red/20">
              <p className="text-sm text-gray-300">
                <span className="text-brand-yellow font-semibold">Insight:</span> Nhóm khán giả chính là 21-25 tuổi (33%),
                cho thấy sự kiện thu hút mạnh đối tượng sinh viên và người mới đi làm.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Gender Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-brand-red" />
              Phân bố giới tính
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {genderData.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg ${item.bg} flex items-center justify-center`}>
                          <Icon className={`h-5 w-5 ${item.color}`} />
                        </div>
                        <div>
                          <p className="text-white font-medium">{item.gender}</p>
                          <p className="text-xs text-gray-400">{item.count.toLocaleString()} người</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${item.color}`}>{item.percentage}%</p>
                      </div>
                    </div>
                    <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.bg.replace('/20', '')} rounded-full transition-all duration-500`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 p-4 rounded-lg bg-pink-500/10 border border-pink-500/20">
              <p className="text-sm text-gray-300">
                <span className="text-pink-400 font-semibold">Insight:</span> Khán giả nữ chiếm đa số (55.1%),
                nên cân nhắc các chương trình khuyến mãi và nội dung hướng đến đối tượng này.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Events by Audience */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-red" />
            Sự kiện có lượng khán giả cao nhất
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-sm text-gray-400">
                  <th className="pb-3 font-medium">Sự kiện</th>
                  <th className="pb-3 font-medium">Lượng khách</th>
                  <th className="pb-3 font-medium">Tuổi TB</th>
                  <th className="pb-3 font-medium">Nam/Nữ</th>
                  <th className="pb-3 font-medium">Phân bố</th>
                </tr>
              </thead>
              <tbody>
                {topEventsByAudience.map((event, index) => (
                  <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-4 text-white font-medium">{event.eventName}</td>
                    <td className="py-4 text-gray-300">{event.attendees.toLocaleString()}</td>
                    <td className="py-4">
                      <Badge variant="outline" size="sm">{event.avgAge} tuổi</Badge>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-blue-400">{event.maleRatio}%</span>
                        <span className="text-gray-500">/</span>
                        <span className="text-pink-400">{event.femaleRatio}%</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex h-2 w-24 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-400"
                          style={{ width: `${event.maleRatio}%` }}
                        />
                        <div
                          className="bg-pink-400"
                          style={{ width: `${event.femaleRatio}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand-red" />
            Xu hướng tham gia theo tháng
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end justify-between gap-4 px-4">
            {monthlyTrends.map((item, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-gradient-to-t from-brand-red/80 to-brand-yellow/80 rounded-t-lg transition-all duration-300 hover:from-brand-red hover:to-brand-yellow"
                    style={{ height: `${(item.tickets / 1000) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">{item.month}</span>
                <span className="text-xs text-white font-medium">{item.tickets.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}