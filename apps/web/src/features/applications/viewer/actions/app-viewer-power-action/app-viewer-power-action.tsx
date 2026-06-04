'use client'

import { useState } from 'react'
import { RuntimePowerControls } from '@/features/applications/viewer/actions/app-viewer-power-action/controls/runtime-power-controls'
import { RuntimePowerDialogs } from '@/features/applications/viewer/actions/app-viewer-power-action/dialogs/runtime-power-dialogs'
import { usePowerActionProfileState } from '@/features/applications/viewer/actions/app-viewer-power-action/profile/profile-state'
import { usePowerActionRuntimeHandlers } from '@/features/applications/viewer/actions/app-viewer-power-action/runtime/runtime-actions'
import {
  getCanRestart,
  usePowerActionViewState
} from '@/features/applications/viewer/actions/app-viewer-power-action/runtime/runtime-view-state'
import { useAppViewerActionRunner } from '@/features/applications/viewer/actions/use-app-viewer-action-runner'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

type AppViewerPowerActionProps = {
  app?: AppDefinition
  canStart: boolean
  canStop: boolean
  canSwitchProfile: boolean
}

export const AppViewerPowerAction = ({ app, canStart, canStop, canSwitchProfile }: AppViewerPowerActionProps) => {
  const { isRunningAction, runAction } = useAppViewerActionRunner()
  const [startDialogOpen, setStartDialogOpen] = useState(false)
  const [stopDialogOpen, setStopDialogOpen] = useState(false)
  const [restartDialogOpen, setRestartDialogOpen] = useState(false)
  const { profileMode, profileName, savedProfiles, setProfileName, setSavedProfiles, handleProfileModeChange } =
    usePowerActionProfileState(app, startDialogOpen)
  const runtimeHandlers = usePowerActionRuntimeHandlers({
    app,
    canRestart: getCanRestart(canStart, canStop),
    canStart,
    canStop,
    canSwitchProfile,
    profileMode,
    profileName,
    runAction,
    setRestartDialogOpen,
    setSavedProfiles,
    setStartDialogOpen,
    setStopDialogOpen
  })
  const viewState = usePowerActionViewState({
    actionPhase: runtimeHandlers.actionPhase,
    app,
    canStart,
    canStop,
    isRunningAction
  })

  return (
    <>
      <RuntimePowerControls
        app={app}
        canRunPrimary={viewState.canRunPrimary}
        isBusy={viewState.isBusy}
        isRunningAction={isRunningAction}
        menuActions={runtimeHandlers.menuActions}
        menuDisabled={viewState.menuDisabled}
        primaryVariant={viewState.primaryVariant}
        primaryLabel={viewState.primaryLabel}
        primaryIcon={viewState.primaryIcon}
        onPrimaryAction={runtimeHandlers.handlePrimaryAction}
      />
      <RuntimePowerDialogs
        app={app}
        appName={app?.name}
        dialogDisabled={viewState.dialogDisabled}
        open={startDialogOpen}
        onOpenChange={setStartDialogOpen}
        profileMode={profileMode}
        profileName={profileName}
        restartDialogOpen={restartDialogOpen}
        savedProfiles={savedProfiles}
        stopDialogOpen={stopDialogOpen}
        isRestartingAction={runtimeHandlers.actionPhase === 'restarting'}
        isRunningAction={isRunningAction}
        isStoppingAction={runtimeHandlers.actionPhase === 'stopping'}
        onModeChange={handleProfileModeChange}
        onNameChange={setProfileName}
        onRestartConfirm={() => void runtimeHandlers.handleRestart()}
        onRestartDialogOpenChange={setRestartDialogOpen}
        onStart={runtimeHandlers.handleProfileStart}
        onStopConfirm={runtimeHandlers.handleStopConfirm}
        onStopDialogOpenChange={setStopDialogOpen}
      />
    </>
  )
}
