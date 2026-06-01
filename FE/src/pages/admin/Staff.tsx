import { useEffect, useState } from 'react'
import { IdCard, Plus, RefreshCcw, UserCheck, UserX } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { adminApi, extractApiErrorMessage } from '@/lib/api'
import type { EventStaffItem, Gender } from '@/types'

const INITIAL_FORM = {
  full_name: '',
  email: '',
  password: '',
  staff_code: '',
  gender: 'OTHER' as Gender,
  age: '18',
}

export default function AdminStaff() {
  const [staff, setStaff] = useState<EventStaffItem[]>([])
  const [form, setForm] = useState(INITIAL_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadStaff() {
    setLoading(true)
    setError(null)
    try {
      setStaff(await adminApi.listStaff())
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể tải danh sách nhân viên sự kiện.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStaff()
  }, [])

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      await adminApi.createStaff({ ...form, age: Number(form.age) })
      setModalOpen(false)
      setForm(INITIAL_FORM)
      await loadStaff()
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể tạo nhân viên sự kiện.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(item: EventStaffItem) {
    setError(null)
    try {
      const updated = await adminApi.updateStaffStatus(item.user_id, !item.is_active)
      setStaff((current) => current.map((staffItem) => (staffItem.user_id === item.user_id ? updated : staffItem)))
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể cập nhật trạng thái nhân viên.'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold admin-text-header">Nhân viên sự kiện</h2>
          <p className="mt-1 text-sm admin-text-muted">Tạo tài khoản và kiểm soát quyền truy cập vận hành sự kiện.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadStaff()} isLoading={loading}>
            <RefreshCcw className="h-4 w-4" /> Làm mới
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Tạo nhân viên
          </Button>
        </div>
      </div>

      {error ? <Card className="border-red-500/30 bg-red-500/10"><CardContent className="pt-6 text-sm text-red-200">{error}</CardContent></Card> : null}

      <Card>
        <CardHeader><CardTitle>Danh sách tài khoản event staff</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm admin-text-muted">Đang tải dữ liệu...</p>
          ) : staff.length === 0 ? (
            <p className="text-sm admin-text-muted">Chưa có nhân viên sự kiện.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b admin-border text-left admin-text-body">
                    <th className="pb-3 font-medium">Nhân viên</th>
                    <th className="pb-3 font-medium">Mã nhân viên</th>
                    <th className="pb-3 font-medium">Ngày tạo</th>
                    <th className="pb-3 font-medium">Trạng thái</th>
                    <th className="pb-3 text-right font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((item) => (
                    <tr key={item.user_id} className="border-b border-white/5">
                      <td className="py-4">
                        <p className="font-medium admin-text-body">{item.full_name}</p>
                        <p className="text-xs admin-text-muted">{item.email}</p>
                      </td>
                      <td className="py-4 font-mono admin-text-body">{item.staff_code}</td>
                      <td className="py-4 admin-text-body">{new Date(item.created_at).toLocaleDateString('vi-VN')}</td>
                      <td className="py-4"><Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}</Badge></td>
                      <td className="py-4 text-right">
                        <Button variant="outline" size="sm" onClick={() => void handleToggle(item)}>
                          {item.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          {item.is_active ? 'Vô hiệu hóa' : 'Kích hoạt'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Tạo nhân viên sự kiện" className="max-w-2xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input placeholder="Họ và tên" value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} />
          <Input placeholder="Mã nhân viên" value={form.staff_code} onChange={(event) => setForm((current) => ({ ...current, staff_code: event.target.value }))} />
          <Input type="email" placeholder="Email đăng nhập" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          <Input type="password" placeholder="Mật khẩu ban đầu" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
          <select className="h-11 rounded-lg border admin-border admin-bg-listbox px-3 admin-text-body" value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value as Gender }))}>
            <option value="OTHER">Khác</option>
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
          </select>
          <Input type="number" min={18} max={100} placeholder="Tuổi" value={form.age} onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModalOpen(false)}>Hủy</Button>
          <Button onClick={() => void handleCreate()} isLoading={saving}>
            <IdCard className="h-4 w-4" /> Tạo tài khoản
          </Button>
        </div>
      </Modal>
    </div>
  )
}
