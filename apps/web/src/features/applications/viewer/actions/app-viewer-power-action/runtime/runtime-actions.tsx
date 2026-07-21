'use client'

import { useState } from 'react'
import { getNormalizedProfileName } from '@/features/applications/viewer/actions/app-viewer-power-action/profile/profile-state'
import { createRuntimeMenuActions } from '@/features/applications/viewer/actions/app-viewer-power-action/runtime/runtime-menu-actions'
import {
  closeDialogOnSuccess,
  openPrimaryRuntimeAction,
  restartAppRuntime,
  startAppRuntime,
  stopAppRuntime
} from '@/features/applications/viewer/actions/app-viewer-power-action/runtime/runtime-operations'
import type {
  PowerActionRuntimeHandlersOptions,
  RuntimeActionPhase
} from '@/features/applications/viewer/actions/app-viewer-power-action/types'
import type { ApplicationProfileMode } from '@/shared/contracts/application'

export const usePowerActionRuntimeHandlers = ({
  app,
  canRestart,
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
}: PowerActionRuntimeHandlersOptions) => {
  const [actionPhase, setActionPhase] = useState<RuntimeActionPhase>(null)

  const handleStart = (options?: { profileMode?: ApplicationProfileMode; profileName?: string }) =>
    startAppRuntime({ app, options, runAction, setActionPhase, setSavedProfiles })

  const handleProfileStart = () => {
    void handleStart({
      profileMode,
      profileName: getNormalizedProfileName(profileMode, profileName)
    }).then(success => closeDialogOnSuccess(success, () => setStartDialogOpen(false)))
  }

  const handleStop = () => stopAppRuntime({ app, runAction, setActionPhase })

  const handleStopConfirm = () => {
    void handleStop().then(success => closeDialogOnSuccess(success, () => setStopDialogOpen(false)))
  }

  const handleRestart = async () => {
    const didSucceed = await restartAppRuntime({ app, runAction, setActionPhase })
    closeDialogOnSuccess(didSucceed, () => setRestartDialogOpen(false))
  }

  const handlePrimaryAction = () => {
    openPrimaryRuntimeAction({
      app,
      canSwitchProfile,
      onStart: () => void handleStart(),
      onStartProfile: () => setStartDialogOpen(true),
      onStop: () => setStopDialogOpen(true)
    })
  }

  const menuActions = createRuntimeMenuActions({
    app,
    canStart,
    canSwitchProfile,
    canStop,
    canRestart,
    onStartDefaults: () => void handleStart(),
    onStartProfile: () => setStartDialogOpen(true),
    onStop: () => setStopDialogOpen(true),
    onRestart: () => setRestartDialogOpen(true)
  })

  return {
    actionPhase,
    menuActions,
    handlePrimaryAction,
    handleProfileStart,
    handleRestart,
    handleStopConfirm
  }
}
