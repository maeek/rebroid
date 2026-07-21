'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { AutomationStepForm } from '../../editor/builder-utils'
import type { AutomationCommand } from '@/shared/contracts/automation'

export type AutomationStepDropTarget = {
  listId: string
  index: number
} | null

interface AutomationStepsContextValue {
  rootSteps: AutomationStepForm[]
  commands: AutomationCommand[]
  commandByUses: Map<string, AutomationCommand>
  selectedStepKey: string | null
  openBlockKeys: string[]
  yamlStepKey: string | null
  dropTarget: AutomationStepDropTarget
  onSelectStep: (clientKey: string | null) => void
  onToggleBlock: (clientKey: string) => void
  onOpenBlock: (clientKey: string) => void
  onSetYamlStepKey: (clientKey: string | null) => void
  onListChange: (listId: string, steps: AutomationStepForm[]) => void
  onStepChange: (listId: string, index: number, step: AutomationStepForm) => void
  onMoveStep: (listId: string, stepId: string, offset: -1 | 1) => void
}

const AutomationStepsContext = createContext<AutomationStepsContextValue | null>(null)

export function AutomationStepsProvider({
  value,
  children
}: {
  value: AutomationStepsContextValue
  children: ReactNode
}) {
  return <AutomationStepsContext.Provider value={value}>{children}</AutomationStepsContext.Provider>
}

export function useAutomationStepsContext() {
  const context = useContext(AutomationStepsContext)
  if (!context) {
    throw new Error('useAutomationStepsContext must be used inside AutomationStepsProvider.')
  }

  return context
}
