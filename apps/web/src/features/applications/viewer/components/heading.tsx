import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge, type StatusBadgeTone } from '@/components/ui/status-badge'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'
import { AppIconSkeleton } from '@/shared/ui/app-icon/app-icon-skeleton'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const appStatusBadgeTone = (status?: AppDefinition['status']): StatusBadgeTone => {
  if (status === 'error') {
    return 'danger'
  }

  if (status === 'provisioning' || status === 'removing') {
    return 'warning'
  }

  if (status === 'running') {
    return 'success'
  }

  return 'neutral'
}

export const AppViewerHeading = ({
  app,
  children,
  className,
  showStatusBadge = false,
  loading = false
}: {
  app?: AppDefinition
  children?: ReactNode
  className?: string
  showStatusBadge?: boolean
  loading?: boolean
}) => {
  return (
    <div
      className={cn(
        'text-3xl max-sm:text-lg font-medium shrink-0 flex gap-4 justify-between items-center w-full py-4 max-sm:pb-0 flex-wrap',
        className
      )}
    >
      <div className='flex gap-4 items-center overflow-hidden'>
        {loading ? <AppIconSkeleton className='size-10 shrink-0' /> : null}
        {app && !loading ? (
          <AppIcon
            appId={app.id}
            appName={app.name}
            icon={app.icon}
            className='shrink-0 size-10'
          />
        ) : null}
        <h1 className='text-ellipsis text-nowrap overflow-hidden max-w-[calc(100%-3rem)]'>
          {loading ? <Skeleton className='h-9 w-48 max-w-[50vw] max-sm:h-7' /> : app?.name || '<App Name>'}
        </h1>
        {loading && showStatusBadge ? <Skeleton className='h-5 w-16' /> : null}
        <Visible when={showStatusBadge && app && !loading}>
          <StatusBadge
            tone={appStatusBadgeTone(app?.status)}
            className='shrink-0 capitalize'
          >
            {app?.status}
          </StatusBadge>
        </Visible>
      </div>
      <div className='shrink-0'>{children}</div>
    </div>
  )
}
