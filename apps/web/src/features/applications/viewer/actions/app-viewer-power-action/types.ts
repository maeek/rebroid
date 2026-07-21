import type { ReactNode } from 'react'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationProfileMode } from '@/shared/contracts/application'
import type { loadSavedApplicationProfiles } from '@/shared/model/application-profile/profile-history'

export type RuntimeActionPhase = 'starting' | 'stopping' | 'restarting' | null

export type RuntimeMenuAction = {
  key: string
  label: string
  icon: ReactNode
  disabled: boolean
  onSelect: () => void
}

export type RuntimeActionRunner = (action: () => Promise<unknown>, title: string) => Promise<boolean>

export type SetActionPhase = (phase: RuntimeActionPhase) => void

export type SavedApplicationProfiles = ReturnType<typeof loadSavedApplicationProfiles>

export type SetSavedProfiles = (profiles: SavedApplicationProfiles) => void

export type RuntimePowerControlsProps = {
  app?: AppDefinition
  canRunPrimary: boolean
  isBusy: boolean
  isRunningAction: boolean
  menuActions: RuntimeMenuAction[]
  menuDisabled: boolean
  primaryVariant: 'primary' | 'secondary'
  primaryLabel: string
  primaryIcon: ReactNode
  onPrimaryAction: () => void
}

export type StartProfileDialogProps = {
  app?: AppDefinition
  open: boolean
  profileMode: ApplicationProfileMode
  profileName: string
  savedProfiles: SavedApplicationProfiles
  isRunningAction: boolean
  onOpenChange: (open: boolean) => void
  onModeChange: (mode: ApplicationProfileMode) => void
  onNameChange: (name: string) => void
  onStart: () => void
}

export type RuntimePowerDialogsProps = StartProfileDialogProps & {
  appName?: string
  dialogDisabled: boolean
  restartDialogOpen: boolean
  stopDialogOpen: boolean
  isRestartingAction: boolean
  isStoppingAction: boolean
  onRestartDialogOpenChange: (open: boolean) => void
  onStopDialogOpenChange: (open: boolean) => void
  onRestartConfirm: () => void
  onStopConfirm: () => void
}

export type PowerActionRuntimeHandlersOptions = {
  app?: AppDefinition
  canRestart: boolean
  canStart: boolean
  canStop: boolean
  canSwitchProfile: boolean
  profileMode: ApplicationProfileMode
  profileName: string
  runAction: RuntimeActionRunner
  setRestartDialogOpen: (open: boolean) => void
  setSavedProfiles: SetSavedProfiles
  setStartDialogOpen: (open: boolean) => void
  setStopDialogOpen: (open: boolean) => void
}
