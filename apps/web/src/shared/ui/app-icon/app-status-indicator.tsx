import { IconActivity, IconClock } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { getAppStatusTone } from '@/shared/model/applications/app-status-label'
import type { RecentApp } from '@/shared/contracts/recent-app'

const toneClasses = {
  neutral: 'bg-foreground-muted',
  danger: 'bg-danger',
  success: 'bg-success',
  info: 'bg-info'
}

export const AppStatusIndicator = ({
  status,
  label,
  compact = false,
  className
}: {
  status: NonNullable<RecentApp['status']>
  label: string
  compact?: boolean
  className?: string
}) => {
  if (compact) {
    const running = getAppStatusTone(status, label) === 'success'
    const Icon = running ? IconActivity : IconClock
    return (
      <span
        role='img'
        aria-label={label}
        title={label}
        className={cn('inline-flex shrink-0', className)}
      >
        <Icon
          aria-hidden='true'
          className={cn('size-3.5', running ? 'text-success' : 'text-info')}
        />
      </span>
    )
  }
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-xs text-foreground-muted', className)}>
      <span
        aria-hidden='true'
        className={cn('size-1.5 shrink-0 rounded-full', toneClasses[getAppStatusTone(status, label)])}
      />
      <span
        className='truncate capitalize'
        title={label}
      >
        {label}
      </span>
    </span>
  )
}
