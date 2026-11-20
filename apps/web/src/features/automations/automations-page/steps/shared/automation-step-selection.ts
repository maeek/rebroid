import { nestedListsForStep } from '../tree/automation-step-tree'
import type { AutomationStepForm } from '../../editor/builder-utils'

export const collectSelectionKeys = (steps: AutomationStepForm[]) => {
  const stepKeys: string[] = []
  const blockKeys: string[] = []

  const visit = (items: AutomationStepForm[]) => {
    for (const step of items) {
      stepKeys.push(step.clientKey)
      if (step.kind !== 'action') blockKeys.push(step.clientKey)
      for (const branch of nestedListsForStep(step)) visit(branch.steps)
    }
  }

  visit(steps)
  return { stepKeys, blockKeys }
}

export const firstStepKey = (steps: AutomationStepForm[]) => steps[0]?.clientKey ?? null

export const selectionAfterDelete = (steps: AutomationStepForm[], deletedIndex: number) =>
  steps[deletedIndex + 1]?.clientKey ?? steps[deletedIndex - 1]?.clientKey ?? null
