// components/admin/ZoneModal.tsx
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Edit, Trash2, Plus, Palette, X } from 'lucide-react'

export interface Zone {
  code: string
  name: string
  row_count: number
  seats_per_row: number
  price: number
  color: string
}

interface ZoneModalProps {
  isOpen: boolean
  onClose: () => void
  zones: Zone[]
  onChange: (zones: Zone[]) => void
  eventName?: string
}

const INITIAL_ZONE: Zone = {
  code: '',
  name: '',
  row_count: 10,
  seats_per_row: 20,
  price: 500000,
  color: '#024ddf',
}

export function ZoneModal({ isOpen, onClose, zones, onChange, eventName }: ZoneModalProps) {
  const [localZones, setLocalZones] = useState<Zone[]>([])
  const [editingZone, setEditingZone] = useState<Zone | null>(null)
  const [form, setForm] = useState<Zone>(INITIAL_ZONE)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setLocalZones([...zones])
      setEditingZone(null)
      setForm(INITIAL_ZONE)
      setError(null)
    }
  }, [isOpen, zones])

  const handleOpenCreate = () => {
    setEditingZone(null)
    setForm(INITIAL_ZONE)
    setError(null)
  }

  const handleOpenEdit = (zone: Zone) => {
    setEditingZone(zone)
    setForm({ ...zone })
    setError(null)
  }

  const handleDelete = (code: string) => {
    if (window.confirm(`Bạn có chắc muốn xóa zone "${code}"?`)) {
      const updated = localZones.filter((z) => z.code !== code)
      setLocalZones(updated)
      onChange(updated)
      if (editingZone?.code === code) {
        setEditingZone(null)
        setForm(INITIAL_ZONE)
      }
    }
  }

  const handleSubmit = () => {
    // Validation
    if (!form.code.trim() || !form.name.trim()) {
      setError('Zone code và Zone name là bắt buộc.')
      return
    }
    if (!/^[A-Z0-9]{1,5}$/i.test(form.code)) {
      setError('Zone code chỉ chứa chữ và số, tối đa 5 ký tự.')
      return
    }
    if (!/^#[0-9A-F]{6}$/i.test(form.color)) {
      setError('Màu zone phải là mã hex hợp lệ (ví dụ: #024ddf).')
      return
    }

    const newZone: Zone = {
      ...form,
      row_count: Number(form.row_count),
      seats_per_row: Number(form.seats_per_row),
      price: Number(form.price),
    }

    let updated: Zone[]
    if (editingZone) {
      // Update existing zone (by code)
      updated = localZones.map((z) => (z.code === editingZone.code ? newZone : z))
    } else {
      // Check duplicate code
      if (localZones.some((z) => z.code.toLowerCase() === newZone.code.toLowerCase())) {
        setError('Zone code đã tồn tại.')
        return
      }
      updated = [...localZones, newZone]
    }

    setLocalZones(updated)
    onChange(updated)
    setEditingZone(null)
    setForm(INITIAL_ZONE)
    setError(null)
  }

  const totalSeats = localZones.reduce((sum, z) => sum + z.row_count * z.seats_per_row, 0)
  const estimatedRevenue = localZones.reduce(
    (sum, z) => sum + z.row_count * z.seats_per_row * z.price,
    0
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={eventName ? `Quản lý Zone - ${eventName}` : 'Quản lý Zone'}
      className="max-w-4xl"
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-space-700/50 border border-white/10">
            <p className="text-xs text-gray-400">Tổng ghế</p>
            <p className="text-xl font-bold text-white">{totalSeats.toLocaleString('vi-VN')}</p>
          </div>
          <div className="p-3 rounded-lg bg-space-700/50 border border-white/10">
            <p className="text-xs text-gray-400">Doanh thu ước tính</p>
            <p className="text-xl font-bold text-brand-yellow">
              {estimatedRevenue.toLocaleString('vi-VN')}₫
            </p>
          </div>
        </div>

        {/* Zone List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300">Danh sách Zone</h3>
            <Button variant="primary" size="sm" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Thêm Zone
            </Button>
          </div>

          {localZones.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-white/20 rounded-lg">
              Chưa có zone nào. Nhấn "Thêm Zone" để bắt đầu.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {localZones.map((zone) => (
                <div
                  key={zone.code}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border transition-all',
                    editingZone?.code === zone.code
                      ? 'border-brand-red bg-brand-red/10'
                      : 'border-white/10 hover:border-white/30 bg-space-700/30'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Color Preview Box */}
                    <div
                      className="w-8 h-8 rounded-md border border-white/20 flex-shrink-0"
                      style={{ backgroundColor: zone.color }}
                      title={zone.color}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {zone.code}
                        </Badge>
                        <span className="font-medium text-white truncate">{zone.name}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {zone.row_count} hàng × {zone.seats_per_row} ghế ={' '}
                        {(zone.row_count * zone.seats_per_row).toLocaleString('vi-VN')} ghế •{' '}
                        {zone.price.toLocaleString('vi-VN')}₫
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleOpenEdit(zone)}
                      title="Sửa zone"
                    >
                      <Edit className="h-4 w-4 text-gray-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                      onClick={() => handleDelete(zone.code)}
                      title="Xóa zone"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zone Form */}
        <div className="pt-4 border-t border-white/10">
          <h3 className="text-sm font-medium text-gray-300 mb-4">
            {editingZone ? 'Chỉnh sửa Zone' : 'Thêm Zone mới'}
          </h3>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Zone code <span className="text-brand-red">*</span>
              </label>
              <Input
                placeholder="VD: A, VIP, GA..."
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                maxLength={5}
                className="font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Zone name <span className="text-brand-red">*</span>
              </label>
              <Input
                placeholder="VD: Standard, Premium..."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Rows</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.row_count}
                onChange={(e) => setForm({ ...form, row_count: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Seats/row</label>
              <Input
                type="number"
                min={1}
                max={200}
                value={form.seats_per_row}
                onChange={(e) => setForm({ ...form, seats_per_row: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Price (₫)</label>
              <Input
                type="number"
                min={0}
                step={10000}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Zone color</label>
              <div className="flex items-center gap-2">
                {/* Color Preview Square */}
                <div
                  className="w-10 h-10 rounded-lg border border-white/20 flex-shrink-0 cursor-pointer"
                  style={{ backgroundColor: form.color }}
                  title={form.color}
                />
                <Input
                  type="text"
                  placeholder="#024ddf"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="font-mono lowercase"
                  pattern="^#[0-9A-F]{6}$"
                />
              </div>
              {/* Optional: Native color picker */}
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full h-8 mt-2 rounded cursor-pointer bg-transparent"
                title="Chọn màu"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            {editingZone && (
              <Button variant="ghost" onClick={() => {
                setEditingZone(null)
                setForm(INITIAL_ZONE)
                setError(null)
              }}>
                Hủy sửa
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Đóng
            </Button>
            <Button variant="primary" onClick={handleSubmit}>
              {editingZone ? 'Cập nhật Zone' : 'Thêm Zone'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}