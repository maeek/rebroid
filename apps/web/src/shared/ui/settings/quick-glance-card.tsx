import { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Surface } from '@/components/ui/surface'
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
  className,
  loading = false
}: {
  label: string
  value: ReactNode
  hint: ReactNode
  headerAction?: ReactNode
  tone?: QuickGlanceTone
  className?: string
  loading?: boolean
}) => {
  return (
    <Surface
      level='panel'
      className={cn('p-4', className)}
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
      <div className='mt-1 text-2xl font-medium text-foreground'>
        {loading ? <Skeleton className='h-8 w-20' /> : value}
      </div>
      <div className='mt-2 text-xs leading-5 text-foreground-muted'>
        {loading ? <Skeleton className='my-1 h-3 w-3/4' /> : hint}
      </div>
    </Surface>
  )
}
