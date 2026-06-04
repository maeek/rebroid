'use client'

import { IconLoader2, IconPlayerStopFilled, IconRestore } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Visible } from '@/components/ui/visible'
import { AppActionDialogSummary } from '@/features/applications/components/app-action-dialog-summary'
import { useRuntimePowerActionContext } from '@/features/applications/viewer/actions/app-viewer-power-action/runtime-power-action-context'

export const RuntimeConfirmationDialog = ({ kind }: { kind: 'stop' | 'restart' }) => {
  const context = useRuntimePowerActionContext()
  const isStop = kind === 'stop'
  const open = isStop ? context.stopDialogOpen : context.restartDialogOpen
  const onOpenChange = isStop ? context.onStopDialogOpenChange : context.onRestartDialogOpenChange
  const isWorking = isStop ? context.isStoppingAction : context.isRestartingAction
  const onConfirm = isStop ? context.onStopConfirm : context.onRestartConfirm

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{isStop ? `Stop ${context.appName}?` : `Restart ${context.appName}?`}</DialogTitle>
          <DialogDescription>
            {isStop
              ? 'The current Android runtime will stop.'
              : 'The current Android runtime will stop and start again.'}
          </DialogDescription>
        </DialogHeader>
        <AppActionDialogSummary
          icon={isStop ? <IconPlayerStopFilled className='size-4' /> : <IconRestore className='size-4' />}
          title='Saved data remains available'
          description={
            isStop
              ? 'The app record and saved profiles stay ready for the next start.'
              : 'The active profile is reused when the app starts again.'
          }
          tone='warning'
        />
        <DialogFooter>
          <Button
            variant='secondary'
            disabled={isWorking}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant='secondary'
            disabled={context.dialogDisabled}
            onClick={onConfirm}
          >
            <Visible when={isWorking}>
              <IconLoader2 className='size-4 animate-spin' />
            </Visible>
            {isWorking ? (isStop ? 'Stopping...' : 'Restarting...') : isStop ? 'Stop app' : 'Restart app'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
