'use client'

import type { ReactNode } from 'react'

export function AutomationStepBranchLane({
  title,
  detail,
  children
}: {
  title: string
  detail?: string
  children: ReactNode
}) {
  return (
    <div className='relative ml-4 grid min-w-0 gap-2 border-l border-border/70 pl-4 max-sm:ml-2 max-sm:pl-3'>
      <div className='flex min-h-6 items-center gap-2'>
        <span className='rounded-sm border border-border/60 bg-background/55 px-2 py-0.5 text-xs font-medium text-secondary-foreground'>
          {title}
        </span>
        {detail ? <span className='min-w-0 truncate text-xs text-secondary-foreground'>{detail}</span> : null}
      </div>
      {children}
    </div>
  )
}
