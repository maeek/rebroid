import { summarizeActionInput } from '../../actions/action-registry'
import { conditionOperatorLabel, valueRefLabel } from '../value-ref/automation-value-ref-utils'
import type { AutomationStepForm } from '../../editor/builder-utils'
import type { AutomationCommand } from '@/shared/contracts/automation'

export const parseStepInput = (step: AutomationStepForm): Record<string, unknown> => {
  if (step.kind !== 'action') return {}
  try {
    const parsed: unknown = JSON.parse(step.withJson || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export const stepTitle = (step: AutomationStepForm, command?: AutomationCommand) => {
  if (step.kind === 'condition') return 'Condition'
  if (step.kind === 'switch') return 'Switch'
  if (step.kind === 'repeat') return 'Repeat'
  return command?.label || step.uses
}

export const stepKindLabel = (step: AutomationStepForm) => {
  if (step.kind === 'action') return 'Action'
  if (step.kind === 'condition') return 'Condition'
  if (step.kind === 'switch') return 'Switch'
  return 'Repeat'
}

export const stepSummary = (step: AutomationStepForm) => {
  if (step.kind === 'condition') {
    const firstRule = step.condition.groups[0]?.conditions[0]
    if (firstRule) {
      return `${valueRefLabel(firstRule.value, [])} ${conditionOperatorLabel(firstRule.operator)}`
    }
    return 'Run a branch when the condition matches'
  }
  if (step.kind === 'switch') return `by ${valueRefLabel(step.value, [])}`
  if (step.kind === 'repeat') {
    return step.mode === 'count'
      ? `${step.count} ${step.count === 1 ? 'time' : 'times'}`
      : `while condition matches, max ${step.maxIterations}`
  }
  const input = parseStepInput(step)
  return summarizeActionInput(step.uses, input)
}
