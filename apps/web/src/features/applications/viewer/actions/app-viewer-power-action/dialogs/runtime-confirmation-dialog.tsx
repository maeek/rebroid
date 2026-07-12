'use client'

import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { useRuntimePowerActionContext } from '@/features/applications/viewer/actions/app-viewer-power-action/runtime-power-action-context'

export const RuntimeConfirmationDialog = ({ kind }: { kind: 'stop' | 'restart' }) => {
  const context = useRuntimePowerActionContext()
  const isStop = kind === 'stop'
  const open = isStop ? context.stopDialogOpen : context.restartDialogOpen
  const onOpenChange = isStop ? context.onStopDialogOpenChange : context.onRestartDialogOpenChange
  const isWorking = isStop ? context.isStoppingAction : context.isRestartingAction
  const onConfirm = isStop ? context.onStopConfirm : context.onRestartConfirm

  return (
    <ConfirmMutationDialog
      open={open}
      title={isStop ? `Stop ${context.appName}?` : `Restart ${context.appName}?`}
      description={
        isStop ? 'The current Android runtime will stop.' : 'The current Android runtime will stop and start again.'
      }
      summary={context.appName}
      consequence={
        isStop
          ? 'The app record and saved profiles stay ready for the next start.'
          : 'The active profile is reused when the app starts again.'
      }
      tone='warning'
      confirmLabel={isStop ? 'Stop app' : 'Restart app'}
      confirmDisabled={context.dialogDisabled}
      pendingLabel={isStop ? 'Stopping…' : 'Restarting…'}
      pending={isWorking}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  )
}
