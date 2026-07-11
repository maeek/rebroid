'use client'

import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { useApplicationViewerContext } from '@/features/applications/detail/application-viewer-context'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import {
  getProfileDefaults,
  usePowerActionProfileState
} from '@/features/applications/viewer/actions/app-viewer-power-action/profile/profile-state'
import { usePowerActionRuntimeHandlers } from '@/features/applications/viewer/actions/app-viewer-power-action/runtime/runtime-actions'
import {
  getCanRestart,
  usePowerActionViewState
} from '@/features/applications/viewer/actions/app-viewer-power-action/runtime/runtime-view-state'
import { useAppViewerActionRunner } from '@/features/applications/viewer/actions/use-app-viewer-action-runner'
import { toast } from '@/hooks/use-toast'
import { deleteApplicationProfileAction } from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { loadSavedApplicationProfiles } from '@/shared/model/application-profile/profile-history'
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
  canDeleteProfiles: boolean
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
  primaryVariant: 'primary' | 'secondary'
  profileMode: ApplicationProfileMode
  profileName: string
  restartDialogOpen: boolean
  savedProfiles: SavedApplicationProfiles
  stopDialogOpen: boolean
  onModeChange: (mode: ApplicationProfileMode) => void
  onNameChange: (name: string) => void
  onOpenChange: (open: boolean) => void
  onProfileDelete: (profileName: string) => Promise<void>
  onPrimaryAction: () => void
  onRestartConfirm: () => void
  onRestartDialogOpenChange: (open: boolean) => void
  onStart: () => void
  onStopConfirm: () => void
  onStopDialogOpenChange: (open: boolean) => void
}

const RuntimePowerActionContext = createContext<RuntimePowerActionContextValue | null>(null)

export const RuntimePowerActionProvider = ({ children }: { children: ReactNode }) => {
  const { app, permissions, setApp } = useApplicationViewerContext()
  const canStart = hasPermission(permissions, 'applications:start')
  const canStop = hasPermission(permissions, 'applications:stop')
  const canSwitchProfile = hasPermission(permissions, 'applications:switch-profile')
  const canDeleteProfiles = hasPermission(permissions, 'applications:delete')
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

  const handleProfileDelete = async (deletedProfileName: string) => {
    if (!app) {
      return
    }

    try {
      const updated = mapAndroidApplicationToAppDefinition(
        await deleteApplicationProfileAction(app.id, deletedProfileName)
      )
      setApp(current => ({
        ...updated,
        icon: current?.icon ?? updated.icon,
        ownerDisplayName: current?.ownerDisplayName ?? updated.ownerDisplayName
      }))
      setSavedProfiles(loadSavedApplicationProfiles(updated.id, getProfileDefaults(updated), updated.savedProfiles))
      if (profileMode === 'persistent' && profileName.trim() === deletedProfileName.trim()) {
        setProfileName('default')
      }
      toast({ title: 'Profile removed', description: `${deletedProfileName} was deleted with its saved data.` })
    } catch (error) {
      toast({
        title: 'Could not remove profile',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
      throw error
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
        onProfileDelete: handleProfileDelete,
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
