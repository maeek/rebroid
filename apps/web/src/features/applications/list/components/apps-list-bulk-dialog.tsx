import { IconAlertTriangle, IconLoader2, IconPlayerStopFilled, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Visible } from '@/components/ui/visible'
import { AppActionDialogSummary } from '@/features/applications/components/app-action-dialog-summary'
import { useAppsListContext } from './apps-list-context'

export const AppsListBulkDialog = () => {
  const {
    activeBulkApps,
    bulkAction,
    closeBulkAction,
    closePendingAppAction,
    confirmBulkAction,
    confirmPendingAppAction,
    isBulkWorking,
    pendingAppAction,
    removeDataOnDelete
  } = useAppsListContext()

  const activeBulkTitle =
    bulkAction === 'stop'
      ? `Stop ${activeBulkApps.length} selected app${activeBulkApps.length === 1 ? '' : 's'}?`
      : `Delete ${activeBulkApps.length} selected app${activeBulkApps.length === 1 ? '' : 's'}?`
  const activeBulkDescription =
    bulkAction === 'stop'
      ? 'The selected apps will stop, but their saved data and records will remain.'
      : removeDataOnDelete
        ? 'This removes the selected apps and their saved data.'
        : 'This removes the selected apps while preserving saved data when possible.'

  return (
    <>
      <Dialog
        open={bulkAction !== null}
        onOpenChange={open => {
          if (!open) {
            closeBulkAction()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeBulkTitle}</DialogTitle>
            <DialogDescription>{activeBulkDescription}</DialogDescription>
          </DialogHeader>
          <AppActionDialogSummary
            icon={
              bulkAction === 'stop' ? <IconPlayerStopFilled className='size-4' /> : <IconTrash className='size-4' />
            }
            title={`${activeBulkApps.length} app${activeBulkApps.length === 1 ? '' : 's'} selected`}
            description={activeBulkApps.map(app => app.name).join(', ')}
            details={
              bulkAction === 'stop'
                ? ['Containers stop immediately.', 'Saved profiles and app records remain available.']
                : [
                    'Running containers are stopped and removed.',
                    removeDataOnDelete
                      ? 'Saved profile data is deleted.'
                      : 'Saved profile data is preserved when possible.'
                  ]
            }
            tone={bulkAction === 'delete' ? 'destructive' : 'warning'}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant='secondary'
                disabled={isBulkWorking}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant={bulkAction === 'delete' ? 'destructive' : 'default'}
              disabled={isBulkWorking || activeBulkApps.length === 0}
              onClick={() => void confirmBulkAction()}
            >
              <Visible when={isBulkWorking}>
                <IconLoader2 className='size-4 animate-spin' />
              </Visible>
              {bulkAction === 'stop' ? 'Stop apps' : 'Delete apps'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={pendingAppAction !== null}
        onOpenChange={open => {
          if (!open) {
            closePendingAppAction()
          }
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>
              {pendingAppAction?.action === 'stop'
                ? `Stop ${pendingAppAction.app.name}?`
                : `Delete ${pendingAppAction?.app.name}?`}
            </DialogTitle>
            <DialogDescription>
              {pendingAppAction?.action === 'stop'
                ? 'The app becomes unavailable immediately while network cleanup finishes in the background.'
                : 'This removes the app record and its runtime resources.'}
            </DialogDescription>
          </DialogHeader>
          <AppActionDialogSummary
            icon={
              pendingAppAction?.action === 'stop' ? (
                <IconPlayerStopFilled className='size-4' />
              ) : (
                <IconAlertTriangle className='size-4' />
              )
            }
            title={pendingAppAction?.app.name ?? 'Selected app'}
            description={
              pendingAppAction?.action === 'stop'
                ? 'The container stops immediately. Saved profiles remain available for the next start.'
                : removeDataOnDelete
                  ? 'The container, app record, network resources, and saved profile data are removed.'
                  : 'The container, app record, and network resources are removed. Saved profile data is preserved when possible.'
            }
            tone={pendingAppAction?.action === 'stop' ? 'warning' : 'destructive'}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant='secondary'>Cancel</Button>
            </DialogClose>
            <Button
              variant={pendingAppAction?.action === 'delete' ? 'destructive' : 'default'}
              onClick={() => void confirmPendingAppAction()}
            >
              {pendingAppAction?.action === 'stop' ? (
                <IconPlayerStopFilled className='size-4' />
              ) : (
                <IconTrash className='size-4' />
              )}
              {pendingAppAction?.action === 'stop' ? 'Stop app' : 'Delete app'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
