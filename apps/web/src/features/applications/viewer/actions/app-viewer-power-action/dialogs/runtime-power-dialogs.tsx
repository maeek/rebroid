'use client'

import { RuntimeConfirmationDialog } from '@/features/applications/viewer/actions/app-viewer-power-action/dialogs/runtime-confirmation-dialog'
import { StartProfileDialog } from '@/features/applications/viewer/actions/app-viewer-power-action/dialogs/start-profile-dialog'

export const RuntimePowerDialogs = () => (
  <>
    <StartProfileDialog />
    <RuntimeConfirmationDialog kind='stop' />
    <RuntimeConfirmationDialog kind='restart' />
  </>
)
