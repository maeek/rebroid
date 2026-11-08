import {
  IconCheck,
  IconDotsVertical,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconSettings,
  IconTrash,
  IconX
} from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { focusRingClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { AppGalleryTile, AppGalleryStatus } from './app-gallery-tile'
import { useAppsListContext } from './apps-list-context'
import { getAppStatusLabel, isAppBusy } from './apps-list.utils'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export const AppsListItem = ({ app, showOwner = false }: { app: AppDefinition; showOwner?: boolean }) => {
  const { isManaging, isBulkWorking, openPendingAppAction, selectedIds, startApp, toggleSelected } =
    useAppsListContext()
  const isSelected = selectedIds.has(app.id)
  const busy = isAppBusy(app) || isBulkWorking
  const content = (
    <AppGalleryTile
      app={app}
      status={
        <AppGalleryStatus
          app={app}
          label={getAppStatusLabel(app)}
        />
      }
      showOwner={showOwner}
    />
  )
  return (
    <div
      className={cn('relative min-w-0 rounded-panel text-foreground', isManaging && isSelected && 'bg-accent')}
      data-app-tile={app.id}
    >
      {isManaging ? (
        <button
          type='button'
          aria-label={`Select ${app.name}`}
          aria-pressed={isSelected}
          disabled={isBulkWorking}
          onClick={() => toggleSelected(app.id)}
          className={cn(
            focusRingClassName,
            'block w-full rounded-panel text-left hover:bg-control-hover focus-visible:bg-control-hover'
          )}
        >
          <span
            className={cn(
              'absolute left-3 top-3 flex size-4 items-center justify-center rounded-full bg-control text-foreground-muted',
              isSelected && 'bg-primary text-primary-foreground'
            )}
            aria-hidden='true'
          >
            {isSelected ? <IconCheck className='size-3' /> : null}
          </span>
          {content}
        </button>
      ) : (
        <Link
          href={`/app/${encodeURIComponent(app.id)}`}
          aria-label={`Open ${app.name}`}
          className={cn(
            focusRingClassName,
            'block rounded-panel hover:bg-control-hover focus-visible:bg-control-hover'
          )}
        >
          {content}
        </Link>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            className='absolute right-1.5 top-1.5'
            aria-label={`Actions for ${app.name}`}
            disabled={isManaging || isBulkWorking}
          >
            <IconDotsVertical className='size-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem asChild>
            <Link href={`/app/${encodeURIComponent(app.id)}?view=configuration`}>
              <IconSettings className='size-4' /> Configuration
            </Link>
          </DropdownMenuItem>
          {!showOwner ? (
            <DropdownMenuItem
              disabled={busy}
              onClick={() => (app.running ? openPendingAppAction({ action: 'stop', app }) : void startApp(app))}
            >
              {app.running ? <IconPlayerStopFilled className='size-4' /> : <IconPlayerPlayFilled className='size-4' />}
              {app.running ? 'Stop app…' : 'Start app'}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            className='text-danger'
            disabled={app.status === 'removing' || isBulkWorking}
            onClick={() => openPendingAppAction({ action: 'delete', app })}
          >
            {app.status === 'provisioning' ? <IconX className='size-4' /> : <IconTrash className='size-4' />}
            {app.status === 'provisioning' ? 'Cancel and delete…' : 'Delete app…'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
