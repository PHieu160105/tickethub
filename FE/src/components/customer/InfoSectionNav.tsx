interface InfoSectionNavItem {
  id: string
  label: string
}

interface InfoSectionNavProps {
  items: InfoSectionNavItem[]
  activeId: string
  onSelect: (id: string) => void
}

export function InfoSectionNav({ items, activeId, onSelect }: InfoSectionNavProps) {
  return (
    <div className="sticky top-20 z-30 rounded-2xl border customer-border customer-bg-surface px-4 py-3 shadow-lg backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={`transition-colors ${
                activeId === item.id ? 'text-primary font-semibold' : 'customer-text-muted hover:text-primary'
              }`}
            >
              {item.label}
            </button>
            {index < items.length - 1 ? <span className="customer-text-muted">/</span> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
