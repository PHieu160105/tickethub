import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { forwardRef, type HTMLAttributes } from 'react';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-brand-red/20 text-brand-red border-brand-red/30',
        warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        success: 'bg-green-500/20 text-green-400 border-green-500/30',
        info: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
        outline: 'bg-transparent text-gray-300 border-white/20',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(badgeVariants({ variant, className }))} {...props} />
  )
);
Badge.displayName = 'Badge';