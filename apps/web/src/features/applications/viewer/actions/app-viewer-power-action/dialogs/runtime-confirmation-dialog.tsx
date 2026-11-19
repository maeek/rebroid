'use client'

import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { useRuntimePowerActionContext } from '@/features/applications/viewer/actions/app-viewer-power-action/runtime-power-action-context'

export const RuntimeConfirmationDialog = ({ kind }: { kind: 'stop' | 'restart' }) => {
  const context = useRuntimePowerActionContext()
  const isStop = kind === 'stop'
  const appName = context.appName || 'app'
  const open = isStop ? context.stopDialogOpen : context.restartDialogOpen
  const onOpenChange = isStop ? context.onStopDialogOpenChange : context.onRestartDialogOpenChange
  const isWorking = isStop ? context.isStoppingAction : context.isRestartingAction
  const onConfirm = isStop ? context.onStopConfirm : context.onRestartConfirm

  return (
    <ConfirmMutationDialog
      open={open}
      title={isStop ? `Stop ${appName}?` : `Restart ${appName}?`}
      description={
        isStop
          ? 'Android stops and active viewers disconnect.'
          : 'Viewers briefly disconnect while Android restarts with the active profile.'
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
