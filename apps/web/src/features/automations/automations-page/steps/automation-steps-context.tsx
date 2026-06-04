'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { AutomationStepForm } from '../editor/builder-utils'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

interface AutomationStepsContextValue {
  rootSteps: AutomationStepForm[]
  commands: AutomationCommand[]
  commandByUses: Map<string, AutomationCommand>
  expandedStepKeys: string[]
  onToggleStep: (clientKey: string) => void
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
