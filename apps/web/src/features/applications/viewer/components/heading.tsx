import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { StateTransition } from '@/components/ui/state-transition'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { getAppStatusLabel, getAppStatusTone } from '@/shared/model/applications/app-status-label'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'
import { AppIconSkeleton } from '@/shared/ui/app-icon/app-icon-skeleton'
import { PageHeadingRow } from '@/shared/ui/page/page-heading-row'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

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
  const statusLabel = app ? getAppStatusLabel(app.status, app.lifecycleStage) : undefined
  return (
    <PageHeadingRow
      actions={children}
      className={cn('w-full shrink-0 py-4 max-sm:pb-0', className)}
      titleClassName='flex-[1_1_5rem]'
    >
      <div className='flex min-h-12 w-full min-w-0 items-start gap-2.5 sm:min-h-12.5 sm:gap-4'>
        {loading ? <AppIconSkeleton className='size-12 shrink-0' /> : null}
        {app && !loading ? (
          <AppIcon
            appId={app.id}
            appName={app.name}
            icon={app.icon}
            className='size-12 shrink-0'
          />
        ) : null}
        <div className='flex min-w-0 flex-1 flex-col items-start gap-1'>
          <h1
            className='max-w-full truncate text-xl/6 font-medium'
            title={loading ? undefined : app?.name}
          >
            {loading ? (
              <Skeleton
                as='span'
                className='block h-6 w-36 max-w-full'
              />
            ) : (
              app?.name || '<App Name>'
            )}
          </h1>
          {loading && showStatusBadge ? <Skeleton className='h-5.5 w-16 max-sm:h-4 max-sm:w-14' /> : null}
          {showStatusBadge && app && !loading ? (
            <StatusBadge
              tone={getAppStatusTone(app.status, statusLabel)}
              className={cn(
                'max-w-full whitespace-normal max-sm:px-2 max-sm:py-0 max-sm:text-[0.6875rem]/3.5',
                app.status === 'error' && 'border-danger/40 bg-danger/22 text-foreground shadow-none hover:bg-danger/22'
              )}
            >
              <StateTransition
                identity={app.id}
                state={statusLabel ?? app.status}
              >
                {statusLabel}
              </StateTransition>
            </StatusBadge>
          ) : null}
        </div>
      </div>
    </PageHeadingRow>
  )
}
