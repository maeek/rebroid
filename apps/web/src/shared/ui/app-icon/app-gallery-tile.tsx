import { Skeleton } from '@/components/ui/skeleton'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'
import { AppStatusIndicator } from '@/shared/ui/app-icon/app-status-indicator'
import type { RecentApp } from '@/shared/contracts/recent-app'

export type AppGalleryCardData = Pick<
  RecentApp,
  'id' | 'name' | 'icon' | 'status' | 'statusLabel' | 'ownerDisplayName' | 'canClone'
>

export const AppGalleryTile = ({ app }: { app?: AppGalleryCardData }) => (
  <div className='flex min-h-[4.75rem] min-w-0 items-center gap-3 py-4 pl-4 pr-12 text-left touch:pr-14'>
    {app ? (
      <AppIcon
        appId={app.id}
        appName={app.name}
        icon={app.icon}
        className='size-10 shrink-0'
      />
    ) : (
      <Skeleton className='size-10 shrink-0' />
    )}
    {app ? (
      <div className='grid min-w-0 flex-1 gap-1'>
        <div className='flex min-w-0 items-baseline gap-2'>
          <span
            className='truncate text-sm font-medium'
            title={app.name}
          >
            {app.name}
          </span>
          {app.ownerDisplayName ? (
            <span
              className='max-w-[50%] shrink-0 truncate text-xs text-foreground-muted'
              title={app.ownerDisplayName}
            >
              {app.ownerDisplayName}
            </span>
          ) : null}
        </div>
        <div className='flex h-5 min-w-0 items-center gap-2'>
          {app.ownerDisplayName ? (
            <span className='shrink-0 border-r border-surface-border pr-2 text-xs text-foreground-muted'>
              {app.canClone ? 'Clone to run' : 'Administrator view'}
            </span>
          ) : null}
          {app.status ? (
            <AppStatusIndicator
              status={app.status}
              label={app.statusLabel ?? app.status}
            />
          ) : null}
        </div>
      </div>
    ) : (
      <div className='grid min-w-0 gap-1'>
        <Skeleton className='h-4 w-24 max-w-full' />
        <Skeleton className='h-3 w-14' />
      </div>
    )}
  </div>
)
