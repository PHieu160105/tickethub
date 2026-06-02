import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { adminApi, extractApiErrorMessage } from '@/lib/api'
import type { PerformerRole, PerformerSuggestionItem, ShowSummary } from '@/types'

type DraftPerformer = {
  local_id: string
  show_performer_id?: number
  performer_id?: number
  stage_name: string
  artist_type: string
  image_url: string
  role: PerformerRole
  sort_order: number
}

type FieldValidation = {
  stage_name?: string
}

type ValidationState = {
  sectionErrors: Partial<Record<PerformerRole, string>>
  fieldErrors: Record<string, FieldValidation>
}

type AutocompleteProps = {
  value: string
  selectedPerformerId?: number
  onChange: (value: string) => void
  onSelect: (item: PerformerSuggestionItem) => void
  placeholder: string
  hasError?: boolean
  errorMessage?: string
}

const DEFAULT_PERFORMER_IMAGE =
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80'
const MAX_PERFORMER_IMAGE_BYTES = 10 * 1024 * 1024
const SUPPORTED_PERFORMER_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function createLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createDraftPerformer(role: PerformerRole, seed?: Partial<DraftPerformer>): DraftPerformer {
  return {
    local_id: seed?.local_id ?? createLocalId(),
    show_performer_id: seed?.show_performer_id,
    performer_id: seed?.performer_id,
    stage_name: seed?.stage_name ?? '',
    artist_type: seed?.artist_type ?? '',
    image_url: seed?.image_url ?? '',
    role,
    sort_order: seed?.sort_order ?? 0,
  }
}

function buildValidation(rows: DraftPerformer[]): ValidationState {
  const sectionErrors: ValidationState['sectionErrors'] = {}
  const fieldErrors: ValidationState['fieldErrors'] = {}

  const mainCount = rows.filter((item) => item.role === 'MAIN').length
  if (mainCount < 1) {
    sectionErrors.MAIN = 'Cần ít nhất 1 main performer.'
  }

  const nameMap = new Map<string, string[]>()
  rows.forEach((item) => {
    const normalized = item.stage_name.trim().toLowerCase()
    if (!normalized) {
      fieldErrors[item.local_id] = {
        ...fieldErrors[item.local_id],
        stage_name: 'Vui lòng nhập nghệ danh.',
      }
      return
    }
    nameMap.set(normalized, [...(nameMap.get(normalized) ?? []), item.local_id])
  })

  nameMap.forEach((ids) => {
    if (ids.length < 2) return
    ids.forEach((id) => {
      fieldErrors[id] = {
        ...fieldErrors[id],
        stage_name: 'Nghệ sĩ này đã xuất hiện trong show.',
      }
    })
  })

  return {
    sectionErrors,
    fieldErrors,
  }
}

function hasValidationErrors(validation: ValidationState) {
  return Object.keys(validation.sectionErrors).length > 0 || Object.keys(validation.fieldErrors).length > 0
}

function PerformerAutocomplete({
  value,
  selectedPerformerId,
  onChange,
  onSelect,
  placeholder,
  hasError,
  errorMessage,
}: AutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<PerformerSuggestionItem[]>([])
  const [isFocused, setIsFocused] = useState(false)
  const suppressNextFetchRef = useRef(false)
  const blurTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) {
        window.clearTimeout(blurTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const trimmed = value.trim()

    if (!isFocused || !trimmed || selectedPerformerId) {
      setItems([])
      setOpen(false)
      return
    }

    if (suppressNextFetchRef.current) {
      suppressNextFetchRef.current = false
      setItems([])
      setOpen(false)
      return
    }

    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await adminApi.suggestPerformers(trimmed)
        setItems(response)
        setOpen(response.length > 0)
      } catch {
        setItems([])
        setOpen(false)
      } finally {
        setLoading(false)
      }
    }, 220)

    return () => window.clearTimeout(timer)
  }, [isFocused, selectedPerformerId, value])

  return (
    <div className="relative">
      <Input
        value={value}
        variant={hasError ? 'error' : 'default'}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        onFocus={() => {
          if (blurTimerRef.current) {
            window.clearTimeout(blurTimerRef.current)
          }
          setIsFocused(true)
        }}
        onBlur={() => {
          blurTimerRef.current = window.setTimeout(() => {
            setIsFocused(false)
            setOpen(false)
          }, 120)
        }}
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-white/10 admin-bg-listbox shadow-xl">
          {loading ? (
            <div className="px-3 py-2 text-xs text-gray-400">Đang tải gợi ý...</div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full border-b border-white/5 px-3 py-2 text-left transition hover:bg-white/10 last:border-b-0"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  suppressNextFetchRef.current = true
                  onSelect(item)
                  setItems([])
                  setOpen(false)
                }}
              >
                <div className="text-sm text-white">{item.stage_name}</div>
                <div className="text-xs text-gray-400">
                  {item.artist_type || 'Chưa phân loại'}
                  {` • Đã tham gia ${item.show_count} show`}
                </div>
              </button>
            ))
          )}
        </div>
      )}
      {errorMessage ? <p className="mt-2 text-xs text-red-300">{errorMessage}</p> : null}
    </div>
  )
}

