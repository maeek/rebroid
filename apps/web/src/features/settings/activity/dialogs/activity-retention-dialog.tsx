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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActivityController } from '../activity-context'

export const ActivityRetentionDialog = () => {
  const controller = useActivityController()

  return (
    <Dialog
      open={controller.retentionOpen}
      onOpenChange={controller.setRetentionOpen}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Activity retention</DialogTitle>
          <DialogDescription>
            Rebroid automatically deletes audit events older than this many days. The default is 30 days.
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-2'>
          <Label htmlFor='activity-retention'>Retention days</Label>
          <Input
            id='activity-retention'
            type='number'
            min={1}
            max={3650}
            value={controller.retentionDays}
            onChange={event => controller.setRetentionDays(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            disabled={controller.isPending}
            onClick={controller.saveRetention}
          >
            {controller.isPending && <IconLoader2 className='size-4 animate-spin' />}
            Save retention
          </Button>
          <DialogClose asChild>
            <Button variant='secondary'>Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
