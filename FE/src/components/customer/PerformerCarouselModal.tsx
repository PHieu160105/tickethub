import { useEffect, useMemo, useRef, useState, type WheelEvent } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { createPortal } from 'react-dom'

import { PerformerCard } from '@/components/customer/PerformerCard'
import type { ShowSummary } from '@/types'

type PerformerFilter = 'all' | 'MAIN' | 'GUEST'

export function PerformerCarouselModal({
  show,
  onClose,
}: {
  show: ShowSummary | null
  onClose: () => void
}) {
  const [filter, setFilter] = useState<PerformerFilter>('all')
  const stripRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!show) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [onClose, show])

  const performers = useMemo(() => {
    if (!show) return []
    if (filter === 'all') return show.performers
    return show.performers.filter((performer) => performer.role === filter)
  }, [filter, show])

  if (!show) return null

  const scroll = (direction: 'left' | 'right') => {
    stripRef.current?.scrollBy({ left: direction === 'left' ? -456 : 456, behavior: 'smooth' })
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const node = stripRef.current
    if (!node || node.scrollWidth <= node.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    event.preventDefault()
    node.scrollBy({ left: event.deltaY, behavior: 'auto' })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="performer-carousel-title"
    >
      <section className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[var(--customer-border)] bg-[var(--customer-bg-surface-strong)] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--customer-border)] px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] customer-text-muted">Danh sách nghệ sĩ</p>
            <h2 id="performer-carousel-title" className="mt-1 text-xl font-bold customer-text-header">{show.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg customer-text-muted transition hover:bg-[var(--customer-bg-soft)] hover:text-[var(--customer-text-header)]"
            aria-label="Đóng danh sách nghệ sĩ"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex items-center justify-between gap-3 border-b border-[var(--customer-border)] px-5 py-3">
          <p className="text-sm customer-text-muted">{performers.length} nghệ sĩ</p>
          <div className="relative min-w-32">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as PerformerFilter)}
              className="h-10 w-full appearance-none rounded-lg border border-[var(--customer-border)] bg-[var(--customer-bg-page)] px-3 pr-9 text-sm customer-text-body outline-none focus:border-[var(--customer-bg-opt)]"
              aria-label="Lọc nghệ sĩ theo vị trí"
            >
              <option value="all">Tất cả</option>
              <option value="MAIN">Main</option>
              <option value="GUEST">Guest</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 customer-text-muted" />
          </div>
        </div>

        <div className="relative overflow-hidden px-14 py-6">
          {performers.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => scroll('left')}
                className="absolute left-2 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg border border-[var(--customer-border)] bg-[var(--customer-bg-surface)] customer-text-body transition hover:bg-[var(--customer-bg-soft)]"
                aria-label="Xem nghệ sĩ phía trước"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => scroll('right')}
                className="absolute right-2 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg border border-[var(--customer-border)] bg-[var(--customer-bg-surface)] customer-text-body transition hover:bg-[var(--customer-bg-soft)]"
                aria-label="Xem thêm nghệ sĩ"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          ) : null}

          {performers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--customer-border)] px-4 py-10 text-center text-sm customer-text-muted">
              Không có nghệ sĩ thuộc nhóm này.
            </div>
          ) : (
            <div
              ref={stripRef}
              onWheel={handleWheel}
              className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {performers.map((performer) => (
                <PerformerCard
                  key={`${show.id}-${performer.performer_id}-${performer.role}`}
                  performer={performer}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
