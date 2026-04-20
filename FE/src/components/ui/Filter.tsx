import { cn } from '@/lib/utils';
import { forwardRef, type HTMLAttributes } from 'react';

export interface FilterSectionProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  onReset?: () => void;
}

export const FilterSection = forwardRef<HTMLDivElement, FilterSectionProps>(
  ({ className, title, onReset, children, ...props }, ref) => (
    <div ref={ref} className={cn('glass-panel p-6 rounded-xl', className)} {...props}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-headline font-bold uppercase tracking-widest text-sm text-secondary">{title}</h3>
        {onReset && (
          <button onClick={onReset} className="text-xs text-slate-400 hover:text-primary transition-colors">
            Reset All
          </button>
        )}
      </div>
      {children}
    </div>
  )
);
FilterSection.displayName = 'FilterSection';

export interface FilterCategoryProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
}

export const FilterCategory = forwardRef<HTMLDivElement, FilterCategoryProps>(
  ({ className, label, children, ...props }, ref) => (
    <div ref={ref} className={cn('mb-8', className)} {...props}>
      <p className="text-xs font-headline font-bold uppercase tracking-widest text-slate-400 mb-4">{label}</p>
      <div className="space-y-3">{children}</div>
    </div>
  )
);
FilterCategory.displayName = 'FilterCategory';

export interface FilterOptionProps extends HTMLAttributes<HTMLLabelElement> {
  checked?: boolean;
  label: string;
}

export const FilterOption = forwardRef<HTMLLabelElement, FilterOptionProps>(
  ({ className, checked, label, children, ...props }, ref) => (
    <label ref={ref} className={cn('flex items-center gap-3 cursor-pointer group', className)} {...props}>
      <div
        className={cn(
          'w-5 h-5 rounded border flex items-center justify-center transition-colors bg-surface-container-highest',
          checked ? 'border-primary bg-primary/20' : 'border-outline-variant/50 group-hover:border-primary'
        )}
      >
        {checked && (
          <span className="material-symbols-outlined text-[14px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
            check
          </span>
        )}
        {!checked && <div className="w-2 h-2 bg-primary rounded-sm opacity-0 group-hover:opacity-40" />}
      </div>
      <span className={cn('text-sm font-body', checked ? 'text-primary' : 'text-on-surface')}>{label}</span>
      {children}
    </label>
  )
);
FilterOption.displayName = 'FilterOption';