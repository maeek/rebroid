import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const ViewerActionBar = ({ className, ...props }: ComponentProps<'div'>) => (
  <div
    className={cn(
      'viewer-chrome flex h-[var(--viewer-chrome-height)] w-full min-w-0 shrink-0 items-center justify-end gap-2 overflow-x-auto transform-gpu rounded-control bg-surface-editor px-1.5 text-foreground scrollbar-none',
      className
    )}
    {...props}
  />
)
