import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const QuickGlanceCard = ({
  label,
  value,
  hint,
  headerAction,
  className
}: {
  label: string
  value: ReactNode
  hint: ReactNode
  headerAction?: ReactNode
  className?: string
}) => {
  return (
    <div
      className={cn(
        'rounded-md border border-l-4 border-border/60 bg-surface-panel/50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-md',
        className
      )}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='text-sm font-medium text-foreground-muted'>{label}</div>
        {headerAction}
      </div>
      <div className='mt-1 text-2xl font-semibold text-foreground'>{value}</div>
      <div className='mt-2 text-xs leading-5 text-muted-foreground'>{hint}</div>
    </div>
  )
}
