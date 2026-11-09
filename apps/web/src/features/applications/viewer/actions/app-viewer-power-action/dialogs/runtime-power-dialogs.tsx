'use client'

import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { RuntimeConfirmationDialog } from '@/features/applications/viewer/actions/app-viewer-power-action/dialogs/runtime-confirmation-dialog'
import { StartProfileDialog } from '@/features/applications/viewer/actions/app-viewer-power-action/dialogs/start-profile-dialog'
import { useRuntimePowerActionContext } from '@/features/applications/viewer/actions/app-viewer-power-action/runtime-power-action-context'

const RecreateRuntimeDialog = () => {
  const context = useRuntimePowerActionContext()

  return (
    <ConfirmMutationDialog
      open={context.recreateDialogOpen}
      title={`Recreate the runtime for ${context.appName || 'this app'}?`}
      description='Use this if Start or Restart cannot recover the app. Rebroid replaces the app container and network, then starts Android with the active profile.'
      consequence='Saved settings and persistent profiles are kept. Any data stored only in the old container is lost.'
      tone='danger'
      confirmLabel='Recreate runtime'
      confirmDisabled={context.dialogDisabled}
      pendingLabel='Recreating…'
      pending={context.isRecreatingAction}
      onOpenChange={context.onRecreateDialogOpenChange}
      onConfirm={context.onRecreateConfirm}
    />
  )
}

export const RuntimePowerDialogs = () => (
  <>
    <StartProfileDialog />
    <RuntimeConfirmationDialog kind='stop' />
    <RuntimeConfirmationDialog kind='restart' />
    <RecreateRuntimeDialog />
  </>
)
