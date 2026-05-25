import { IconLoader2 } from '@tabler/icons-react'
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
import { useAppsListContext } from './apps-list-context'

export const AppsListBulkDialog = () => {
  const { activeBulkApps, bulkAction, closeBulkAction, confirmBulkAction, isBulkWorking, removeDataOnDelete } =
    useAppsListContext()

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
        <div className='rounded-md border border-input bg-secondary/30 p-3 text-sm text-secondary-foreground'>
          <p className='font-medium text-foreground'>Selected apps</p>
          <p className='mt-2 line-clamp-3'>{activeBulkApps.map(app => app.name).join(', ')}</p>
        </div>
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
  )
}
