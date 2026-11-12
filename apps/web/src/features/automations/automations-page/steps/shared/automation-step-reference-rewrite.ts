import { actionInputBinding } from '@rebroid/automation-core/command-registry'
import { mapAutomationSteps } from '../tree/automation-step-tree'
import { parseStepInput } from './automation-step-utils'
import type { AutomationStepForm } from '../../editor/builder-utils'
import type { AutomationConditionExpression, AutomationValueRef } from '@rebroid/automation-core/definition'

export const rewriteAutomationStepReferences = (
  steps: AutomationStepForm[],
  ids: ReadonlyMap<string, string>
): AutomationStepForm[] => {
  if (!ids.size) return steps
  const rewriteValue = <T extends AutomationValueRef>(value: T): T => {
    const stepId = value.source === 'stepOutput' ? ids.get(value.stepId) : undefined
    return stepId ? { ...value, stepId } : value
  }
  const rewriteExpression = (expression: AutomationConditionExpression): AutomationConditionExpression => ({
    groups: expression.groups.map(group => ({
      conditions: group.conditions.map(rule => ({
        ...rule,
        value: rewriteValue(rule.value),
        ...(rule.compare ? { compare: rewriteValue(rule.compare) } : {})
      }))
    }))
  })

  return mapAutomationSteps(steps, step => {
    switch (step.kind) {
      case 'condition':
        return { ...step, condition: rewriteExpression(step.condition) }
      case 'switch':
        return { ...step, value: rewriteValue(step.value) }
      case 'repeat':
        return { ...step, while: rewriteExpression(step.while) }
      case 'action': {
        const input = parseStepInput(step)
        let changed = false
        for (const [key, value] of Object.entries(input)) {
          const ref = actionInputBinding(value)
          if (!ref) continue
          const next = rewriteValue(ref)
          if (next === ref) continue
          input[key] = { $ref: next }
          changed = true
        }
        return changed ? { ...step, withJson: JSON.stringify(input, null, 2) } : step
      }
    }
  })
}
