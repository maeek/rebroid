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
import { useActivityController } from '../activity-context'

export const ActivityPurgeDialog = () => {
  const controller = useActivityController()

  return (
    <Dialog
      open={controller.purgeOpen}
      onOpenChange={controller.setPurgeOpen}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Purge all activity logs?</DialogTitle>
          <DialogDescription>
            This deletes every existing activity event. A new purge event will be recorded after deletion.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant='destructive'
            disabled={controller.isPurging}
            onClick={() => void controller.purgeAll()}
          >
            {controller.isPurging && <IconLoader2 className='size-4 animate-spin' />}
            Purge all logs
          </Button>
          <DialogClose asChild>
            <Button
              variant='secondary'
              disabled={controller.isPurging}
            >
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
