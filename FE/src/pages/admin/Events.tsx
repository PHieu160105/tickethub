import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  Calendar,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  MapPin,
  Clock,
  Users,
  DollarSign
} from 'lucide-react';

interface Event {
  id: number;
  name: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  totalSeats: number;
  soldSeats: number;
  priceRange: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  image?: string;
}

const mockEvents: Event[] = [
  {
    id: 1,
    name: 'Hòa nhạc Âm vang Mùa xuân',
    description: 'Chương trình hòa nhạc đặc sắc với sự tham gia của nhiều nghệ sĩ nổi tiếng',
    date: '2025-05-15',
    time: '19:30',
    venue: 'Nhà hát Lớn Hà Nội',
    totalSeats: 1000,
    soldSeats: 850,
    priceRange: '500,000₫ - 2,000,000₫',
    status: 'active',
  },
  {
    id: 2,
    name: 'Festival Âm nhạc Quốc tế',
    description: 'Lễ hội âm nhạc quy mô quốc tế với các nghệ sĩ từ nhiều nước',
    date: '2025-06-20',
    time: '18:00',
    venue: 'Sân vận động Mỹ Đình',
    totalSeats: 1500,
    soldSeats: 1200,
    priceRange: '800,000₫ - 5,000,000₫',
    status: 'active',
  },
  {
    id: 3,
    name: 'Buổi diễn Kịch Nghệ thuật',
    description: 'Vở kịch kinh điển được dàn dựng công phu',
    date: '2025-04-10',
    time: '20:00',
    venue: 'Nhà hát Tuổi trẻ',
    totalSeats: 500,
    soldSeats: 500,
    priceRange: '300,000₫ - 1,000,000₫',
    status: 'completed',
  },
  {
    id: 4,
    name: 'Live Show Ca sĩ nổi tiếng',
    description: 'Liveshow độc quyền của ca sĩ hàng đầu V-Pop',
    date: '2025-07-01',
    time: '19:00',
    venue: 'Trung tâm Hội nghị Quốc gia',
    totalSeats: 800,
    soldSeats: 320,
    priceRange: '1,000,000₫ - 8,000,000₫',
    status: 'active',
  },
  {
    id: 5,
    name: 'Đêm nhạc Acoustic',
    description: 'Không gian âm nhạc acoustic ấm cúng và lãng mạn',
    date: '2025-08-15',
    time: '20:30',
    venue: 'Phòng trà Không Tên',
    totalSeats: 200,
    soldSeats: 0,
    priceRange: '200,000₫ - 500,000₫',
    status: 'draft',
  },
];

export default function AdminEvents() {
  const [events, setEvents] = useState<Event[]>(mockEvents);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.venue.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Event['status']) => {
    const variants = {
      draft: 'default',
      active: 'success',
      completed: 'info',
      cancelled: 'warning',
    } as const;

    const labels = {
      draft: 'Nháp',
      active: 'Đang bán',
      completed: 'Hoàn thành',
      cancelled: 'Đã hủy',
    };

    return <Badge variant={variants[status]} size="sm">{labels[status]}</Badge>;
  };

  const handleDeleteEvent = (id: number) => {
    if (confirm('Bạn có chắc chắn muốn xóa sự kiện này?')) {
      setEvents(events.filter(e => e.id !== id));
    }
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  const handleCreateEvent = () => {
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Quản lý Sự kiện</h2>
          <p className="text-gray-400 mt-1">Tạo mới và quản lý tất cả sự kiện</p>
        </div>
        <Button variant="primary" onClick={handleCreateEvent}>
          <Plus className="h-4 w-4" />
          Tạo sự kiện mới
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Tìm kiếm sự kiện..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                className="h-10 px-3 rounded-lg bg-space-700/50 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="draft">Nháp</option>
                <option value="active">Đang bán</option>
                <option value="completed">Hoàn thành</option>
                <option value="cancelled">Đã hủy</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredEvents.map((event) => (
          <Card key={event.id} className="group hover:border-brand-red/30 transition-all">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2">{event.name}</CardTitle>
                  <CardDescription className="line-clamp-2">{event.description}</CardDescription>
                </div>
                {getStatusBadge(event.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <Calendar className="h-4 w-4 text-brand-red" />
                  <span>{event.date}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Clock className="h-4 w-4 text-brand-yellow" />
                  <span>{event.time}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <MapPin className="h-4 w-4 text-green-400" />
                  <span className="truncate">{event.venue}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Users className="h-4 w-4 text-purple-400" />
                  <span>{event.soldSeats}/{event.totalSeats} ghế</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Tỷ lệ lấp đầy</span>
                  <span>{Math.round((event.soldSeats / event.totalSeats) * 100)}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-red to-brand-yellow rounded-full transition-all"
                    style={{ width: `${(event.soldSeats / event.totalSeats) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-green-400 font-medium">
                  <DollarSign className="h-4 w-4" />
                  <span>{event.priceRange}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t border-white/10 pt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditEvent(event)}
              >
                <Edit className="h-4 w-4" />
                Chỉnh sửa
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300"
                onClick={() => handleDeleteEvent(event.id)}
              >
                <Trash2 className="h-4 w-4" />
                Xóa
              </Button>
              <Button variant="primary" size="sm">
                Cấu hình ghế
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {filteredEvents.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Không tìm thấy sự kiện nào</p>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Event Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEvent ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện mới'}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Tên sự kiện</label>
            <Input placeholder="Nhập tên sự kiện" defaultValue={editingEvent?.name} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Mô tả</label>
            <textarea
              className="w-full rounded-lg border bg-space-700/50 border-white/20 px-4 py-2.5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red"
              rows={3}
              placeholder="Mô tả chi tiết sự kiện"
              defaultValue={editingEvent?.description}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Ngày tổ chức</label>
              <Input type="date" defaultValue={editingEvent?.date} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Giờ bắt đầu</label>
              <Input type="time" defaultValue={editingEvent?.time} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Địa điểm</label>
            <Input placeholder="Nhập địa điểm" defaultValue={editingEvent?.venue} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tổng số ghế</label>
              <Input type="number" placeholder="1000" defaultValue={editingEvent?.totalSeats} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Trạng thái</label>
              <select className="w-full rounded-lg border bg-space-700/50 border-white/20 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-red" defaultValue={editingEvent?.status || 'draft'}>
                <option value="draft">Nháp</option>
                <option value="active">Đang bán</option>
                <option value="completed">Hoàn thành</option>
                <option value="cancelled">Đã hủy</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button variant="primary">{editingEvent ? 'Cập nhật' : 'Tạo mới'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}