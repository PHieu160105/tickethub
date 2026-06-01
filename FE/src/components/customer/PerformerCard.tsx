import { Badge } from '@/components/ui/Badge'
import type { ShowPerformer } from '@/types'

const FALLBACK_PERFORMER_IMAGE =
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=400&q=80'

function performerPositionLabel(role: ShowPerformer['role']) {
  if (role === 'MAIN') return 'Main'
  if (role === 'GUEST') return 'Guest'
  return 'Backup'
}

export function PerformerCard({ performer }: { performer: ShowPerformer }) {
  return (
    <div className="relative group w-[210px] shrink-0 snap-start mx-2">
      {/* border gradient giống search input */}
      <div className="absolute rounded-xl blur opacity-55 group-hover:opacity-40 transition duration-1000" />
      
      <article className="relative overflow-hidden rounded-xl bg-[var(--customer-bg-page)] shadow-lg hover:translate-y-[-4px] hover:bg-[var(--customer-bg-page)]/10 transition-all duration-300">
        <div className="h-44 relative overflow-hidden">
          <img
            src={performer.image_url || FALLBACK_PERFORMER_IMAGE}
            alt={performer.stage_name}
            className="h-44 w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
        <div className="space-y-3 p-4">
          <div className="border-b border-slate-500">
            <p className="line-clamp-2 min-h-12 text-base font-bold customer-text-header">
              {performer.stage_name}
            </p>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="customer-text-muted">Vai trò</span>
              <span className="truncate font-medium customer-text-body">
                {performer.artist_type || 'Nghệ sĩ'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="customer-text-muted">Vị trí</span>
              <Badge variant={performer.role === 'MAIN' ? 'success' : 'warning'} size="sm">
                {performerPositionLabel(performer.role)}
              </Badge>
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}
