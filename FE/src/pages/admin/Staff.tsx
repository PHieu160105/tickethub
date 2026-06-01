import { useEffect, useState } from 'react'
import { CalendarRange, IdCard, Plus, RefreshCcw, Save, UserCheck, UserX } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { adminApi, extractApiErrorMessage } from '@/lib/api'
import type { EventAssignmentOverviewItem, EventStaffItem, Gender } from '@/types'

const INITIAL_FORM = { full_name: '', email: '', password: '', staff_code: '', gender: 'OTHER' as Gender, age: '18' }

export default function AdminStaff() {
  const [staff, setStaff] = useState<EventStaffItem[]>([])
  const [assignments, setAssignments] = useState<EventAssignmentOverviewItem[]>([])
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<number, number[]>>({})
  const [form, setForm] = useState(INITIAL_FORM)
  const [activeTab, setActiveTab] = useState<'staff' | 'assignments'>('staff')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [nextStaff, nextAssignments] = await Promise.all([adminApi.listStaff(), adminApi.listEventAssignments()])
      setStaff(nextStaff)
      setAssignments(nextAssignments)
      setAssignmentDrafts(Object.fromEntries(nextAssignments.map((item) => [item.event_id, item.assigned_staff.map((member) => member.user_id)])))
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể tải dữ liệu nhân viên sự kiện.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      await adminApi.createStaff({ ...form, age: Number(form.age) })
      setModalOpen(false)
      setForm(INITIAL_FORM)
      setMessage('Đã tạo tài khoản event staff.')
      await loadData()
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể tạo nhân viên sự kiện.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(item: EventStaffItem) {
    setError(null)
    try {
      await adminApi.updateStaffStatus(item.user_id, !item.is_active)
      setMessage(item.is_active ? 'Đã vô hiệu hóa tài khoản.' : 'Đã kích hoạt tài khoản.')
      await loadData()
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể cập nhật trạng thái. Hãy phân công staff thay thế trước khi vô hiệu hóa.'))
    }
  }

  function toggleAssignment(eventId: number, staffId: number) {
    setAssignmentDrafts((current) => {
      const selected = current[eventId] ?? []
      return { ...current, [eventId]: selected.includes(staffId) ? selected.filter((id) => id !== staffId) : [...selected, staffId] }
    })
  }

  async function saveAssignment(eventId: number) {
    const staffIds = assignmentDrafts[eventId] ?? []
    if (staffIds.length === 0) {
      setError('Mỗi sự kiện phải có ít nhất một event staff đang hoạt động.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await adminApi.updateEventAssignments(eventId, staffIds)
      setMessage('Đã cập nhật phân công sự kiện.')
      await loadData()
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể cập nhật phân công sự kiện.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold admin-text-header">Quản lý event staff</h2>
          <p className="mt-1 text-sm admin-text-muted">System admin quản lý tài khoản và phân công nhân viên vào từng sự kiện.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadData()} isLoading={loading}><RefreshCcw className="h-4 w-4" /> Làm mới</Button>
          <Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Tạo nhân viên</Button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}

      <div className="flex gap-2">
        <Button variant={activeTab === 'staff' ? 'primary' : 'outline'} onClick={() => setActiveTab('staff')}><IdCard className="h-4 w-4" /> Tài khoản</Button>
        <Button variant={activeTab === 'assignments' ? 'primary' : 'outline'} onClick={() => setActiveTab('assignments')}><CalendarRange className="h-4 w-4" /> Phân công sự kiện</Button>
      </div>

      {activeTab === 'staff' ? (
        <Card>
          <CardHeader><CardTitle>Danh sách tài khoản event staff</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b admin-border text-left admin-text-body"><th className="pb-3">Nhân viên</th><th className="pb-3">Mã nhân viên</th><th className="pb-3">Ngày tạo</th><th className="pb-3">Trạng thái</th><th className="pb-3 text-right">Thao tác</th></tr></thead>
                <tbody>{staff.map((item) => <tr key={item.user_id} className="border-b border-white/5"><td className="py-4"><p className="font-medium admin-text-body">{item.full_name}</p><p className="text-xs admin-text-muted">{item.email}</p></td><td className="py-4 font-mono admin-text-body">{item.staff_code}</td><td className="py-4 admin-text-body">{new Date(item.created_at).toLocaleDateString('vi-VN')}</td><td className="py-4"><Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}</Badge></td><td className="py-4 text-right"><Button variant="outline" size="sm" onClick={() => void handleToggle(item)}>{item.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}{item.is_active ? 'Vô hiệu hóa' : 'Kích hoạt'}</Button></td></tr>)}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {assignments.map((event) => (
            <Card key={event.event_id}>
              <CardHeader><CardTitle>{event.event_title}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {staff.filter((item) => item.is_active).map((item) => <label key={item.user_id} className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-3 text-sm admin-text-body"><input type="checkbox" checked={(assignmentDrafts[event.event_id] ?? []).includes(item.user_id)} onChange={() => toggleAssignment(event.event_id, item.user_id)} /><span><span className="block font-semibold">{item.full_name}</span><span className="text-xs admin-text-muted">{item.staff_code}</span></span></label>)}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs admin-text-muted">Mỗi sự kiện phải còn ít nhất một staff đang hoạt động.</p><Button onClick={() => void saveAssignment(event.event_id)} isLoading={saving}><Save className="h-4 w-4" /> Lưu phân công</Button></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Tạo nhân viên sự kiện" className="max-w-2xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input placeholder="Họ và tên" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
          <Input placeholder="Mã nhân viên" value={form.staff_code} onChange={(event) => setForm({ ...form, staff_code: event.target.value })} />
          <Input type="email" placeholder="Email đăng nhập" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <Input type="password" placeholder="Mật khẩu ban đầu" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <select className="h-11 rounded-lg border admin-border admin-bg-listbox px-3 admin-text-body" value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as Gender })}><option value="OTHER">Khác</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option></select>
          <Input type="number" min={18} max={100} placeholder="Tuổi" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} />
        </div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setModalOpen(false)}>Hủy</Button><Button onClick={() => void handleCreate()} isLoading={saving}><IdCard className="h-4 w-4" /> Tạo tài khoản</Button></div>
      </Modal>
    </div>
  )
}
