import { Skeleton } from '@/components/ui/skeleton'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'
import { AppStatusIndicator } from '@/shared/ui/app-icon/app-status-indicator'
import { getAppStatusLabel } from './apps-list.utils'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export const appGalleryActionPosition = 'absolute right-2 top-1/2 -translate-y-1/2'

export const AppGalleryTile = ({ app, showOwner }: { app?: AppDefinition; showOwner?: boolean }) => (
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
        <span
          className='truncate text-sm font-medium'
          title={app.name}
        >
          {app.name}
        </span>
        <div className='flex h-5 min-w-0 items-center gap-2'>
          <AppStatusIndicator
            status={app.status}
            label={getAppStatusLabel(app)}
          />
          {showOwner ? (
            <span
              className='min-w-0 max-w-[65%] truncate border-l border-surface-border pl-2 text-xs text-foreground-muted'
              title={app.ownerDisplayName ?? undefined}
            >
              {app.ownerDisplayName ?? 'Unknown owner'}
            </span>
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
