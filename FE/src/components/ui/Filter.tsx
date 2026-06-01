import { X } from 'lucide-react'

interface FilterSectionProps {
  title: string
  children: React.ReactNode
  onReset: () => void
  activeFiltersCount?: number
}

export function FilterSection({ title, children, onReset, activeFiltersCount = 0 }: FilterSectionProps) {
  return (
    <div className="glass-panel p-6 rounded-xl border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-yellow-400 font-headline font-bold text-lg uppercase tracking-wider">
          {title}
        </h3>
        {activeFiltersCount > 0 && (
          <button
            onClick={onReset}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" />
            Reset All
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

interface FilterCategoryProps {
  label: string
  children: React.ReactNode
}

export function FilterCategory({ label, children }: FilterCategoryProps) {
  return (
    <div className="mb-6 last:mb-0">
      <h4 className="text-xs font-headline font-bold uppercase tracking-widest text-slate-400 mb-3">
        {label}
      </h4>
      {children}
    </div>
  )
}

interface FilterOptionProps {
  label: string
  checked: boolean
  onChange: () => void
}

export function FilterOption({ label, checked, onChange }: FilterOptionProps) {
  return (
    <label className="flex items-center gap-3 mb-3 cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only"
        />
        <div className={`w-5 h-5 rounded border-2 transition-all ${
          checked 
            ? 'bg-primary border-primary' 
            : 'border-slate-600 group-hover:border-slate-500'
        }`}>
          {checked && (
            <svg className="w-full h-full text-white p-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
      <span className={`text-sm transition-colors ${
        checked ? 'text-white font-semibold' : 'text-slate-300 group-hover:text-white'
      }`}>
        {label}
      </span>
    </label>
  )
}
