import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'
import { AppStatusIndicator } from '@/shared/ui/app-icon/app-status-indicator'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export const AppGalleryTile = ({
  app,
  status,
  showOwner,
  loading = false
}: {
  app?: AppDefinition
  status?: ReactNode
  showOwner?: boolean
  loading?: boolean
}) => {
  let icon: ReactNode = null
  if (loading) icon = <Skeleton className='size-20 shrink-0' />
  else if (app)
    icon = (
      <AppIcon
        appId={app.id}
        appName={app.name}
        icon={app.icon}
        className='size-20 shrink-0'
      />
    )
  return (
    <div className='flex min-w-0 flex-col items-center gap-2 p-4 pt-5'>
      {icon}
      <div className='grid w-full min-w-0 gap-1 text-center'>
        <div className='flex min-h-10 min-w-0 items-center justify-center text-sm font-medium [overflow-wrap:anywhere]'>
          {loading ? (
            <Skeleton className='h-4 w-24 max-w-full' />
          ) : (
            <span
              className='line-clamp-2'
              title={app?.name}
            >
              {app?.name}
            </span>
          )}
        </div>
        <div className='flex h-5 min-w-0 items-center justify-center'>
          {loading ? <Skeleton className='h-5 w-16' /> : status}
        </div>
        {showOwner ? (
          <span
            className='max-w-full truncate text-xs text-foreground-muted'
            title={app?.ownerDisplayName ?? undefined}
          >
            {app?.ownerDisplayName ?? 'Unknown owner'}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export const AppGalleryStatus = ({ app, label }: { app: AppDefinition; label: string }) => {
  return (
    <AppStatusIndicator
      status={app.status}
      label={label}
    />
  )
}
