import { actionInputBinding, actionInputBindingType } from '@rebroid/automation-core/command-registry'
import { controlStepOutputs, unaryOperators } from '@rebroid/automation-core/metadata'
import { visitStepScopes } from '../tree/automation-step-tree'
import { parseStepInput } from './automation-step-utils'
import type { AutomationStepForm } from '../../editor/builder-utils'
import type { AutomationCommand } from '@/shared/contracts/automation'
import type {
  AutomationConditionExpression,
  AutomationStepOutputRef,
  AutomationValueRef,
  AutomationValueType
} from '@rebroid/automation-core/definition'

type StepReferenceIssue = { field: string; reference: AutomationStepOutputRef }

export type StepReferenceIssues = {
  step: AutomationStepForm
  id: string
  ancestors: string[]
  issues: StepReferenceIssue[]
}

export const collectStepReferenceIssues = (steps: AutomationStepForm[], commands?: readonly AutomationCommand[]) => {
  const commandByUses = new Map(commands?.map(command => [command.uses, command]))
  const affected = new Map<string, StepReferenceIssues>()
  visitStepScopes(steps, (step, id, scope, ancestors) => {
    const issues: StepReferenceIssue[] = []
    const check = (field: string, reference: AutomationValueRef | undefined, expectedType?: AutomationValueType) => {
      if (reference?.source !== 'stepOutput') return
      const stepId = reference.stepId.trim()
      const outputKey = reference.outputKey.trim()
      const source = scope.get(stepId)
      const outputs =
        source?.kind === 'action'
          ? commandByUses.get(source.uses)?.outputs
          : source && controlStepOutputs[`flow.${source.kind}`]
      const matchesOutput =
        !outputs || outputs.some(output => output.key === outputKey && (!expectedType || output.type === expectedType))
      if (stepId && outputKey && (!source || !matchesOutput)) {
        issues.push({ field, reference: { ...reference, stepId, outputKey } })
      }
    }
    const checkExpression = (expression: AutomationConditionExpression) => {
      expression.groups.forEach((group, groupIndex) => {
        group.conditions.forEach((rule, index) => {
          const label = `Group ${groupIndex + 1}, rule ${index + 1}`
          check(`${label} value`, rule.value)
          if (!unaryOperators.has(rule.operator)) check(`${label} comparison`, rule.compare)
        })
      })
    }

    switch (step.kind) {
      case 'action': {
        const properties = commandByUses.get(step.uses)?.inputSchema.properties
        for (const [key, input] of Object.entries(parseStepInput(step))) {
          const property: unknown =
            properties && typeof properties === 'object' ? Reflect.get(properties, key) : undefined
          check(`Source for ${key}`, actionInputBinding(input), actionInputBindingType(step.uses, key, property))
        }
        break
      }
      case 'condition':
        checkExpression(step.condition)
        break
      case 'switch':
        check('Switch value', step.value)
        break
      case 'repeat':
        if (step.mode === 'while') checkExpression(step.while)
        break
    }

    if (issues.length) affected.set(step.clientKey, { step, id, ancestors, issues })
  })
  return affected
}
