import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';
import { forwardRef, type HTMLAttributes } from 'react';

const toastVariants = cva(
  'flex items-start gap-3 rounded-lg border p-4 shadow-xl backdrop-blur-md animate-in slide-in-from-top-2 duration-200',
  {
    variants: {
      variant: {
        default: 'bg-space-800/90 border-white/10 text-white',
        success: 'bg-green-500/20 border-green-500/30 text-green-100',
        error: 'bg-red-500/20 border-red-500/30 text-red-100',
        warning: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-100',
        info: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-100',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

const icons = {
  success: <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />,
  error: <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />,
  warning: <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />,
  info: <Info className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />,
  default: <Info className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />,
};

export interface ToastProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof toastVariants> {
  title: string;
  description?: string;
  onClose?: () => void;
}

export const Toast = forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant = 'default', title, description, onClose, ...props }, ref) => (
    <div ref={ref} className={cn(toastVariants({ variant, className }))} {...props}>
      {icons[variant || 'default']}
      <div className="flex-1">
        <p className="font-medium text-sm">{title}</p>
        {description && <p className="text-xs text-gray-300 mt-0.5">{description}</p>}
      </div>
      {onClose && (
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors" aria-label="Đóng thông báo">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
);
Toast.displayName = 'Toast';
