import { controlStepOutputs } from '@rebroid/automation-core/metadata'
import type { AutomationStepForm } from '../../editor/builder-utils'
import type { AutomationStepReferenceOption } from '../value-ref/automation-value-ref-constants'
import type { AutomationCommand } from '@/shared/contracts/automation'

export const collectStepReferenceOptions = (
  steps: AutomationStepForm[],
  excludeClientKey: string,
  commandByUses: Map<string, AutomationCommand>
) => {
  const options: AutomationStepReferenceOption[] = []

  const visit = (items: AutomationStepForm[]): boolean => {
    for (const item of items) {
      if (item.clientKey === excludeClientKey) return true

      const id = item.id.trim()
      if (id) {
        const uses = item.kind === 'action' ? item.uses : `flow.${item.kind}`
        const command = item.kind === 'action' ? commandByUses.get(item.uses) : undefined
        options.push({
          id,
          label: command?.label ?? stepLabel(item),
          uses,
          outputs: item.kind === 'action' ? (command?.outputs ?? []) : (controlStepOutputs[uses] ?? [])
        })
      }

      if (item.kind === 'condition') {
        if (visit(item.thenSteps)) return true
        if (visit(item.elseSteps)) return true
      } else if (item.kind === 'switch') {
        for (const caseItem of item.cases) {
          if (visit(caseItem.steps)) return true
        }
        if (visit(item.defaultSteps)) return true
      } else if (item.kind === 'repeat') {
        if (visit(item.steps)) return true
      }
    }

    return false
  }

  visit(steps)
  return options
}

const stepLabel = (step: AutomationStepForm) => {
  if (step.kind === 'action') return step.uses
  if (step.kind === 'condition') return 'Condition'
  if (step.kind === 'switch') return 'Switch'
  return 'Repeat'
}
