import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type DefinitionTableItem = {
  label: string
  value: ReactNode
}

export const DefinitionTable = ({
  items,
  columns = 1,
  className
}: {
  items: DefinitionTableItem[]
  columns?: 1 | 2
  className?: string
}) => (
  <dl className={cn('grid min-w-0 gap-x-8', columns === 2 && 'xl:grid-cols-2', className)}>
    {items.map(item => (
      <div
        key={item.label}
        className='grid min-w-0 grid-cols-[10rem_minmax(0,1fr)] gap-4 border-b border-surface-border/50 py-3 text-sm last:border-b-0 max-sm:grid-cols-1 max-sm:gap-1'
      >
        <dt className='font-medium text-foreground-muted'>{item.label}</dt>
        <dd className='min-w-0 break-words text-foreground'>{item.value ?? 'none'}</dd>
      </div>
    ))}
  </dl>
)
