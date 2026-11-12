import { IconPlayerPlayFilled, IconPlayerStopFilled, IconTrash, IconX } from '@tabler/icons-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { isAppInProgress } from '@/shared/model/applications/app-gallery-status'
import { getAppStatusLabel } from '@/shared/model/applications/app-status-label'
import { AppGalleryCard } from '@/shared/ui/app-icon/app-gallery-card'
import { useAppsListContext } from './apps-list-context'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export const AppsListItem = ({
  app,
  showOwner = false,
  canClone = false
}: {
  app: AppDefinition
  showOwner?: boolean
  canClone?: boolean
}) => {
  const { isManaging, isBulkWorking, openPendingAppAction, selectedIds, startApp, startManaging, toggleSelected } =
    useAppsListContext()
  const busy = isAppInProgress(app.status, app.lifecycleStage) || isBulkWorking

  return (
    <AppGalleryCard
      app={{
        id: app.id,
        name: app.name,
        icon: app.icon,
        status: app.status,
        statusLabel: getAppStatusLabel(app.status, app.lifecycleStage),
        ownerDisplayName: showOwner ? (app.ownerDisplayName ?? 'Unknown owner') : null,
        canClone
      }}
      disabled={isBulkWorking}
      selection={
        isManaging
          ? {
              selected: selectedIds.has(app.id),
              onToggle: () => toggleSelected(app.id)
            }
          : undefined
      }
      onSelect={() => startManaging(app.id)}
      actions={
        <>
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
      }
    />
  )
}
