import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  Users,
  Search,
  Filter,
  Edit,
  Trash2,
  Plus,
  Mail,
  Phone,
  Calendar,
  Ticket
} from 'lucide-react';

interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'customer' | 'organizer';
  registeredDate: string;
  totalTickets: number;
  status: 'active' | 'inactive' | 'banned';
  avatar?: string;
}

const mockUsers: User[] = [
  { id: 1, name: 'Nguyễn Văn A', email: 'nguyenvana@example.com', phone: '0901234567', role: 'customer', registeredDate: '2025-01-15', totalTickets: 12, status: 'active' },
  { id: 2, name: 'Trần Thị B', email: 'tranthib@example.com', phone: '0912345678', role: 'customer', registeredDate: '2025-02-20', totalTickets: 8, status: 'active' },
  { id: 3, name: 'Lê Văn C', email: 'levanc@example.com', phone: '0923456789', role: 'organizer', registeredDate: '2025-01-10', totalTickets: 25, status: 'active' },
  { id: 4, name: 'Phạm Thị D', email: 'phamthid@example.com', phone: '0934567890', role: 'customer', registeredDate: '2025-03-05', totalTickets: 5, status: 'inactive' },
  { id: 5, name: 'Hoàng Văn E', email: 'hoangvane@example.com', phone: '0945678901', role: 'customer', registeredDate: '2025-02-28', totalTickets: 3, status: 'banned' },
  { id: 6, name: 'Đỗ Thị F', email: 'dothif@example.com', phone: '0956789012', role: 'admin', registeredDate: '2024-12-01', totalTickets: 50, status: 'active' },
];

export default function AdminUsers() {
  const [users] = useState<User[]>(mockUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadge = (role: User['role']) => {
    const variants = {
      admin: 'default',
      organizer: 'warning',
      customer: 'info',
    } as const;

    const labels = {
      admin: 'Quản trị viên',
      organizer: 'Tổ chức',
      customer: 'Khách hàng',
    };

    return <Badge variant={variants[role]} size="sm">{labels[role]}</Badge>;
  };

  const getStatusBadge = (status: User['status']) => {
    const variants = {
      active: 'success',
      inactive: 'default',
      banned: 'warning',
    } as const;

    const labels = {
      active: 'Hoạt động',
      inactive: 'Không hoạt động',
      banned: 'Bị khóa',
    };

    return <Badge variant={variants[status]} size="sm">{labels[status]}</Badge>;
  };

  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.status === 'active').length;
  const totalCustomers = users.filter(u => u.role === 'customer').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Quản lý Người dùng</h2>
          <p className="text-gray-400 mt-1">Quản lý tất cả người dùng trên hệ thống</p>
        </div>
        <Button variant="primary">
          <Plus className="h-4 w-4" />
          Thêm người dùng
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Tổng người dùng</p>
                <p className="text-2xl font-bold text-white">{totalUsers}</p>
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
                <p className="text-sm text-gray-400 mb-1">Đang hoạt động</p>
                <p className="text-2xl font-bold text-green-400">{activeUsers}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Khách hàng</p>
                <p className="text-2xl font-bold text-brand-yellow">{totalCustomers}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-brand-yellow/20 flex items-center justify-center">
                <Ticket className="h-6 w-6 text-brand-yellow" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Tổ chức sự kiện</p>
                <p className="text-2xl font-bold text-purple-400">
                  {users.filter(u => u.role === 'organizer').length}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Mail className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Tìm kiếm theo tên hoặc email..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                className="h-10 px-3 rounded-lg bg-space-700/50 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">Tất cả vai trò</option>
                <option value="admin">Quản trị viên</option>
                <option value="organizer">Tổ chức</option>
                <option value="customer">Khách hàng</option>
              </select>
              <select
                className="h-10 px-3 rounded-lg bg-space-700/50 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="inactive">Không hoạt động</option>
                <option value="banned">Bị khóa</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách người dùng</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-sm text-gray-400">
                  <th className="pb-3 font-medium">Người dùng</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Số điện thoại</th>
                  <th className="pb-3 font-medium">Vai trò</th>
                  <th className="pb-3 font-medium">Vé đã mua</th>
                  <th className="pb-3 font-medium">Ngày đăng ký</th>
                  <th className="pb-3 font-medium">Trạng thái</th>
                  <th className="pb-3 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-red to-brand-yellow flex items-center justify-center text-sm font-bold text-space-900">
                          {user.name.charAt(0)}
                        </div>
                        <span className="text-white font-medium">{user.name}</span>
                      </div>
                    </td>
                    <td className="py-4 text-gray-300">{user.email}</td>
                    <td className="py-4 text-gray-300">{user.phone}</td>
                    <td className="py-4">{getRoleBadge(user.role)}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-gray-400" />
                        <span className="text-white">{user.totalTickets}</span>
                      </div>
                    </td>
                    <td className="py-4 text-gray-400 text-sm">{user.registeredDate}</td>
                    <td className="py-4">{getStatusBadge(user.status)}</td>
                    <td className="py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewUser(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {filteredUsers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Không tìm thấy người dùng nào</p>
          </CardContent>
        </Card>
      )}

      {/* User Detail Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Chi tiết người dùng"
        className="max-w-lg"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-white/10">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brand-red to-brand-yellow flex items-center justify-center text-xl font-bold text-space-900">
                {selectedUser.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedUser.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {getRoleBadge(selectedUser.role)}
                  {getStatusBadge(selectedUser.status)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <div className="flex items-center gap-2 text-white">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>{selectedUser.email}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Số điện thoại</label>
                <div className="flex items-center gap-2 text-white">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{selectedUser.phone}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Ngày đăng ký</label>
                <div className="flex items-center gap-2 text-white">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>{selectedUser.registeredDate}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Tổng vé đã mua</label>
                <div className="flex items-center gap-2 text-white">
                  <Ticket className="h-4 w-4 text-gray-400" />
                  <span>{selectedUser.totalTickets}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Đóng</Button>
              <Button variant="primary">Chỉnh sửa</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}