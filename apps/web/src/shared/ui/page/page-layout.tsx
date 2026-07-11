import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const StandardPage = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('flex w-full flex-col', className)}>{children}</div>
)

export const StandardPageSplit = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div
    className={cn(
      'flex min-h-[calc(100dvh-4rem)] w-full justify-between gap-8 max-lg:flex-col max-lg:items-center',
      className
    )}
  >
    {children}
  </div>
)

export const PageContent = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('flex w-full flex-col items-start gap-6 px-6 pb-16 max-sm:px-4', className)}>{children}</div>
)

export const PageAside = ({ children, className }: { children: ReactNode; className?: string }) => (
  <aside className={cn('w-full shrink-0 lg:max-w-[26rem]', className)}>{children}</aside>
)
