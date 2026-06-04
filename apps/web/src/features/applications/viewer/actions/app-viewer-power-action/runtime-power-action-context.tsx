'use client'

import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { useApplicationViewerContext } from '@/features/applications/detail/application-viewer-context'
import { usePowerActionProfileState } from '@/features/applications/viewer/actions/app-viewer-power-action/profile/profile-state'
import { usePowerActionRuntimeHandlers } from '@/features/applications/viewer/actions/app-viewer-power-action/runtime/runtime-actions'
import {
  getCanRestart,
  usePowerActionViewState
} from '@/features/applications/viewer/actions/app-viewer-power-action/runtime/runtime-view-state'
import { useAppViewerActionRunner } from '@/features/applications/viewer/actions/use-app-viewer-action-runner'
import { hasPermission } from '@/shared/permissions/permissions'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type {
  RuntimeMenuAction,
  SavedApplicationProfiles
} from '@/features/applications/viewer/actions/app-viewer-power-action/types'
import type { ApplicationProfileMode } from '@/server/orchestrator/applications/types'

type RuntimePowerActionContextValue = {
  app?: AppDefinition
  appName?: string
  canRunPrimary: boolean
  dialogDisabled: boolean
  isBusy: boolean
  isRestartingAction: boolean
  isRunningAction: boolean
  isStoppingAction: boolean
  menuActions: RuntimeMenuAction[]
  menuDisabled: boolean
  open: boolean
  primaryIcon: ReactNode
  primaryLabel: string
  primaryVariant: 'secondary' | 'update'
  profileMode: ApplicationProfileMode
  profileName: string
  restartDialogOpen: boolean
  savedProfiles: SavedApplicationProfiles
  stopDialogOpen: boolean
  onModeChange: (mode: ApplicationProfileMode) => void
  onNameChange: (name: string) => void
  onOpenChange: (open: boolean) => void
  onPrimaryAction: () => void
  onRestartConfirm: () => void
  onRestartDialogOpenChange: (open: boolean) => void
  onStart: () => void
  onStopConfirm: () => void
  onStopDialogOpenChange: (open: boolean) => void
}

const RuntimePowerActionContext = createContext<RuntimePowerActionContextValue | null>(null)

export const RuntimePowerActionProvider = ({ children }: { children: ReactNode }) => {
  const { app, permissions } = useApplicationViewerContext()
  const canStart = hasPermission(permissions, 'applications:start')
  const canStop = hasPermission(permissions, 'applications:stop')
  const canSwitchProfile = hasPermission(permissions, 'applications:switch-profile')
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
    <RuntimePowerActionContext.Provider
      value={{
        app,
        appName: app?.name,
        canRunPrimary: viewState.canRunPrimary,
        dialogDisabled: viewState.dialogDisabled,
        isBusy: viewState.isBusy,
        isRestartingAction: runtimeHandlers.actionPhase === 'restarting',
        isRunningAction,
        isStoppingAction: runtimeHandlers.actionPhase === 'stopping',
        menuActions: runtimeHandlers.menuActions,
        menuDisabled: viewState.menuDisabled,
        open: startDialogOpen,
        primaryIcon: viewState.primaryIcon,
        primaryLabel: viewState.primaryLabel,
        primaryVariant: viewState.primaryVariant,
        profileMode,
        profileName,
        restartDialogOpen,
        savedProfiles,
        stopDialogOpen,
        onModeChange: handleProfileModeChange,
        onNameChange: setProfileName,
        onOpenChange: setStartDialogOpen,
        onPrimaryAction: runtimeHandlers.handlePrimaryAction,
        onRestartConfirm: () => void runtimeHandlers.handleRestart(),
        onRestartDialogOpenChange: setRestartDialogOpen,
        onStart: runtimeHandlers.handleProfileStart,
        onStopConfirm: runtimeHandlers.handleStopConfirm,
        onStopDialogOpenChange: setStopDialogOpen
      }}
    >
      {children}
    </RuntimePowerActionContext.Provider>
  )
}

export const useRuntimePowerActionContext = () => {
  const context = useContext(RuntimePowerActionContext)

  if (!context) {
    throw new Error('useRuntimePowerActionContext must be used within RuntimePowerActionProvider')
  }

  return context
}
