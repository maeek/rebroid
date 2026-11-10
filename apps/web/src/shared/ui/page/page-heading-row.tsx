import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const PageHeadingRow = ({
  actions,
  children,
  className
}: {
  actions?: ReactNode
  children: ReactNode
  className?: string
}) => (
  <div className={cn('flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2', className)}>
    <div className='min-w-0 flex-auto'>{children}</div>
    {actions ? (
      <div className='flex min-w-0 max-w-full flex-wrap gap-2 sm:ml-auto sm:justify-end'>{actions}</div>
    ) : null}
  </div>
)