interface ShowPerformersModalProps {
  isOpen: boolean
  show: ShowSummary | null
  onClose: () => void
  onSaved: () => Promise<void> | void
}

export function ShowPerformersModal({ isOpen, show, onClose, onSaved }: ShowPerformersModalProps) {
  const [rows, setRows] = useState<DraftPerformer[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingImageLocalId, setUploadingImageLocalId] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false)

  const validation = useMemo(() => buildValidation(rows), [rows])

  useEffect(() => {
    if (!isOpen || !show) return
    const activeShow = show

    let cancelled = false

    async function load() {
      setLoading(true)
      setRequestError(null)
      setHasAttemptedSave(false)
      try {
        const response = await adminApi.getShowPerformers(activeShow.id)
        if (cancelled) return

        if (response.length === 0) {
          setRows([])
          return
        }

        setRows(
          response.map((item, index) =>
            createDraftPerformer(item.role, {
              local_id: `server-${item.show_performer_id}`,
              show_performer_id: item.show_performer_id,
              performer_id: item.performer_id,
              stage_name: item.stage_name,
              artist_type: item.artist_type ?? '',
              image_url: item.image_url ?? '',
              sort_order: item.sort_order ?? index,
            }),
          ),
        )
      } catch (errorValue) {
        if (!cancelled) {
          setRows([])
          setRequestError(extractApiErrorMessage(errorValue, 'Không thể tải danh sách nghệ sĩ của show.'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [isOpen, show])

  function clearRequestError() {
    setRequestError(null)
  }

  function setRow(localId: string, updater: (previous: DraftPerformer) => DraftPerformer) {
    clearRequestError()
    setRows((previous) => previous.map((item) => (item.local_id === localId ? updater(item) : item)))
  }

  function addRow(role: PerformerRole) {
    clearRequestError()
    setRows((previous) => [
      ...previous,
      createDraftPerformer(role, {
        sort_order: previous.filter((item) => item.role === role).length,
      }),
    ])
  }

  function removeRow(localId: string) {
    clearRequestError()
    setRows((previous) => previous.filter((item) => item.local_id !== localId))
  }

  async function handleSuggestionSelect(localId: string, item: PerformerSuggestionItem) {
    clearRequestError()
    try {
      const detail = await adminApi.getPerformerDetail(item.id)
      setRows((previous) =>
        previous.map((row) =>
          row.local_id === localId
            ? {
                ...row,
                performer_id: detail.id,
                stage_name: detail.stage_name,
                artist_type: detail.artist_type ?? '',
                image_url: detail.image_url ?? '',
              }
            : row,
        ),
      )
    } catch (errorValue) {
      setRequestError(extractApiErrorMessage(errorValue, 'Không thể lấy chi tiết nghệ sĩ được chọn.'))
    }
  }

  async function handleImageUpload(localId: string, file: File | null) {
    if (!file) return
    clearRequestError()
    if (!SUPPORTED_PERFORMER_IMAGE_TYPES.has(file.type)) {
      setRequestError('Ảnh nghệ sĩ chỉ hỗ trợ JPG, JPEG, PNG hoặc WEBP.')
      return
    }
    if (file.size > MAX_PERFORMER_IMAGE_BYTES) {
      setRequestError('Ảnh nghệ sĩ phải có dung lượng không quá 10MB.')
      return
    }
    setUploadingImageLocalId(localId)
    try {
      const uploaded = await adminApi.uploadPerformerImage(file)
      setRows((previous) =>
        previous.map((row) => (row.local_id === localId ? { ...row, image_url: uploaded.image_url } : row)),
      )
    } catch (errorValue) {
      setRequestError(extractApiErrorMessage(errorValue, 'Không thể upload ảnh nghệ sĩ.'))
    } finally {
      setUploadingImageLocalId(null)
    }
  }

  async function handleSave() {
    if (!show) return

    setHasAttemptedSave(true)
    clearRequestError()

    if (hasValidationErrors(validation)) {
      return
    }

    setSaving(true)
    try {
      await adminApi.updateShowPerformers(show.id, {
        performers: rows.map((item, index) => ({
          show_performer_id: item.show_performer_id,
          performer_id: item.performer_id,
          stage_name: item.stage_name.trim(),
          artist_type: item.artist_type.trim() || null,
          image_url: item.image_url || null,
          role: item.role,
          sort_order: index,
        })),
      })
      await onSaved()
      onClose()
    } catch (errorValue) {
      setRequestError(extractApiErrorMessage(errorValue, 'Không thể lưu lineup nghệ sĩ cho show.'))
    } finally {
      setSaving(false)
    }
  }

  function renderEmptyState(role: PerformerRole, title: string) {
    const buttonLabel = role === 'MAIN' ? 'Thêm main' : role === 'GUEST' ? 'Thêm guest' : 'Thêm backup'

    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-black/10 px-4 py-5">
        <p className="text-sm text-gray-400">Chưa có nghệ sĩ trong nhóm {title.toLowerCase()}.</p>
        <div className="mt-3">
          <Button variant="ghost" size="sm" className="text-primary" onClick={() => addRow(role)}>
            <Plus className="h-4 w-4" /> {buttonLabel}
          </Button>
        </div>
      </div>
    )
  }

  function renderSection(role: PerformerRole, title: string, description: string) {
    const items = rows.filter((item) => item.role === role)
    const sectionError = hasAttemptedSave ? validation.sectionErrors[role] : undefined

    return (
      <section className={`rounded-xl border p-4 ${sectionError ? 'border-red-500/35 bg-red-500/6' : 'border-white/10 bg-white/5'}`}>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">{title}</h3>
              <Badge variant={role === 'MAIN' ? 'success' : role === 'GUEST' ? 'warning' : 'default'} size="sm">
                {items.length}
              </Badge>
            </div>
            <p className="text-sm text-gray-400">{description}</p>
            {sectionError ? <p className="mt-2 text-sm text-red-200">{sectionError}</p> : null}
          </div>
          <Button variant="ghost" size="sm" className="text-primary" onClick={() => addRow(role)}>
            <Plus className="h-4 w-4" /> Thêm
          </Button>
        </div>

        <div className="space-y-3">
          {items.length === 0
            ? renderEmptyState(role, title)
            : items.map((item) => {
                const stageNameError = hasAttemptedSave ? validation.fieldErrors[item.local_id]?.stage_name : undefined

                return (
                  <div key={item.local_id} className="rounded-xl border border-white/10 bg-space-900/60 p-3">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[84px_1fr]">
                      <div className="space-y-2">
                        <img
                          src={item.image_url || DEFAULT_PERFORMER_IMAGE}
                          alt={item.stage_name || 'Performer preview'}
                          className="h-20 w-20 rounded-xl border border-white/10 object-cover"
                        />
                        <label className={`flex items-center justify-center gap-2 rounded-lg border border-white/10 px-2 py-2 text-xs text-gray-300 transition ${uploadingImageLocalId === item.local_id ? 'cursor-wait opacity-60' : 'cursor-pointer hover:bg-white/10'}`}>
                          <ImagePlus className="h-3.5 w-3.5" />
                          {uploadingImageLocalId === item.local_id ? 'Đang tải...' : 'Ảnh'}
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                            className="hidden"
                            disabled={uploadingImageLocalId !== null}
                            onChange={(event) => {
                              void handleImageUpload(item.local_id, event.target.files?.[0] ?? null)
                              event.target.value = ''
                            }}
                          />
                        </label>
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_auto]">
                          <div>
                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">Nghệ danh</label>
                            <PerformerAutocomplete
                              value={item.stage_name}
                              selectedPerformerId={item.performer_id}
                              onChange={(value) =>
                                setRow(item.local_id, (previous) => ({
                                  ...previous,
                                  stage_name: value,
                                  performer_id:
                                    previous.performer_id && value.trim() !== previous.stage_name.trim()
                                      ? undefined
                                      : previous.performer_id,
                                }))
                              }
                              onSelect={(selected) => void handleSuggestionSelect(item.local_id, selected)}
                              placeholder="Nhập hoặc tìm nghệ sĩ..."
                              hasError={Boolean(stageNameError)}
                              errorMessage={stageNameError}
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">Artist type</label>
                            <Input
                              value={item.artist_type}
                              placeholder="Singer, DJ..."
                              onChange={(event) => setRow(item.local_id, (previous) => ({ ...previous, artist_type: event.target.value }))}
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            <Badge variant={role === 'MAIN' ? 'success' : role === 'GUEST' ? 'warning' : 'default'}>{role}</Badge>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => removeRow(item.local_id)}>
                            <Trash2 className="h-4 w-4" /> Xóa
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
        </div>
      </section>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={show ? `Quản lý nghệ sĩ • ${show.title}` : 'Quản lý nghệ sĩ'}
      className="max-w-5xl"
    >
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-gray-400">Đang tải lineup nghệ sĩ...</div>
        ) : (
          <>
            {renderSection('MAIN', 'Nghệ sĩ chính', 'Danh sách nghệ sĩ chính của show. Show cần ít nhất 1 nghệ sĩ chính để có thể lưu.')}
            {renderSection('GUEST', 'Khách mời', 'Khách mời hiển thị công khai cùng nghệ sĩ chính và có thể xóa khỏi show.')}
            {renderSection('BACKUP', 'Dự phòng', 'Danh sách dự phòng nội bộ của show.')}
          </>
        )}

        {requestError ? <p className="text-sm text-red-300">{requestError}</p> : null}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={() => void handleSave()} isLoading={saving || loading}>
            Lưu thay đổi
          </Button>
        </div>
      </div>
    </Modal>
  )
}
