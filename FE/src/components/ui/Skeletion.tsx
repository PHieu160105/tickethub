import { cn } from '@/lib/utils';
import { forwardRef, type HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('animate-pulse rounded-lg bg-space-700/50', className)}
      {...props}
    />
  )
);
Skeleton.displayName = 'Skeleton';