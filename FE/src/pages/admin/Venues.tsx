import { useEffect, useMemo, useState } from 'react'
import { Building2, Check, Edit, FileUp, Layers3, Palette, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { adminApi, extractApiErrorMessage } from '@/lib/api'
import type { VenueDetail, VenueLayoutItem, VenueSectionItem, VenueSummary } from '@/types'

const DEFAULT_LAYOUT_FORM = {
    name: '',
    description: '',
    svg_data: '',
    sort_order: '0',
}

const DEFAULT_SECTION_FORM = {
    name: '',
    code: '',
    color: '#024ddf',
    price_base: '0',
    sort_order: '0',
}

const DEFAULT_VENUE_FORM = {
    name: '',
    address: '',
    city: '',
    venue_type: 'theater',
    capacity: '',
    width: '1000',
    height: '600',
}

function renderSvgPreview(svg: string | null) {
    if (!svg) {
        return <div className="text-sm text-slate-400">Chưa có dữ liệu SVG.</div>
    }

    return (
        <div
            className="max-h-[420px] overflow-auto rounded-xl border border-white/10 bg-white p-3"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    )
}

export default function AdminVenues() {
    const [venues, setVenues] = useState<VenueSummary[]>([])
    const [selectedVenueId, setSelectedVenueId] = useState<number | null>(null)
    const [selectedVenue, setSelectedVenue] = useState<VenueDetail | null>(null)
    const [layouts, setLayouts] = useState<VenueLayoutItem[]>([])
    const [selectedLayoutId, setSelectedLayoutId] = useState<number | null>(null)
    const [sections, setSections] = useState<VenueSectionItem[]>([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [svgFile, setSvgFile] = useState<File | null>(null)

    const [venueForm, setVenueForm] = useState(DEFAULT_VENUE_FORM)
    const [layoutForm, setLayoutForm] = useState(DEFAULT_LAYOUT_FORM)
    const [editingLayoutId, setEditingLayoutId] = useState<number | null>(null)
    const [sectionForm, setSectionForm] = useState(DEFAULT_SECTION_FORM)
    const [editingSectionId, setEditingSectionId] = useState<number | null>(null)

    const selectedLayout = useMemo(
        () => layouts.find((layout) => layout.id === selectedLayoutId) ?? null,
        [layouts, selectedLayoutId],
    )

    async function loadVenues(nextSelectedId?: number | null) {
        setLoading(true)
        setError(null)
        try {
            const list = await adminApi.listVenues()
            setVenues(list)
            const candidate = nextSelectedId ?? selectedVenueId ?? list[0]?.id ?? null
            setSelectedVenueId(candidate)
            if (candidate) {
                await loadVenueBundle(candidate)
            } else {
                setSelectedVenue(null)
                setLayouts([])
                setSections([])
                setSelectedLayoutId(null)
            }
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể tải danh sách venue.'))
        } finally {
            setLoading(false)
        }
    }

    async function loadVenueBundle(venueId: number) {
        const [detail, layoutList] = await Promise.all([adminApi.getVenue(venueId), adminApi.listLayouts(venueId)])
        setSelectedVenue(detail)
        setLayouts(layoutList)
        const nextLayoutId = layoutList[0]?.id ?? null
        setSelectedLayoutId(nextLayoutId)
        setSelectedVenueId(venueId)
        if (nextLayoutId) {
            const layoutSections = await adminApi.listLayoutSections(nextLayoutId)
            setSections(layoutSections)
        } else {
            setSections([])
        }
    }

    useEffect(() => {
        void loadVenues()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!selectedLayoutId) {
            setSections([])
            return
        }

        let active = true
        void (async () => {
            try {
                const list = await adminApi.listLayoutSections(selectedLayoutId)
                if (active) {
                    setSections(list)
                }
            } catch (errorValue) {
                if (active) {
                    setError(extractApiErrorMessage(errorValue, 'Không thể tải sections của layout.'))
                }
            }
        })()

        return () => {
            active = false
        }
    }, [selectedLayoutId])

    async function handleCreateVenue() {
        setBusy(true)
        setError(null)
        setMessage(null)
        try {
            const created = await adminApi.createVenue({
                name: venueForm.name,
                address: venueForm.address || null,
                city: venueForm.city || null,
                venue_type: venueForm.venue_type,
                capacity: venueForm.capacity ? Number(venueForm.capacity) : null,
                width: Number(venueForm.width),
                height: Number(venueForm.height),
            })
            setVenueForm(DEFAULT_VENUE_FORM)
            setMessage('Đã tạo venue mới.')
            await loadVenues(created.id)
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể tạo venue.'))
        } finally {
            setBusy(false)
        }
    }

    async function handleUploadSvg() {
        if (!selectedVenueId || !svgFile) return
        setBusy(true)
        setError(null)
        setMessage(null)
        try {
            await adminApi.uploadVenueSvg(selectedVenueId, svgFile)
            setMessage('Đã tải SVG lên. Hãy bấm Process để xử lý nền.')
            await loadVenueBundle(selectedVenueId)
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể tải SVG.'))
        } finally {
            setBusy(false)
        }
    }

    async function handleProcessSvg() {
        if (!selectedVenueId) return
        setBusy(true)
        setError(null)
        setMessage(null)
        try {
            const result = await adminApi.processVenueSvg(selectedVenueId)
            setMessage(`Đã xử lý SVG: ${result.seat_count} seat markers, ${result.sections_detected} sections.`)
            await loadVenueBundle(selectedVenueId)
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể xử lý SVG.'))
        } finally {
            setBusy(false)
        }
    }

    function startEditLayout(layout: VenueLayoutItem) {
        setEditingLayoutId(layout.id)
        setLayoutForm({
            name: layout.name,
            description: layout.description ?? '',
            svg_data: layout.svg_data ?? '',
            sort_order: String(layout.sort_order),
        })
    }

    function resetLayoutForm() {
        setEditingLayoutId(null)
        setLayoutForm(DEFAULT_LAYOUT_FORM)
    }

    async function handleSaveLayout() {
        if (!selectedVenueId || !layoutForm.name.trim()) return
        setBusy(true)
        setError(null)
        setMessage(null)
        try {
            if (editingLayoutId) {
                await adminApi.updateLayout(editingLayoutId, {
                    name: layoutForm.name,
                    description: layoutForm.description || null,
                    svg_data: layoutForm.svg_data || null,
                    sort_order: Number(layoutForm.sort_order),
                })
                setMessage('Đã cập nhật layout.')
            } else {
                await adminApi.createLayout(selectedVenueId, {
                    name: layoutForm.name,
                    description: layoutForm.description || null,
                    svg_data: layoutForm.svg_data || null,
                    sort_order: Number(layoutForm.sort_order),
                })
                setMessage('Đã tạo layout mới.')
            }
            resetLayoutForm()
            await loadVenueBundle(selectedVenueId)
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể lưu layout.'))
        } finally {
            setBusy(false)
        }
    }

    async function handleDeleteLayout(layoutId: number) {
        if (!window.confirm('Xóa layout này?')) return
        setBusy(true)
        setError(null)
        setMessage(null)
        try {
            await adminApi.deleteLayout(layoutId)
            setMessage('Đã xóa layout.')
            if (selectedVenueId) {
                await loadVenueBundle(selectedVenueId)
            }
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể xóa layout.'))
        } finally {
            setBusy(false)
        }
    }

    function startEditSection(section: VenueSectionItem) {
        setEditingSectionId(section.id)
        setSectionForm({
            name: section.name,
            code: section.code,
            color: section.color,
            price_base: String(section.price_base),
            sort_order: String(section.sort_order),
        })
    }

    function resetSectionForm() {
        setEditingSectionId(null)
        setSectionForm(DEFAULT_SECTION_FORM)
    }

    async function handleSaveSection() {
        if (!selectedLayoutId || !sectionForm.name.trim() || !sectionForm.code.trim()) return
        setBusy(true)
        setError(null)
        setMessage(null)
        try {
            if (editingSectionId) {
                await adminApi.updateSection(editingSectionId, {
                    name: sectionForm.name,
                    code: sectionForm.code,
                    color: sectionForm.color,
                    price_base: Number(sectionForm.price_base),
                    sort_order: Number(sectionForm.sort_order),
                })
                setMessage('Đã cập nhật section.')
            } else {
                await adminApi.createLayoutSection(selectedLayoutId, {
                    name: sectionForm.name,
                    code: sectionForm.code,
                    color: sectionForm.color,
                    price_base: Number(sectionForm.price_base),
                    sort_order: Number(sectionForm.sort_order),
                })
                setMessage('Đã tạo section mới.')
            }
            resetSectionForm()
            const latestSections = await adminApi.listLayoutSections(selectedLayoutId)
            setSections(latestSections)
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể lưu section.'))
        } finally {
            setBusy(false)
        }
    }

    async function handleDeleteSection(sectionId: number) {
        if (!window.confirm('Xóa section này?')) return
        setBusy(true)
        setError(null)
        setMessage(null)
        try {
            await adminApi.deleteSection(sectionId)
            setMessage('Đã xóa section.')
            if (selectedLayoutId) {
                setSections(await adminApi.listLayoutSections(selectedLayoutId))
            }
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể xóa section.'))
        } finally {
            setBusy(false)
        }
    }

    const selectedVenueLabel = selectedVenue ? `${selectedVenue.name} · ${selectedVenue.city ?? 'N/A'}` : 'Chưa chọn venue'

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-black text-white">Venue Studio</h1>
                    <p className="text-slate-400 mt-1 max-w-2xl">
                        Upload SVG nền, xử lý layout, và quản lý sections theo đúng mô hình venue seating.
                    </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void loadVenues()} isLoading={loading}>
                    <RefreshCw className="h-4 w-4" />
                    Làm mới
                </Button>
            </div>

            {(error || message) && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
                    {error ?? message}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="xl:col-span-1 bg-space-900/90 border-white/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <Building2 className="h-5 w-5 text-brand-red" /> Venues
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <div>
                                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Name</label>
                                <Input value={venueForm.name} onChange={(event) => setVenueForm({ ...venueForm, name: event.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">City</label>
                                    <Input value={venueForm.city} onChange={(event) => setVenueForm({ ...venueForm, city: event.target.value })} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Type</label>
                                    <Input value={venueForm.venue_type} onChange={(event) => setVenueForm({ ...venueForm, venue_type: event.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Capacity</label>
                                    <Input value={venueForm.capacity} onChange={(event) => setVenueForm({ ...venueForm, capacity: event.target.value })} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Width</label>
                                    <Input value={venueForm.width} onChange={(event) => setVenueForm({ ...venueForm, width: event.target.value })} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Height</label>
                                    <Input value={venueForm.height} onChange={(event) => setVenueForm({ ...venueForm, height: event.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Address</label>
                                <Input value={venueForm.address} onChange={(event) => setVenueForm({ ...venueForm, address: event.target.value })} />
                            </div>
                            <Button className="w-full" onClick={() => void handleCreateVenue()} isLoading={busy}>
                                <Plus className="h-4 w-4" /> Tạo venue
                            </Button>
                        </div>

                        <div className="border-t border-white/10 pt-4 space-y-2">
                            {loading ? (
                                <p className="text-sm text-slate-400">Đang tải danh sách venue...</p>
                            ) : venues.length === 0 ? (
                                <p className="text-sm text-slate-400">Chưa có venue nào.</p>
                            ) : (
                                venues.map((venue) => (
                                    <button
                                        key={venue.id}
                                        type="button"
                                        onClick={() => void loadVenueBundle(venue.id)}
                                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${selectedVenueId === venue.id ? 'border-brand-red/40 bg-brand-red/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-white">{venue.name}</p>
                                                <p className="text-xs text-slate-400">{venue.city ?? 'N/A'} · {venue.venue_type}</p>
                                            </div>
                                            <span className="text-xs text-slate-400">{venue.capacity ?? 0} chỗ</span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="xl:col-span-2 space-y-6">
                    <Card className="bg-space-900/90 border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <FileUp className="h-5 w-5 text-brand-red" /> SVG Background
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-slate-400">{selectedVenueLabel}</p>
                            <div className="flex flex-col md:flex-row gap-3">
                                <input
                                    type="file"
                                    accept=".svg,image/svg+xml"
                                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-brand-red file:px-4 file:py-2 file:text-white"
                                    onChange={(event) => setSvgFile(event.target.files?.[0] ?? null)}
                                />
                                <Button variant="outline" onClick={() => void handleUploadSvg()} disabled={!selectedVenueId || !svgFile} isLoading={busy}>
                                    Upload SVG
                                </Button>
                                <Button variant="primary" onClick={() => void handleProcessSvg()} disabled={!selectedVenueId || !selectedVenue?.svg_source} isLoading={busy}>
                                    <Check className="h-4 w-4" /> Process
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div>
                                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Original SVG</p>
                                    {renderSvgPreview(selectedVenue?.svg_source ?? null)}
                                </div>
                                <div>
                                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Processed SVG</p>
                                    {renderSvgPreview(selectedVenue?.svg_processed ?? null)}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <Card className="bg-space-900/90 border-white/10">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-white">
                                    <Layers3 className="h-5 w-5 text-brand-yellow" /> Layouts
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <Input placeholder="Layout name" value={layoutForm.name} onChange={(event) => setLayoutForm({ ...layoutForm, name: event.target.value })} />
                                    <Input placeholder="Description" value={layoutForm.description} onChange={(event) => setLayoutForm({ ...layoutForm, description: event.target.value })} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input placeholder="Sort order" value={layoutForm.sort_order} onChange={(event) => setLayoutForm({ ...layoutForm, sort_order: event.target.value })} />
                                        <Input placeholder="SVG data (optional)" value={layoutForm.svg_data} onChange={(event) => setLayoutForm({ ...layoutForm, svg_data: event.target.value })} />
                                    </div>
                                    <div className="flex gap-2">
                                        {editingLayoutId && (
                                            <Button variant="ghost" onClick={resetLayoutForm}>
                                                Hủy sửa
                                            </Button>
                                        )}
                                        <Button onClick={() => void handleSaveLayout()} isLoading={busy}>
                                            <Save className="h-4 w-4" /> {editingLayoutId ? 'Cập nhật layout' : 'Thêm layout'}
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2 border-t border-white/10 pt-4">
                                    {layouts.length === 0 ? (
                                        <p className="text-sm text-slate-400">Chưa có layout nào.</p>
                                    ) : (
                                        layouts.map((layout) => (
                                            <button
                                                key={layout.id}
                                                type="button"
                                                onClick={() => setSelectedLayoutId(layout.id)}
                                                className={`w-full rounded-xl border px-4 py-3 text-left transition ${selectedLayoutId === layout.id ? 'border-brand-yellow/40 bg-brand-yellow/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="font-semibold text-white">{layout.name}</p>
                                                        <p className="text-xs text-slate-400">Sort: {layout.sort_order}</p>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={(event) => { event.stopPropagation(); startEditLayout(layout) }}>
                                                            <Edit className="h-4 w-4 text-sky-300" />
                                                        </button>
                                                        <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={(event) => { event.stopPropagation(); void handleDeleteLayout(layout.id) }}>
                                                            <Trash2 className="h-4 w-4 text-red-400" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-space-900/90 border-white/10">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-white">
                                    <Palette className="h-5 w-5 text-brand-red" /> Sections
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-sm text-slate-400">
                                    Layout: <span className="text-white">{selectedLayout?.name ?? 'Chưa chọn'}</span>
                                </p>
                                <div className="space-y-3">
                                    <Input placeholder="Section name" value={sectionForm.name} onChange={(event) => setSectionForm({ ...sectionForm, name: event.target.value })} />
                                    <Input placeholder="Code" value={sectionForm.code} onChange={(event) => setSectionForm({ ...sectionForm, code: event.target.value })} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input placeholder="Price base" value={sectionForm.price_base} onChange={(event) => setSectionForm({ ...sectionForm, price_base: event.target.value })} />
                                        <Input placeholder="Sort order" value={sectionForm.sort_order} onChange={(event) => setSectionForm({ ...sectionForm, sort_order: event.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-[96px_1fr] gap-3 items-center">
                                        <input
                                            type="color"
                                            value={sectionForm.color}
                                            onChange={(event) => setSectionForm({ ...sectionForm, color: event.target.value })}
                                            className="h-12 w-full rounded-lg border border-white/10 bg-transparent p-1"
                                        />
                                        <Input value={sectionForm.color} onChange={(event) => setSectionForm({ ...sectionForm, color: event.target.value })} />
                                    </div>
                                    <div className="flex gap-2">
                                        {editingSectionId && (
                                            <Button variant="ghost" onClick={resetSectionForm}>
                                                Hủy sửa
                                            </Button>
                                        )}
                                        <Button onClick={() => void handleSaveSection()} isLoading={busy} disabled={!selectedLayoutId}>
                                            <Save className="h-4 w-4" /> {editingSectionId ? 'Cập nhật section' : 'Thêm section'}
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2 border-t border-white/10 pt-4">
                                    {sections.length === 0 ? (
                                        <p className="text-sm text-slate-400">Chưa có section nào.</p>
                                    ) : (
                                        sections.map((section) => (
                                            <div key={section.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: section.color }} />
                                                    <div className="min-w-0">
                                                        <p className="truncate font-semibold text-white">{section.name}</p>
                                                        <p className="text-xs text-slate-400">{section.code} · {Number(section.price_base).toLocaleString('vi-VN')}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 shrink-0">
                                                    <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={() => startEditSection(section)}>
                                                        <Edit className="h-4 w-4 text-sky-300" />
                                                    </button>
                                                    <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={() => void handleDeleteSection(section.id)}>
                                                        <Trash2 className="h-4 w-4 text-red-400" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
