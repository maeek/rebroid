import type { AutomationStepReferenceOption } from './automation-value-ref-constants'
import type { AutomationValueRef } from '@/server/orchestrator/automations/types'

export const defaultValueRef = (
  source: AutomationValueRef['source'],
  stepOptions: AutomationStepReferenceOption[]
): AutomationValueRef => {
  if (source === 'context') return { source, path: 'targetProfileName' }
  if (source === 'step') return { source, stepId: stepOptions[0]?.id ?? '', path: 'summary' }
  return { source, value: '' }
}

export const literalKind = (value: unknown): 'string' | 'number' | 'boolean' | 'null' => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'string'
}

export const defaultLiteralValue = (kind: 'string' | 'number' | 'boolean' | 'null') => {
  if (kind === 'number') return 0
  if (kind === 'boolean') return true
  if (kind === 'null') return null
  return ''
}

export const uniqueValues = (items: string[]) => [...new Set(items)]
