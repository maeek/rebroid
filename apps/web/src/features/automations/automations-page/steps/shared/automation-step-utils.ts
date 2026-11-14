import { actionInputBinding } from '@rebroid/automation-core/command-registry'
import { automationActionPresentation } from '@/shared/model/workflow-action-presentation'
import { summarizeActionInput } from '../../actions/action-registry'
import { conditionOperatorLabel, needsCompareValue, valueRefLabel } from '../value-ref/automation-value-ref-utils'
import type { AutomationStepForm } from '../../editor/builder-utils'
import type { AutomationCommand } from '@/shared/contracts/automation'
import type { AutomationConditionExpression, AutomationValueRef } from '@rebroid/automation-core/definition'

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
  return automationActionPresentation[step.uses]?.[1] ?? (command?.label || step.uses)
}

const compareLabel = (value: AutomationValueRef) =>
  value.source === 'literal' ? (JSON.stringify(value.value) ?? 'unset') : valueRefLabel(value, [])

const summarizeCondition = (expression: AutomationConditionExpression, prefix: string) => {
  const rules = expression.groups.flatMap(group => group.conditions)
  const first = rules[0]
  if (!first) return 'No rules configured'
  const predicate = `${prefix} ${compareLabel(first.value)} ${conditionOperatorLabel(first.operator)}`
  const comparison = needsCompareValue(first.operator)
    ? ` ${first.compare ? compareLabel(first.compare) : '(unset)'}`
    : ''
  if (rules.length === 1) return predicate + comparison
  const remaining = rules.length - 1
  return `${predicate}${comparison} (${remaining} more ${remaining === 1 ? 'rule' : 'rules'})`
}

export const stepSummary = (step: AutomationStepForm) => {
  if (step.kind === 'condition') return summarizeCondition(step.condition, 'If')
  if (step.kind === 'switch') return `Match ${compareLabel(step.value)}`
  if (step.kind === 'repeat') {
    return step.mode === 'count'
      ? `${step.count} ${step.count === 1 ? 'time' : 'times'}`
      : `${summarizeCondition(step.while, 'While')} (up to ${step.maxIterations} iterations)`
  }
  const input = parseStepInput(step)
  for (const value of Object.values(input)) {
    const reference = actionInputBinding(value)
    if (reference) return `Uses ${reference.stepId} → ${reference.outputKey}`
  }
  return summarizeActionInput(step.uses, input)
}
