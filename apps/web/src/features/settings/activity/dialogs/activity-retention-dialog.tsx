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
import { FormField } from '@/components/ui/form-field'
import { MutationButton } from '@/components/ui/mutation-button'
import { NumericUnitInput } from '@/components/ui/numeric-unit-input'
import { useActivityController } from '../activity-context'

export const ActivityRetentionDialog = () => {
  const controller = useActivityController()
  return (
    <Dialog
      open={controller.retentionOpen}
      onOpenChange={open => {
        if (!controller.isSavingRetention) controller.setRetentionOpen(open)
      }}
    >
      <DialogContent
        className='sm:max-w-md'
        showCloseButton={!controller.isSavingRetention}
      >
        <DialogHeader>
          <DialogTitle>Activity retention</DialogTitle>
          <DialogDescription>Choose how long audit events are kept before automatic deletion.</DialogDescription>
        </DialogHeader>
        <form
          className='grid gap-6'
          onSubmit={event => {
            event.preventDefault()
            controller.saveRetention()
          }}
        >
          <FormField
            label='Retention days'
            description='Keep events for 1–3,650 days. The default is 30 days.'
            layout='vertical'
          >
            <NumericUnitInput
              unit='days'
              type='number'
              required
              min={1}
              max={3650}
              step={1}
              disabled={controller.isSavingRetention}
              value={controller.retentionDays}
              onChange={event => controller.setRetentionDays(event.target.value)}
            />
          </FormField>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type='button'
                variant='secondary'
                disabled={controller.isSavingRetention}
              >
                Cancel
              </Button>
            </DialogClose>
            <MutationButton
              type='submit'
              pending={controller.isSavingRetention}
              animate
              pendingLabel='Saving…'
            >
              Save retention
            </MutationButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
