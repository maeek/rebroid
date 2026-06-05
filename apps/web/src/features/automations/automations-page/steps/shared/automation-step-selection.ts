import type { AutomationStepForm } from '../../editor/builder-utils'

export const collectStepKeys = (steps: AutomationStepForm[]): string[] => {
  const keys: string[] = []

  const visit = (items: AutomationStepForm[]) => {
    for (const step of items) {
      keys.push(step.clientKey)
      if (step.kind === 'condition') {
        visit(step.thenSteps)
        visit(step.elseSteps)
      } else if (step.kind === 'switch') {
        step.cases.forEach(item => visit(item.steps))
        visit(step.defaultSteps)
      } else if (step.kind === 'repeat') {
        visit(step.steps)
      }
    }
  }

  visit(steps)
  return keys
}

export const collectBlockKeys = (steps: AutomationStepForm[]): string[] => {
  const keys: string[] = []

  const visit = (items: AutomationStepForm[]) => {
    for (const step of items) {
      if (step.kind !== 'action') keys.push(step.clientKey)
      if (step.kind === 'condition') {
        visit(step.thenSteps)
        visit(step.elseSteps)
      } else if (step.kind === 'switch') {
        step.cases.forEach(item => visit(item.steps))
        visit(step.defaultSteps)
      } else if (step.kind === 'repeat') {
        visit(step.steps)
      }
    }
  }

  visit(steps)
  return keys
}

export const firstStepKey = (steps: AutomationStepForm[]) => collectStepKeys(steps)[0] ?? null

export const selectionAfterDelete = (steps: AutomationStepForm[], deletedIndex: number) =>
  steps[deletedIndex + 1]?.clientKey ?? steps[deletedIndex - 1]?.clientKey ?? null
