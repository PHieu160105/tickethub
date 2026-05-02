import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/Input'
import { searchApi } from '@/lib/api'
import type { SearchSuggestionItem } from '@/types'

interface Props {
  value: string
  onChange: (v: string) => void
  onSelect?: (item: SearchSuggestionItem) => void
  placeholder?: string
  scope?: 'global' | 'events' | 'venues' | 'users' | 'tickets'
  className?: string
}

export function SearchAutocompleteInput({ value, onChange, onSelect, placeholder, scope = 'global', className }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<SearchSuggestionItem[]>([])

  useEffect(() => {
    if (!value.trim()) {
      setItems([])
      setOpen(false)
      return
    }
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchApi.suggest(value.trim(), scope)
        setItems(data)
        setOpen(true)
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [value, scope])

  const hasItems = useMemo(() => items.length > 0, [items.length])

  return (
    <div className={`relative ${className ?? ''}`}>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} onFocus={() => value && setOpen(true)} />
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/10 bg-slate-900 shadow-xl">
          {loading ? (
            <div className="px-3 py-2 text-xs text-slate-400">Loading suggestions...</div>
          ) : hasItems ? (
            items.map((item) => (
              <button
                type="button"
                key={`${item.item_type}-${item.value}-${item.label}`}
                onClick={() => {
                  onChange(item.label)
                  setOpen(false)
                  onSelect?.(item)
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              >
                {item.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-slate-400">No suggestions</div>
          )}
        </div>
      )}
    </div>
  )
}
