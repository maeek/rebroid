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
}) => (
  <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-xs text-foreground-muted', className)}>
    <span
      aria-hidden='true'
      className={cn('size-1.5 shrink-0 rounded-full', toneClasses[getAppStatusTone(status, label)])}
    />
    <span
      className={compact ? 'sr-only' : 'truncate capitalize'}
      title={label}
    >
      {label}
    </span>
  </span>
)
