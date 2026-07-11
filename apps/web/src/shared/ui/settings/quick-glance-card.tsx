import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type QuickGlanceTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

const toneMarkerClassName: Record<QuickGlanceTone, string> = {
  neutral: 'bg-foreground-subtle',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger'
}

export const QuickGlanceCard = ({
  label,
  value,
  hint,
  headerAction,
  tone = 'neutral',
  className
}: {
  label: string
  value: ReactNode
  hint: ReactNode
  headerAction?: ReactNode
  tone?: QuickGlanceTone
  className?: string
}) => {
  return (
    <div
      className={cn(
        'rounded-control border border-surface-border/60 bg-surface-panel/50 p-4 shadow-panel backdrop-blur-md',
        className
      )}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='flex items-center gap-2 text-sm font-medium text-foreground-muted'>
          <span
            aria-hidden='true'
            className={cn('size-2 shrink-0 rounded-full', toneMarkerClassName[tone])}
          />
          <span>{label}</span>
        </div>
        {headerAction}
      </div>
      <div className='mt-1 text-2xl font-medium text-foreground'>{value}</div>
      <div className='mt-2 text-xs leading-5 text-foreground-muted'>{hint}</div>
    </div>
  )
}
