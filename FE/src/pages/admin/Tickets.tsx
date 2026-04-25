import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Ticket,
  DollarSign,
  TrendingUp,
  Download,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';

interface TicketSale {
  id: number;
  eventName: string;
  customerName: string;
  seatNumber: string;
  section: string;
  price: number;
  purchaseDate: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'refunded';
  paymentMethod: 'credit_card' | 'bank_transfer' | 'e_wallet';
}

const mockTicketSales: TicketSale[] = [
  { id: 1, eventName: 'Hòa nhạc Âm vang Mùa xuân', customerName: 'Nguyễn Văn A', seatNumber: 'A12', section: 'VIP', price: 2000000, purchaseDate: '2025-04-20 14:30', status: 'confirmed', paymentMethod: 'credit_card' },
  { id: 2, eventName: 'Festival Âm nhạc Quốc tế', customerName: 'Trần Thị B', seatNumber: 'B25', section: 'Standard', price: 800000, purchaseDate: '2025-04-20 15:45', status: 'confirmed', paymentMethod: 'e_wallet' },
  { id: 3, eventName: 'Hòa nhạc Âm vang Mùa xuân', customerName: 'Lê Văn C', seatNumber: 'C08', section: 'Premium', price: 1500000, purchaseDate: '2025-04-20 16:20', status: 'pending', paymentMethod: 'bank_transfer' },
  { id: 4, eventName: 'Live Show Ca sĩ nổi tiếng', customerName: 'Phạm Thị D', seatNumber: 'A05', section: 'VIP', price: 5000000, purchaseDate: '2025-04-20 17:10', status: 'confirmed', paymentMethod: 'credit_card' },
  { id: 5, eventName: 'Buổi diễn Kịch Nghệ thuật', customerName: 'Hoàng Văn E', seatNumber: 'D15', section: 'Standard', price: 500000, purchaseDate: '2025-04-19 10:00', status: 'cancelled', paymentMethod: 'e_wallet' },
  { id: 6, eventName: 'Festival Âm nhạc Quốc tế', customerName: 'Đỗ Thị F', seatNumber: 'A18', section: 'VIP', price: 3000000, purchaseDate: '2025-04-19 11:30', status: 'refunded', paymentMethod: 'bank_transfer' },
];

const revenueByEvent = [
  { eventName: 'Hòa nhạc Âm vang Mùa xuân', revenue: 42500000, ticketsSold: 850, target: 50000000 },
  { eventName: 'Festival Âm nhạc Quốc tế', revenue: 60000000, ticketsSold: 1200, target: 75000000 },
  { eventName: 'Live Show Ca sĩ nổi tiếng', revenue: 19200000, ticketsSold: 320, target: 40000000 },
  { eventName: 'Buổi diễn Kịch Nghệ thuật', revenue: 25000000, ticketsSold: 500, target: 25000000 },
];

export default function AdminTickets() {
  const [ticketSales] = useState<TicketSale[]>(mockTicketSales);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');

  const filteredSales = ticketSales.filter(sale => {
    const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
    const matchesEvent = eventFilter === 'all' || sale.eventName === eventFilter;
    return matchesStatus && matchesEvent;
  });

  const getStatusBadge = (status: TicketSale['status']) => {
    const variants = {
      confirmed: 'success',
      pending: 'warning',
      cancelled: 'default',
      refunded: 'info',
    } as const;

    const labels = {
      confirmed: 'Đã xác nhận',
      pending: 'Chờ xử lý',
      cancelled: 'Đã hủy',
      refunded: 'Đã hoàn tiền',
    };

    const icons = {
      confirmed: CheckCircle,
      pending: Clock,
      cancelled: XCircle,
      refunded: DollarSign,
    };

    const Icon = icons[status];

    return (
      <Badge variant={variants[status]} size="sm" className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {labels[status]}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const totalRevenue = revenueByEvent.reduce((sum, item) => sum + item.revenue, 0);
  const totalTicketsSold = revenueByEvent.reduce((_, item) => _ + item.ticketsSold, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Vé & Doanh thu</h2>
          <p className="text-gray-400 mt-1">Theo dõi bán vé và biến động doanh thu</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4" />
          Xuất báo cáo
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Doanh thu tổng</p>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-green-400">
              <TrendingUp className="h-4 w-4" />
              <span>Tăng 12.5% so với tháng trước</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Vé đã bán</p>
                <p className="text-2xl font-bold text-brand-red">{totalTicketsSold.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-brand-red/20 flex items-center justify-center">
                <Ticket className="h-6 w-6 text-brand-red" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-green-400">
              <TrendingUp className="h-4 w-4" />
              <span>Tăng 8.3% so với tháng trước</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Sự kiện đang diễn ra</p>
                <p className="text-2xl font-bold text-brand-yellow">4</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-brand-yellow/20 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-brand-yellow" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
              <Users className="h-4 w-4" />
              <span>24 sự kiện tổng cộng</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Event */}
      <Card>
        <CardHeader>
          <CardTitle>Doanh thu theo sự kiện</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {revenueByEvent.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white font-medium">{item.eventName}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-400">{item.ticketsSold} vé</span>
                    <span className="text-green-400 font-medium">{formatCurrency(item.revenue)}</span>
                  </div>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-red to-brand-yellow rounded-full transition-all"
                    style={{ width: `${(item.revenue / item.target) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Đạt {(item.revenue / item.target * 100).toFixed(1)}%</span>
                  <span>Mục tiêu: {formatCurrency(item.target)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Ticket Sales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Giao dịch vé gần đây</span>
            <div className="flex items-center gap-2">
              <select
                className="h-9 px-3 rounded-lg bg-space-700/50 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
              >
                <option value="all">Tất cả sự kiện</option>
                {Array.from(new Set(ticketSales.map(s => s.eventName))).map(eventName => (
                  <option key={eventName} value={eventName}>{eventName}</option>
                ))}
              </select>
              <select
                className="h-9 px-3 rounded-lg bg-space-700/50 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="pending">Chờ xử lý</option>
                <option value="cancelled">Đã hủy</option>
                <option value="refunded">Đã hoàn tiền</option>
              </select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-sm text-gray-400">
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">Sự kiện</th>
                  <th className="pb-3 font-medium">Khách hàng</th>
                  <th className="pb-3 font-medium">Ghế</th>
                  <th className="pb-3 font-medium">Giá vé</th>
                  <th className="pb-3 font-medium">Ngày mua</th>
                  <th className="pb-3 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-4 text-gray-400 font-mono text-sm">#{sale.id.toString().padStart(4, '0')}</td>
                    <td className="py-4 text-white font-medium max-w-[200px] truncate">{sale.eventName}</td>
                    <td className="py-4 text-gray-300">{sale.customerName}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" size="sm">{sale.section}</Badge>
                        <span className="text-white">{sale.seatNumber}</span>
                      </div>
                    </td>
                    <td className="py-4 text-green-400 font-medium">{formatCurrency(sale.price)}</td>
                    <td className="py-4 text-gray-400 text-sm">{sale.purchaseDate}</td>
                    <td className="py-4">{getStatusBadge(sale.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}