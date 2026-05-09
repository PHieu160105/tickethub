import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

const inputVariants = cva(
  'w-full rounded-lg border bg-space-700/50 px-4 py-2.5 admin-text-body placeholder:text-gray-500 transition-all focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'border-gray-500 focus:border-gray-500 focus:ring-gray-500',
        error: 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
        success: 'border-green-500 focus:border-green-500 focus:ring-green-500/20',
      },
    },
    defaultVariants: { variant: 'default'},
  }
);

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(inputVariants({ variant, className }))}
      {...props}
    />
  )
);
Input.displayName = 'Input';