'use client'

import { IconPlayerStopFilled, IconRestore } from '@tabler/icons-react'
import { RuntimeConfirmationDialog } from '@/features/applications/viewer/actions/app-viewer-power-action/dialogs/runtime-confirmation-dialog'
import { StartProfileDialog } from '@/features/applications/viewer/actions/app-viewer-power-action/dialogs/start-profile-dialog'
import type { RuntimePowerDialogsProps } from '@/features/applications/viewer/actions/app-viewer-power-action/types'

const StopRuntimeDialog = ({
  appName,
  dialogDisabled,
  isStoppingAction,
  stopDialogOpen,
  onStopConfirm,
  onStopDialogOpenChange
}: Pick<
  RuntimePowerDialogsProps,
  'appName' | 'dialogDisabled' | 'isStoppingAction' | 'stopDialogOpen' | 'onStopConfirm' | 'onStopDialogOpenChange'
>) => (
  <RuntimeConfirmationDialog
    open={stopDialogOpen}
    onOpenChange={onStopDialogOpenChange}
    title={`Stop ${appName}?`}
    description='The current Android runtime will stop.'
    summaryIcon={<IconPlayerStopFilled className='size-4' />}
    summaryTitle='Saved data remains available'
    summaryDescription='The app record and saved profiles stay ready for the next start.'
    disabled={dialogDisabled}
    isWorking={isStoppingAction}
    buttonLabel='Stop app'
    workingLabel='Stopping...'
    onConfirm={onStopConfirm}
  />
)

const RestartRuntimeDialog = ({
  appName,
  dialogDisabled,
  isRestartingAction,
  restartDialogOpen,
  onRestartConfirm,
  onRestartDialogOpenChange
}: Pick<
  RuntimePowerDialogsProps,
  | 'appName'
  | 'dialogDisabled'
  | 'isRestartingAction'
  | 'restartDialogOpen'
  | 'onRestartConfirm'
  | 'onRestartDialogOpenChange'
>) => (
  <RuntimeConfirmationDialog
    open={restartDialogOpen}
    onOpenChange={onRestartDialogOpenChange}
    title={`Restart ${appName}?`}
    description='The current Android runtime will stop and start again.'
    summaryIcon={<IconRestore className='size-4' />}
    summaryTitle='Saved data remains available'
    summaryDescription='The active profile is reused when the app starts again.'
    disabled={dialogDisabled}
    isWorking={isRestartingAction}
    buttonLabel='Restart app'
    workingLabel='Restarting...'
    onConfirm={onRestartConfirm}
  />
)

export const RuntimePowerDialogs = ({
  app,
  appName,
  dialogDisabled,
  isRestartingAction,
  isRunningAction,
  isStoppingAction,
  open,
  profileMode,
  profileName,
  restartDialogOpen,
  savedProfiles,
  stopDialogOpen,
  onModeChange,
  onNameChange,
  onOpenChange,
  onRestartConfirm,
  onRestartDialogOpenChange,
  onStart,
  onStopConfirm,
  onStopDialogOpenChange
}: RuntimePowerDialogsProps) => (
  <>
    <StartProfileDialog
      app={app}
      open={open}
      onOpenChange={onOpenChange}
      profileMode={profileMode}
      profileName={profileName}
      savedProfiles={savedProfiles}
      isRunningAction={isRunningAction}
      onModeChange={onModeChange}
      onNameChange={onNameChange}
      onStart={onStart}
    />
    <StopRuntimeDialog
      appName={appName}
      dialogDisabled={dialogDisabled}
      isStoppingAction={isStoppingAction}
      stopDialogOpen={stopDialogOpen}
      onStopConfirm={onStopConfirm}
      onStopDialogOpenChange={onStopDialogOpenChange}
    />
    <RestartRuntimeDialog
      appName={appName}
      dialogDisabled={dialogDisabled}
      isRestartingAction={isRestartingAction}
      restartDialogOpen={restartDialogOpen}
      onRestartConfirm={onRestartConfirm}
      onRestartDialogOpenChange={onRestartDialogOpenChange}
    />
  </>
)
