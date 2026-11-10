import { useRef } from 'react'
import {
  IconCheck,
  IconDotsVertical,
  IconListCheck,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconSettings,
  IconTrash,
  IconX
} from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { focusRingClassName, panelSurfaceClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { AppGalleryTile, appGalleryActionPosition } from './app-gallery-tile'
import { useAppsListContext } from './apps-list-context'
import { isAppBusy } from './apps-list.utils'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export const AppsListItem = ({ app, showOwner = false }: { app: AppDefinition; showOwner?: boolean }) => {
  const { isManaging, isBulkWorking, openPendingAppAction, selectedIds, startApp, startManaging, toggleSelected } =
    useAppsListContext()
  const contextOpen = useRef(false)
  const focusSelection = useRef(false)
  const isSelected = selectedIds.has(app.id)
  const busy = isAppBusy(app) || isBulkWorking
  const content = (
    <AppGalleryTile
      app={app}
      showOwner={showOwner}
    />
  )
  const actions = (
    <>
      <DropdownMenuItem
        className='gap-2'
        onClick={() => {
          focusSelection.current = true
          startManaging(app.id)
        }}
      >
        <IconListCheck className='size-4' /> Select app
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        asChild
        className='gap-2'
      >
        <Link href={`/app/${encodeURIComponent(app.id)}?view=configuration`}>
          <IconSettings className='size-4' /> Configuration
        </Link>
      </DropdownMenuItem>
      {!showOwner ? (
        <DropdownMenuItem
          className='gap-2'
          disabled={busy}
          onClick={() => (app.running ? openPendingAppAction({ action: 'stop', app }) : void startApp(app))}
        >
          {app.running ? <IconPlayerStopFilled className='size-4' /> : <IconPlayerPlayFilled className='size-4' />}
          {app.running ? 'Stop app…' : 'Start app'}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem
        className='gap-2 text-danger'
        disabled={app.status === 'removing' || isBulkWorking}
        onClick={() => openPendingAppAction({ action: 'delete', app })}
      >
        {app.status === 'provisioning' ? <IconX className='size-4' /> : <IconTrash className='size-4' />}
        {app.status === 'provisioning' ? 'Cancel and delete…' : 'Delete app…'}
      </DropdownMenuItem>
    </>
  )

  return (
    <li
      className={cn(panelSurfaceClassName, 'relative min-w-0', isManaging && isSelected && 'bg-accent')}
      data-app-tile={app.id}
    >
      {isManaging ? (
        <button
          type='button'
          aria-label={`Select ${app.name}`}
          aria-pressed={isSelected}
          ref={button => {
            if (button && focusSelection.current) {
              focusSelection.current = false
              button.focus({ preventScroll: true })
            }
          }}
          disabled={isBulkWorking}
          onClick={() => toggleSelected(app.id)}
          className={cn(focusRingClassName, 'block w-full rounded-panel hover:bg-foreground/5')}
        >
          <span
            className={cn(appGalleryActionPosition, 'touch-control flex size-8 items-center justify-center')}
            aria-hidden='true'
          >
            <span
              className={cn(
                'flex size-5 items-center justify-center rounded-full border border-control-border-strong bg-control text-foreground-muted',
                isSelected && 'border-primary bg-primary text-primary-foreground'
              )}
            >
              {isSelected ? <IconCheck className='size-3' /> : null}
            </span>
          </span>
          {content}
        </button>
      ) : (
        <ContextMenu
          disabled={isBulkWorking}
          onOpenChange={open => {
            contextOpen.current = open
          }}
        >
          <ContextMenuTrigger asChild>
            <Link
              href={`/app/${encodeURIComponent(app.id)}`}
              aria-label={`Open ${app.name}`}
              onClick={event => {
                if (contextOpen.current) event.preventDefault()
              }}
              className={cn(
                focusRingClassName,
                'block rounded-panel transition-colors hover:bg-surface-band touch:select-none'
              )}
            >
              {content}
            </Link>
          </ContextMenuTrigger>
          <ContextMenuContent aria-label={`Actions for ${app.name}`}>{actions}</ContextMenuContent>
        </ContextMenu>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            className={cn(appGalleryActionPosition, isManaging && 'invisible')}
            aria-label={`Actions for ${app.name}`}
            disabled={isManaging || isBulkWorking}
          >
            <IconDotsVertical className='size-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          aria-label={`Actions for ${app.name}`}
        >
          {actions}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
