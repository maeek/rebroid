import { forkAutomationStepScope } from '@rebroid/automation-core/definition'
import { controlStepOutputs } from '@rebroid/automation-core/metadata'
import type { AutomationStepForm } from '../../editor/builder-utils'
import type { AutomationStepReferenceOption } from '../value-ref/automation-value-ref-constants'
import type { AutomationCommand } from '@/shared/contracts/automation'

export const collectStepReferenceOptions = (
  steps: AutomationStepForm[],
  excludeClientKey: string,
  commandByUses: Map<string, AutomationCommand>
) => {
  const visit = (
    items: AutomationStepForm[],
    available: ReadonlyMap<string, AutomationStepReferenceOption>
  ): AutomationStepReferenceOption[] | undefined => {
    const scope = new Map(available)
    for (const item of items) {
      if (item.clientKey === excludeClientKey) return [...scope.values()]
      const id = item.id.trim()
      const uses = item.kind === 'action' ? item.uses : `flow.${item.kind}`
      const command = item.kind === 'action' ? commandByUses.get(item.uses) : undefined
      const option = {
        id,
        label: command?.label ?? stepLabel(item),
        uses,
        outputs: item.kind === 'action' ? (command?.outputs ?? []) : (controlStepOutputs[uses] ?? [])
      }
      if (item.kind !== 'action') {
        const childScope = forkAutomationStepScope(scope, { id, kind: item.kind, outputs: option })
        for (const branch of childBranches(item)) {
          const found = visit(branch, childScope)
          if (found) return found
        }
      }
      if (id) scope.set(id, option)
    }
  }

  return visit(steps, new Map()) ?? []
}

const childBranches = (step: AutomationStepForm): AutomationStepForm[][] => {
  switch (step.kind) {
    case 'condition':
      return [step.thenSteps, step.elseSteps]
    case 'switch':
      return [...step.cases.map(item => item.steps), step.defaultSteps]
    case 'repeat':
      return [step.steps]
    case 'action':
      return []
  }
}

const stepLabel = (step: AutomationStepForm) => {
  if (step.kind === 'action') return step.uses
  if (step.kind === 'condition') return 'Condition'
  if (step.kind === 'switch') return 'Switch'
  return 'Repeat'
}
