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
          ? 'This stops Android and disconnects active viewers.'
          : 'This briefly disconnects viewers while the Android runtime restarts.'
      }
      consequence={
        isStop
          ? 'You can start the app again with its saved profiles.'
          : 'The app starts again using its active profile.'
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
