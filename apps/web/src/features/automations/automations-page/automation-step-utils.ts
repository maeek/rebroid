import { summarizeActionInput } from './actions/action-registry'
import { referenceDisplay, pixelToPercent, percentToPixel } from './actions/shared/coordinate-helpers'
import { numberInputValue, stringInputValue, booleanInputValue } from './actions/shared/input-values'
import type { AutomationStepForm } from './builder-utils'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

export { booleanInputValue, numberInputValue, percentToPixel, pixelToPercent, referenceDisplay, stringInputValue }

export const parseStepInput = (step: AutomationStepForm): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(step.withJson || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export const updateStepInput = (step: AutomationStepForm, patch: Record<string, unknown>): AutomationStepForm => ({
  ...step,
  withJson: JSON.stringify({ ...parseStepInput(step), ...patch }, null, 2)
})

export const replaceStepInput = (step: AutomationStepForm, input: Record<string, unknown>): AutomationStepForm => ({
  ...step,
  withJson: JSON.stringify(input, null, 2)
})

export const stepTitle = (step: AutomationStepForm, command?: AutomationCommand) => command?.label || step.uses

export const stepSummary = (step: AutomationStepForm) => {
  const input = parseStepInput(step)
  return summarizeActionInput(step.uses, input)
}
