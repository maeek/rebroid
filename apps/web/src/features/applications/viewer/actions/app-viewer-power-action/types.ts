import type { ReactNode } from 'react'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationProfileMode } from '@/shared/contracts/application'

export type RuntimeActionPhase = 'starting' | 'stopping' | 'restarting' | 'recreating' | null

export type RuntimeMenuAction = {
  key: string
  label: string
  icon: ReactNode
  disabled: boolean
  onSelect: () => void
}

type RuntimeActionRunner = (action: () => Promise<unknown>, title: string) => Promise<boolean>

export type PowerActionRuntimeHandlersOptions = {
  app?: AppDefinition
  canSwitchProfile: boolean
  profileMode: ApplicationProfileMode
  profileName: string
  runAction: RuntimeActionRunner
  setRestartDialogOpen: (open: boolean) => void
  setStartDialogOpen: (open: boolean) => void
  setStopDialogOpen: (open: boolean) => void
}
