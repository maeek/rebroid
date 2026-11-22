'use client'

import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { useApplicationViewerContext } from '@/features/applications/detail/application-viewer-context'
import { useRemoveApplicationProfile } from '@/features/applications/manage/use-remove-application-profile'
import { usePowerActionProfileState } from '@/features/applications/viewer/actions/app-viewer-power-action/profile/profile-state'
import { usePowerActionRuntimeHandlers } from '@/features/applications/viewer/actions/app-viewer-power-action/runtime/runtime-actions'
import { createRuntimeMenuActions } from '@/features/applications/viewer/actions/app-viewer-power-action/runtime/runtime-menu-actions'
import { getPowerActionViewState } from '@/features/applications/viewer/actions/app-viewer-power-action/runtime/runtime-view-state'
import { useApplicationActionRunner } from '@/hooks/use-application-action-runner'
import { hasPermission } from '@/shared/permissions/permissions'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { RuntimeMenuAction } from '@/features/applications/viewer/actions/app-viewer-power-action/types'
import type { ApplicationProfileMode } from '@/shared/contracts/application'

type RuntimePowerActionContextValue = {
  app?: AppDefinition
  appName?: string
  canRunPrimary: boolean
  canDeleteProfiles: boolean
  dialogDisabled: boolean
  isBusy: boolean
  isRecreatingAction: boolean
  isRestartingAction: boolean
  isRunningAction: boolean
  isStoppingAction: boolean
  menuActions: RuntimeMenuAction[]
  menuDisabled: boolean
  open: boolean
  primaryLabel: string
  primaryVariant: 'primary' | 'secondary'
  profileMode: ApplicationProfileMode
  profileName: string
  recreateDialogOpen: boolean
  restartDialogOpen: boolean
  savedProfiles: AppDefinition['savedProfiles']
  stopDialogOpen: boolean
  onModeChange: (mode: ApplicationProfileMode) => void
  onNameChange: (name: string) => void
  onOpenChange: (open: boolean) => void
  onProfileDelete: (profileName: string) => Promise<void>
  onPrimaryAction: () => void
  onRecreateConfirm: () => void
  onRecreateDialogOpenChange: (open: boolean) => void
  onRestartConfirm: () => void
  onRestartDialogOpenChange: (open: boolean) => void
  onStart: () => void
  onStopConfirm: () => void
  onStopDialogOpenChange: (open: boolean) => void
}

const RuntimePowerActionContext = createContext<RuntimePowerActionContextValue | null>(null)

export const RuntimePowerActionProvider = ({ children }: { children: ReactNode }) => {
  const { app, permissions } = useApplicationViewerContext()
  const removeProfile = useRemoveApplicationProfile()
  const canStart = hasPermission(permissions, 'applications:start')
  const canStop = hasPermission(permissions, 'applications:stop')
  const canSwitchProfile = hasPermission(permissions, 'applications:switch-profile')
  const canDeleteProfiles = hasPermission(permissions, 'applications:delete')
  const { isRunningAction, runAction } = useApplicationActionRunner()
  const [startDialogOpen, setStartDialogOpen] = useState(false)
  const [stopDialogOpen, setStopDialogOpen] = useState(false)
  const [restartDialogOpen, setRestartDialogOpen] = useState(false)
  const { profileMode, profileName, savedProfiles, setProfileName, handleProfileModeChange } =
    usePowerActionProfileState(app, startDialogOpen)
  const runtimeHandlers = usePowerActionRuntimeHandlers({
    app,
    canSwitchProfile,
    profileMode,
    profileName,
    runAction,
    setRestartDialogOpen,
    setStartDialogOpen,
    setStopDialogOpen
  })
  const menuActions = createRuntimeMenuActions({
    app,
    canStart,
    canStop,
    canSwitchProfile,
    onStartDefaults: () => void runtimeHandlers.startWithDefaults(),
    onStartProfile: () => setStartDialogOpen(true),
    onStop: () => setStopDialogOpen(true),
    onRestart: () => setRestartDialogOpen(true),
    onRecreate: () => runtimeHandlers.setRecreateDialogOpen(true)
  })
  const viewState = getPowerActionViewState({
    actionPhase: runtimeHandlers.actionPhase,
    app,
    canStart,
    canStop,
    isRunningAction
  })

  const handleProfileDelete = async (deletedProfileName: string) => {
    if (!app) {
      return
    }

    await removeProfile(deletedProfileName)
    if (profileMode === 'persistent' && profileName.trim() === deletedProfileName.trim()) {
      setProfileName('default')
    }
  }

  return (
    <RuntimePowerActionContext.Provider
      value={{
        app,
        appName: app?.name,
        canDeleteProfiles,
        canRunPrimary: viewState.canRunPrimary,
        dialogDisabled: viewState.dialogDisabled,
        isBusy: viewState.isBusy,
        isRecreatingAction: runtimeHandlers.actionPhase === 'recreating',
        isRestartingAction: runtimeHandlers.actionPhase === 'restarting',
        isRunningAction,
        isStoppingAction: runtimeHandlers.actionPhase === 'stopping',
        menuActions,
        menuDisabled: viewState.menuDisabled,
        open: startDialogOpen,
        primaryLabel: viewState.primaryLabel,
        primaryVariant: viewState.primaryVariant,
        profileMode,
        profileName,
        recreateDialogOpen: runtimeHandlers.recreateDialogOpen,
        restartDialogOpen,
        savedProfiles,
        stopDialogOpen,
        onModeChange: handleProfileModeChange,
        onNameChange: setProfileName,
        onOpenChange: setStartDialogOpen,
        onProfileDelete: handleProfileDelete,
        onPrimaryAction: runtimeHandlers.handlePrimaryAction,
        onRecreateConfirm: () => void runtimeHandlers.handleRecreate(),
        onRecreateDialogOpenChange: runtimeHandlers.setRecreateDialogOpen,
        onRestartConfirm: () => void runtimeHandlers.handleRestart(),
        onRestartDialogOpenChange: setRestartDialogOpen,
        onStart: () => void runtimeHandlers.handleProfileStart(),
        onStopConfirm: () => void runtimeHandlers.handleStopConfirm(),
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
