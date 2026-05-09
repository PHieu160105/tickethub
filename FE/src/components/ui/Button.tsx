import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg-page)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-primary hover:bg-on-primary text-white shadow-lg shadow-brand-red/20 hover:shadow-brand-red/40',
        secondary: 'bg-secondary hover:bg-brand-yellow-hover text-space-900 font-semibold',
        outline: 'border admin-border hover:bg-[var(--admin-btn-outline-bg-hover)] text-[var(--admin-btn-outline-text)] backdrop-blur-sm',
        ghost: 'hover:bg-[var(--admin-btn-ghost-bg-hover)] text-[var(--admin-btn-ghost-text)]',
        danger: 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-5 text-base',
        lg: 'h-14 px-8 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
