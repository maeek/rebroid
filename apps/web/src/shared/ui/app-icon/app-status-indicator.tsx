import { cn } from '@/lib/utils'
import type { RecentApp } from '@/shared/contracts/recent-app'

export const AppStatusIndicator = ({ status, label }: { status: RecentApp['status']; label: string }) => (
  <span className='inline-flex min-w-0 items-center gap-1.5 text-xs text-foreground-muted'>
    <span
      aria-hidden='true'
      className={cn(
        'size-1.5 shrink-0 rounded-full bg-foreground-muted',
        status === 'error' && 'bg-danger',
        status === 'running' && 'bg-success',
        (status === 'provisioning' || status === 'removing') && 'bg-info'
      )}
    />
    <span
      className='truncate capitalize'
      title={label}
    >
      {label}
    </span>
  </span>
)
