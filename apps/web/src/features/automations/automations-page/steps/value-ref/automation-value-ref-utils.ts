import { operatorLabels, operatorsForType, runContextOutputs, unaryOperators } from '@rebroid/automation-core/metadata'
import type {
  AutomationReferenceOption,
  AutomationStepReferenceOption,
  LiteralKind
} from './automation-value-ref-constants'
import type {
  AutomationConditionOperator,
  AutomationCommandOutput,
  AutomationValueRef,
  AutomationValueType
} from '@rebroid/automation-core/definition'

export const referenceOptionId = (value: AutomationValueRef) => {
  if (value.source === 'runContext') return `context:${value.key}`
  if (value.source === 'stepOutput') return `step:${value.stepId}:${value.outputKey}`
  return ''
}

export const valueRefFromReferenceId = (id: string, references: AutomationReferenceOption[]): AutomationValueRef => {
  const selected = references.find(option => option.id === id)
  if (!selected || selected.value.source === 'runContext') {
    return { source: 'runContext', key: selected?.value.key ?? 'targetApplicationId' }
  }
  return {
    source: 'stepOutput',
    stepId: selected.value.stepId ?? '',
    outputKey: selected.value.outputKey ?? 'summary'
  }
}

export const buildReferenceOptions = (stepOptions: AutomationStepReferenceOption[]): AutomationReferenceOption[] => [
  ...runContextOutputs.map(output => ({
    id: `context:${output.key}`,
    label: output.label,
    group: 'Run context' as const,
    type: output.type,
    value: { source: 'runContext' as const, key: output.key }
  })),
  ...stepOptions.flatMap(step =>
    step.outputs.map(output => ({
      id: `step:${step.id}:${output.key}`,
      label: `${step.label} > ${output.label}`,
      group: 'Previous steps' as const,
      type: output.type,
      value: {
        source: 'stepOutput' as const,
        stepId: step.id,
        outputKey: output.key
      }
    }))
  )
]

export const outputForValueRef = (
  value: AutomationValueRef,
  stepOptions: AutomationStepReferenceOption[]
): AutomationCommandOutput | undefined => {
  if (value.source === 'runContext') return runContextOutputs.find(output => output.key === value.key)
  if (value.source === 'stepOutput') {
    return stepOptions.find(step => step.id === value.stepId)?.outputs.find(output => output.key === value.outputKey)
  }
  return undefined
}

export const typeForValueRef = (
  value: AutomationValueRef,
  stepOptions: AutomationStepReferenceOption[]
): AutomationValueType =>
  outputForValueRef(value, stepOptions)?.type ?? (value.source === 'literal' ? literalType(value.value) : 'unknown')

export const defaultOperatorForType = (type: AutomationValueType): AutomationConditionOperator =>
  operatorsForType(type)[0] ?? 'exists'

export const needsCompareValue = (operator: AutomationConditionOperator) => !unaryOperators.has(operator)

export const conditionOperatorLabel = (operator: AutomationConditionOperator) => operatorLabels[operator]

export const literalKind = (value: unknown): LiteralKind => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'string'
}

export const literalType = (value: unknown): AutomationValueType => {
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (value && typeof value === 'object') return 'object'
  return 'unknown'
}

export const defaultLiteralValue = (kind: LiteralKind) => {
  if (kind === 'number') return 0
  if (kind === 'boolean') return true
  if (kind === 'null') return null
  return ''
}

export const defaultCompareValue = (type: AutomationValueType): AutomationValueRef => {
  if (type === 'number' || type === 'array') return { source: 'literal', value: 0 }
  if (type === 'boolean') return { source: 'literal', value: true }
  return { source: 'literal', value: '' }
}

export const valueRefLabel = (value: AutomationValueRef, stepOptions: AutomationStepReferenceOption[]) => {
  if (value.source === 'literal') return literalLabel(value.value)
  if (value.source === 'runContext') {
    return runContextOutputs.find(output => output.key === value.key)?.label ?? value.key
  }
  const step = stepOptions.find(option => option.id === value.stepId)
  const output = step?.outputs.find(item => item.key === value.outputKey)
  return step && output ? `${step.label} > ${output.label}` : `${value.stepId} > ${value.outputKey}`
}

const literalLabel = (value: unknown) => {
  if (value === undefined || value === null || value === '') return 'empty'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return 'value'
  }
}
