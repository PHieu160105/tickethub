import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { adminApi, extractApiErrorMessage } from '@/lib/api'
import type { AdminUserItem } from '@/types'
import { Calendar, Mail, Search, Ticket, UserRound, Filter } from 'lucide-react'
import { Listbox } from '@headlessui/react';

const PAGE_SIZE = 10

function roleVariant(role: string): 'default' | 'warning' | 'info' {
  if (role === 'admin') return 'default'
  return role === 'customer' ? 'info' : 'warning'
}

function genderLabel(gender: string) {
  if (gender === 'male') return 'Male'
  if (gender === 'female') return 'Female'
  return 'Other'
}

type Role = {
  value: string;
  label: string;
};

interface RoleSelectProps {
  roleFilter: string;
  setRoleFilter: React.Dispatch<React.SetStateAction<string>>;
}

function RoleSelect({ roleFilter, setRoleFilter }: RoleSelectProps) {
  const roles: Role[] = [
    { value: 'all', label: 'Tất cả vai trò' },
    { value: 'admin', label: 'Admin' },
    { value: 'customer', label: 'Customer' },
  ];

  return (
    <Listbox value={roleFilter} onChange={(value) => setRoleFilter(value)}>
      <div className="relative">
        <Listbox.Button
          className="w-48 px-3 py-2 bg-space-800 text-white border border-gray-600 rounded-md shadow-sm text-left"
        >
          {roles.find((r) => r.value === roleFilter)?.label}
        </Listbox.Button>
        <Listbox.Options
          className="absolute z-50 mt-1 w-48 bg-slate-900 text-white border border-white/20 rounded-md shadow-lg"
        >
          {roles.map((role) => (
            <Listbox.Option
              key={role.value}
              value={role.value}
              className="px-3 py-2 cursor-pointer hover:bg-space-700"
            >
              {role.label}
            </Listbox.Option>
          ))}
        </Listbox.Options>
      </div>
    </Listbox>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | string>('all')
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  async function loadUsers() {
    setLoading(true)
    setError(null)
    try {
      const response = await adminApi.users({
        search: searchTerm || undefined,
        role: roleFilter === 'all' ? undefined : roleFilter,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      })
      setUsers(response.items)
      setTotal(response.total)
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể tải danh sách users.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [page, roleFilter, searchTerm])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const totalTickets = users.reduce((sum, user) => sum + user.total_tickets, 0)

  if (loading) {
    return <GlobalLoader />
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-white">Quản lý người dùng</h2>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="pt-6 text-sm text-red-200">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-400">Tổng users (filtered)</p>
            <p className="text-2xl font-bold text-white mt-2">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-400">Page</p>
            <p className="text-2xl font-bold text-brand-yellow mt-2">{page}/{totalPages}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-400">Tickets (page)</p>
            <p className="text-2xl font-bold text-green-400 mt-2">{totalTickets}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Tìm theo tên hoặc email..."
                className="pl-10"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <div className="relative">
                <RoleSelect roleFilter={roleFilter} setRoleFilter={setRoleFilter} />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
              </div>
            </div>  
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách người dùng</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-300">Đang tải users...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-gray-400">Không có users phù hợp.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-gray-400">
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Gender/Age</th>
                    <th className="pb-3 font-medium">Tickets</th>
                    <th className="pb-3 font-medium">Registered</th>
                    <th className="pb-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-white/5">
                      <td className="py-4">
                        <div>
                          <p className="text-white font-medium">{user.full_name}</p>
                          <p className="text-gray-400 text-xs">{user.email}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <Badge variant={roleVariant(user.role)} size="sm">{user.role}</Badge>
                      </td>
                      <td className="py-4 text-gray-300">{genderLabel(user.gender)} / {user.age}</td>
                      <td className="py-4 text-gray-300">{user.total_tickets}</td>
                      <td className="py-4 text-gray-400">{new Date(user.registered_at).toLocaleDateString('vi-VN')}</td>
                      <td className="py-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedUser(user)}>Xem</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Trước
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              Sau
            </Button>
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={selectedUser !== null} onClose={() => setSelectedUser(null)} title="Chi tiết user" className="max-w-lg">
        {selectedUser ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-red to-brand-yellow flex items-center justify-center text-space-900 font-bold">
                {selectedUser.full_name.charAt(0)}
              </div>
              <div>
                <p className="text-white font-semibold">{selectedUser.full_name}</p>
                <Badge variant={roleVariant(selectedUser.role)} size="sm">{selectedUser.role}</Badge>
              </div>
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              <div className="flex items-center gap-2"><Mail className="h-4 w-4" /><span>{selectedUser.email}</span></div>
              <div className="flex items-center gap-2"><UserRound className="h-4 w-4" /><span>{genderLabel(selectedUser.gender)}, {selectedUser.age} tuổi</span></div>
              <div className="flex items-center gap-2"><Ticket className="h-4 w-4" /><span>{selectedUser.total_tickets} tickets đã mua</span></div>
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span>Registered {new Date(selectedUser.registered_at).toLocaleString('vi-VN')}</span></div>
            </div>
            <div className="pt-2 flex justify-end"><Button variant="ghost" onClick={() => setSelectedUser(null)}>Đóng</Button></div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
