import { controlStepOutputs } from '@rebroid/automation-core/metadata'
import { visitStepScopes } from '../tree/automation-step-tree'
import { stepTitle } from './automation-step-utils'
import type { AutomationStepForm } from '../../editor/builder-utils'
import type { AutomationStepReferenceOption } from '../value-ref/automation-value-ref-constants'
import type { AutomationCommand } from '@/shared/contracts/automation'

export const collectStepReferenceOptions = (
  steps: AutomationStepForm[],
  excludeClientKey: string,
  commandByUses: Map<string, AutomationCommand>
) => {
  let options: AutomationStepReferenceOption[] = []
  visitStepScopes(steps, (step, _id, scope) => {
    if (step.clientKey !== excludeClientKey) return false
    options = Array.from(scope, ([id, item]) => {
      const uses = item.kind === 'action' ? item.uses : `flow.${item.kind}`
      const command = item.kind === 'action' ? commandByUses.get(item.uses) : undefined
      return {
        id,
        label: stepTitle(item, command),
        uses,
        outputs: item.kind === 'action' ? (command?.outputs ?? []) : (controlStepOutputs[uses] ?? [])
      }
    })
    return true
  })
  return options
}
