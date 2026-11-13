import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { StateTransition } from '@/components/ui/state-transition'
import { StatusBadge, type StatusBadgeTone } from '@/components/ui/status-badge'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'
import { AppIconSkeleton } from '@/shared/ui/app-icon/app-icon-skeleton'
import { PageHeadingRow } from '@/shared/ui/page/page-heading-row'
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
    <PageHeadingRow
      actions={children}
      className={cn('w-full shrink-0 py-4 max-sm:pb-0', className)}
    >
      <div className='flex min-w-0 items-center gap-2.5 sm:gap-4'>
        {loading ? <AppIconSkeleton className='size-10 shrink-0' /> : null}
        {app && !loading ? (
          <AppIcon
            appId={app.id}
            appName={app.name}
            icon={app.icon}
            className='shrink-0 size-10'
          />
        ) : null}
        <h1 className='min-w-0 text-3xl font-medium [overflow-wrap:anywhere] max-sm:text-2xl'>
          {loading ? <Skeleton className='h-9 w-48 max-w-[50vw] max-sm:h-7' /> : app?.name || '<App Name>'}
        </h1>
        {loading && showStatusBadge ? <Skeleton className='h-5 w-16 shrink-0' /> : null}
        <Visible when={showStatusBadge && app && !loading}>
          <StatusBadge
            tone={appStatusBadgeTone(app?.status)}
            className='shrink-0 capitalize'
          >
            <StateTransition
              identity={app?.id}
              state={app?.status ?? 'unknown'}
            >
              {app?.status}
            </StateTransition>
          </StatusBadge>
        </Visible>
      </div>
    </PageHeadingRow>
  )
}
