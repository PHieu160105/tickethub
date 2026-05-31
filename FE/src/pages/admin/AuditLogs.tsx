import { useEffect, useState } from 'react'
import { RefreshCcw, Search } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { adminApi, extractApiErrorMessage } from '@/lib/api'
import type { AdminAuditLogItem } from '@/types'

const PAGE_SIZE = 25

type AuditDiff = {
  before: string[]
  after: string[]
}

function parseAuditValue(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function stringifyAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function flattenAuditValue(value: unknown, prefix = ''): Map<string, string> {
  const result = new Map<string, string>()

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, childValue] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (childValue && typeof childValue === 'object' && !Array.isArray(childValue)) {
        for (const [childKey, flattenedValue] of flattenAuditValue(childValue, path)) {
          result.set(childKey, flattenedValue)
        }
      } else {
        result.set(path, stringifyAuditValue(childValue))
      }
    }
    return result
  }

  result.set(prefix || 'value', stringifyAuditValue(value))
  return result
}

function buildAuditDiff(oldValue: string | null, newValue: string | null): AuditDiff {
  const before = flattenAuditValue(parseAuditValue(oldValue))
  const after = flattenAuditValue(parseAuditValue(newValue))
  const keys = Array.from(new Set([...before.keys(), ...after.keys()])).sort()
  const changedKeys = keys.filter((key) => before.get(key) !== after.get(key))

  if (changedKeys.length === 0) {
    return { before: ['Không có thay đổi'], after: ['Không có thay đổi'] }
  }

  return {
    before: changedKeys.map((key) => `${key}: ${before.get(key) ?? '-'}`),
    after: changedKeys.map((key) => `${key}: ${after.get(key) ?? '-'}`),
  }
}

function AuditDiffList({ values }: { values: string[] }) {
  return (
    <ul className="max-h-44 space-y-2 overflow-auto rounded-lg border admin-border bg-black/10 p-3 text-xs leading-relaxed admin-text-muted">
      {values.map((value, index) => (
        <li key={`${value}-${index}`} className="break-words">
          {value}
        </li>
      ))}
    </ul>
  )
}

function AuditTimestamp({ value }: { value: string }) {
  const date = new Date(value)

  return (
    <div className="space-y-1">
      <p>{date.toLocaleTimeString('vi-VN')}</p>
      <p className="text-xs">{date.toLocaleDateString('vi-VN')}</p>
    </div>
  )
}

export default function AdminAuditLogs() {
  const [items, setItems] = useState<AdminAuditLogItem[]>([])
  const [action, setAction] = useState('')
  const [targetTable, setTargetTable] = useState('')
  const [actorUserId, setActorUserId] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadLogs() {
    setLoading(true)
    setError(null)
    try {
      const response = await adminApi.auditLogs({
        action: action.trim() || undefined,
        target_table: targetTable.trim() || undefined,
        actor_user_id: actorUserId ? Number(actorUserId) : undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      })
      setItems(response.items)
      setTotal(response.total)
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể tải nhật ký quản trị.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadLogs()
    // Filters are applied explicitly to avoid sending a request on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold admin-text-header">Nhật ký quản trị</h2>
          <p className="mt-1 text-sm admin-text-muted">Theo dõi các thay đổi dữ liệu do nhân viên nội bộ thực hiện.</p>
        </div>
        <Button variant="outline" onClick={() => void loadLogs()} isLoading={loading}><RefreshCcw className="h-4 w-4" /> Làm mới</Button>
      </div>

      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-[0.7fr_1fr_1fr_auto]">
          <Input type="number" min={1} placeholder="ID người thao tác" value={actorUserId} onChange={(event) => setActorUserId(event.target.value)} />
          <Input placeholder="Hành động, ví dụ UPDATE_EVENT" value={action} onChange={(event) => setAction(event.target.value)} />
          <Input placeholder="Bảng dữ liệu, ví dụ events" value={targetTable} onChange={(event) => setTargetTable(event.target.value)} />
          <Button onClick={() => page === 1 ? void loadLogs() : setPage(1)}><Search className="h-4 w-4" /> Lọc nhật ký</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Danh sách thay đổi</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] table-fixed border-separate border-spacing-y-2 text-left text-sm">
              <thead><tr><th className="w-32 px-4 pb-3">Thời điểm</th><th className="w-56 px-4 pb-3">Người thao tác</th><th className="w-80 px-4 pb-3">Action</th><th className="w-40 px-4 pb-3">Target table</th><th className="w-[20rem] px-4 pb-3">Trước</th><th className="w-[20rem] px-4 pb-3">Sau</th></tr></thead>
              <tbody>
                {items.map((item) => {
                  const diff = buildAuditDiff(item.old_value, item.new_value)
                  return (
                    <tr key={item.id} className="align-top admin-table-row">
                      <td className="whitespace-nowrap rounded-l-lg px-4 py-4 admin-text-muted"><AuditTimestamp value={item.created_at} /></td>
                      <td className="px-4 py-4"><p className="font-medium admin-text-body">{item.actor_name}</p><p className="mt-1 text-xs admin-text-muted">{item.actor_email}</p></td>
                      <td className="px-4 py-4"><Badge variant="info" className="w-fit max-w-none whitespace-nowrap">{item.action}</Badge></td>
                      <td className="whitespace-nowrap px-4 py-4 admin-text-body">{item.target_table}</td>
                      <td className="w-[20rem] px-4 py-4"><AuditDiffList values={diff.before} /></td>
                      <td className="w-[20rem] rounded-r-lg px-4 py-4"><AuditDiffList values={diff.after} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!loading && items.length === 0 ? <p className="py-6 text-center text-sm admin-text-muted">Chưa có nhật ký phù hợp.</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Trước</Button>
            <span className="px-3 py-2 text-sm admin-text-muted">{page}/{totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Sau</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
